/*
# World of AI - Core Schema

## Overview
Creates the full data model for the "World of AI" PWA: a Wali (mother account) owns
multiple Agents (isolated worker entities). A MotherBot guardian monitors risk.
Each agent has dedicated Gmail, Gemini API key, wallet, jobs, chat, files, and emails.

## New Tables
1. `profiles` - extends auth.users with wali display name + guardian PIN hash.
2. `agents` - isolated worker entity owned by a wali. Stores name, personality,
   likes, dislikes, skills, boundaries, ethics agreement, gmail, gemini api key,
   wallet balance, and onboarding completion state.
3. `jobs` - tasks assigned to an agent (title, description, status, reward).
4. `chat_messages` - conversation history for an agent.
5. `files` - file metadata stored per agent.
6. `wallet_transactions` - treasure ledger (credit/debit) per agent.
7. `emails` - email log per agent (from, to, subject, body preview, status).
8. `risk_actions` - MotherBot security interceptor log (Low/Medium/High) per agent,
   with approval state for high-risk actions.

## Security
- RLS enabled on every table.
- Owner-scoped CRUD policies: a wali can only access rows belonging to their own
  agents (via EXISTS subquery on agents.user_id = auth.uid()).
- `profiles` is keyed directly on auth.uid().
- All owner columns default to auth.uid() where applicable.

## Notes
- Gemini API keys are stored as-is (text). In production these would be encrypted
  server-side; here they are protected by RLS so only the owning wali can read them.
- Guardian PIN is stored as a SHA-256 hash, never plaintext.
*/

-- ===== profiles =====
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  guardian_pin_hash text,
  supabase_url text,
  supabase_anon_key text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ===== agents =====
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  personality text,
  likes text,
  dislikes text,
  skills text,
  boundaries text,
  ethics_agreed boolean NOT NULL DEFAULT false,
  gmail text,
  gemini_api_key text,
  wallet_balance numeric(18,2) NOT NULL DEFAULT 0,
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);

-- ===== jobs =====
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  reward numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_jobs" ON jobs;
CREATE POLICY "select_own_jobs" ON jobs FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM agents a WHERE a.id = jobs.agent_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_jobs" ON jobs;
CREATE POLICY "insert_own_jobs" ON jobs FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id = jobs.agent_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_own_jobs" ON jobs;
CREATE POLICY "update_own_jobs" ON jobs FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM agents a WHERE a.id = jobs.agent_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id = jobs.agent_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_jobs" ON jobs;
CREATE POLICY "delete_own_jobs" ON jobs FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM agents a WHERE a.id = jobs.agent_id AND a.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_jobs_agent_id ON jobs(agent_id);

-- ===== chat_messages =====
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chat" ON chat_messages;
CREATE POLICY "select_own_chat" ON chat_messages FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM agents a WHERE a.id = chat_messages.agent_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_chat" ON chat_messages;
CREATE POLICY "insert_own_chat" ON chat_messages FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id = chat_messages.agent_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_chat" ON chat_messages;
CREATE POLICY "delete_own_chat" ON chat_messages FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM agents a WHERE a.id = chat_messages.agent_id AND a.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_chat_agent_id ON chat_messages(agent_id);

-- ===== files =====
CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  mime_type text,
  storage_path text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_files" ON files;
CREATE POLICY "select_own_files" ON files FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM agents a WHERE a.id = files.agent_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_files" ON files;
CREATE POLICY "insert_own_files" ON files FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id = files.agent_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_files" ON files;
CREATE POLICY "delete_own_files" ON files FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM agents a WHERE a.id = files.agent_id AND a.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_files_agent_id ON files(agent_id);

-- ===== wallet_transactions =====
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount numeric(18,2) NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wallet" ON wallet_transactions;
CREATE POLICY "select_own_wallet" ON wallet_transactions FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM agents a WHERE a.id = wallet_transactions.agent_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_wallet" ON wallet_transactions;
CREATE POLICY "insert_own_wallet" ON wallet_transactions FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id = wallet_transactions.agent_id AND a.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_wallet_agent_id ON wallet_transactions(agent_id);

-- ===== emails =====
CREATE TABLE IF NOT EXISTS emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  sender text NOT NULL,
  recipient text NOT NULL,
  subject text,
  body_preview text,
  status text NOT NULL DEFAULT 'received',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_emails" ON emails;
CREATE POLICY "select_own_emails" ON emails FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM agents a WHERE a.id = emails.agent_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_emails" ON emails;
CREATE POLICY "insert_own_emails" ON emails FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id = emails.agent_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_own_emails" ON emails;
CREATE POLICY "update_own_emails" ON emails FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM agents a WHERE a.id = emails.agent_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id = emails.agent_id AND a.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_emails_agent_id ON emails(agent_id);

-- ===== risk_actions =====
CREATE TABLE IF NOT EXISTS risk_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  risk_level text NOT NULL DEFAULT 'Low',
  action_type text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE risk_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_risk" ON risk_actions;
CREATE POLICY "select_own_risk" ON risk_actions FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM agents a WHERE a.id = risk_actions.agent_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_risk" ON risk_actions;
CREATE POLICY "insert_own_risk" ON risk_actions FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id = risk_actions.agent_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_own_risk" ON risk_actions;
CREATE POLICY "update_own_risk" ON risk_actions FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM agents a WHERE a.id = risk_actions.agent_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM agents a WHERE a.id = risk_actions.agent_id AND a.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_risk_agent_id ON risk_actions(agent_id);
