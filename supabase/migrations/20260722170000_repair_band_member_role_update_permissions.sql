-- Repair leader detection for band-member role updates across legacy user_id
-- leaders, profile_id leaders, and founder/manager membership rows.
CREATE OR REPLACE FUNCTION public.can_manage_band_members(target_band_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH actor_profiles AS (
    SELECT p.id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.bands b
    WHERE b.id = target_band_id
      AND (
        b.leader_id = auth.uid()
        OR b.leader_id IN (SELECT id FROM actor_profiles)
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.band_members bm
    WHERE bm.band_id = target_band_id
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND (
        bm.user_id = auth.uid()
        OR bm.profile_id IN (SELECT id FROM actor_profiles)
      )
      AND lower(COALESCE(bm.role, '')) IN ('leader', 'founder', 'co-leader', 'manager')
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

GRANT EXECUTE ON FUNCTION public.can_manage_band_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_band_member_performance_role(uuid, text) TO authenticated;
