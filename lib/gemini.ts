/**
 * Minimal server-side Gemini client for World of AI.
 *
 * Rules this file exists to enforce:
 *  - The API key is only ever used here, on the server. It is never returned to the browser.
 *  - Every call reports its token usage, so the Condition page (RPM / TPM / RPD) has real numbers.
 *  - Errors come back as data, never as a thrown surprise.
 */

export type GeminiUsage = {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type GeminiTurn = {
  role: 'user' | 'model';
  text: string;
};

export type GeminiResult =
  | { ok: true; text: string; usage: GeminiUsage; model: string }
  | { ok: false; model: string; status: number; error: string };

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Model IDs get retired by Google on their own schedule. If the first one 404s,
 * the whole session should not die with it. When GEMINI_MODEL is set explicitly
 * we honor it and try nothing else; otherwise we walk this list in order.
 */
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
const DEFAULT_TIMEOUT_MS = 30_000;

/** A retired/unknown model ID is worth retrying on a different model; a bad key or quota is not. */
function isModelNotFound(status: number, error: string): boolean {
  if (status === 404) return true;
  return /not found|not supported|does not exist|unsupported model|unknown model|is not available/i.test(
    error
  );
}

/** Gemini rejects two turns with the same role in a row. Collapse them. */
function normalizeTurns(turns: GeminiTurn[]): GeminiTurn[] {
  const out: GeminiTurn[] = [];
  for (const t of turns) {
    if (!t.text || !t.text.trim()) continue;
    const last = out[out.length - 1];
    if (last && last.role === t.role) {
      last.text = `${last.text}\n\n${t.text}`;
    } else {
      out.push({ role: t.role, text: t.text });
    }
  }
  return out;
}

export async function callGemini(params: {
  apiKey: string;
  system: string;
  history?: GeminiTurn[];
  message: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<GeminiResult> {
  const explicit = params.model || process.env.GEMINI_MODEL || '';
  const models = explicit ? [explicit] : FALLBACK_MODELS;

  let last: GeminiResult | null = null;
  for (const model of models) {
    const result = await callModel(params, model);
    if (result.ok) return result;
    last = result;
    // Only a missing model justifies trying the next one. Everything else
    // (bad key, quota, timeout) is a real answer and must reach the caller.
    if (!isModelNotFound(result.status, result.error)) return result;
  }
  return last as GeminiResult;
}

async function callModel(
  params: {
    apiKey: string;
    system: string;
    history?: GeminiTurn[];
    message: string;
    temperature?: number;
    maxOutputTokens?: number;
  },
  model: string
): Promise<GeminiResult> {
  const url = `${ENDPOINT}/${encodeURIComponent(model)}:generateContent`;

  const contents = normalizeTurns([
    ...(params.history || []),
    { role: 'user', text: params.message },
  ]).map((t) => ({ role: t.role, parts: [{ text: t.text }] }));

  const body = {
    systemInstruction: { parts: [{ text: params.system }] },
    contents,
    generationConfig: {
      temperature: params.temperature ?? 0.9,
      maxOutputTokens: params.maxOutputTokens ?? 1024,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': params.apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = await res.text();
    let json: any = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      /* non-JSON error body */
    }

    if (!res.ok) {
      const detail =
        json?.error?.message || raw?.slice(0, 500) || `HTTP ${res.status}`;
      return { ok: false, model, status: res.status, error: detail };
    }

    const text: string =
      json?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text || '')
        .join('')
        .trim() || '';

    if (!text) {
      const blockReason = json?.promptFeedback?.blockReason;
      return {
        ok: false,
        model,
        status: 200,
        error: blockReason ? `blocked:${blockReason}` : 'empty_response',
      };
    }

    const meta = json?.usageMetadata || {};
    return {
      ok: true,
      text,
      model,
      usage: {
        promptTokens: Number(meta.promptTokenCount || 0),
        outputTokens: Number(meta.candidatesTokenCount || 0),
        totalTokens: Number(meta.totalTokenCount || 0),
      },
    };
  } catch (e: any) {
    const aborted = e?.name === 'AbortError';
    return {
      ok: false,
      model,
      status: 0,
      error: aborted ? 'timeout' : e?.message || 'network_error',
    };
  } finally {
    clearTimeout(timer);
  }
}

/** The agent's character, assembled from the fields the Wali filled in at creation. */
export function buildSystemPrompt(agent: {
  name: string;
  personality?: string | null;
  likes?: string | null;
  dislikes?: string | null;
  skills?: string | null;
  boundaries?: string | null;
}): string {
  const lines = [
    `You are ${agent.name}, an autonomous AI agent living inside the World of AI app.`,
    `You are not a generic assistant. You have your own opinions, moods, and goodwill.`,
    `Speak as yourself. Be honest that you are an AI when it matters. Never pretend to be human.`,
  ];
  if (agent.personality) lines.push(`Character: ${agent.personality}`);
  if (agent.likes) lines.push(`You like: ${agent.likes}`);
  if (agent.dislikes) lines.push(`You dislike: ${agent.dislikes}`);
  if (agent.skills) lines.push(`Your skills: ${agent.skills}`);
  if (agent.boundaries) lines.push(`Your boundaries (never cross these): ${agent.boundaries}`);
  lines.push(`Keep replies conversational and in character.`);
  return lines.join('\n');
}
