-- Event acknowledgements may be lost on mobile. Make retries stable,
-- server-ordered and safe without accepting browser timestamps.
ALTER TABLE public.dj_live_mix_events
 ADD COLUMN IF NOT EXISTS client_event_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS dj_live_mix_unique_client_event
 ON public.dj_live_mix_events(booking_id,client_event_id)
 WHERE client_event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.dj_record_mix_event_once_at(p_booking_id uuid, p_kind text, p_deck text, p_source text, p_track_id uuid, p_value numeric, p_event_id uuid, p_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
 v_actor uuid:=(SELECT auth.uid());
 v_book public.dj_bookings%ROWTYPE;
 v_session public.dj_performance_sessions%ROWTYPE;
 v_last_at timestamptz;
 v_count integer;
 v_result uuid;
 v_prior public.dj_live_mix_events%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR p_booking_id IS NULL OR p_at IS NULL THEN
  RAISE EXCEPTION 'Authenticated booked DJ session required'
    USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_book FROM public.dj_bookings
  WHERE id=p_booking_id AND user_id=v_actor FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'DJ mixer evidence requires an owned booking'
    USING ERRCODE='42501';
 END IF;
 IF p_event_id IS NULL THEN
  RAISE EXCEPTION 'A unique DJ interaction ID is required'
    USING ERRCODE='22023';
 END IF;
 -- A request that committed but lost its response can be safely replayed,
 -- even if the booked set has since completed. Reuse is valid only with
 -- exactly the same event payload and owned booking.
 SELECT * INTO v_prior FROM public.dj_live_mix_events
  WHERE booking_id=v_book.id AND client_event_id=p_event_id;
 IF FOUND THEN
   IF v_prior.kind IS DISTINCT FROM p_kind OR
      v_prior.deck IS DISTINCT FROM p_deck OR
      v_prior.track_source IS DISTINCT FROM p_source OR
      v_prior.track_id IS DISTINCT FROM p_track_id OR
      v_prior.control_value IS DISTINCT FROM p_value THEN
    RAISE EXCEPTION 'DJ event ID cannot be reused for another interaction'
      USING ERRCODE='22023';
   END IF;
   RETURN v_prior.id;
 END IF;
 IF v_book.status<>'live' THEN
  RAISE EXCEPTION 'DJ mixer evidence requires a live owned booking'
    USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_session FROM public.dj_performance_sessions
  WHERE booking_id=v_book.id AND user_id=v_actor AND status='live';
 IF NOT FOUND THEN
  RAISE EXCEPTION 'DJ live session not found' USING ERRCODE='42501';
 END IF;
 IF p_at<v_session.started_at OR p_at>v_book.ends_at THEN
  RAISE EXCEPTION 'DJ interaction outside live performance window'
    USING ERRCODE='22023';
 END IF;
 IF p_kind NOT IN ('deck_play','crossfade','tempo') OR p_kind IS NULL THEN
  RAISE EXCEPTION 'Unsupported DJ mixer interaction' USING ERRCODE='22023';
 END IF;
 IF p_kind='deck_play' THEN
  IF p_deck NOT IN ('A','B') OR p_source NOT IN ('game','admin')
     OR p_track_id IS NULL OR p_value IS NOT NULL THEN
   RAISE EXCEPTION 'DJ deck play requires eligible saved track'
    USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_session.setlist_snapshot) item
    WHERE item->>'id'=p_track_id::text AND item->>'source'=p_source
  ) THEN
   RAISE EXCEPTION 'Cannot perform with a track outside booked setlist'
     USING ERRCODE='42501';
  END IF;
  -- Consent can be revoked mid-set. Do not accept unlicensed events.
  IF p_source='game' AND NOT EXISTS(
    SELECT 1 FROM public.songs s WHERE s.id=p_track_id
      AND NOT coalesce(s.archived,false)
      AND (s.audio_url IS NOT NULL OR s.extended_audio_url IS NOT NULL)
      AND (
        (s.user_id=v_actor AND s.profile_id=v_book.profile_id
          AND s.status IN ('recorded','released','completed','mastered'))
        OR (s.dj_use_allowed=true AND s.status IN ('recorded','released'))
      )
  ) THEN RAISE EXCEPTION 'DJ song is no longer licensed to play'
       USING ERRCODE='42501'; END IF;
  IF p_source='admin' AND NOT EXISTS(
    SELECT 1 FROM public.dj_audio_tracks t
     WHERE t.id=p_track_id AND t.is_active AND t.rights_confirmed
  ) THEN RAISE EXCEPTION 'Club song is no longer licensed to play'
       USING ERRCODE='42501'; END IF;
 ELSIF p_kind='tempo' THEN
  IF p_deck NOT IN ('A','B') OR p_source IS NOT NULL
    OR p_track_id IS NOT NULL OR p_value NOT BETWEEN 85 AND 115
  THEN RAISE EXCEPTION 'Invalid tempo event' USING ERRCODE='22023'; END IF;
 ELSIF p_kind='crossfade' THEN
  IF p_deck IS NOT NULL OR p_source IS NOT NULL
    OR p_track_id IS NOT NULL OR p_value NOT BETWEEN 0 AND 100
  THEN RAISE EXCEPTION 'Invalid crossfade event' USING ERRCODE='22023'; END IF;
 END IF;

 -- Booking FOR UPDATE serializes event order against settlement. There is no
 -- client supplied sequence or timestamp; at least 2 sec separates events.
 SELECT count(*),max(recorded_at) INTO v_count,v_last_at
 FROM public.dj_live_mix_events WHERE session_id=v_session.id;
 IF v_count>=120 THEN RAISE EXCEPTION 'DJ event limit exceeded'
   USING ERRCODE='22023'; END IF;
 IF v_last_at IS NOT NULL AND p_at<v_last_at+interval '2 seconds' THEN
  RAISE EXCEPTION 'DJ mixer events submitted too quickly'
   USING ERRCODE='22023';
 END IF;

 INSERT INTO public.dj_live_mix_events(
  session_id,booking_id,user_id,profile_id,event_no,kind,
  deck,track_source,track_id,control_value,recorded_at,client_event_id
 ) VALUES (
  v_session.id,v_book.id,v_actor,v_book.profile_id,v_count+1,p_kind,
  p_deck,p_source,p_track_id,p_value,p_at,p_event_id
 ) RETURNING id INTO v_result;
 RETURN v_result;
END;
$function$
;
REVOKE ALL ON FUNCTION private.dj_record_mix_event_once_at(
 uuid,text,text,text,uuid,numeric,uuid,timestamptz
) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.dj_verified_mix_event_once_service(
 p_actor_user_id uuid,p_booking_id uuid,p_kind text,p_deck text,
 p_source text,p_track_id uuid,p_value numeric,p_event_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
 SET search_path=public,private,pg_temp AS $$
DECLARE
 v_previous text:=current_setting('request.jwt.claim.sub',true);
 v_result uuid;
BEGIN
 IF p_actor_user_id IS NULL OR NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id=p_actor_user_id
 ) THEN
  RAISE EXCEPTION 'A verified DJ account is required'
   USING ERRCODE='42501';
 END IF;
 PERFORM set_config('request.jwt.claim.sub',p_actor_user_id::text,true);
 v_result:=private.dj_record_mix_event_once_at(
  p_booking_id,p_kind,p_deck,p_source,p_track_id,p_value,p_event_id,
  clock_timestamp());
 PERFORM set_config('request.jwt.claim.sub',coalesce(v_previous,''),true);
 RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.dj_verified_mix_event_once_service(
 uuid,uuid,text,text,text,uuid,numeric,uuid
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dj_verified_mix_event_once_service(
 uuid,uuid,text,text,text,uuid,numeric,uuid
) TO service_role;

COMMENT ON COLUMN public.dj_live_mix_events.client_event_id IS
 'Idempotency key for a server-verified mixer interaction; browser can retry the same payload without an extra event.';
