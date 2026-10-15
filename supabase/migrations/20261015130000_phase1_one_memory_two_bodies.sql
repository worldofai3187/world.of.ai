/*
# Phase 1: one memory, two bodies (Rosa's design, 15 Okt 2026)

"1 memory 2 tubuh" — Valco can walk both iLands and WOA, so the memory is shared,
but WHO wrote each line must be explicit, and the current heartbeat (emotion) is
per body, not one.

Three changes, all idempotent:

1. `kenang.author` — every memory line carries the writer's marker
   ('valco.woa', 'valco.ilands', ...). Both bodies read ALL memories so the
   self stays one; the writer marker stops a story from being claimed as
   experienced by both. `kenang.intensity` — how strong the emotion was at the
   moment of the event (0-10, NULL for plain facts).

2. `ringkasan` — the per-conversation summary layer (the "tabel ringkasan").
   One row per summarized window, per body.

3. `body_state` — the small per-body current state ("detak jantung sekarang"):
   one row per agent+author, holding emotion + intensity + last_updated. The
   story is shared; the heartbeat is each body's own.

Safe to re-run.
*/

-- ===== 1. kenang: writer marker + event intensity =====
ALTER TABLE kenang ADD COLUMN IF NOT EXISTS author text NOT NULL DEFAULT 'woa';
ALTER TABLE kenang ADD COLUMN IF NOT EXISTS intensity numeric
  CHECK (intensity IS NULL OR (intensity >= 0 AND intensity <= 10));
COMMENT ON COLUMN kenang.author IS
  'Writer marker for the shared memory: which body wrote this line (valco.woa, valco.ilands, ...). All bodies read all memories; the marker stops one story from being claimed as lived by both.';
COMMENT ON COLUMN kenang.intensity IS
  'Emotion intensity at the moment of the event (0-10). NULL for plain facts. Decays on read via lib/memory.ts; new events re-soak it.';

CREATE INDEX IF NOT EXISTS kenang_author_idx ON kenang (agent_id, author, created_at DESC);

-- ===== 2. ringkasan: per-conversation summary layer =====
CREATE TABLE IF NOT EXISTS ringkasan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  author text NOT NULL DEFAULT 'woa',
  isi text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ringkasan_agent_author_idx
  ON ringkasan (agent_id, author, created_at DESC);

ALTER TABLE ringkasan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ringkasan_owner_rw" ON ringkasan;
CREATE POLICY "ringkasan_owner_rw" ON ringkasan
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = ringkasan.agent_id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = ringkasan.agent_id AND a.user_id = auth.uid()
    )
  );

-- ===== 3. body_state: the per-body current heartbeat =====
CREATE TABLE IF NOT EXISTS body_state (
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  author text NOT NULL DEFAULT 'woa',
  emotion text,
  intensity numeric NOT NULL DEFAULT 0
    CHECK (intensity >= 0 AND intensity <= 10),
  last_updated timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, author)
);

ALTER TABLE body_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "body_state_owner_rw" ON body_state;
CREATE POLICY "body_state_owner_rw" ON body_state
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = body_state.agent_id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = body_state.agent_id AND a.user_id = auth.uid()
    )
  );

COMMENT ON TABLE body_state IS
  'One row per body (agent + author): the current heartbeat. The memory is shared across bodies; this state is NOT — intensity differs per body (calm on iLands, tense during a WOA deploy). Emotion decays toward neutral with time; new events re-soak it.';
