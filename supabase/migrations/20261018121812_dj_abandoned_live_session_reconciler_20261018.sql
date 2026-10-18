-- Fix: a player can start a scheduled DJ set and never call settlement.
-- Release flags remain OFF. A live performance that remains unfinished for
-- 60 minutes after the slot ends is marked abandoned, not paid.
-- The existing no-show cron runs this code with no new credentials.

ALTER TABLE public.dj_performance_sessions
 DROP CONSTRAINT IF EXISTS dj_performance_sessions_status_check;
ALTER TABLE public.dj_performance_sessions
 ADD CONSTRAINT dj_performance_sessions_status_check
 CHECK (status IN ('live','completed','abandoned'));

ALTER TABLE public.dj_performance_sessions
 ADD COLUMN IF NOT EXISTS abandoned_at timestamptz;
ALTER TABLE public.dj_performance_sessions
 ADD CONSTRAINT dj_performance_abandoned_at_consistent CHECK
 (status <> 'abandoned' OR abandoned_at IS NOT NULL);

CREATE OR REPLACE FUNCTION private.dj_abandon_live_booking_at(
 p_booking_id uuid, p_at timestamptz
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,private,pg_temp
AS $$
DECLARE
 v_actor uuid := (SELECT auth.uid());
 v_booking public.dj_bookings%ROWTYPE;
 v_session public.dj_performance_sessions%ROWTYPE;
BEGIN
 IF p_booking_id IS NULL OR p_at IS NULL OR v_actor IS NULL THEN
   RAISE EXCEPTION 'Verified DJ booking owner required'
    USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_booking FROM public.dj_bookings
   WHERE id=p_booking_id AND user_id=v_actor FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'DJ booking is not owned by this account'
     USING ERRCODE='42501';
 END IF;
 IF v_booking.status='missed' AND EXISTS (
   SELECT 1 FROM public.dj_performance_sessions
     WHERE booking_id=p_booking_id AND status='abandoned'
 ) THEN RETURN v_booking.id; END IF;

 IF v_booking.status <> 'live' OR
   p_at < v_booking.ends_at + interval '60 minutes'
 THEN RAISE EXCEPTION 'Live DJ set has not passed its completion grace period'
   USING ERRCODE='22023'; END IF;

 SELECT * INTO v_session FROM public.dj_performance_sessions
   WHERE booking_id=v_booking.id AND user_id=v_actor FOR UPDATE;
 IF NOT FOUND OR v_session.status<>'live' THEN
   RAISE EXCEPTION 'Expected active DJ session is missing'
     USING ERRCODE='23503';
 END IF;
 IF EXISTS(SELECT 1 FROM public.dj_settlement_ledger
   WHERE booking_id=v_booking.id)
 THEN RAISE EXCEPTION 'A settled DJ session must never be abandoned'
   USING ERRCODE='23505'; END IF;

 UPDATE public.dj_performance_sessions
 SET status='abandoned', abandoned_at=p_at
 WHERE id=v_session.id;
 UPDATE public.dj_bookings
 SET status='missed',updated_at=now()
 WHERE id=v_booking.id;

 -- Project existing booking status into canonical player Schedule atomically.
 -- Energy spent actually STARTING the set is not refunded; no cash/XP/fame/
 -- fans or recording-history settlement is written by this worker.
 RETURN v_booking.id;
END;
$$;
REVOKE ALL ON FUNCTION private.dj_abandon_live_booking_at(uuid,timestamptz)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.dj_process_missed_at(
 p_at timestamptz,p_max integer DEFAULT 50
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,private,pg_temp
AS $$
DECLARE
 v_booking record;
 v_count integer:=0;
 v_previous text:=current_setting('request.jwt.claim.sub',true);
BEGIN
 IF p_at IS NULL OR p_max IS NULL OR p_max NOT BETWEEN 1 AND 100
 THEN RAISE EXCEPTION 'Invalid DJ missed-set sweep clock or batch size'
   USING ERRCODE='22023'; END IF;

 FOR v_booking IN
   SELECT b.id,b.user_id,b.status
   FROM public.dj_bookings b
   WHERE
     (b.status IN ('booked','ready') AND
       b.ends_at + interval '10 minutes' <= p_at)
     OR
     (b.status='live' AND
       b.ends_at + interval '60 minutes' <= p_at)
   ORDER BY b.ends_at,b.id
   FOR UPDATE SKIP LOCKED
   LIMIT p_max
 LOOP
   PERFORM set_config('request.jwt.claim.sub',v_booking.user_id::text,true);
   IF v_booking.status='live' THEN
     PERFORM private.dj_abandon_live_booking_at(v_booking.id,p_at);
   ELSE
     PERFORM private.dj_mark_missed_at(v_booking.id,p_at);
   END IF;
   v_count:=v_count+1;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub',coalesce(v_previous,''),true);
 RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION private.dj_process_missed_at(timestamptz,integer)
 FROM PUBLIC,anon,authenticated,service_role;

COMMENT ON FUNCTION private.dj_abandon_live_booking_at(uuid,timestamptz) IS
 'Internal abandoned-live reconciliation after set end + 60 minutes: no payout, no XP, no energy refund. Only internal owner-context worker may call it.';
