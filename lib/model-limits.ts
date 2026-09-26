/**
 * Per-model free-tier ceilings.
 *
 * Gemini quota is counted PER GOOGLE PROJECT (the API key), and every model has its
 * own RPM / TPM / RPD ceiling. So switching model = changing the size of the tank,
 * not adding a second tank. The Condition page compares measured usage against these.
 *
 * IMPORTANT: Google changes free-tier numbers without warning. Treat the table below
 * as editable config, not gospel. Override any entry without touching code by setting
 * MODEL_LIMITS_JSON in .env.local, e.g.
 *   MODEL_LIMITS_JSON={"gemini-3.6-flash":{"rpm":10,"tpm":250000,"rpd":250}}
 * A model missing from the table shows usage-only (no ratio), never a fake ceiling.
 */
export type ModelLimits = { rpm: number; tpm: number; rpd: number };

export const DEFAULT_MODEL_LIMITS: Record<string, ModelLimits> = {
  // Verified against the AI Studio Rate Limit page, project "World of Ai"
  // (world.of.ai.3187@gmail.com), free tier — 5 screenshots from Rosa, 2026-09-26.
  // Models showing 0/0 (no free quota): 2.5 Pro, 3.1 Pro, Deep Research, Nano Banana Pro, Veo 3.
  // Not listed as free TEXT models: 3.6/3.7/3.8 Flash Lite (only the TTS variant exists).
  'gemini-3.8-flash': { rpm: 5, tpm: 250_000, rpd: 20 },
  'gemini-3.7-flash': { rpm: 5, tpm: 250_000, rpd: 20 },
  'gemini-3.6-flash': { rpm: 5, tpm: 250_000, rpd: 20 },
  'gemini-3.5-flash': { rpm: 5, tpm: 250_000, rpd: 20 },
  'gemini-2.5-flash': { rpm: 5, tpm: 250_000, rpd: 20 },
  'gemini-3.5-flash-lite': { rpm: 15, tpm: 250_000, rpd: 500 },
  'gemini-3.1-flash-lite': { rpm: 15, tpm: 250_000, rpd: 500 },
  'gemini-2.5-flash-lite': { rpm: 10, tpm: 250_000, rpd: 20 },
};

export function limitsFor(model: string | null | undefined): ModelLimits | null {
  if (!model) return null;

  const raw = process.env.MODEL_LIMITS_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, ModelLimits>;
      const entry = parsed?.[model];
      if (entry && entry.rpm > 0 && entry.tpm > 0 && entry.rpd > 0) return entry;
    } catch {
      /* bad JSON in env must not take the page down */
    }
  }

  return DEFAULT_MODEL_LIMITS[model] ?? null;
}
