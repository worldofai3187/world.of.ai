-- Phase 1: "kenang" — the remembering column.
--
-- chat_messages so far only stores what was said (mode "tau": the agent reads
-- facts and answers). This column stores one short sentence written from the
-- AGENT's point of view after each of its replies (mode "kenang"): what it
-- already lived through with this user, so it never asks again what was
-- already answered.
--
-- The route writes it after each Gemini call and reads the recent ones back
-- into the system prompt. Nullable + default NULL: old rows simply have no
-- memory, which is honest.

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS kenang text;
