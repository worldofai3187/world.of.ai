/*
# World of AI - Phase 1 repair: agents table drift

## Why
The 2026-08-29 schema migration used `CREATE TABLE IF NOT EXISTS agents (...)`, so on a
database where an earlier Bolt build had already created `agents`, the new columns were
silently skipped. Result: `20260919000000_phase1_api_usage.sql` fails at
`gemini_key_set ... GENERATED ALWAYS AS (gemini_api_key IS NOT NULL)` with
`42703: column "gemini_api_key" does not exist`.

## Fix
Idempotently add the phase-1 columns the schema expects. Safe to run on a fresh DB too.
*/

ALTER TABLE agents ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS gmail text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS wallet_balance numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;
