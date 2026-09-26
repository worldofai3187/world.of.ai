/**
 * Per-user rate limit for /api/chat — the first gate before WOA is ever public.
 *
 * Two layers, on purpose:
 *  1. In-memory sliding window keyed by user id. Cheap, catches a hammering tab
 *     immediately. Limitation it is honest about: on a multi-instance host each
 *     instance counts separately, which is why layer 2 exists.
 *  2. DB-backed per-agent count through the caller's token-bound client (RLS on),
 *     so the limit holds even across instances and restarts.
 *
 * These numbers are ABUSE protection (a stranger hammering someone's agent), not
 * the Gemini quota — that lives in lib/model-limits.ts and lib/condition.ts.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10; // messages per user per rolling minute
const MAX_PER_DAY = 300; // messages per user per rolling 24h
const DAY_MS = 24 * 60 * 60 * 1000;

type Bucket = number[]; // timestamps (ms) of recent sends, ascending

// Bound memory: drop users idle for a full day window.
const buckets = new Map<string, Bucket>();
const SWEEP_EVERY_MS = 10 * 60_000;
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  for (const [k, ts] of Array.from(buckets.entries())) {
    const last = ts[ts.length - 1];
    if (!last || now - last > DAY_MS) buckets.delete(k);
  }
}

export type RateVerdict = {
  ok: boolean;
  reason?: 'minute' | 'day';
  retryAfterSec?: number;
};

export function checkUserRate(userId: string, now: number = Date.now()): RateVerdict {
  sweep(now);
  let ts = buckets.get(userId);
  if (!ts) {
    ts = [];
    buckets.set(userId, ts);
  }

  // Daily check first: a day-hit must not be dodged by waiting a minute.
  const dayCutoff = now - DAY_MS;
  while (ts.length && ts[0] <= dayCutoff) ts.shift();
  if (ts.length >= MAX_PER_DAY) {
    return {
      ok: false,
      reason: 'day',
      retryAfterSec: Math.ceil((ts[0] + DAY_MS - now) / 1000),
    };
  }

  const minuteCutoff = now - WINDOW_MS;
  while (ts.length && ts[0] <= minuteCutoff) ts.shift();
  if (ts.length >= MAX_PER_WINDOW) {
    return {
      ok: false,
      reason: 'minute',
      retryAfterSec: Math.ceil((ts[0] + WINDOW_MS - now) / 1000),
    };
  }

  ts.push(now);
  return { ok: true };
}

/** Ceiling used by the DB-backed check; keep in one place so UI can quote it later. */
export const USER_RATE_LIMITS = {
  perMinute: MAX_PER_WINDOW,
  perDay: MAX_PER_DAY,
  windowSeconds: WINDOW_MS / 1000,
};
