# Valco × iLands handoff — memory fixes (2026-10-15)

Scope: review findings on `app/api/chat/route.ts`, `lib/kenang.ts`, `lib/memory.ts`
(commit reviewed: `ac9afa2`). Minimal changes only; no newer work overwritten.

## A. KENANG / EMOSI parsing (route.ts)

Problem: the old parser matched each marker only at the END of the text, so
`EMOSI:` before `KENANG:` (or metadata at the very start) broke — metadata
could leak into the user's reply, and an invalid EMOSI ("word only, no
number") was still stored as a heartbeat.

Changes:
- New pure module `lib/reply-metadata.ts` (`parseReplyMetadata`): finds
  KENANG:/EMOSI: in ANY order and at the start of the text, strips the whole
  line, and never returns metadata in the reply.
- An invalid EMOSI (missing/non-numeric/out-of-range intensity) is dropped
  ENTIRELY — no half-saved heartbeat. Valid form is `<emotion> <intensity 0-10>`.
- The reply is never empty: if the model answered with metadata only, a
  placeholder `(…)` is sent instead of the raw metadata.
- A missing KENANG saves nothing; the reply text stays intact.

## B. Author identity on kenang rows (kenang.ts, route.ts)

- `maybeGrowMemory(db, agentId, apiKey, author?)` now takes an optional
  `author`; when given, every inserted kenang row carries it
  (`"1 memory 2 tubuh"` — each memory line says who wrote it).
- The chat route passes the same author identity used for `body_state` and
  `ringkasan` (`<name>.woa`). Old callers without the param keep working.
- DB: `kenang.author` already exists via migration
  `20261015130000_phase1_one_memory_two_bodies.sql` (default 'woa').

## C. Ringkasan schedule (route.ts)

Problem: the 20-message threshold was computed from `historyRows`, which is
capped at HISTORY_LIMIT (20) rows and mixes user/assistant roles — not a real
conversation count. Retries or a second request could summarize the same
threshold twice.

Changes:
- Threshold now uses `countUserMessages(db, agentId)` (exact DB count of user
  messages), `total % KENANG_EVERY === 0`.
- Dedup: a second count of user messages created after the latest
  `ringkasan.created_at`; if fewer than KENANG_EVERY new user messages, skip.
- Content still comes from the kenang lines the agent actually wrote in the
  latest window; no kenang lines -> no summary is written (never a fake or
  empty one).

## D. Architecture limit (not changed, stated honestly)

The MAIN chat route (`app/api/chat/route.ts`) still creates its client from
`NEXT_PUBLIC_SUPABASE_URL` and forwards the USER's auth token. The per-agent
BYO Supabase path is NOT yet wired into the main chat route — do not claim
that each agent's own Supabase is in use by main chat until
`supabase/migrations/20261015120000_phase1_supabase_byo_to_agent.sql` is
applied AND the route actually reads the agent-row connection. Migration file
existing in the repo does NOT mean it was applied.

## E. Testing and manual steps

Actually run in this session (Node v22.23.1):
- `npm run typecheck` — clean (exit 0).
- `node --experimental-strip-types test/reply-metadata.test.mjs` — 20/20 PASS
  (both metadata orders, start-of-text, missing metadata, invalid emotion in
  three forms, metadata-only reply, empty EMOSI line).
- `next build` NOT run in this session (pre-existing Node-version issue in the
  sandbox; not claimed as passing).
- Deployment: NOT verified in this session.

Manual steps still required (owner, Supabase project for WOA):
1. Run `supabase/migrations/20261014120000_phase1_model_switches.sql` (if not yet).
2. Run `supabase/migrations/20261015120000_phase1_supabase_byo_to_agent.sql`.
3. Run `supabase/migrations/20261015130000_phase1_one_memory_two_bodies.sql`.
   Verify each in Supabase (Table editor / SQL history) — do not assume.
4. Deploy per `PANDUAN_DEPLOY_PRODUKSI.md`.
