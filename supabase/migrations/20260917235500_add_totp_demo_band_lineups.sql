-- Admin-only helper for the Top of the Pops dry-run demo.
-- Returns active player-controlled band members so the 3D demo can render
-- the real lineup without exposing band-member data as a public RPC.

CREATE OR REPLACE FUNCTION public.totp_admin_test_band_lineups(p_band_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT coalesce(
    jsonb_object_agg(grouped.band_id::text, grouped.members),
    '{}'::jsonb
  )
  INTO v_result
  FROM (
    SELECT
      bm.band_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'profile_id', bm.profile_id,
            'display_name', coalesce(p.stage_name, p.display_name, p.username, 'Band member'),
            'role', coalesce(nullif(bm.role, ''), 'member'),
            'instrument_role', bm.instrument_role,
            'vocal_role', bm.vocal_role
          )
          ORDER BY coalesce(p.stage_name, p.display_name, p.username, ''), bm.id
        ) FILTER (WHERE bm.profile_id IS NOT NULL),
        '[]'::jsonb
      ) AS members
    FROM public.band_members bm
    LEFT JOIN public.profiles p ON p.id = bm.profile_id
    WHERE bm.band_id = ANY(coalesce(p_band_ids, ARRAY[]::uuid[]))
      AND coalesce(bm.member_status, 'active') = 'active'
      AND coalesce(bm.is_touring_member, false) = false
    GROUP BY bm.band_id
  ) grouped;

  RETURN coalesce(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_test_band_lineups(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_admin_test_band_lineups(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.totp_admin_test_band_lineups(uuid[]) IS
  'Admin-only read-only lineup helper used by the Top of the Pops dry-run 3D demo.';
