-- =====================================================
-- Excom members get unlimited food quota
-- Run this in your Supabase SQL Editor (anon key can't replace functions).
--
-- Attendees with role = 'Excom' bypass the per-item quota check in claim_food;
-- everyone else stays capped at food_items.quota. This mirrors the updated
-- claim_food in schema.sql — running either keeps them in sync.
-- =====================================================

CREATE OR REPLACE FUNCTION claim_food(
  p_attendee_external_id text,
  p_item_id              text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quota     int;
  v_claimed   int;
  v_remaining int;
  v_role      text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_attendee_external_id), hashtext(p_item_id));

  SELECT quota INTO v_quota FROM food_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'item_not_found');
  END IF;

  SELECT role INTO v_role FROM attendees WHERE external_id = p_attendee_external_id;

  SELECT COUNT(*) INTO v_claimed
  FROM food_claims
  WHERE attendee_external_id = p_attendee_external_id AND item_id = p_item_id;

  -- Everyone except Excom is capped at the per-item quota.
  IF v_role IS DISTINCT FROM 'Excom' AND v_claimed >= v_quota THEN
    RETURN json_build_object('success', false, 'error', 'quota_reached',
                             'claimed', v_claimed, 'quota', v_quota);
  END IF;

  INSERT INTO food_claims (attendee_external_id, item_id)
  VALUES (p_attendee_external_id, p_item_id);

  v_remaining := CASE WHEN v_role = 'Excom' THEN 999 ELSE v_quota - v_claimed - 1 END;

  RETURN json_build_object('success', true, 'claimed', v_claimed + 1,
                           'quota', v_quota, 'remaining', v_remaining,
                           'unlimited', v_role = 'Excom');
END;
$$;
