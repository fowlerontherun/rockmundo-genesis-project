-- Keep the AFTER INSERT gig-lineup trigger on the same canonical membership
-- contract as book_gig and its schedule-conflict trigger.  In particular this
-- includes a row-less leader and excludes inactive/touring members.
CREATE OR REPLACE FUNCTION public.seed_gig_performers(p_gig_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gig public.gigs%ROWTYPE;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id;
  IF NOT FOUND OR COALESCE(v_gig.status, '') IN ('cancelled', 'failed') THEN
    RETURN 0;
  END IF;

  INSERT INTO public.gig_performers
    (gig_id, band_id, profile_id, role_or_instrument, lineup_status, selected_at)
  SELECT v_gig.id,
         v_gig.band_id,
         member.profile_id,
         NULLIF(COALESCE(bm.instrument_role, bm.role), ''),
         'selected',
         now()
  FROM public.active_band_performing_members(v_gig.band_id) member
  LEFT JOIN LATERAL (
    SELECT candidate.instrument_role, candidate.role, candidate.joined_at
    FROM public.band_members candidate
    WHERE candidate.band_id = v_gig.band_id
      AND candidate.profile_id = member.profile_id
    ORDER BY candidate.joined_at NULLS LAST, candidate.id
    LIMIT 1
  ) bm ON true
  WHERE bm.joined_at IS NULL OR bm.joined_at <= v_gig.scheduled_date
  ON CONFLICT ON CONSTRAINT gig_performers_unique DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_gig_performers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_gig_performers(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
