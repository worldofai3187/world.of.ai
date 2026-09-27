-- Phase 1 invite gate: the app stays closed to the public.
-- A stranger can only onboard after redeeming a one-time invite code
-- that the wali (owner) created manually in the Supabase SQL editor.

-- ---------------------------------------------------------------
-- 1. Invite codes
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  note text,                                  -- who the wali made it for (optional)
  created_by uuid,                            -- wali's supabase user id (manual rows may leave null)
  used_by uuid UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- No public policies at all: direct reads/writes from any anon/auth client
-- are denied. The only way in is the SECURITY DEFINER RPCs below.

-- ---------------------------------------------------------------
-- 2. Redeem RPC (atomic, safe to call from the browser)
--    Returns true once per code. Race-safe: UPDATE ... WHERE used_by IS NULL.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION redeem_invite(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_updated invite_codes;
BEGIN
  IF v_user IS NULL THEN
    RETURN false;                              -- must be signed in to redeem
  END IF;
  IF p_code IS NULL OR length(btrim(p_code)) < 8 THEN
    RETURN false;
  END IF;

  -- If this user already redeemed something, don't burn another code.
  IF EXISTS (SELECT 1 FROM invite_codes WHERE used_by = v_user) THEN
    RETURN true;
  END IF;

  UPDATE invite_codes
     SET used_by = v_user, used_at = now()
   WHERE code = btrim(p_code)
     AND used_by IS NULL
  RETURNING * INTO v_updated;

  RETURN v_updated.id IS NOT NULL;
END;
$$;

-- Read check for the UI: has the current user already redeemed an invite?
CREATE OR REPLACE FUNCTION invite_redeemed()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM invite_codes WHERE used_by = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION redeem_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION invite_redeemed() TO authenticated;
REVOKE ALL ON TABLE invite_codes FROM anon, authenticated;

-- ---------------------------------------------------------------
-- 3. Close the back door: creating an agent row directly via the API
--    (skipping onboarding UI) also requires a redeemed invite —
--    unless the caller is the wali, configured in app_config.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- Wali inserts exactly one row (docs/PHASE1.md):
--   INSERT INTO app_config (key, value)
--   VALUES ('wali_uid', '<their supabase user id>');
CREATE OR REPLACE FUNCTION is_wali()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_config
     WHERE key = 'wali_uid' AND value = auth.uid()::text
  );
$$;

-- Only the wali can write config; nobody else can even read it.
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_config FROM anon, authenticated;
DROP POLICY IF EXISTS "wali_config_rw" ON app_config;
CREATE POLICY "wali_config_rw" ON app_config
  FOR ALL TO authenticated
  USING (is_wali())
  WITH CHECK (is_wali());

DROP POLICY IF EXISTS "insert_own_agents" ON agents;
CREATE POLICY "insert_own_agents" ON agents FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (is_wali() OR invite_redeemed())
  );

DROP POLICY IF EXISTS "insert_own_wallet" ON wallet_transactions;
CREATE POLICY "insert_own_wallet" ON wallet_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM agents WHERE id = agent_id AND user_id = auth.uid())
    AND (is_wali() OR invite_redeemed())
  );
