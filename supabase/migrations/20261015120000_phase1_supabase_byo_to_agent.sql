/*
# Phase 1: BYO Supabase lives on the agent row, not the user profile

Rosa's rule (14 Okt, locked): Supabase and the Gemini API key belong to the agent, not
the user account. The user account only holds ToS and recovery. Why it matters: when an
agent is later adopted by a new user, its own database connection must travel WITH the
agent — the adopting wali never re-enters Supabase for it, and the old user's row keeps
nothing.

Before this migration the BYO pair was stored on `profiles` (the user row). This one:
1. Adds the pair to `agents` (idempotent).
2. Copies any existing values from `profiles` into the agent row. Safe because phase 1
   enforces one agent per wali (agents_one_per_user), so there is exactly one target.
3. Blanks the copy on `profiles` — the values stay readable in the columns for the
   deploy window (old clients still write there), but the user row stops HOLDING the
   connection. Dropping the columns from profiles entirely is a follow-up once every
   client runs the new code.

Safe to re-run.
*/

ALTER TABLE agents ADD COLUMN IF NOT EXISTS supabase_url text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS supabase_anon_key text;

-- 2. Copy existing BYO values onto the agent (one agent per wali).
UPDATE agents a
SET supabase_url = p.supabase_url,
    supabase_anon_key = p.supabase_anon_key
FROM profiles p
WHERE a.user_id = p.id
  AND a.supabase_url IS NULL
  AND p.supabase_url IS NOT NULL;

-- 3. The user row stops holding the connection.
UPDATE profiles SET supabase_url = NULL, supabase_anon_key = NULL
WHERE supabase_url IS NOT NULL OR supabase_anon_key IS NOT NULL;
