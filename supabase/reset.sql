-- =====================================================
-- SMASH Badminton Event — Reset (keep roster, clear state)
-- Run this in your Supabase SQL Editor to start a fresh run.
--
-- WHAT THIS DOES:
--   • Keeps the attendees roster, but un-checks everyone in
--   • Clears every food claim, match, court check-in and result
--   • Keeps schema, seeds (food_items, courts) and RLS untouched
--
-- This DELETES live data permanently and cannot be undone.
-- Take a backup first if you are unsure (Database → Backups).
-- =====================================================

BEGIN;

-- ── Wipe transactional / live data ────────────────
-- TRUNCATE resets these in one shot. court_checkins references
-- matches, so both are truncated together to satisfy the FK.
TRUNCATE court_checkins, matches, food_claims RESTART IDENTITY;

-- results has no incoming FKs — a plain delete keeps it simple.
DELETE FROM results;

-- ── Reset the roster's check-in status ────────────
-- Roster rows stay; everyone is marked not-checked-in again.
UPDATE attendees
SET checked_in    = false,
    check_in_time = NULL;

-- ── OPTIONAL: drop day-of walk-in registrations ───
-- Walk-ins (external_id like 'W%') are created on the event day,
-- not part of the imported roster. Uncomment to remove them so a
-- re-run starts the W-numbering clean instead of keeping test rows.
-- DELETE FROM attendees WHERE walk_in = true OR external_id LIKE 'W%';

-- ── OPTIONAL: clear event content (MOTM / announcement / seating) ─
-- Uncomment to blank out the configurable content as well.
-- UPDATE event_config
-- SET value = ''
-- WHERE key IN ('motm_name','motm_team','motm_image_url','announcement','seating_map_url');

COMMIT;

-- ── Sanity check (optional) ───────────────────────
-- SELECT
--   (SELECT count(*) FROM attendees)                          AS roster,
--   (SELECT count(*) FROM attendees WHERE checked_in)         AS checked_in,
--   (SELECT count(*) FROM food_claims)                        AS claims,
--   (SELECT count(*) FROM matches)                            AS matches,
--   (SELECT count(*) FROM court_checkins)                     AS court_checkins,
--   (SELECT count(*) FROM results)                            AS results;
