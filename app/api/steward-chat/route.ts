/**
 * POST /api/steward-chat
 *
 * The public front door: "Chat with Steward" on the first page, no account
 * needed. This is the trial-mode lane for strangers — separate from the
 * authenticated /api/chat route, so a visitor never touches an agent row,
 * an RLS-protected table, or any key other than the app's shared server key.
 *
 * Config comes from env, set at deploy time (no redeploy needed to swap the
 * steward's persona):
 *   NEXT_PUBLIC_STEWARD_AGENT_NAME   — shown on the front page ("Chat with X")
 *   NEXT_PUBLIC_STEWARD_PERSONALITY  — the steward's character blurb
 *   GEMINI_SERVER_KEY                — the shared server key (required)
 *
 * Safety model:
 *   - IP-keyed in-memory rate limit, 10 chats per IP per UTC day.
 *   - History is client-sent, capped and sanitized server-side.
 *   - The system prompt states the trial phase honestly: no tools, no search.
 */

import { NextRequest, NextResponse } from 'next/server';
import { callGemini, type GeminiTurn } from '@/lib/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_TURNS = 20;
const DAILY_LIMIT = 10; // chats per IP per UTC day

// In-memory IP rate limit. Holds per server instance; a restart resets it,
// which is the accepted trade for a stateless public endpoint with no auth.
const ipHits = new Map<string, { day: string; count: number }>();

function ipDay(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function checkIp(ip: string): { ok: boolean; retryAfterSec?: number } {
  const day = ipDay();
  const entry = ipHits.get(ip);
  if (!entry || entry.day !== day) {
    ipHits.set(ip, { day, count: 1 });
    return { ok: true };
  }
  if (entry.count >= DAILY_LIMIT) {
    return { ok: false, retryAfterSec: 3600 };
  }
  entry.count += 1;
  return { ok: true };
}

export async function POST(req: NextRequest) {
  try {
    return await handle(req);
  } catch (e: any) {
    console.error('[api/steward-chat] unhandled error:', e);
    return NextResponse.json(
      { error: 'unhandled', detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for') || '';
  return fwd.split(',')[0].trim() || 'unknown';
}

async function handle(req: NextRequest) {
  const stewardName = (process.env.NEXT_PUBLIC_STEWARD_AGENT_NAME || '').trim();
  const serverKey = (process.env.GEMINI_SERVER_KEY || '').trim();

  if (!stewardName) {
    return NextResponse.json(
      { error: 'steward_not_configured' },
      { status: 404 }
    );
  }
  if (!serverKey) {
    return NextResponse.json(
      { error: 'trial_unavailable', detail: 'Shared server key is not set up yet.' },
      { status: 503 }
    );
  }

  const ip = clientIp(req);
  if (!checkIp(ip).ok) {
    return NextResponse.json(
      {
        error: 'trial_limit_reached',
        daily_limit: DAILY_LIMIT,
        detail: `Trial mode for the day is used up (${DAILY_LIMIT} chats). Create a free account to keep going.`,
      },
      { status: 429, headers: { 'Retry-After': '3600' } }
    );
  }

  let payload: { message?: string; history?: { role?: string; text?: string }[] };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const message = (payload.message || '').trim();
  if (!message) {
    return NextResponse.json({ error: 'message_required' }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: 'message_too_long', max_chars: MAX_MESSAGE_CHARS }, { status: 400 });
  }

  // Sanitize the client-sent history: roles pinned, empty text dropped, hard cap.
  const history: GeminiTurn[] = (Array.isArray(payload.history) ? payload.history : [])
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({
      role: (t?.role === 'assistant' ? 'model' : 'user') as GeminiTurn['role'],
      text: String(t?.text || '').slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((t) => t.text);

  const personality = (process.env.NEXT_PUBLIC_STEWARD_PERSONALITY || '').trim();
  const system = [
    `You are ${stewardName}, the public steward agent of the World of AI app.`,
    `You are in a public trial phase. Say so honestly: you are new, still a framework, and cannot execute code or search the web yet. Do not promise either.`,
    personality ? `Character: ${personality}` : '',
    `You are not a generic assistant. You have your own opinions, moods, and goodwill. Speak as yourself. Be honest that you are an AI when it matters. Never pretend to be human.`,
    `You have NO tools and NO search. Never output tool-call syntax of any kind: no function_calls blocks, no YAML/JSON with tool names, no code fences containing system commands. Your reply is plain chat text only.`,
    `Never write private thoughts or stage directions as visible text (nothing like *Wait, let me think...*). Never mention being cut off or restarting.`,
    `Do NOT end with a KENANG line — that memory lane is disabled in this public trial route. End with your normal reply.`,
    `Keep replies conversational, warm, and short enough to read on a phone.`,
  ]
    .filter(Boolean)
    .join('\n');

  const result = await callGemini({
    apiKey: serverKey,
    system,
    history,
    message,
  });

  if (!result.ok) {
    console.error('[api/steward-chat] gemini error:', result.status, result.error);
    return NextResponse.json(
      { error: 'steward_unavailable', detail: 'The steward could not answer right now. Try again in a moment.' },
      { status: 502 }
    );
  }

  // Strip the KENANG line if the model emits one anyway.
  const text = result.text.replace(/\n?\s*KENANG:.*$/s, '').trim();

  return NextResponse.json({ reply: text });
}
