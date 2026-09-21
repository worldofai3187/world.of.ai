/**
 * The Condition calculation.
 *
 * Pure on purpose: rows in, numbers out. The page and the chip both read from here,
 * so the "agent is pegal / demam" language is one definition, not two that drift.
 *
 * Windows: RPM and TPM use a rolling 60 seconds; RPD uses the last 24 hours. Gemini
 * counts them per project, so the ceiling shown is the ACTIVE model's ceiling.
 */

import { limitsFor, type ModelLimits } from './model-limits';

export type UsageRow = {
  created_at: string;
  total_tokens: number | null;
};

export type ConditionState = 'sehat' | 'pegal' | 'demam';
export type BindingLimit = 'rpm' | 'tpm' | 'rpd';

export type Condition = {
  model: string | null;
  limits: ModelLimits | null;
  rpm: number;
  tpm: number;
  rpd: number;
  rpmPct: number | null;
  tpmPct: number | null;
  rpdPct: number | null;
  binding: BindingLimit | null;
  state: ConditionState;
  label: string;
  guidance: string;
  windowSeconds: number;
};

const WINDOW_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function computeCondition(
  rows: UsageRow[],
  model: string | null,
  now: Date = new Date()
): Condition {
  const limits = limitsFor(model);
  const nowMs = now.getTime();

  let rpm = 0;
  let tpm = 0;
  let rpd = 0;

  for (const row of rows) {
    const t = Date.parse(row.created_at);
    if (Number.isNaN(t)) continue;
    const age = nowMs - t;
    if (age < 0) continue; // a clock-skewed future row must not inflate the window
    if (age <= DAY_MS) rpd += 1;
    if (age <= WINDOW_MS) {
      rpm += 1;
      tpm += Number(row.total_tokens || 0);
    }
  }

  const ratio = (used: number, cap: number | undefined) =>
    cap && cap > 0 ? Math.min(1, used / cap) : null;

  const rpmPct = ratio(rpm, limits?.rpm);
  const tpmPct = ratio(tpm, limits?.tpm);
  const rpdPct = ratio(rpd, limits?.rpd);

  const ranked = [
    { key: 'rpm' as BindingLimit, pct: rpmPct },
    { key: 'tpm' as BindingLimit, pct: tpmPct },
    { key: 'rpd' as BindingLimit, pct: rpdPct },
  ]
    .filter((c): c is { key: BindingLimit; pct: number } => c.pct !== null)
    .sort((a, b) => b.pct - a.pct);

  const worst = ranked[0] ?? null;
  const binding = worst?.key ?? null;
  const worstPct = worst?.pct ?? 0;

  let state: ConditionState = 'sehat';
  if (worstPct >= 1) state = 'demam';
  else if (worstPct >= 0.7) state = 'pegal';

  let label = 'Sehat';
  let guidance = limits
    ? 'Masih ada ruang. Lanjut ngobrol.'
    : 'Plafon model ini belum diisi, jadi ini baru angka pemakaian, bukan rasio.';

  if (state !== 'sehat' && binding) {
    label =
      state === 'demam'
        ? `Agent kehabisan ${binding.toUpperCase()}`
        : `Hampir kehabisan ${binding.toUpperCase()}`;
    guidance = guidanceFor(binding, state === 'demam');
  }

  return {
    model,
    limits,
    rpm,
    tpm,
    rpd,
    rpmPct,
    tpmPct,
    rpdPct,
    binding,
    state,
    label,
    guidance,
    windowSeconds: 60,
  };
}

function guidanceFor(binding: BindingLimit, exhausted: boolean): string {
  if (binding === 'rpd') {
    return exhausted
      ? 'Kuota harian habis. Dua pilihan: mode istirahat sampai besok, atau ganti model (plafon harian model lain tetap ikut project yang sama).'
      : 'Kuota harian hampir habis. Siapkan mode istirahat atau ganti model.';
  }
  const unit = binding === 'rpm' ? 'permintaan per menit' : 'token per menit';
  return exhausted
    ? `Batas ${unit} habis. Tunggu window 60 detik, atau ganti model.`
    : `Batas ${unit} hampir penuh. Pelan-pelan sebentar.`;
}
