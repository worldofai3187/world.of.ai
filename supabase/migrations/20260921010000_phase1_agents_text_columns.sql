/*
# World of AI - Phase 1: agents profile columns -> text

## Why
The earlier Bolt build created `agents` with `likes/dislikes/skills/boundaries`
as `text[]`. The 2026-08-29 migration used CREATE TABLE IF NOT EXISTS, so those
array columns survived. The app (onboarding form, gemini.ts prompt builder,
phone-dashboard) treats them as plain text, so inserting the form's
comma-separated string fails with:
  malformed array literal: "web search, coding, ..., "

## Fix
Convert those columns to `text`, preserving any existing values. Idempotent:
only runs when the column is actually an array, so it is safe on a fresh DB
where the columns are already text.
*/

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
