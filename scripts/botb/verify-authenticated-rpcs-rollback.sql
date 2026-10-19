-- Verify the real authenticated RPC execution path after revoking direct
-- botb_events/botb_entries write grants. This deliberately switches to the
-- authenticated DB role with a real registered player's JWT subject.
-- Both writes run in exception subtransactions and are fully rolled back.
-- Requires trusted SQL administrator access.

DO $auth_withdrawal$
DECLARE
  v record;
  v_response jsonb;
BEGIN
  SELECT be.id AS entry_id,be.user_id INTO v
  FROM public.botb_entries be
  JOIN public.botb_events e ON e.id=be.event_id
  WHERE e.status='upcoming' AND e.scheduled_date>now()
  ORDER BY e.scheduled_date LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOTB_AUTH_TEST_MISSING_ENTRY'; END IF;

  BEGIN
    PERFORM set_config('request.jwt.claim.sub',v.user_id::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    IF current_user<>'authenticated' THEN
      RAISE EXCEPTION 'BOTB_AUTH_TEST_ROLE_NOT_SET';
    END IF;
    v_response:=public.withdraw_battle_of_the_bands_entry(v.entry_id);
    IF coalesce((v_response->>'success')::boolean,false) IS DISTINCT FROM TRUE
    THEN RAISE EXCEPTION 'BOTB_AUTH_WITHDRAWAL_FAILED %',v_response; END IF;
    RAISE EXCEPTION 'BOTB_AUTH_WITHDRAWAL_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'BOTB_AUTH_WITHDRAWAL_ROLLBACK' THEN RAISE; END IF;
  END;

  IF NOT EXISTS(SELECT 1 FROM public.botb_entries WHERE id=v.entry_id) THEN
    RAISE EXCEPTION 'BOTB_AUTH_WITHDRAWAL_ROLLBACK_LEAK';
  END IF;
END;
$auth_withdrawal$;

DO $auth_entry$
DECLARE
  v record;
  v_response jsonb;
BEGIN
  SELECT e.id AS event_id,bm.band_id,bm.user_id,bm.profile_id,
         songs.song_1_id,songs.song_2_id
  INTO v
  FROM public.botb_events e
  CROSS JOIN (
    SELECT DISTINCT ON(band_id) band_id,user_id,profile_id
    FROM public.band_members
    WHERE user_id IS NOT NULL AND profile_id IS NOT NULL
      AND coalesce(member_status,'active')='active'
    ORDER BY band_id,joined_at DESC NULLS LAST
  ) bm
  JOIN LATERAL (
    SELECT (array_agg(s.id ORDER BY s.id))[1] song_1_id,
           (array_agg(s.id ORDER BY s.id))[2] song_2_id
    FROM public.songs s
    WHERE s.band_id=bm.band_id AND coalesce(s.archived,false)=false
  ) songs
    ON songs.song_1_id IS NOT NULL AND songs.song_2_id IS NOT NULL
  WHERE e.status='upcoming' AND e.scheduled_date>now()+interval '1 day'
    AND (public.botb_check_eligibility(e.id,bm.band_id)->>'eligible')::boolean
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOTB_AUTH_TEST_NO_ELIGIBLE_ENTRY'; END IF;

  BEGIN
    PERFORM set_config('request.jwt.claim.sub',v.user_id::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    IF current_user<>'authenticated' THEN
      RAISE EXCEPTION 'BOTB_AUTH_TEST_ROLE_NOT_SET';
    END IF;
    v_response:=public.enter_battle_of_the_bands(
      v.event_id,v.band_id,v.profile_id,v.song_1_id,v.song_2_id);
    IF coalesce((v_response->>'success')::boolean,false) IS DISTINCT FROM TRUE
    THEN RAISE EXCEPTION 'BOTB_AUTH_ENTRY_FAILED %',v_response; END IF;
    RAISE EXCEPTION 'BOTB_AUTH_ENTRY_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'BOTB_AUTH_ENTRY_ROLLBACK' THEN RAISE; END IF;
  END;

  IF EXISTS(SELECT 1 FROM public.botb_entries
    WHERE event_id=v.event_id AND band_id=v.band_id)
  THEN RAISE EXCEPTION 'BOTB_AUTH_ENTRY_ROLLBACK_LEAK'; END IF;
END;
$auth_entry$;

SELECT 'PASS' AS authenticated_botb_rpc_smoke;
