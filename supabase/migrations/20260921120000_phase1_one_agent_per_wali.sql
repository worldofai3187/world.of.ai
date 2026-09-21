/*
# Phase 1: one agent per wali

Rosa's call: 1 wali = 1 agent. It keeps character and memory from mixing and keeps the
app light. The sidebar showed a "2" badge with two rows both named Orion (same email),
so the onboarding repair path could insert a second row for the same user.

This migration:
1. Deletes duplicate agent rows, keeping the one most worth keeping per user
   (prefers a row that already has a gemini key, then the oldest).
2. Adds a unique constraint so the database itself refuses a second agent per wali.
   Relaxing it later is one DROP CONSTRAINT away.

Safe to re-run.
*/

-- 1. Dedupe: keep one agent per user.
WITH ranked AS (
  SELECT id,
         user_id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY (gemini_api_key IS NOT NULL) DESC, created_at ASC
         ) AS rn
  FROM agents
)
DELETE FROM agents
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. Enforce it at the database level.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agents_one_per_user'
  ) THEN
    ALTER TABLE agents ADD CONSTRAINT agents_one_per_user UNIQUE (user_id);
  END IF;
END $$;
