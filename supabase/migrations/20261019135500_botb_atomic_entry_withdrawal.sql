-- 2026-10-19: serialize band registrations and withdrawals with resolution.
-- Event row is locked before mutating entries. Other gameplay does not change.

CREATE OR REPLACE FUNCTION public.enter_battle_of_the_bands(
  p_event_id uuid, p_band_id uuid, p_profile_id uuid,
  p_song_1_id uuid, p_song_2_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $enter_botb$
DECLARE
  v_event public.botb_events;
  v_check jsonb;
  v_entry public.botb_entries;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'BOTB_UNAUTHENTICATED';
  END IF;
  IF p_event_id IS NULL OR p_band_id IS NULL THEN
    RAISE EXCEPTION 'BOTB_INVALID_EVENT_OR_BAND';
  END IF;

  -- SETTLEMENT ALSO LOCKS THE EVENT FIRST, so entry and resolution cannot
  -- race on count, event status, scoring or payments. A concurrent mayor's
  -- event replacement also takes this row lock before deleting a free slot.
  SELECT * INTO v_event FROM public.botb_events
  WHERE id=p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOTB_EVENT_NOT_FOUND'; END IF;
  IF v_event.status<>'upcoming' OR v_event.scheduled_date<=clock_timestamp() THEN
    RAISE EXCEPTION 'BOTB_EVENT_CLOSED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id=p_band_id AND bm.user_id=auth.uid()
      AND COALESCE(bm.member_status,'active')='active'
      AND (p_profile_id IS NULL OR bm.profile_id=p_profile_id)
  ) THEN
    RAISE EXCEPTION 'BOTB_NOT_BAND_MEMBER';
  END IF;
  IF p_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=p_profile_id AND p.user_id=auth.uid()
  ) THEN
    RAISE EXCEPTION 'BOTB_INVALID_PROFILE';
  END IF;

  IF p_song_1_id IS NULL OR p_song_2_id IS NULL
     OR p_song_1_id=p_song_2_id THEN
    RAISE EXCEPTION 'BOTB_INVALID_SONGS';
  END IF;
  -- Archived or deleted tracks cannot become selected Battle songs.
  IF (SELECT count(*) FROM public.songs s
      WHERE s.id IN(p_song_1_id,p_song_2_id)
        AND s.band_id=p_band_id AND COALESCE(s.archived,false)=false)<>2 THEN
    RAISE EXCEPTION 'BOTB_SONG_NOT_OWNED';
  END IF;

  v_check:=public.botb_check_eligibility(p_event_id,p_band_id);
  IF NOT COALESCE((v_check->>'eligible')::boolean,false) THEN
    RAISE EXCEPTION 'BOTB_INELIGIBLE: %',COALESCE(v_check->>'reason','Not eligible');
  END IF;

  INSERT INTO public.botb_entries
    (event_id,band_id,profile_id,user_id,song_1_id,song_2_id)
  VALUES(p_event_id,p_band_id,p_profile_id,auth.uid(),
    p_song_1_id,p_song_2_id)
  RETURNING * INTO v_entry;

  RETURN jsonb_build_object('success',true,'entry_id',v_entry.id);
END;
$enter_botb$;
REVOKE ALL ON FUNCTION public.enter_battle_of_the_bands(uuid,uuid,uuid,uuid,uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.enter_battle_of_the_bands(uuid,uuid,uuid,uuid,uuid)
  TO authenticated,service_role;

-- Deliberately retain direct DELETE grant temporarily for existing deployed
-- frontend versions. New clients use this safe withdrawal RPC; direct DELETE
-- can be revoked after the frontend PR is live, avoiding a release-window bug.
CREATE OR REPLACE FUNCTION public.withdraw_battle_of_the_bands_entry(p_entry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $withdraw_botb$
DECLARE
  v_event_id uuid;
  v_event public.botb_events;
  v_deleted_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'BOTB_UNAUTHENTICATED'; END IF;
  IF p_entry_id IS NULL THEN RAISE EXCEPTION 'BOTB_ENTRY_NOT_FOUND'; END IF;

  SELECT b.event_id INTO v_event_id
  FROM public.botb_entries b WHERE b.id=p_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOTB_ENTRY_NOT_FOUND'; END IF;

  -- Match the resolver and registration lock order: EVENT row first.
  SELECT * INTO v_event
  FROM public.botb_events WHERE id=v_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.status<>'upcoming'
     OR v_event.scheduled_date<=clock_timestamp() THEN
    RAISE EXCEPTION 'BOTB_ENTRY_CLOSED';
  END IF;

  DELETE FROM public.botb_entries b
  WHERE b.id=p_entry_id AND b.event_id=v_event.id
    AND EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id=b.band_id AND bm.user_id=auth.uid()
        AND COALESCE(bm.member_status,'active')='active'
    )
  RETURNING b.id INTO v_deleted_id;
  IF v_deleted_id IS NULL THEN
    RAISE EXCEPTION 'BOTB_NOT_BAND_MEMBER';
  END IF;
  RETURN jsonb_build_object('success',true,'entry_id',v_deleted_id);
END;
$withdraw_botb$;
REVOKE ALL ON FUNCTION public.withdraw_battle_of_the_bands_entry(uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.withdraw_battle_of_the_bands_entry(uuid)
  TO authenticated,service_role;
