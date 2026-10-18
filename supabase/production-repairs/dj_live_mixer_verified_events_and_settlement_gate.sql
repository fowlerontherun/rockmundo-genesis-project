-- DJ live-mixer evidence: service-owned event log and authoritative payout gate.
-- This measures server-observed interactive use and real elapsed time. It does
-- NOT cryptographically prove audio output. Feature flags remain OFF.

CREATE TABLE IF NOT EXISTS public.dj_live_mix_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.dj_performance_sessions(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL REFERENCES public.dj_bookings(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  event_no integer NOT NULL CHECK (event_no BETWEEN 1 AND 120),
  kind text NOT NULL CHECK (kind IN ('deck_play','crossfade','tempo')),
  deck text CHECK (deck IN ('A','B')),
  track_source text CHECK (track_source IN ('game','admin')),
  track_id uuid,
  control_value numeric,
  recorded_at timestamptz NOT NULL,
  CONSTRAINT dj_live_mix_event_unique_order UNIQUE(session_id,event_no),
  CONSTRAINT dj_mix_event_shape CHECK (
    (kind='deck_play' AND deck IN ('A','B') AND track_source IN ('game','admin')
       AND track_id IS NOT NULL AND control_value IS NULL)
    OR
    (kind='tempo' AND deck IN ('A','B') AND track_source IS NULL
       AND track_id IS NULL AND control_value BETWEEN 85 AND 115)
    OR
    (kind='crossfade' AND deck IS NULL AND track_source IS NULL
       AND track_id IS NULL AND control_value BETWEEN 0 AND 100)
  )
);
CREATE INDEX IF NOT EXISTS dj_live_mix_events_session_time_idx
 ON public.dj_live_mix_events(session_id,recorded_at);
ALTER TABLE public.dj_live_mix_events ENABLE ROW LEVEL SECURITY;
REVOKE INSERT,UPDATE,DELETE ON public.dj_live_mix_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.dj_live_mix_events TO authenticated;
DROP POLICY IF EXISTS "Owner reads DJ mixer evidence" ON public.dj_live_mix_events;
CREATE POLICY "Owner reads DJ mixer evidence" ON public.dj_live_mix_events
 FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) AND EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid())
 ));

-- Harden even direct privileged updates: evidence is append-only.
CREATE OR REPLACE FUNCTION public.dj_mix_event_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $$
BEGIN
 RAISE EXCEPTION 'DJ mixer evidence is append-only' USING ERRCODE='42501';
END; $$;
REVOKE ALL ON FUNCTION public.dj_mix_event_immutable() FROM PUBLIC;
DROP TRIGGER IF EXISTS dj_mix_event_immutable_on_change ON public.dj_live_mix_events;
CREATE TRIGGER dj_mix_event_immutable_on_change
 BEFORE UPDATE OR DELETE ON public.dj_live_mix_events
 FOR EACH ROW EXECUTE FUNCTION public.dj_mix_event_immutable();

-- Effective clock is ONLY available through private internal helper for
-- reproducible rollback-only tests. Public service function uses server time.
CREATE OR REPLACE FUNCTION private.dj_record_mix_event_at(
 p_booking_id uuid,p_kind text,p_deck text,p_source text,p_track_id uuid,
 p_value numeric,p_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,private,pg_temp AS $$
DECLARE
 v_actor uuid:=(SELECT auth.uid());
 v_book public.dj_bookings%ROWTYPE;
 v_session public.dj_performance_sessions%ROWTYPE;
 v_last_at timestamptz;
 v_count integer;
 v_result uuid;
BEGIN
 IF v_actor IS NULL OR p_booking_id IS NULL OR p_at IS NULL THEN
  RAISE EXCEPTION 'Authenticated booked DJ session required'
    USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_book FROM public.dj_bookings
  WHERE id=p_booking_id AND user_id=v_actor FOR UPDATE;
 IF NOT FOUND OR v_book.status<>'live' THEN
  RAISE EXCEPTION 'DJ mixer evidence requires live owned booking'
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
  deck,track_source,track_id,control_value,recorded_at
 ) VALUES (
  v_session.id,v_book.id,v_actor,v_book.profile_id,v_count+1,p_kind,
  p_deck,p_source,p_track_id,p_value,p_at
 ) RETURNING id INTO v_result;
 RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION private.dj_record_mix_event_at(
 uuid,text,text,text,uuid,numeric,timestamptz)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.record_dj_mix_event_internal(
 p_booking_id uuid,p_kind text,p_deck text DEFAULT NULL,
 p_source text DEFAULT NULL,p_track_id uuid DEFAULT NULL,p_value numeric DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,private,pg_temp AS $$
BEGIN
 RETURN private.dj_record_mix_event_at(p_booking_id,p_kind,p_deck,
   p_source,p_track_id,p_value,clock_timestamp());
END; $$;
REVOKE ALL ON FUNCTION public.record_dj_mix_event_internal(
 uuid,text,text,text,uuid,numeric)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_dj_mix_event_internal(
 uuid,text,text,text,uuid,numeric) TO service_role;

-- Settlement currently updates wallet/skill XP then inserts into the durable
-- ledger. This BEFORE INSERT gate makes that ENTIRE transaction fail/roll back
-- if no real-time mixer evidence exists, including cash, XP and gig history.
CREATE OR REPLACE FUNCTION public.require_dj_live_mix_for_settlement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
 v_session public.dj_performance_sessions%ROWTYPE;
 v_book public.dj_bookings%ROWTYPE;
 v_count int;
 v_decks int;
 v_cross int;
 v_tempo int;
 v_first timestamptz;
 v_last timestamptz;
 v_later int;
BEGIN
 SELECT * INTO v_session FROM public.dj_performance_sessions s
  WHERE s.id=NEW.session_id AND s.booking_id=NEW.booking_id;
 SELECT * INTO v_book FROM public.dj_bookings b
  WHERE b.id=NEW.booking_id;
 IF v_session.id IS NULL OR v_book.id IS NULL THEN
  RAISE EXCEPTION 'Missing live DJ session for payout' USING ERRCODE='23503';
 END IF;
 SELECT count(*),
    count(DISTINCT deck) FILTER(WHERE kind='deck_play'),
    count(*) FILTER(WHERE kind='crossfade'),
    count(*) FILTER(WHERE kind='tempo'),
    min(recorded_at),max(recorded_at),
    count(*) FILTER(WHERE recorded_at>=v_book.starts_at
      +(v_book.ends_at-v_book.starts_at)/2)
 INTO v_count,v_decks,v_cross,v_tempo,v_first,v_last,v_later
 FROM public.dj_live_mix_events
 WHERE session_id=v_session.id AND booking_id=NEW.booking_id;
 IF v_count<6 OR v_decks<2 OR v_cross<1 OR v_tempo<1
   OR v_last<v_first+interval '60 seconds' OR v_later<1
 THEN
  RAISE EXCEPTION
    'DJ set needs verified real-time deck A/B play, tempo and crossfade interactions across the booked slot'
    USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.require_dj_live_mix_for_settlement() FROM PUBLIC;
DROP TRIGGER IF EXISTS require_dj_live_mix_before_settlement ON public.dj_settlement_ledger;
CREATE TRIGGER require_dj_live_mix_before_settlement
 BEFORE INSERT ON public.dj_settlement_ledger
 FOR EACH ROW EXECUTE FUNCTION public.require_dj_live_mix_for_settlement();

COMMENT ON TABLE public.dj_live_mix_events IS
'Append-only, server-timestamped, owner-readable DJ live interaction evidence. Events do not prove acoustic audio output; never use client-side playback claims as a sole reward source.';
