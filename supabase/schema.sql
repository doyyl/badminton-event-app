-- =====================================================
-- SMASH Badminton Event — Supabase Schema
-- Run this in your Supabase SQL Editor
-- =====================================================

-- ── Tables ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attendees (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id      text        UNIQUE NOT NULL,
  name             text        NOT NULL,
  email            text,
  phone            text,
  company          text,
  category         text,       -- Basic / Expert / Substitute / Spectator
  role             text,       -- athlete / spectator
  checked_in       boolean     DEFAULT false,
  check_in_time    timestamptz,
  walk_in          boolean     DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS food_items (
  id     text  PRIMARY KEY,
  name   text  NOT NULL,
  quota  int   NOT NULL
);

CREATE TABLE IF NOT EXISTS food_claims (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  attendee_external_id  text        NOT NULL,
  item_id               text        NOT NULL REFERENCES food_items(id),
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS food_claims_attendee_item_idx
  ON food_claims (attendee_external_id, item_id);

CREATE TABLE IF NOT EXISTS results (
  id      uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  rank    int   NOT NULL,
  team    text  NOT NULL,
  win     int   DEFAULT 0,
  lose    int   DEFAULT 0,
  points  int   DEFAULT 0
);

CREATE TABLE IF NOT EXISTS event_config (
  key   text  PRIMARY KEY,
  value text
);

-- ── Seed: food_items ──────────────────────────────

INSERT INTO food_items (id, name, quota) VALUES
  ('wrap',       'Wrap',            1),
  ('mc_chicken', 'McChicken',       1),
  ('croffle',    'Croffle',         1),
  ('icecream',   'Ice Cream',       1),
  ('fruits',     'Fruits',          1),
  ('energy_bar', 'Energy Bar',      1),
  ('bbq',        'BBQ',             3),
  ('beer',       'Beer',            3),
  ('soft_drink', 'Soft Drink',      1),
  ('hydration',  'Hydration Drink', 1),
  ('water',      'Water',           3)
ON CONFLICT (id) DO NOTHING;

-- ── Seed: event_config ────────────────────────────

INSERT INTO event_config (key, value) VALUES
  ('motm_name',       ''),
  ('motm_team',       ''),
  ('motm_image_url',  ''),
  ('announcement',    ''),
  ('seating_map_url', '')
ON CONFLICT (key) DO NOTHING;

-- ── Atomic food claim function ────────────────────
-- Uses an advisory lock per (attendee, item) pair to prevent
-- race conditions when the same person scans at two stations simultaneously.

CREATE OR REPLACE FUNCTION claim_food(
  p_attendee_external_id text,
  p_item_id              text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quota    int;
  v_claimed  int;
  v_remaining int;
BEGIN
  -- Advisory lock scoped to this transaction, keyed on (attendee, item)
  PERFORM pg_advisory_xact_lock(
    hashtext(p_attendee_external_id),
    hashtext(p_item_id)
  );

  -- Verify item exists
  SELECT quota INTO v_quota
  FROM food_items
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'item_not_found');
  END IF;

  -- Count existing claims under the lock
  SELECT COUNT(*) INTO v_claimed
  FROM food_claims
  WHERE attendee_external_id = p_attendee_external_id
    AND item_id = p_item_id;

  IF v_claimed >= v_quota THEN
    RETURN json_build_object(
      'success', false,
      'error',   'quota_reached',
      'claimed', v_claimed,
      'quota',   v_quota
    );
  END IF;

  -- Insert claim
  INSERT INTO food_claims (attendee_external_id, item_id)
  VALUES (p_attendee_external_id, p_item_id);

  v_remaining := v_quota - v_claimed - 1;

  RETURN json_build_object(
    'success',   true,
    'claimed',   v_claimed + 1,
    'quota',     v_quota,
    'remaining', v_remaining
  );
END;
$$;

-- ── Row Level Security ────────────────────────────

ALTER TABLE attendees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_claims  ENABLE ROW LEVEL SECURITY;
ALTER TABLE results      ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_config ENABLE ROW LEVEL SECURITY;

-- food_items: public read
CREATE POLICY "food_items_read"
  ON food_items FOR SELECT USING (true);

-- results: public read, anyone can write (protected at app layer)
CREATE POLICY "results_read"
  ON results FOR SELECT USING (true);
CREATE POLICY "results_insert"
  ON results FOR INSERT WITH CHECK (true);
CREATE POLICY "results_update"
  ON results FOR UPDATE USING (true);
CREATE POLICY "results_delete"
  ON results FOR DELETE USING (true);

-- event_config: public read, anyone can write (admin only in UI)
CREATE POLICY "event_config_read"
  ON event_config FOR SELECT USING (true);
CREATE POLICY "event_config_write"
  ON event_config FOR ALL USING (true);

-- attendees: public read/insert/update (guest self-lookup + walk-in)
CREATE POLICY "attendees_read"
  ON attendees FOR SELECT USING (true);
CREATE POLICY "attendees_insert"
  ON attendees FOR INSERT WITH CHECK (true);
CREATE POLICY "attendees_update"
  ON attendees FOR UPDATE USING (true);

-- food_claims: insert via claim_food function (SECURITY DEFINER bypasses RLS)
-- Allow select for admin monitoring
CREATE POLICY "food_claims_read"
  ON food_claims FOR SELECT USING (true);
CREATE POLICY "food_claims_insert"
  ON food_claims FOR INSERT WITH CHECK (true);

-- ── Realtime ──────────────────────────────────────
-- Enable realtime on these tables in Supabase Dashboard:
--   Database → Replication → enable for: attendees, food_claims, results, event_config
--
-- Or run:
ALTER PUBLICATION supabase_realtime ADD TABLE attendees;
ALTER PUBLICATION supabase_realtime ADD TABLE food_claims;
ALTER PUBLICATION supabase_realtime ADD TABLE results;
ALTER PUBLICATION supabase_realtime ADD TABLE event_config;

-- =====================================================
-- REFEREE & COURT SYSTEM
-- Run this section after the base schema above
-- =====================================================

-- ── Courts ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS courts (
  id    int  PRIMARY KEY,
  name  text NOT NULL
);

INSERT INTO courts (id, name) VALUES
  (1,'Court 1'),(2,'Court 2'),(3,'Court 3'),(4,'Court 4'),(5,'Court 5'),
  (6,'Court 6'),(7,'Court 7'),(8,'Court 8'),(9,'Court 9'),(10,'Court 10')
ON CONFLICT (id) DO NOTHING;

-- ── Matches ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS matches (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id             int         NOT NULL REFERENCES courts(id),
  player1_name         text        NOT NULL,
  player2_name         text        NOT NULL,
  player1_external_id  text,
  player2_external_id  text,
  score1               int         DEFAULT 0,
  score2               int         DEFAULT 0,
  status               text        DEFAULT 'active',  -- active | completed | cancelled
  winner_external_id   text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS matches_court_status_idx ON matches (court_id, status);
CREATE INDEX IF NOT EXISTS matches_player1_idx ON matches (player1_external_id);
CREATE INDEX IF NOT EXISTS matches_player2_idx ON matches (player2_external_id);

-- ── Court Check-ins ───────────────────────────────

CREATE TABLE IF NOT EXISTS court_checkins (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id             int         NOT NULL REFERENCES courts(id),
  attendee_external_id text        NOT NULL,
  match_id             uuid        REFERENCES matches(id),
  checked_in_at        timestamptz DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────

ALTER TABLE courts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courts_read"           ON courts         FOR SELECT USING (true);
CREATE POLICY "matches_read"          ON matches        FOR SELECT USING (true);
CREATE POLICY "matches_insert"        ON matches        FOR INSERT WITH CHECK (true);
CREATE POLICY "matches_update"        ON matches        FOR UPDATE USING (true);
CREATE POLICY "court_checkins_read"   ON court_checkins FOR SELECT USING (true);
CREATE POLICY "court_checkins_insert" ON court_checkins FOR INSERT WITH CHECK (true);

-- ── Realtime ──────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE court_checkins;
