-- Production repair: attribute spend must match 13 displayed attribute keys
-- and the client cap of 1000 (previous RPC permitted 8 keys and capped at 100).
-- Atomic wallet debit and attribute increment, with no automatic payouts.
CREATE OR REPLACE FUNCTION public.spend_attribute_points_atomic(
  p_profile_id uuid, p_attribute text, p_cost integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_wallet public.player_xp_wallet%ROWTYPE;
  v_value integer;
BEGIN
  IF auth.uid() IS NULL OR p_profile_id IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = p_profile_id AND p.user_id = auth.uid()
         AND p.is_active IS TRUE AND p.deleted_at IS NULL AND p.died_at IS NULL
     ) THEN
    RAISE EXCEPTION 'PROFILE_NOT_OWNED' USING ERRCODE = '42501';
  END IF;

  -- Match src/utils/attributeProgression.ts FULL_ATTRIBUTE_KEYS.
  -- Validate the column name BEFORE interpolating it as a SQL identifier.
  IF p_attribute IS NULL OR p_attribute NOT IN (
    'charisma', 'looks', 'mental_focus', 'musicality',
    'physical_endurance', 'stage_presence', 'crowd_engagement',
    'social_reach', 'musical_ability', 'vocal_talent',
    'rhythm_sense', 'creative_insight', 'technical_mastery'
  ) OR p_cost IS NULL OR p_cost < 1 OR p_cost > 100 THEN
    RAISE EXCEPTION 'INVALID_ATTRIBUTE_OR_COST' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_wallet
    FROM public.player_xp_wallet
    WHERE profile_id = p_profile_id FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_wallet.attribute_points_balance, 0) < p_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_ATTRIBUTE_POINTS';
  END IF;

  INSERT INTO public.player_attributes(profile_id, user_id)
    SELECT p.id,p.user_id FROM public.profiles p WHERE p.id=p_profile_id
    ON CONFLICT (profile_id) DO NOTHING;

  EXECUTE format(
    'SELECT COALESCE(%I,0) FROM public.player_attributes WHERE profile_id=$1 FOR UPDATE',
    p_attribute
  ) INTO v_value USING p_profile_id;

  IF v_value IS NULL THEN
    RAISE EXCEPTION 'ATTRIBUTE_ROW_MISSING';
  END IF;

  -- The client currently displays values up to 1000, not 100.
  IF v_value + p_cost > 1000 THEN
    RAISE EXCEPTION 'ATTRIBUTE_CAP_EXCEEDED';
  END IF;

  UPDATE public.player_xp_wallet
    SET attribute_points_balance = COALESCE(attribute_points_balance,0) - p_cost,
        last_recalculated = now()
    WHERE profile_id = p_profile_id;

  EXECUTE format(
    'UPDATE public.player_attributes SET %I=$2, attribute_points_spent=COALESCE(attribute_points_spent,0)+$3 WHERE profile_id=$1',
    p_attribute
  ) USING p_profile_id, v_value + p_cost, p_cost;
END;
$$;

REVOKE ALL ON FUNCTION public.spend_attribute_points_atomic(uuid,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_attribute_points_atomic(uuid,text,integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
