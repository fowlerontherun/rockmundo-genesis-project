-- Keep battles progressing automatically and close authorization gaps found in
-- the initial Battle of the Bands implementation.

CREATE OR REPLACE FUNCTION public.botb_is_active_member(p_band_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.band_members bm
    LEFT JOIN public.profiles p ON p.id = bm.profile_id
    WHERE bm.band_id = p_band_id
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND (bm.user_id = auth.uid() OR p.user_id = auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.botb_is_active_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.botb_is_active_member(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "Band members can withdraw their entry" ON public.botb_entries;
CREATE POLICY "Band members can withdraw their entry" ON public.botb_entries
  FOR DELETE TO authenticated USING (
    public.botb_is_active_member(botb_entries.band_id)
    AND EXISTS (
      SELECT 1 FROM public.botb_events e
      WHERE e.id = botb_entries.event_id
        AND e.status = 'upcoming'
        AND e.scheduled_date > now()
    )
  );

-- Patch the entry RPC rather than allowing legacy membership rows (whose
-- user_id can be null) to make valid members appear unauthorized.
CREATE OR REPLACE FUNCTION public.enter_battle_of_the_bands(
  p_event_id UUID, p_band_id UUID, p_profile_id UUID,
  p_song_1_id UUID, p_song_2_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_check JSONB;
  v_entry public.botb_entries;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'BOTB_UNAUTHENTICATED'; END IF;
  IF NOT public.botb_is_active_member(p_band_id) THEN RAISE EXCEPTION 'BOTB_NOT_BAND_MEMBER'; END IF;
  IF p_profile_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_profile_id AND user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'BOTB_INVALID_PROFILE'; END IF;
  IF p_song_1_id IS NULL OR p_song_2_id IS NULL OR p_song_1_id = p_song_2_id THEN
    RAISE EXCEPTION 'BOTB_INVALID_SONGS';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.botb_events
    WHERE id = p_event_id AND status = 'upcoming' AND scheduled_date > now()
  ) THEN RAISE EXCEPTION 'BOTB_INELIGIBLE: This battle is no longer open'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.songs WHERE id = p_song_1_id AND band_id = p_band_id AND NOT COALESCE(archived, false))
     OR NOT EXISTS (SELECT 1 FROM public.songs WHERE id = p_song_2_id AND band_id = p_band_id AND NOT COALESCE(archived, false)) THEN
    RAISE EXCEPTION 'BOTB_SONG_NOT_OWNED';
  END IF;

  v_check := public.botb_check_eligibility(p_event_id, p_band_id);
  IF NOT (v_check->>'eligible')::boolean THEN
    RAISE EXCEPTION 'BOTB_INELIGIBLE: %', v_check->>'reason';
  END IF;

  -- Lock the event so simultaneous final-slot entries cannot exceed capacity.
  PERFORM 1 FROM public.botb_events WHERE id = p_event_id FOR UPDATE;
  v_check := public.botb_check_eligibility(p_event_id, p_band_id);
  IF NOT (v_check->>'eligible')::boolean THEN
    RAISE EXCEPTION 'BOTB_INELIGIBLE: %', v_check->>'reason';
  END IF;

  INSERT INTO public.botb_entries (event_id, band_id, profile_id, user_id, song_1_id, song_2_id)
  VALUES (p_event_id, p_band_id, p_profile_id, auth.uid(), p_song_1_id, p_song_2_id)
  RETURNING * INTO v_entry;
  RETURN jsonb_build_object('success', true, 'entry_id', v_entry.id);
END;
$$;

REVOKE ALL ON FUNCTION public.enter_battle_of_the_bands(UUID, UUID, UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enter_battle_of_the_bands(UUID, UUID, UUID, UUID, UUID) TO authenticated, service_role;

-- The original migration created a runner but never scheduled it, leaving due
-- events unresolved and preventing yesterday's winners from reaching the news.
DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'run-battle-of-the-bands-cycle' LIMIT 1;
    IF v_job_id IS NOT NULL THEN PERFORM cron.unschedule(v_job_id); END IF;
    PERFORM cron.schedule(
      'run-battle-of-the-bands-cycle',
      '*/5 * * * *',
      'SELECT public.run_botb_cycle()'
    );
  END IF;
END;
$$;

SELECT public.run_botb_cycle();
