/**
 * Model routing: pick the SIZE of the brain before spending it.
 *
 * Rosa's design (2026-09-26): everyday chat runs on the Lite model — its quota is
 * much larger and it is faster — while serious, thinking-heavy chats go up to the
 * full Flash model. The Flash RPD tank is tiny (20/day on this project), so it is
 * reserved for work that actually needs it.
 *
 * The classifier is deliberately a heuristic, not an AI call: spending a model to
 * choose a model is exactly the waste this file exists to prevent.
 *
 * Escalation is free: if the Lite chain fails (wrong id, quota full), lib/gemini.ts
 * already walks down to the Flash models. Downgrading after the fact is impossible
 * — which is the right direction to be wrong in.
 */

export type ModelTier = 'lite' | 'deep';

/** Ordered lite chain. Unknown/retired ids are tolerated by the fallback walk. */
export const LITE_MODELS = [
  'gemini-3.6-flash-lite',
  'gemini-2.5-flash-lite',
];

/** Signals that a message deserves the full Flash brain. */
/** Signals that a message deserves the full Flash brain (analysis, code, debugging).
 *  Storytelling and small talk stay on Lite — Rosa's split, 2026-09-26. */
const DEEP_SIGNALS: RegExp[] = [
  /\b(jelaskan|analisis|analisa|bandingkan|evaluasi|kenapa|mengapa|gimana caranya|bagaimana caranya|buatkan|rancang|resep kode|debug|error|stack trace|refactor)\b/i,
  /\b(explain|analyze|compare|why|how do i|how to|design|write a|create a|debug|refactor|code|script)\b/i,
  /```/,
  /\n.{20,}\n.{20,}/, // three or more substantial lines = structured thought
];

const DEEP_MIN_CHARS = 280;

export function classifyTier(message: string): ModelTier {
  const text = message.trim();
  if (text.length >= DEEP_MIN_CHARS) return 'deep';
  if (DEEP_SIGNALS.some((re) => re.test(text))) return 'deep';
  return 'lite';
}

/**
 * The ordered model chain for this turn. Deep = the existing Flash-first chain.
 * Lite = the Lite models first, falling back to Flash so a wrong/retired lite id
 * or an empty lite tank still produces an answer instead of an error.
 */
export function chainForTier(tier: ModelTier, flashModels: string[]): string[] {
  if (tier === 'deep') return flashModels;
  return [...LITE_MODELS, ...flashModels];
}
