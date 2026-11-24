CREATE FUNCTION private.festival_booking_preparation(p_booking_id uuid,p_expected_version integer DEFAULT NULL,p_song_ids uuid[] DEFAULT NULL,p_backstage_choice text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE actor uuid:=public._caller_profile_id(); b public.festival_artist_bookings%ROWTYPE; pr public.festival_artist_programmes%ROWTYPE; e public.festival_editions_v2%ROWTYPE; songs jsonb; total integer; zone text; prep jsonb;
BEGIN
 IF auth.uid() IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
 SELECT * INTO b FROM public.festival_artist_bookings WHERE id=p_booking_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'festival_artist_booking_invalid_transition'; END IF;
 SELECT * INTO pr FROM public.festival_artist_programmes WHERE id=b.festival_artist_programme_id;
 SELECT * INTO e FROM public.festival_editions_v2 WHERE id=pr.festival_edition_id;
 IF b.artist_type<>'band' OR b.band_id IS NULL OR NOT coalesce(public.caller_can_act_for_band(b.band_id),false) THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
 IF p_song_ids IS NOT NULL OR p_backstage_choice IS NOT NULL THEN
  IF b.status NOT IN ('confirmed','awaiting_schedule','scheduled') OR b.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'festival_artist_booking_invalid_transition'; END IF;
  SELECT c.timezone INTO zone FROM public.cities c WHERE c.id=e.city_id;
  IF e.starts_on IS NULL OR zone IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=zone) OR (now() AT TIME ZONE zone)::date >= e.starts_on THEN RAISE EXCEPTION 'festival_preparation_locked'; END IF;
  IF p_song_ids IS NOT NULL THEN
   IF cardinality(p_song_ids)<1 OR cardinality(p_song_ids)>50 OR cardinality(p_song_ids)<>(SELECT count(DISTINCT id) FROM unnest(p_song_ids) id) THEN RAISE EXCEPTION 'festival_setlist_invalid'; END IF;
   IF EXISTS(SELECT 1 FROM unnest(p_song_ids) song_id WHERE NOT EXISTS(SELECT 1 FROM public.songs s WHERE s.id=song_id AND s.band_id=b.band_id)) THEN RAISE EXCEPTION 'festival_setlist_song_not_owned'; END IF;
   SELECT sum(coalesce(nullif(duration_seconds,0),180)) INTO total FROM public.songs WHERE id=ANY(p_song_ids);
   IF total IS NULL OR total>b.set_minutes*60 THEN RAISE EXCEPTION 'festival_setlist_duration_exceeded'; END IF;
   b.contract_terms:=coalesce(b.contract_terms,'{}'::jsonb)||jsonb_build_object('playerPreparation',coalesce(b.contract_terms->'playerPreparation','{}'::jsonb)||jsonb_build_object('songIds',to_jsonb(p_song_ids),'durationSeconds',total,'savedAt',now()));
  END IF;
  IF p_backstage_choice IS NOT NULL THEN
   IF p_backstage_choice NOT IN ('focus_on_show','meet_the_press','support_the_band') THEN RAISE EXCEPTION 'festival_backstage_choice_invalid'; END IF;
   b.contract_terms:=coalesce(b.contract_terms,'{}'::jsonb)||jsonb_build_object('playerPreparation',coalesce(b.contract_terms->'playerPreparation','{}'::jsonb)||jsonb_build_object('backstageChoice',p_backstage_choice,'choiceRecordedAt',now()));
  END IF;
  UPDATE public.festival_artist_bookings SET contract_terms=b.contract_terms,version=version+1,updated_at=now() WHERE id=b.id RETURNING * INTO b;
  PERFORM public._festival_artist_audit(pr.festival_company_id,actor,'booking',b.id,'artist_preparation_saved',NULL,b.status,b.version);
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'durationSeconds',coalesce(nullif(s.duration_seconds,0),180)) ORDER BY s.title),'[]'::jsonb) INTO songs FROM public.songs s WHERE s.band_id=b.band_id;
 RETURN jsonb_build_object('bookingId',b.id,'version',b.version,'setMinutes',b.set_minutes,'festivalName',e.name,'festivalCompanyId',pr.festival_company_id,'festivalEditionId',e.id,'startsOn',e.starts_on,'preparation',coalesce(b.contract_terms->'playerPreparation','{}'::jsonb),'songs',songs);
END;
$$;
REVOKE ALL ON FUNCTION private.festival_booking_preparation(uuid,integer,uuid[],text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.festival_booking_preparation(uuid,integer,uuid[],text) TO authenticated;
CREATE FUNCTION public.festival_booking_preparation(p_booking_id uuid,p_expected_version integer DEFAULT NULL,p_song_ids uuid[] DEFAULT NULL,p_backstage_choice text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.festival_booking_preparation(p_booking_id,p_expected_version,p_song_ids,p_backstage_choice); $$;
REVOKE ALL ON FUNCTION public.festival_booking_preparation(uuid,integer,uuid[],text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.festival_booking_preparation(uuid,integer,uuid[],text) TO authenticated;
DO $$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('public.get_my_festival_artist_opportunities()'::regprocedure);
 definition:=replace(definition,'jsonb_agg(to_jsonb(b)) FROM public.festival_artist_bookings b','jsonb_agg(to_jsonb(b)||jsonb_build_object(''festivalCompanyId'',pr.festival_company_id,''festivalEditionId'',e.id,''festivalName'',e.name,''festivalDate'',b.provisional_date,''startsOn'',e.starts_on)) FROM public.festival_artist_bookings b JOIN public.festival_artist_programmes pr ON pr.id=b.festival_artist_programme_id JOIN public.festival_editions_v2 e ON e.id=pr.festival_edition_id');
 EXECUTE definition;
END $$;
NOTIFY pgrst,'reload schema';