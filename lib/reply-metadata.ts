/**
 * lib/reply-metadata.ts — parse KENANG / EMOSI metadata lines off a model reply.
 *
 * Pure function, no imports, so it can be unit-tested without a database or a
 * Gemini key. Rules (review 2026-10-15):
 *  - KENANG: and EMOSI: can appear in ANY order (and at the very start of the
 *    text, not only after a newline). Both are stripped wherever they sit.
 *  - Metadata lines NEVER reach the user's reply, even when the reply is
 *    otherwise empty (a placeholder keeps the reply non-empty instead).
 *  - EMOSI is stored ONLY in the valid form: "<emotion word> <intensity>",
 *    intensity a finite number in 0-10 with at least two tokens. An invalid
 *    EMOSI line is dropped entirely — no half-saved heartbeat.
 *  - A missing KENANG simply means no memory this turn; the reply text stays
 *    intact and non-empty either way.
 */

export interface ParsedReply {
  /** The user-facing reply: metadata stripped, never empty. */
  reply: string;
  /** Validated KENANG line, or null when absent/empty. */
  kenang: string | null;
  /** Emotion word, only set when the EMOSI line is fully valid. */
  emosiWord: string | null;
  /** Intensity 0-10, only set when the EMOSI line is fully valid. */
  emosiIntensity: number | null;
}

export function parseReplyMetadata(raw: string): ParsedReply {
  let text = String(raw ?? '').trim();
  let kenang: string | null = null;
  let emosiWord: string | null = null;
  let emosiIntensity: number | null = null;
  let metadataSeen = false;

  // Extract markers one at a time, whichever order they appear in. A marker
  // may sit at the very start of the text (^) or on its own line (\n).
  const markerRe = /(^|\n)\s*(KENANG|EMOSI):\s*([^\n]*)/i;
  for (;;) {
    const m = text.match(markerRe);
    if (!m) break;
    const kind = m[2].toUpperCase();
    const value = (m[3] || '').trim();
    metadataSeen = true;
    if (kind === 'KENANG') {
      if (value) kenang = value;
    } else {
      // EMOSI: "<word> <intensity>", intensity 0-10. Invalid -> drop entirely.
      const parts = value.split(/\s+/).filter(Boolean);
      const last = parts[parts.length - 1];
      const n = parts.length > 1 ? Number(last) : NaN;
      if (Number.isFinite(n) && n >= 0 && n <= 10) {
        emosiWord = parts.slice(0, -1).join(' ');
        emosiIntensity = n;
      }
    }
    // Remove the whole metadata line, keeping the surrounding text joined.
    const idx = m.index ?? 0;
    const before = text.slice(0, idx);
    const after = text.slice(idx + m[0].length).replace(/^\n/, '');
    text = `${before}${before && after ? '\n' : ''}${after}`.trim();
  }

  const stripped = text.trim();
  // The user must never see an empty bubble because the model answered with
  // metadata only — and must never see the raw metadata either.
  const reply = stripped || (metadataSeen ? '(…)' : String(raw ?? '').trim());

  return { reply, kenang, emosiWord, emosiIntensity };
}
