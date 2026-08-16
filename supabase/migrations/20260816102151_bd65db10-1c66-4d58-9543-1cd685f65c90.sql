-- 1. Multiple performance roles per member
ALTER TABLE public.band_members
  ADD COLUMN IF NOT EXISTS instrument_roles text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.band_members
SET instrument_roles = ARRAY[instrument_role]
WHERE cardinality(instrument_roles) = 0
  AND instrument_role IS NOT NULL
  AND instrument_role <> '';

-- 2. Fix leader access rule (bands.leader_id stores a profile id, not auth.uid())
DROP POLICY IF EXISTS "Band leaders can manage members" ON public.band_members;

CREATE POLICY "Band leaders can manage members"
ON public.band_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bands b
    JOIN public.profiles p ON p.id = b.leader_id
    WHERE b.id = band_members.band_id AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bands b
    JOIN public.profiles p ON p.id = b.leader_id
    WHERE b.id = band_members.band_id AND p.user_id = auth.uid()
  )
);

-- Members may update their own membership row
DROP POLICY IF EXISTS "Members can update their own membership" ON public.band_members;
CREATE POLICY "Members can update their own membership"
ON public.band_members
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  user_id = auth.uid()
  OR profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.band_members TO authenticated;
GRANT SELECT ON public.band_members TO anon;
GRANT ALL ON public.band_members TO service_role;

-- 3. Authorisation helper: caller is the band's leader OR the member themselves
CREATE OR REPLACE FUNCTION public.band_member_edit_authorised(p_member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.band_members bm
    LEFT JOIN public.bands b ON b.id = bm.band_id
    LEFT JOIN public.profiles lp ON lp.id = b.leader_id
    WHERE bm.id = p_member_id
      AND (
        lp.user_id = auth.uid()
        OR bm.user_id = auth.uid()
        OR bm.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
        OR lower(coalesce(bm.role, '')) IN ('leader', 'founder', 'co-leader', 'manager')
           AND bm.user_id = auth.uid()
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.band_member_edit_authorised(uuid) TO authenticated;

-- 4. Save one or more performance roles
CREATE OR REPLACE FUNCTION public.update_band_member_roles(
  p_member_id uuid,
  p_instrument_roles text[]
)
RETURNS public.band_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_roles text[];
  v_row public.band_members;
BEGIN
  IF NOT public.band_member_edit_authorised(p_member_id) THEN
    RAISE EXCEPTION 'Not authorised to change roles for this member' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(DISTINCT btrim(r))
  INTO v_roles
  FROM unnest(coalesce(p_instrument_roles, '{}'::text[])) AS r
  WHERE btrim(coalesce(r, '')) <> '';

  IF v_roles IS NULL OR cardinality(v_roles) = 0 THEN
    RAISE EXCEPTION 'At least one performance role is required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.band_members
  SET instrument_roles = v_roles,
      instrument_role = v_roles[1]
  WHERE id = p_member_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_band_member_roles(uuid, text[]) TO authenticated;

-- Back-compat single-role entry point used by existing UI
CREATE OR REPLACE FUNCTION public.update_band_member_performance_role(
  p_member_id uuid,
  p_instrument_role text
)
RETURNS public.band_members
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.update_band_member_roles(p_member_id, ARRAY[p_instrument_role]);
$$;

GRANT EXECUTE ON FUNCTION public.update_band_member_performance_role(uuid, text) TO authenticated;

-- 5. Travel setting (leader or the member themselves)
CREATE OR REPLACE FUNCTION public.set_band_member_travel(
  p_member_id uuid,
  p_travels_with_band boolean
)
RETURNS public.band_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.band_members;
BEGIN
  IF NOT public.band_member_edit_authorised(p_member_id) THEN
    RAISE EXCEPTION 'Not authorised to change travel settings for this member' USING ERRCODE = '42501';
  END IF;

  UPDATE public.band_members
  SET travels_with_band = coalesce(p_travels_with_band, false)
  WHERE id = p_member_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_band_member_travel(uuid, boolean) TO authenticated;