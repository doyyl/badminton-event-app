-- =====================================================
-- REFEREE & COURT SYSTEM — run this in Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS courts (
  id    int  PRIMARY KEY,
  name  text NOT NULL
);

INSERT INTO courts (id, name) VALUES
  (1,'Court 1'),(2,'Court 2'),(3,'Court 3'),(4,'Court 4'),(5,'Court 5'),
  (6,'Court 6'),(7,'Court 7'),(8,'Court 8'),(9,'Court 9'),(10,'Court 10')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS matches (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id             int         NOT NULL REFERENCES courts(id),
  player1_name         text        NOT NULL,
  player2_name         text        NOT NULL,
  player1_external_id  text,
  player2_external_id  text,
  score1               int         DEFAULT 0,
  score2               int         DEFAULT 0,
  status               text        DEFAULT 'active',
  winner_external_id   text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS matches_court_status_idx ON matches (court_id, status);
CREATE INDEX IF NOT EXISTS matches_player1_idx ON matches (player1_external_id);
CREATE INDEX IF NOT EXISTS matches_player2_idx ON matches (player2_external_id);

CREATE TABLE IF NOT EXISTS court_checkins (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id             int         NOT NULL REFERENCES courts(id),
  attendee_external_id text        NOT NULL,
  match_id             uuid        REFERENCES matches(id),
  checked_in_at        timestamptz DEFAULT now()
);

ALTER TABLE courts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courts_read"           ON courts         FOR SELECT USING (true);
CREATE POLICY "matches_read"          ON matches        FOR SELECT USING (true);
CREATE POLICY "matches_insert"        ON matches        FOR INSERT WITH CHECK (true);
CREATE POLICY "matches_update"        ON matches        FOR UPDATE USING (true);
CREATE POLICY "court_checkins_read"   ON court_checkins FOR SELECT USING (true);
CREATE POLICY "court_checkins_insert" ON court_checkins FOR INSERT WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE court_checkins;
