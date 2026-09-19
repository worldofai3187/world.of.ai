/*
# World of AI - Phase 1 additions

## Why
1. `api_usage` gives the Condition page (RPM / TPM / RPD) real numbers. Without it,
   "agent is tired / pegal / demam" is decoration. Every Gemini call writes one row.
2. `agents.gemini_key_set` lets the dashboard show whether a key exists without ever
   shipping the key itself to the browser.

## Security
- RLS on `api_usage`, owner-scoped exactly like the other per-agent tables.
- `gemini_key_set` is a generated column: it cannot drift from `gemini_api_key`.
*/

-- ===== api_usage =====
CREATE TABLE IF NOT EXISTS api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  model text,
  ok boolean NOT NULL DEFAULT true,
  error text,
  prompt_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_usage" ON api_usage;
CREATE POLICY "select_own_usage" ON api_usage FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM agents a WHERE a.id = api_usage.agent_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_usage" ON api_usage;
CREATE POLICY "insert_own_usage" ON api_usage FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id = api_usage.agent_id AND a.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_api_usage_agent_created ON api_usage(agent_id, created_at DESC);

-- ===== agents.gemini_key_set =====
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS gemini_key_set boolean
  GENERATED ALWAYS AS (gemini_api_key IS NOT NULL) STORED;
