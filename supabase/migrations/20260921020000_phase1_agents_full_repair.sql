/*
# World of AI - Phase 1: full agents repair (idempotent, safe to re-run)

## Why
Two different drifts can strand a wali on the onboarding page:

1. `likes/dislikes/skills/boundaries` were created as `text[]` by an early Bolt build,
   while the app sends plain comma-separated text -> insert fails with
   `malformed array literal`.
2. `gemini_key_set` (and `gemini_api_key`, `gmail`, `wallet_balance`,
   `onboarding_complete`) may not exist if the earlier migrations were skipped.
   The dashboard and the onboarding success screen both SELECT `gemini_key_set`,
   so a missing column makes the agents query fail -> the app always thinks the
   wali has zero agents and shows onboarding again.

This file repairs both in one paste. Every statement is guarded, so running it on
an already-fixed database changes nothing.
*/

-- 1. Profile columns back to text (only when they are actually arrays).
DO $$
DECLARE
  col text;
  cols text[] := ARRAY['likes', 'dislikes', 'skills', 'boundaries'];
BEGIN
  FOREACH col IN ARRAY cols LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'agents'
        AND column_name = col
        AND data_type = 'ARRAY'
    ) THEN
      EXECUTE format(
        'ALTER TABLE agents ALTER COLUMN %I TYPE text USING array_to_string(%I, '', '')',
        col, col
      );
    END IF;
  END LOOP;
END $$;

-- 2. Phase-1 columns the app expects.
ALTER TABLE agents ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS gmail text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS wallet_balance numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;

-- 3. Generated flag so the browser can see "key set" without ever reading the key.
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS gemini_key_set boolean
  GENERATED ALWAYS AS (gemini_api_key IS NOT NULL) STORED;

-- 4. Make sure RLS policies exist (no-ops if already present).
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_agents" ON agents;
CREATE POLICY "select_own_agents" ON agents FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_agents" ON agents;
CREATE POLICY "insert_own_agents" ON agents FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_agents" ON agents;
CREATE POLICY "update_own_agents" ON agents FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_agents" ON agents;
CREATE POLICY "delete_own_agents" ON agents FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
