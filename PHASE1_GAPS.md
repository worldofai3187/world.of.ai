# Phase 1 — gap triage (2026-09-22)

Written by Valco. Scope: what still stands between "runs on Rosa's laptop" and
"a stranger can sign up, talk to their agent, and see real usage numbers."
Nothing here is invented; each item says how it was checked.

## 1. Node version — no gap (I had this wrong)
- My earlier note said "`next build` fails on Node 22." That is false. Verified today:
  `npx next build` is green on Node 22.23.1 — all 4 static pages generate, and both
  `/api/chat` and `/api/condition` show in the route table.
- The failure I saw earlier was the missing-env prerender error ("supabaseUrl is
  required"), which the placeholder fallback in `lib/supabase.ts` already fixed.
  Two things had changed that day; I blamed the wrong one.
- Kept, cheaply: `engines.node = ">=18.17"` (floor only, no ceiling, since 22 is
  verified good) + `.nvmrc = 20` so local and Netlify builds agree.

## 2. Onboarding Supabase step blocked strangers — FIXED (this commit)
- Step 1 of onboarding hard-required `SUPABASE_URL` + `SUPABASE_ANON_KEY`
  (`if (!supabaseUrl || !supabaseAnonKey) throw ...`).
- Those values are written to `profiles` and then **never read by any code path**:
  `lib/supabase.ts` builds one client from `NEXT_PUBLIC_SUPABASE_URL`. They are a
  leftover of the "Supabase per agent" vision, not a phase-1 requirement.
- Effect: a tester who does not own a Supabase project could not reach the agent
  creation step at all. That is the single biggest blocker to "a stranger can test."
- Fix: the step is now optional. Both fields filled = saved. Both empty = skip.
  One filled = error (typo guard). Copy says it is optional in phase 1.
- Decision for Rosa: keep it optional for phase 2 too (per-agent house, added later
  from settings), or drop the step entirely until the per-agent model is real.

## 3. Gemini key handling — NO LEAK, one design note
- Checked every read of `agents` from the browser: `agent-switcher.tsx`,
  `dashboard.tsx`, `onboarding-flow.tsx` all use `AGENT_PUBLIC_COLUMNS`, which
  deliberately omits `gemini_api_key`. The raw key is read only in
  `app/api/chat/route.ts` (server, token-bound client, no service key).
- The one client-side *write* of the key is the onboarding insert. That is the
  user typing their own key into their own row under RLS, so it is acceptable for
  phase 1. Moving it server-side is a hardening item, not a leak.

## 4. Model ceilings — needs Rosa's real numbers
- `lib/model-limits.ts` holds per-model RPM/TPM/RPD defaults (10 / 250k / 250) and
  is env-overridable. They must be replaced with the real AI Studio numbers for
  whichever model is active, or the Condition page will show honest-looking wrong
  limits.
- The Condition page already names the *binding* limit, so a wrong ceiling is
  visible rather than silent. This is the last input only Rosa can supply.

## 5. Open with Rosa
- Pull `0ccb919` and run `supabase/migrations/20260921120000_phase1_one_agent_per_wali.sql`.
  That is still the only step that makes the Condition tab show real numbers.
