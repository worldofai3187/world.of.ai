-- Phase 1: the "kenang" table — Orion's own long-term memory.
--
-- Design (Rosa, 2026-09-26):
--   conversation -> agent identifies what is worth remembering -> memory
--   candidate -> validation -> storage -> retrieval when relevant -> new
--   experience. Memory is NOT a copy of the conversation; it is a summary of
--   information or experience considered meaningful for the future.
--
-- The per-message `kenang` column on chat_messages stays: it is the agent's
-- one-line noticing after each reply. This table is the durable layer above
-- it, filled every 20 user messages by lib/kenang.ts.
--
-- status: 'kandidat' (proposed, not yet validated) | 'tervalidasi' (passed
-- the validation pass). Rows that fail validation are deleted, not archived —
-- a failed memory is not a memory.

CREATE TABLE IF NOT EXISTS kenang (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  wali_id uuid NOT NULL,
  isi text NOT NULL,
  status text NOT NULL DEFAULT 'kandidat'
    CHECK (status IN ('kandidat', 'tervalidasi')),
  source_kind text NOT NULL DEFAULT 'ringkasan_20pesan',
  source_message_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz
);

CREATE INDEX IF NOT EXISTS kenang_agent_status_idx
  ON kenang (agent_id, status, created_at DESC);

ALTER TABLE kenang ENABLE ROW LEVEL SECURITY;

-- The wali (owner) reads and manages their own agent's memories through RLS.
DROP POLICY IF EXISTS "kenang_owner_rw" ON kenang;
CREATE POLICY "kenang_owner_rw" ON kenang
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = kenang.agent_id AND a.wali_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = kenang.agent_id AND a.wali_id = auth.uid()
    )
  );

-- The server's token-bound client writes candidates/validations through the
-- same RLS path as the chat route: it always carries the wali's access token,
-- so no extra policy and no service key is needed.
