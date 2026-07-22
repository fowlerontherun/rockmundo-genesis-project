-- Authoritative band-member management helpers for leader-only roster edits.
-- These avoid browser writes being blocked by band_members RLS policies that still
-- depend on historical user_id-based leader checks while the app now uses profiles.

CREATE OR REPLACE FUNCTION public.can_manage_band_members(target_band_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        EXISTS (
          SELECT 1
          FROM public.bands b
          WHERE b.id = target_band_id
            AND (b.leader_id = auth.uid() OR b.leader_id = p.id)
        )
        OR EXISTS (
          SELECT 1
          FROM public.band_members bm
          WHERE bm.band_id = target_band_id
            AND COALESCE(bm.member_status, 'active') = 'active'
            AND (bm.user_id = auth.uid() OR bm.profile_id = p.id)
            AND lower(COALESCE(bm.role, '')) IN ('leader', 'founder', 'co-leader', 'manager')
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.update_band_member_performance_role(
  p_member_id uuid,
  p_instrument_role text
)
RETURNS public.band_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_member public.band_members;
  normalized_role text;
BEGIN
  normalized_role := NULLIF(btrim(COALESCE(p_instrument_role, '')), '');

  IF normalized_role IS NULL OR char_length(normalized_role) > 50 THEN
    RAISE EXCEPTION 'invalid_performance_role';
  END IF;

  SELECT * INTO target_member
  FROM public.band_members
  WHERE id = p_member_id
  FOR UPDATE;

  IF target_member.id IS NULL THEN
    RAISE EXCEPTION 'band_member_not_found';
  END IF;

  IF NOT public.can_manage_band_members(target_member.band_id) THEN
    RAISE EXCEPTION 'not_band_manager';
  END IF;

  UPDATE public.band_members
  SET instrument_role = normalized_role
  WHERE id = p_member_id
  RETURNING * INTO target_member;

  RETURN target_member;
END;
$$;

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

GRANT EXECUTE ON FUNCTION public.can_manage_band_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_band_member_performance_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hire_band_touring_member(uuid, text, text, integer, integer) TO authenticated;
