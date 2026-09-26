/**
 * lib/kenang.ts — Orion's long-term memory, phase 1.
 *
 * The cycle (Rosa's design, 2026-09-26):
 *   conversation -> identify what is worth remembering -> memory candidate
 *   -> validation -> storage -> retrieval when relevant -> new experience.
 *
 * Memory is NOT a copy of the conversation. It is a summary of information or
 * experience considered meaningful for the future. Chit-chat, greetings, and
 * small talk never become memories.
 *
 * Mechanics:
 *  - Every KENANG_EVERY (20) user messages, the last window of the
 *    conversation is summarized by ONE extra Gemini call (lite tier) into 0-5
 *    candidate memories.
 *  - Each candidate then passes a SECOND Gemini call (the validation pass).
 *    Passing -> status 'tervalidasi'. Failing -> the row is deleted.
 *    Validation is deliberately a separate call: the same call that proposes
 *    a memory should not also be the one that blesses it.
 *  - Retrieval is keyword-overlap scoring over validated rows (no pgvector in
 *    phase 1). Only memories that actually share content words with the user's
 *    message get into the system prompt. No match, no memory block — the
 *    agent does not recite its diary on every chat.
 *
 * Failures here never break the chat: every function returns quietly on error
 * and the caller ignores the result. A broken memory is a degraded memory,
 * not a broken conversation.
 */

import { callGemini, type GeminiTurn } from '@/lib/gemini';

export const KENANG_EVERY = 20; // summarize after every N user messages
export const KENANG_MAX_RETAINED = 50; // cap per agent+user; oldest kandidat evicted first

type Db = any;

const SUMMARIZE_SYSTEM = `You are the memory module of an AI agent. You read a window of a conversation between the agent and its user, and you decide what is WORTH REMEMBERING for the future.

Rules:
- Extract only: facts about the user (name, job, family, plans), stable preferences (likes, dislikes, how they want to be treated), and significant shared events or decisions.
- NEVER extract greetings, small talk, jokes, questions the agent already answered in the visible history, or anything transient.
- Each memory is ONE short sentence (max 20 words), written in English, from the AGENT's point of view, third person about the user (e.g. "The user is studying to become a nurse").
- If nothing in the window is worth remembering, return an empty list.
- Return ONLY a JSON array of strings, nothing else. Example: ["The user has a sister named Dewi","The user dislikes being called bro"]`;

const VALIDATE_SYSTEM = `You are the validation module of an AI agent's memory. You will be given one candidate memory and the conversation window it came from.

Validate strictly:
- KEEP only if the window actually supports it, it is about the user or a shared event, and it will still matter in future conversations.
- DROP if it is chit-chat, a guess, unsupported by the window, transient, or a copy of something visible in recent history.
- Answer with exactly one word: KEEP or DROP.`;

const STOPWORDS = new Set(
  ('yang dan di ke dari untuk dengan ini itu apa sih kah the a an of to is are was i you he she it we they my your ' +
    'aku kamu dia kita saya tidak bukan sudah belum akan bisa mau ingin gimana bagus okay oke ya nggak gak')
    .split(/\s+/)
);

/** Count user messages so we know when the 20-message window is full. */
export async function countUserMessages(db: Db, agentId: string): Promise<number> {
  const { count, error } = await db
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('role', 'user');
  if (error) return 0;
  return count || 0;
}

/** The last N user messages plus the assistant replies between them. */
async function conversationWindow(db: Db, agentId: string, n: number) {
  const { data } = await db
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(n * 2 + 5); // user turns + their replies, roughly
  return (data || []).slice().reverse();
}

function parseCandidateList(text: string): string[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s: any) => typeof s === 'string')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 8 && s.length < 300)
      .slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * The candidate -> validation -> storage cycle. Call after every successful
 * chat reply; it internally decides whether the 20-message threshold is hit.
 */
export async function maybeGrowMemory(
  db: Db,
  agentId: string,
  apiKey: string
): Promise<void> {
  try {
    const total = await countUserMessages(db, agentId);
    if (total === 0 || total % KENANG_EVERY !== 0) return;

    // Don't double-run: if a candidate was created after the previous user
    // message in this same window, skip.
    const { data: recent } = await db
      .from('kenang')
      .select('created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(1);
    const { count: usersSince, error: cntErr } = await db
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('role', 'user')
      .gte('created_at', recent?.[0]?.created_at || '1970-01-01');
    if (!cntErr && (usersSince || 0) < KENANG_EVERY) return;

    const window = await conversationWindow(db, agentId, KENANG_EVERY);
    if (window.length < 4) return;
    const transcript = (window as any[])
      .map((m) => `${m.role === 'user' ? 'USER' : 'AGENT'}: ${String(m.content || '')}`)
      .join('\n')
      .slice(-12000);

    // 1. Candidate proposal.
    const propose = await callGemini({
      apiKey,
      system: SUMMARIZE_SYSTEM,
      history: [] as GeminiTurn[],
      message: `Conversation window:\n\n${transcript}\n\nReturn the JSON array of memories worth keeping, or [].`,
      tier: 'lite',
    });
    if (!propose.ok) return;
    const candidates = parseCandidateList(propose.text);
    if (candidates.length === 0) return;

    // 2. Validation pass, one call per candidate (cheap, lite tier).
    for (const c of candidates) {
      const verdict = await callGemini({
        apiKey,
        system: VALIDATE_SYSTEM,
        history: [] as GeminiTurn[],
        message: `Candidate memory: "${c}"\n\nConversation window:\n\n${transcript.slice(-6000)}\n\nKEEP or DROP?`,
        tier: 'lite',
      });
      const kept = verdict.ok && /\bKEEP\b/i.test(verdict.text.slice(0, 40));
      if (!kept) continue; // failed candidates are simply not stored
      await db.from('kenang').insert({
        agent_id: agentId,
        isi: c,
        status: 'tervalidasi',
        validated_at: new Date().toISOString(),
      });
    }

    await evictOverflow(db, agentId);
  } catch {
    // Memory is best-effort; never break the chat on its behalf.
  }
}

/** Hard cap per agent; oldest rows go first. */
async function evictOverflow(db: Db, agentId: string) {
  const { data } = await db
    .from('kenang')
    .select('id')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .range(KENANG_MAX_RETAINED, KENANG_MAX_RETAINED + 200);
  const overflow = data || [];
  if (overflow.length === 0) return;
  await db.from('kenang').delete().in('id', overflow.map((r: any) => r.id));
}

function contentWords(text: string): string[] {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Retrieval saat relevan: validated memories that share content words with
 * the user's message. No overlap -> empty array -> no memory block in the
 * prompt at all.
 */
export async function retrieveRelevantKenang(
  db: Db,
  agentId: string,
  userMessage: string,
  limit = 8
): Promise<string[]> {
  try {
    const { data } = await db
      .from('kenang')
      .select('isi, created_at')
      .eq('agent_id', agentId)
      .eq('status', 'tervalidasi')
      .order('created_at', { ascending: false })
      .limit(KENANG_MAX_RETAINED);
    if (!data || data.length === 0) return [];

    const msgWords = new Set(contentWords(userMessage));
    if (msgWords.size === 0) return [];

    const scored = (data as any[])
      .map((r) => {
        const words = contentWords(r.isi);
        const hits = words.filter((w) => msgWords.has(w)).length;
        return { isi: String(r.isi), score: hits };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.isi);
    return scored;
  } catch {
    return [];
  }
}
