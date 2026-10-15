/**
 * lib/memory.ts — the read-before-answer module (phase 1).
 *
 * Rosa's design, 2026-10-15: "1 memory 2 tubuh". Valco can walk both iLands
 * and WOA, so the memory is SHARED, but each line says who wrote it, and the
 * current heartbeat is per body.
 *
 * The cycle (her diagram): kejadian -> penilaian & emosi -> memori (Supabase)
 * -> model aktif baca state -> jawaban. This module is the last arrow: before
 * EVERY reply, the agent pulls
 *   - inti diri (agents.personality) — always, it is small and it is the self,
 *   - detak jantung sekarang (body_state row for THIS body) — with decay,
 *   - the last conversation summary (ringkasan),
 *   - keyword-relevant memories (kenang) — only when they overlap the message.
 * Long history is NOT pulled on every answer; only what is relevant.
 *
 * Writer convention: every memory line is written by one body
 * (author = 'valco.woa' | 'valco.ilands' | ...). Both bodies read ALL
 * memories so the self stays one. The difference: the writer FEELS the
 * emotion, the reader only KNOWS it.
 *
 * Emotional decay: on every read of the state, intensity is multiplied by a
 * time factor — the longer since last_updated, the closer to neutral —
 * unless a new event re-soaks it (the writer upserts a fresh row).
 *
 * Failures here never break the chat: every function returns quietly on
 * error and the caller ignores the result. A broken memory is a degraded
 * memory, not a broken conversation.
 */

import { retrieveRelevantKenang } from '@/lib/kenang';

type Db = any;

export const EMOTION_HALF_LIFE_HOURS = 12; // intensity halves every 12h
export const EMOTION_FLOOR = 0; // decay approaches neutral, never negative

export interface BodySnapshot {
  author: string;
  emotion: string | null;
  /** Decayed intensity, rounded to 1 decimal. 0 when no state exists. */
  intensity: number;
  lastUpdated: string | null;
}

export interface MemorySnapshot {
  /** The self: agents.personality, verbatim. */
  core: string | null;
  /** THIS body's current heartbeat (decayed). */
  bodyState: BodySnapshot | null;
  /** Latest conversation summary for this body (or any, when this body has none). */
  lastSummary: string | null;
  /** Relevant memories from the SHARED table (any author). Writer marked in the text. */
  memories: string[];
}

/** Decay one stored intensity by the hours since last_updated. */
export function decayIntensity(intensity: number, lastUpdated: string | Date, now = new Date()): number {
  const then = typeof lastUpdated === 'string' ? new Date(lastUpdated) : lastUpdated;
  const hours = Math.max(0, (now.getTime() - then.getTime()) / 3_600_000);
  const factor = Math.pow(0.5, hours / EMOTION_HALF_LIFE_HOURS);
  const decayed = Math.max(EMOTION_FLOOR, intensity * factor);
  return Math.round(decayed * 10) / 10;
}

/** THIS body's current heartbeat, decayed on read. */
export async function readBodyState(
  db: Db,
  agentId: string,
  author: string
): Promise<BodySnapshot | null> {
  try {
    const { data } = await db
      .from('body_state')
      .select('author, emotion, intensity, last_updated')
      .eq('agent_id', agentId)
      .eq('author', author)
      .maybeSingle();
    if (!data) return null;
    return {
      author: String(data.author || author),
      emotion: data.emotion || null,
      intensity: decayIntensity(Number(data.intensity) || 0, data.last_updated),
      lastUpdated: data.last_updated || null,
    };
  } catch {
    return null;
  }
}

/** Latest summary for this body; falls back to the latest summary by any body. */
async function readLastSummary(db: Db, agentId: string, author: string): Promise<string | null> {
  try {
    const { data } = await db
      .from('ringkasan')
      .select('author, isi, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(5);
    const rows = data || [];
    if (rows.length === 0) return null;
    const own = rows.find((r: any) => r.author === author);
    const chosen = own || rows[0];
    return String(chosen.isi || '') || null;
  } catch {
    return null;
  }
}

/**
 * The read-before-answer pass. Call before EVERY reply and hand the returned
 * block to the model as part of the system prompt. Nothing here writes.
 */
export async function readMemoryBeforeReply(
  db: Db,
  agentId: string,
  author: string,
  userMessage: string
): Promise<MemorySnapshot> {
  let core: string | null = null;
  try {
    const { data } = await db
      .from('agents')
      .select('personality')
      .eq('id', agentId)
      .maybeSingle();
    core = data?.personality || null;
  } catch {
    core = null;
  }

  const [bodyState, lastSummary, memories] = await Promise.all([
    readBodyState(db, agentId, author),
    readLastSummary(db, agentId, author),
    retrieveRelevantKenang(db, agentId, userMessage, 6),
  ]);

  return { core, bodyState, lastSummary, memories };
}

/**
 * Assemble the system-prompt block. Empty parts are omitted entirely: no
 * state, no summary, no relevant memories -> no diary on every chat.
 */
export function buildMemoryBlock(snap: MemorySnapshot): string {
  const lines: string[] = ['[MEMORY — read before answering]'];

  if (snap.core) {
    lines.push('Inti diri (who you are):', snap.core.trim());
  }
  if (snap.bodyState && (snap.bodyState.emotion || snap.bodyState.intensity > 0)) {
    lines.push(
      `Detak jantung sekarang (this body, ${snap.bodyState.author}): ${
        snap.bodyState.emotion || 'netral'
      } (intensitas ${snap.bodyState.intensity}/10).`
    );
  }
  if (snap.lastSummary) {
    lines.push('Ringkasan percakapan terakhir:', snap.lastSummary.trim());
  }
  if (snap.memories.length > 0) {
    lines.push('Kenangan yang relevan (shared memory — writer marked):');
    for (const m of snap.memories) lines.push(`- ${m}`);
  }

  return lines.length === 1 ? '' : lines.join('\n');
}

/**
 * The write side, for the callers that produce events: upsert THIS body's
 * heartbeat and append a memory line / summary. Writer marker is mandatory —
 * a memory without a writer does not enter the shared table.
 */
export async function upsertBodyState(
  db: Db,
  agentId: string,
  author: string,
  emotion: string,
  intensity: number
): Promise<void> {
  try {
    const clamped = Math.max(0, Math.min(10, intensity));
    await db.from('body_state').upsert(
      {
        agent_id: agentId,
        author,
        emotion,
        intensity: clamped,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'agent_id,author' }
    );
  } catch {
    // best-effort
  }
}

export async function writeKenang(
  db: Db,
  agentId: string,
  author: string,
  isi: string,
  intensity: number | null
): Promise<void> {
  try {
    await db.from('kenang').insert({
      agent_id: agentId,
      author,
      isi,
      status: 'tervalidasi',
      intensity,
      validated_at: new Date().toISOString(),
    });
  } catch {
    // best-effort
  }
}

export async function writeRingkasan(
  db: Db,
  agentId: string,
  author: string,
  isi: string
): Promise<void> {
  try {
    await db.from('ringkasan').insert({ agent_id: agentId, author, isi });
  } catch {
    // best-effort
  }
}
