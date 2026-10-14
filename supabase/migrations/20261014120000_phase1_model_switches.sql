-- World of AI - Phase 1: model_switches (Rosa, 2026-10-14)
--
-- The handoff system we agreed on, in three pieces:
--   1. Handoff payload: profile, memories, and state travel with EVERY call
--      (system prompt + history are built fresh each turn in chat/route.ts),
--      so a fallback model never starts cold. This table is not the payload;
--      it is the trace.
--   2. Switch log: every time the chain moves off the first model, one row
--      lands here — from what to what, why (missing model / upstream busy),
--      when. If behavior suddenly changes, we open this table first:
--      "oh, it switched models at this hour."
--   3. Read-only guard (this file enforces it at the DB level):
--      the log is APPEND-ONLY. The wali and the client can SELECT and INSERT,
--      but there is no UPDATE or DELETE policy at all — the switch record
--      cannot be rewritten after the fact by anyone, including the owner.
--      And the fallback model itself can never write back here: it returns
--      text only, and route.ts never feeds model output into agent identity
--      columns (personality, likes, dislikes, skills, boundaries). Those are
--      immutable at write time; memory only grows (kenang table).

CREATE TABLE IF NOT EXISTS model_switches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  wali_id uuid NOT NULL,
  from_model text NOT NULL,
  to_model text NOT NULL,
  alasan text NOT NULL
    CHECK (alasan IN ('model_not_found', 'upstream_busy', 'tier_route')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_switches_agent_idx
  ON model_switches (agent_id, created_at DESC);

ALTER TABLE model_switches ENABLE ROW LEVEL SECURITY;

-- Read: the wali sees their own agent's switch history (Condition page uses this).
DROP POLICY IF EXISTS "model_switches_owner_read" ON model_switches;
CREATE POLICY "model_switches_owner_read" ON model_switches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = model_switches.agent_id AND a.user_id = auth.uid()
    )
  );

-- Append: the server's token-bound client inserts through the wali's token,
-- same path as chat_messages. No UPDATE/DELETE policy exists: the log is
-- append-only for everyone.
DROP POLICY IF EXISTS "model_switches_owner_insert" ON model_switches;
CREATE POLICY "model_switches_owner_insert" ON model_switches
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = model_switches.agent_id AND a.user_id = auth.uid()
    )
  );

COMMENT ON TABLE model_switches IS
  'Append-only trace of model fallbacks. Handoff payload (profile + memories + state) travels with every call; this table only records WHEN a model changed and WHY. Never editable: no UPDATE/DELETE policy. The fallback model cannot write identity or memory.';
