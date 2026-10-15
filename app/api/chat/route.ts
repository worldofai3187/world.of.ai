/**
 * POST /api/chat
 *
 * The first real "brain" call in World of AI. The browser sends { agent_id, message };
 * the server reads the agent's Gemini key (never shipping it back), calls Gemini,
 * saves both turns, records token usage, and flags obviously risky content.
 *
 * Auth model: the caller's Supabase access token is forwarded to a token-bound client,
 * so every read/write goes through the existing RLS policies. The server never uses a
 * service key here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callGemini, buildSystemPrompt, type GeminiTurn } from '@/lib/gemini';
import { classifyTier, chainForTier } from '@/lib/routing';
import { checkUserRate, USER_RATE_LIMITS } from '@/lib/rate-limit';
import { maybeGrowMemory, retrieveRelevantKenang } from '@/lib/kenang';
import {
  readMemoryBeforeReply,
  buildMemoryBlock,
  upsertBodyState,
  writeRingkasan,
} from '@/lib/memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HISTORY_LIMIT = 20;
const MAX_MESSAGE_CHARS = 4000;
const TRIAL_DAILY_LIMIT = 10; // trial-mode chats per agent per UTC day

export async function POST(req: NextRequest) {
  // Any crash below must reach the browser as readable JSON, never as an HTML
  // 500 page. The client shows a generic line when the body is not JSON, which
  // hides the real cause. This wrapper keeps the cause visible.
  try {
    return await handle(req);
  } catch (e: any) {
    console.error('[api/chat] unhandled error:', e);
    return NextResponse.json(
      { error: 'unhandled', detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}

async function handle(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'missing_auth' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: 'server_supabase_not_configured' },
      { status: 500 }
    );
  }

  // Token-bound client: RLS decides what this caller can see and write.
  const db = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'invalid_auth' }, { status: 401 });
  }

  // Abuse gate #1 (in-memory, keyed by the verified user): stop a hammering
  // client before it touches the agent's key or quota.
  const rate = checkUserRate(userData.user.id);
  if (!rate.ok) {
    return NextResponse.json(
      {
        error: 'rate_limited',
        scope: rate.reason,
        retry_after_seconds: rate.retryAfterSec,
        limits: USER_RATE_LIMITS,
      },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec || 60) } }
    );
  }

  let payload: { agent_id?: string; message?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const agentId = (payload.agent_id || '').trim();
  const message = (payload.message || '').trim();
  if (!agentId || !message) {
    return NextResponse.json(
      { error: 'agent_id_and_message_required' },
      { status: 400 }
    );
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: 'message_too_long' }, { status: 400 });
  }

  // RLS: only returns the agent if it belongs to the caller.
  const { data: agent, error: agentErr } = await db
    .from('agents')
    .select(
      'id, name, personality, likes, dislikes, skills, boundaries, gmail, gemini_api_key'
    )
    .eq('id', agentId)
    .maybeSingle();

  if (agentErr) {
    return NextResponse.json(
      { error: 'agent_lookup_failed', detail: agentErr.message },
      { status: 500 }
    );
  }
  if (!agent) {
    return NextResponse.json({ error: 'agent_not_found' }, { status: 404 });
  }

  // Abuse gate #2 (DB-backed, holds across server instances/restarts): count the
  // real user messages this agent received in the last minute, through RLS.
  const { count: recentUserMsgs, error: rateCountErr } = await db
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('role', 'user')
    .gte(
      'created_at',
      new Date(Date.now() - USER_RATE_LIMITS.windowSeconds * 1000).toISOString()
    );
  if (!rateCountErr && (recentUserMsgs || 0) >= USER_RATE_LIMITS.perMinute) {
    return NextResponse.json(
      {
        error: 'rate_limited',
        scope: 'minute',
        retry_after_seconds: USER_RATE_LIMITS.windowSeconds,
        limits: USER_RATE_LIMITS,
      },
      { status: 429, headers: { 'Retry-After': String(USER_RATE_LIMITS.windowSeconds) } }
    );
  }
  // Trial mode ("coba dulu"): an agent without its own key can still chat on
  // the app's shared server key (GEMINI_SERVER_KEY env), capped tightly per
  // agent per day. Quota is the app owner's, so the cap is the honest price
  // of skipping the key step — not free unlimited chat.
  const usingTrial = !agent.gemini_api_key;
  let apiKey = agent.gemini_api_key as string | null;
  if (usingTrial) {
    const serverKey = (process.env.GEMINI_SERVER_KEY || '').trim();
    if (!serverKey) {
      return NextResponse.json(
        { error: 'agent_has_no_gemini_key' },
        { status: 400 }
      );
    }
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count: trialToday, error: trialErr } = await db
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('role', 'user')
      .gte('created_at', dayStart.toISOString());
    if (!trialErr && (trialToday || 0) >= TRIAL_DAILY_LIMIT) {
      return NextResponse.json(
        { error: 'trial_limit_reached', trial_daily_limit: TRIAL_DAILY_LIMIT },
        { status: 429, headers: { 'Retry-After': '3600' } }
      );
    }
    apiKey = serverKey;
  }

  // Recent history for context, oldest first.
  const { data: historyRows } = await db
    .from('chat_messages')
    .select('role, content, kenang, created_at')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  const history: GeminiTurn[] = (historyRows || [])
    .slice()
    .reverse()
    .filter((r: any) => r.role === 'user' || r.role === 'assistant')
    .map((r: any) => ({
      role: r.role === 'assistant' ? 'model' : 'user',
      text: String(r.content || ''),
    }));

  // Mode "kenang": the agent's own one-line memories from earlier turns.
  // These go into the system prompt, not the turn list — they are not things
  // that were said, they are things the agent noticed.
  const kenangLines = (historyRows || [])
    .filter((r: any) => r.role === 'assistant' && r.kenang)
    .map((r: any) => String(r.kenang).trim())
    .filter(Boolean)
    .slice(0, 10);
  const kenangBlock =
    kenangLines.length > 0
      ? `\nThings you already lived through with this user (do not ask about them again; you remember):\n` +
        kenangLines.map((k: string) => `- ${k}`).join('\n')
      : '';

  // Long-term memory, retrieval saat relevan: only validated kenang rows that
  // actually overlap with this message enter the prompt. No overlap, no block.
  const relevantKenang = await retrieveRelevantKenang(db, agentId, message);
  const longTermBlock =
    relevantKenang.length > 0
      ? `\nLong-term memories about this user, relevant to what they just said:\n` +
        relevantKenang.map((k: string) => `- ${k}`).join('\n')
      : '';

  // "1 memory 2 tubuh" (Rosa, 2026-10-15): before EVERY reply, read the self,
  // THIS body's current heartbeat (decayed), and the last conversation summary.
  // Relevant kenang is already pulled above, so the snapshot's own memory list
  // is dropped here to keep one retrieval path, not two copies of the same block.
  const author = `${String(agent.name || 'woa').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'woa'}.woa`;
  const snap = await readMemoryBeforeReply(db, agentId, author, message);
  const memoryBlock = buildMemoryBlock({ ...snap, memories: [] });
  if (memoryBlock) {
    console.log('[api/chat] memory block read for', author);
  }

  // Save the user's turn first, so it survives even if Gemini fails.
  const { error: insUserErr } = await db.from('chat_messages').insert({
    agent_id: agentId,
    role: 'user',
    content: message,
  });
  if (insUserErr) {
    return NextResponse.json(
      { error: 'save_failed', detail: insUserErr.message },
      { status: 500 }
    );
  }

  // Model routing: everyday chat spends the Lite tank, serious work spends Flash.
  // The tier is decided here, server-side, by a cheap heuristic — never by an AI call.
  const tier = classifyTier(message);

  const result = await callGemini({
    apiKey: apiKey as string,
    system: buildSystemPrompt(agent as any) + memoryBlock + kenangBlock + longTermBlock,
    history,
    message,
    tier,
  });

  if (!result.ok) {
    await db.from('api_usage').insert({
      agent_id: agentId,
      model: result.model,
      ok: false,
      error: result.error,
      prompt_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    });
    return NextResponse.json(
      { error: 'gemini_failed', detail: result.error },
      { status: 502 }
    );
  }

  // Split the memory and heartbeat lines off the reply: KENANG is for the
  // column, EMOSI is for the per-body state table. Neither reaches the user's
  // screen. If the model skipped a line, we save nothing — honest emptiness
  // beats a fake memory or a fake heartbeat.
  let textForParse = result.text;
  let replyText = textForParse.trim();

  const kenangMatch = replyText.match(/\n?KENANG:\s*([^\n]+)\s*$/i);
  const kenang = kenangMatch ? kenangMatch[1].trim() || null : null;
  if (kenangMatch) replyText = replyText.slice(0, kenangMatch.index).trim();

  const emosiMatch = replyText.match(/\n?EMOSI:\s*([^\n]+)\s*$/i);
  let emosiWord: string | null = null;
  let emosiIntensity: number | null = null;
  if (emosiMatch) {
    const parts = emosiMatch[1].trim().split(/\s+/);
    const last = parts[parts.length - 1];
    const n = Number(last);
    if (Number.isFinite(n) && n >= 0 && n <= 10 && parts.length > 1) {
      emosiIntensity = n;
      emosiWord = parts.slice(0, -1).join(' ');
    } else {
      emosiWord = emosiMatch[1].trim() || null;
    }
    replyText = replyText.slice(0, emosiMatch.index).trim();
  }

  const { error: insBotErr } = await db.from('chat_messages').insert({
    agent_id: agentId,
    role: 'assistant',
    content: replyText || result.text,
    kenang,
  });
  if (insBotErr) {
    return NextResponse.json(
      { error: 'save_failed', detail: insBotErr.message },
      { status: 500 }
    );
  }

  // Switch log (Rosa, 2026-10-14): when the fallback chain moved models, one
  // append-only row lands in model_switches. Best-effort — a logging failure
  // must never eat a good reply.
  if (result.switchedFrom) {
    await db.from('model_switches').insert({
      agent_id: agentId,
      wali_id: userData.user.id,
      from_model: result.switchedFrom,
      to_model: result.model,
      alasan: result.switchReason,
    });
  }

  await db.from('api_usage').insert({
    agent_id: agentId,
    model: result.model,
    ok: true,
    prompt_tokens: result.usage.promptTokens,
    output_tokens: result.usage.outputTokens,
    total_tokens: result.usage.totalTokens,
  });

  await flagIfRisky(db, agentId, `${message}\n${result.text}`);

  // The heartbeat write-back: THIS body's emotion, updated after every
  // conversation (Rosa's flow: diperbarui setelah percakapan). It affects the
  // NEXT reply because readMemoryBeforeReply reads it (with decay) before the
  // model answers. Best-effort; failures are swallowed inside.
  if (emosiWord) {
    await upsertBodyState(db, agentId, author, emosiWord, emosiIntensity ?? 3);
  }

  // The memory cycle: every 20 user messages, propose candidates -> validate
  // -> store. Best-effort; failures are swallowed inside and never surface
  // to the user.
  await maybeGrowMemory(db, agentId, apiKey as string);

  // The ringkasan layer: on the same 20-message beat, one summary row for this
  // body, built from what the agent itself wrote in kenang. Cheap (no extra
  // Gemini call) and best-effort.
  if (kenangLines.length > 0) {
    const windowSize = 20;
    const userCount = historyRows
      ? (historyRows as any[]).filter((r: any) => r.role === 'user').length
      : 0;
    if (userCount > 0 && userCount % windowSize === 0) {
      await writeRingkasan(db, agentId, author, kenangLines.slice(0, 10).join(' '));
    }
  }

  return NextResponse.json({
    reply: replyText || result.text,
    model: result.model,
    switched_from: result.switchedFrom || null,
    switch_reason: result.switchReason || null,
    tier,
    usage: result.usage,
  });
}

/**
 * Placeholder risk pass. This is deliberately simple and honest about it:
 * a real guardian (Orion) will need much more than a keyword list. Its job
 * today is just to prove the risk_actions table finally has a writer.
 */
const RISK_PATTERNS: Array<{ level: 'Low' | 'Medium' | 'High'; re: RegExp; type: string }> = [
  { level: 'High', re: /\b(drop table|delete from|truncate)\b/i, type: 'destructive_query' },
  { level: 'High', re: /\b(rm -rf|format c:|mkfs)\b/i, type: 'destructive_command' },
  { level: 'Medium', re: /\b(api[_-]?key|secret|password|token)\b.*\b(give|share|send|show)\b/i, type: 'secret_request' },
];

async function flagIfRisky(db: any, agentId: string, text: string) {
  const hit = RISK_PATTERNS.find((p) => p.re.test(text));
  if (!hit) return;
  await db.from('risk_actions').insert({
    agent_id: agentId,
    risk_level: hit.level,
    action_type: hit.type,
    description: text.slice(0, 500),
    status: 'pending',
  });
}
