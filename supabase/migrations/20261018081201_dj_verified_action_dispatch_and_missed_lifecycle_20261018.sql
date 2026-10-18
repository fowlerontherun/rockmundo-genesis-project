-- Phase 6 groundwork: authenticated-actor transport for the existing
-- service-role-only RPCs, plus a no-show state that never produces a payout.
-- The verified actor must come from supabase.auth.getUser(token) on the Edge
-- server. This RPC is NEVER executable by authenticated / anon clients.

CREATE OR REPLACE FUNCTION private.dj_mark_missed_at(
 p_booking_id uuid,p_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,private,pg_temp AS $$
DECLARE
 v_actor uuid := (SELECT auth.uid());
 v_book public.dj_bookings%ROWTYPE;
BEGIN
 IF p_booking_id IS NULL OR v_actor IS NULL OR p_at IS NULL THEN
   RAISE EXCEPTION 'Authenticated player and booking required'
     USING ERRCODE='42501';
 END IF;

 SELECT * INTO v_book FROM public.dj_bookings
  WHERE id=p_booking_id AND user_id=v_actor FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'DJ booking does not belong to this player'
     USING ERRCODE='42501';
 END IF;

 IF v_book.status='missed' THEN RETURN v_book.id; END IF;
 IF v_book.status NOT IN ('booked','ready') THEN
   RAISE EXCEPTION 'Only unstarted DJ bookings can be marked missed'
     USING ERRCODE='22023';
 END IF;
 IF p_at < v_book.ends_at + interval '10 minutes' THEN
   RAISE EXCEPTION 'DJ set has not passed its missed-set grace period'
     USING ERRCODE='22023';
 END IF;
 IF EXISTS (
    SELECT 1 FROM public.dj_performance_sessions s
    WHERE s.booking_id=v_book.id
 ) THEN
   RAISE EXCEPTION 'An actual DJ session cannot be marked missed'
     USING ERRCODE='23505';
 END IF;
 UPDATE public.dj_bookings SET status='missed',updated_at=now()
 WHERE id=v_book.id;

 -- Atomic Schedule projection from prior migrations changes calendar
 -- status to 'missed'. No energy has been charged for an unstarted gig.
 RETURN v_book.id;
END;
$$;
REVOKE ALL ON FUNCTION private.dj_mark_missed_at(uuid,timestamptz)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.mark_dj_booking_missed_internal(p_booking_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,private,pg_temp AS $$
BEGIN
 RETURN private.dj_mark_missed_at(p_booking_id,clock_timestamp());
END;
$$;
REVOKE ALL ON FUNCTION public.mark_dj_booking_missed_internal(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mark_dj_booking_missed_internal(uuid) TO service_role;

-- The older reservation, cancellation, start, settle and missed procedures
-- rely on auth.uid(), while service-role clients have no user JWT. An actor
-- verified by the Edge server is placed into transaction-local JWT claims
-- only inside a service-role-only SECURITY DEFINER RPC.
CREATE OR REPLACE FUNCTION public.dj_verified_player_action_service(
 p_actor_user_id uuid,
 p_action text,
 p_profile_id uuid DEFAULT NULL,
 p_club_id uuid DEFAULT NULL,
 p_setlist_id uuid DEFAULT NULL,
 p_starts_at timestamptz DEFAULT NULL,
 p_request_id uuid DEFAULT NULL,
 p_booking_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,private,pg_temp AS $$
DECLARE
 v_result uuid;
 v_previous text := current_setting('request.jwt.claim.sub',true);
BEGIN
 IF p_actor_user_id IS NULL OR p_action NOT IN
    ('reserve','cancel','start','settle','missed') OR p_action IS NULL
 THEN RAISE EXCEPTION 'Invalid DJ player action' USING ERRCODE='22023';
 END IF;

 IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=p_actor_user_id)
 THEN RAISE EXCEPTION 'DJ action actor does not exist' USING ERRCODE='42501'; END IF;

 -- Owner check against the selected character is repeated by the called
 -- procedures. No actor ID is ever accepted from client JSON.
 PERFORM set_config('request.jwt.claim.sub',p_actor_user_id::text,true);

 IF p_action='reserve' THEN
   IF p_profile_id IS NULL OR p_club_id IS NULL OR p_setlist_id IS NULL
      OR p_starts_at IS NULL OR p_request_id IS NULL
   THEN RAISE EXCEPTION 'Incomplete DJ reservation' USING ERRCODE='22023'; END IF;
   v_result := public.reserve_dj_booking_internal(
      p_profile_id,p_club_id,p_setlist_id,p_starts_at,p_request_id);
 ELSE
   IF p_booking_id IS NULL THEN
     RAISE EXCEPTION 'DJ booking ID required' USING ERRCODE='22023';
   END IF;
   IF p_action='cancel' THEN
      v_result:=public.cancel_dj_booking_internal(p_booking_id);
   ELSIF p_action='start' THEN
      v_result:=public.start_dj_booking_internal(p_booking_id);
   ELSIF p_action='settle' THEN
      v_result:=public.settle_dj_booking_internal(p_booking_id);
   ELSIF p_action='missed' THEN
      v_result:=public.mark_dj_booking_missed_internal(p_booking_id);
   END IF;
 END IF;

 PERFORM set_config('request.jwt.claim.sub',coalesce(v_previous,''),true);
 RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.dj_verified_player_action_service(
 uuid,text,uuid,uuid,uuid,timestamptz,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dj_verified_player_action_service(
 uuid,text,uuid,uuid,uuid,timestamptz,uuid,uuid) TO service_role;

COMMENT ON FUNCTION public.dj_verified_player_action_service(
 uuid,text,uuid,uuid,uuid,timestamptz,uuid,uuid) IS
 'Service-role-only dispatch for Edge-verified DJ player JWT subject. Client-supplied actor IDs must never be passed here.';
