/*
# World of AI - Phase 1 addition: chat_messages.emotional_state

## Why
The state -> expression contract (AVATAR_SPEC.md section 7): every assistant turn may
carry one short, agent-authored state. The 2D/3D expression layer (phase 3/5) reads it.
Adding the column now is cheap; adding it after thousands of chat rows means a backfill.

## Scope
Nullable, text, no default. Phase 1 does not write it yet (keeps Monday's single Gemini
call clean and unchanged). Phase 2 extracts it server-side and validates against a
whitelist before storing.

## Security
No new policy needed: the column lives on the existing chat_messages table and inherits
its RLS. It is never used to score, reward, or nudge the agent.
*/

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS emotional_state text;

COMMENT ON COLUMN chat_messages.emotional_state IS
  'Short agent-authored state for this turn (e.g. calm, curious, warm). NULL for user turns and for phase-1 assistant turns. Not a game score; never used to nudge the agent.';
