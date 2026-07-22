-- Repair and explicitly reload the touring-member hire RPC contract.
-- Some hosted databases missed the original helper in the PostgREST schema cache,
-- which caused frontend RPC calls to fail even though the client supplied the
-- expected named arguments.

CREATE OR REPLACE FUNCTION public.hire_band_touring_member(
  p_band_id uuid,
  p_member_name text,
  p_instrument_role text,
  p_tier integer,
  p_weekly_cost integer
)
RETURNS public.band_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_member public.band_members;
  normalized_name text;
  normalized_role text;
BEGIN
  normalized_name := NULLIF(btrim(COALESCE(p_member_name, '')), '');
  normalized_role := NULLIF(btrim(COALESCE(p_instrument_role, '')), '');

  IF normalized_name IS NULL OR char_length(normalized_name) > 50 THEN
    RAISE EXCEPTION 'invalid_touring_member_name';
  END IF;

  IF normalized_role IS NULL OR char_length(normalized_role) > 50 THEN
    RAISE EXCEPTION 'invalid_performance_role';
  END IF;

  IF p_tier IS NULL OR p_tier < 1 OR p_tier > 5 THEN
    RAISE EXCEPTION 'invalid_touring_member_tier';
  END IF;

  IF p_weekly_cost IS NULL OR p_weekly_cost < 0 THEN
    RAISE EXCEPTION 'invalid_touring_member_cost';
  END IF;

  IF NOT public.can_manage_band_members(p_band_id) THEN
    RAISE EXCEPTION 'not_band_manager';
  END IF;

  INSERT INTO public.band_members (
    band_id,
    user_id,
    profile_id,
    role,
    instrument_role,
    is_touring_member,
    touring_member_tier,
    touring_member_cost,
    salary,
    member_status
  ) VALUES (
    p_band_id,
    NULL,
    NULL,
    normalized_name,
    normalized_role,
    true,
    p_tier,
    p_weekly_cost,
    p_weekly_cost,
    'active'
  )
  RETURNING * INTO new_member;

  RETURN new_member;
END;
$$;

GRANT EXECUTE ON FUNCTION public.hire_band_touring_member(uuid, text, text, integer, integer) TO authenticated;

-- Ask PostgREST to refresh its function signature cache immediately after deploy.
NOTIFY pgrst, 'reload schema';
