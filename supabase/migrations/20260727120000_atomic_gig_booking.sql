-- Atomic, profile-aware gig booking. Historical migrations intentionally remain unchanged.

ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS booking_request_id uuid,
  ADD COLUMN IF NOT EXISTS scheduled_end timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS gigs_booking_request_uidx
  ON public.gigs (booking_request_id) WHERE booking_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gigs_band_active_range_idx
  ON public.gigs (band_id, scheduled_date, scheduled_end)
  WHERE status IN ('scheduled', 'in_progress', 'ready_for_completion');
CREATE INDEX IF NOT EXISTS gigs_venue_active_range_idx
  ON public.gigs (venue_id, scheduled_date, scheduled_end)
  WHERE status IN ('scheduled', 'in_progress', 'ready_for_completion');
CREATE UNIQUE INDEX IF NOT EXISTS player_schedule_gig_profile_uidx
  ON public.player_scheduled_activities (linked_gig_id, profile_id)
  WHERE linked_gig_id IS NOT NULL AND status <> 'cancelled';

-- SECURITY DEFINER avoids making a gigs policy depend on band_members RLS. Both current
-- profile IDs and legacy auth IDs are recognised while old rows are being migrated.
CREATE OR REPLACE FUNCTION public.can_manage_band_gigs(p_band_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH actor AS (
    SELECT id AS profile_id, user_id FROM public.profiles WHERE user_id = p_user_id
  ), membership AS (
    SELECT bm.id
    FROM public.band_members bm, actor a
    WHERE bm.band_id = p_band_id
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND COALESCE(bm.is_touring_member, false) = false
      AND (bm.profile_id = a.profile_id OR bm.user_id = a.user_id)
    LIMIT 1
  ), denied AS (
    SELECT 1 FROM membership m
    JOIN public.band_member_permission_overrides o ON o.member_id = m.id
    WHERE o.permission_key IN ('gigs.apply', 'gigs.accept') AND o.effect = 'deny'
      AND o.revoked_at IS NULL AND (o.expires_at IS NULL OR o.expires_at > now())
  )
  SELECT EXISTS (
    SELECT 1 FROM public.bands b, actor a
    WHERE b.id = p_band_id AND (b.leader_id = a.profile_id OR b.leader_id = a.user_id)
  ) OR (
    EXISTS (SELECT 1 FROM membership) AND NOT EXISTS (SELECT 1 FROM denied) AND (
      EXISTS (SELECT 1 FROM membership m JOIN public.band_member_permission_overrides o ON o.member_id=m.id
        WHERE o.permission_key IN ('gigs.apply','gigs.accept') AND o.effect='allow' AND o.revoked_at IS NULL
          AND (o.expires_at IS NULL OR o.expires_at > now()))
      OR EXISTS (SELECT 1 FROM membership m
        JOIN public.band_member_roles bmr ON bmr.member_id=m.id
        JOIN public.band_roles br ON br.id=bmr.role_id
        JOIN public.band_role_permissions brp ON brp.role_id=br.id
        WHERE brp.permission_key IN ('gigs.apply','gigs.accept') AND br.active AND br.deleted_at IS NULL
          AND bmr.removed_at IS NULL AND bmr.starts_at <= now()
          AND (bmr.expires_at IS NULL OR bmr.expires_at > now()))
    )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_band_gigs(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_band_gigs(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Band members can manage gigs" ON public.gigs;
DROP POLICY IF EXISTS "Gig managers can insert gigs" ON public.gigs;
DROP POLICY IF EXISTS "Gig managers can update gigs" ON public.gigs;
DROP POLICY IF EXISTS "Gig managers can delete gigs" ON public.gigs;
CREATE POLICY "Gig managers can insert gigs" ON public.gigs FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_band_gigs(band_id, auth.uid()));
CREATE POLICY "Gig managers can update gigs" ON public.gigs FOR UPDATE TO authenticated
  USING (public.can_manage_band_gigs(band_id, auth.uid()))
  WITH CHECK (public.can_manage_band_gigs(band_id, auth.uid()));
CREATE POLICY "Gig managers can delete gigs" ON public.gigs FOR DELETE TO authenticated
  USING (public.can_manage_band_gigs(band_id, auth.uid()));
-- The existing SELECT policy remains unchanged: gigs are part of the public game world.

CREATE OR REPLACE FUNCTION public.book_gig(
  p_band_id uuid,
  p_venue_id uuid,
  p_setlist_id uuid,
  p_local_date date,
  p_slot text,
  p_ticket_price integer,
  p_request_id uuid,
  p_rider_id uuid DEFAULT NULL,
  p_ticket_operator_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor public.profiles%ROWTYPE; v_band public.bands%ROWTYPE; v_venue public.venues%ROWTYPE;
  v_gig public.gigs%ROWTYPE; v_timezone text; v_start_time time; v_end_time time;
  v_start timestamptz; v_end timestamptz; v_multiplier numeric; v_payment_multiplier numeric;
  v_capacity integer; v_estimated_attendance integer; v_estimated_revenue integer;
  v_booking_fee integer; v_payment integer; v_rider_cost integer := 0; v_song_count integer; v_setlist_seconds integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'gig_booking_unauthenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_actor FROM public.profiles WHERE user_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_booking_profile_missing' USING ERRCODE='P0001'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'gig_booking_request_invalid' USING ERRCODE='22023'; END IF;

  -- Idempotent retry: only return a booking owned by this caller.
  SELECT * INTO v_gig FROM public.gigs WHERE booking_request_id=p_request_id;
  IF FOUND THEN
    IF v_gig.band_id <> p_band_id OR NOT public.can_manage_band_gigs(v_gig.band_id, auth.uid()) THEN
      RAISE EXCEPTION 'gig_booking_request_conflict' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('gig', to_jsonb(v_gig), 'already_booked', true);
  END IF;

  IF NOT public.can_manage_band_gigs(p_band_id, auth.uid()) THEN
    RAISE EXCEPTION 'gig_booking_forbidden' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gig-band:'||p_band_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('gig-venue:'||p_venue_id::text, 0));
  SELECT * INTO v_band FROM public.bands WHERE id=p_band_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_booking_band_invalid' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_venue FROM public.venues WHERE id=p_venue_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_booking_venue_invalid' USING ERRCODE='P0001'; END IF;
  SELECT COALESCE(c.timezone, 'UTC') INTO v_timezone FROM public.cities c WHERE c.id=v_venue.city_id;
  v_timezone := COALESCE(v_timezone, 'UTC');

  SELECT x.start_time, x.end_time, x.attendance_multiplier, x.payment_multiplier
  INTO v_start_time, v_end_time, v_multiplier, v_payment_multiplier
  FROM (VALUES ('kids','15:00'::time,'15:30'::time,0.30,0.50),('opening','19:00','19:30',0.50,0.60),
    ('support','19:45','20:30',0.75,0.80),('headline','20:45','22:00',1.00,1.00))
    AS x(slot,start_time,end_time,attendance_multiplier,payment_multiplier) WHERE x.slot=p_slot;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_booking_slot_invalid' USING ERRCODE='22023'; END IF;
  v_start := (p_local_date + v_start_time) AT TIME ZONE v_timezone;
  v_end := (p_local_date + v_end_time + CASE WHEN v_end_time <= v_start_time THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE v_timezone;
  IF v_start <= now() THEN RAISE EXCEPTION 'gig_booking_past_date' USING ERRCODE='22023'; END IF;
  IF p_ticket_price IS NULL OR p_ticket_price <= 0 OR p_ticket_price > 100000 THEN
    RAISE EXCEPTION 'gig_booking_ticket_price_invalid' USING ERRCODE='22023';
  END IF;

  SELECT count(*), COALESCE(sum(COALESCE(ss.duration_seconds, song.duration_seconds, 180)),0)
  INTO v_song_count, v_setlist_seconds FROM public.setlist_songs ss JOIN public.setlists s ON s.id=ss.setlist_id
    JOIN public.songs song ON song.id=ss.song_id
    WHERE s.id=p_setlist_id AND s.band_id=p_band_id AND COALESCE(s.is_active,true);
  IF v_song_count < 6 THEN RAISE EXCEPTION 'gig_booking_setlist_invalid' USING ERRCODE='23514'; END IF;
  IF v_setlist_seconds > extract(epoch FROM (v_end-v_start)) + 300 THEN
    RAISE EXCEPTION 'gig_booking_setlist_invalid' USING ERRCODE='23514';
  END IF;
  IF p_rider_id IS NOT NULL THEN
    SELECT COALESCE(total_cost_estimate,0) INTO v_rider_cost FROM public.band_riders WHERE id=p_rider_id AND band_id=p_band_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'gig_booking_rider_invalid' USING ERRCODE='23503'; END IF;
  END IF;
  IF v_venue.capacity >= 200 AND p_ticket_operator_id IS NULL THEN
    RAISE EXCEPTION 'gig_booking_operator_required' USING ERRCODE='23514';
  END IF;

  IF EXISTS (SELECT 1 FROM public.band_activity_lockouts WHERE band_id=p_band_id AND locked_until>now()) THEN
    RAISE EXCEPTION 'gig_booking_band_lockout' USING ERRCODE='P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gigs WHERE band_id=p_band_id AND venue_id=p_venue_id
    AND status IN ('scheduled','in_progress','completed') AND scheduled_date > now()-interval '14 days') THEN
    RAISE EXCEPTION 'gig_booking_venue_cooldown' USING ERRCODE='P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gigs g WHERE g.band_id=p_band_id
    AND g.status IN ('scheduled','in_progress','ready_for_completion')
    AND g.scheduled_date < v_end AND COALESCE(g.scheduled_end,
      g.scheduled_date + COALESCE(
        (g.slot_end_time-g.slot_start_time) + CASE WHEN g.slot_end_time <= g.slot_start_time THEN interval '1 day' ELSE interval '0' END,
        interval '3 hours')) > v_start) THEN
    RAISE EXCEPTION 'gig_booking_band_conflict' USING ERRCODE='23P01';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gigs g WHERE g.venue_id=p_venue_id
    AND g.status IN ('scheduled','in_progress','ready_for_completion')
    AND g.scheduled_date < v_end AND COALESCE(g.scheduled_end,
      g.scheduled_date + interval '3 hours') > v_start) THEN
    RAISE EXCEPTION 'gig_booking_venue_conflict' USING ERRCODE='23P01';
  END IF;
  IF EXISTS (SELECT 1 FROM public.player_scheduled_activities a WHERE a.status IN ('scheduled','in_progress')
    AND a.scheduled_start < v_end AND a.scheduled_end > v_start AND a.profile_id IN (
      SELECT COALESCE(bm.profile_id, mp.id) FROM public.band_members bm LEFT JOIN public.profiles mp ON mp.user_id=bm.user_id
        WHERE bm.band_id=p_band_id AND COALESCE(bm.member_status,'active')='active'
        AND COALESCE(bm.is_touring_member,false)=false AND COALESCE(bm.profile_id,mp.id) IS NOT NULL
      UNION SELECT v_band.leader_id WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=v_band.leader_id))) THEN
    RAISE EXCEPTION 'gig_booking_band_conflict' USING ERRCODE='23P01';
  END IF;

  -- Authoritative conservative forecast and financial values; caller forecasts are never accepted.
  v_capacity := GREATEST(COALESCE(v_venue.capacity,100),1);
  v_estimated_attendance := LEAST(v_capacity, GREATEST(1, round(v_capacity * LEAST(1.0,
    (0.25 + COALESCE(v_band.popularity,0)/200.0 + COALESCE(v_band.fame,0)/10000.0)) * v_multiplier))::integer);
  v_estimated_revenue := v_estimated_attendance * p_ticket_price;
  v_booking_fee := GREATEST(50, round(v_estimated_revenue * 0.10)::integer);
  v_payment := GREATEST(0, round(COALESCE(v_venue.base_payment,0) * v_payment_multiplier)::integer - v_rider_cost);
  IF COALESCE(v_band.band_balance,0) < v_booking_fee THEN
    RAISE EXCEPTION 'gig_booking_insufficient_funds' USING ERRCODE='P0001', DETAIL=v_booking_fee::text;
  END IF;

  UPDATE public.bands SET band_balance=band_balance-v_booking_fee WHERE id=p_band_id;
  INSERT INTO public.gigs (band_id,venue_id,setlist_id,rider_id,ticket_operator_id,scheduled_date,scheduled_end,
    status,show_type,payment,booking_fee,ticket_price,time_slot,slot_start_time,slot_end_time,
    slot_attendance_multiplier,estimated_attendance,estimated_revenue,attendance,fan_gain,predicted_tickets,
    tickets_sold,last_ticket_update,booking_request_id)
  VALUES (p_band_id,p_venue_id,p_setlist_id,p_rider_id,p_ticket_operator_id,v_start,v_end,'scheduled',
    COALESCE(v_venue.venue_type,'concert'),v_payment,v_booking_fee,p_ticket_price,p_slot,v_start_time,v_end_time,
    v_multiplier,v_estimated_attendance,v_estimated_revenue,0,0,v_estimated_attendance,0,now(),p_request_id)
  RETURNING * INTO v_gig;

  -- Include every active real member, plus a leader who has no band_members row.
  INSERT INTO public.player_scheduled_activities (user_id,profile_id,activity_type,scheduled_start,scheduled_end,
    status,title,location,linked_gig_id,metadata)
  SELECT p.user_id,p.id,'gig',v_start,v_end,'scheduled','Gig at '||v_venue.name,v_venue.name,v_gig.id,
    jsonb_build_object('band_id',p_band_id,'venueId',p_venue_id,'slotId',p_slot,'venue_timezone',v_timezone,'is_band_activity',true)
  FROM public.profiles p WHERE p.id IN (
    SELECT COALESCE(bm.profile_id, mp.id) FROM public.band_members bm LEFT JOIN public.profiles mp ON mp.user_id=bm.user_id
      WHERE bm.band_id=p_band_id AND COALESCE(bm.member_status,'active')='active'
      AND COALESCE(bm.is_touring_member,false)=false AND COALESCE(bm.profile_id,mp.id) IS NOT NULL
    UNION SELECT v_band.leader_id WHERE EXISTS (SELECT 1 FROM public.profiles lp WHERE lp.id=v_band.leader_id)
  ) ON CONFLICT (linked_gig_id,profile_id) WHERE linked_gig_id IS NOT NULL AND status <> 'cancelled' DO NOTHING;

  RETURN jsonb_build_object('gig',to_jsonb(v_gig),'already_booked',false,'booking_fee',v_booking_fee,
    'band_balance',COALESCE(v_band.band_balance,0)-v_booking_fee,'scheduled_start',v_start,'scheduled_end',v_end,'venue_timezone',v_timezone);
END;
$$;

REVOKE ALL ON FUNCTION public.book_gig(uuid,uuid,uuid,date,text,integer,uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_gig(uuid,uuid,uuid,date,text,integer,uuid,uuid,text) TO authenticated;

COMMENT ON FUNCTION public.book_gig(uuid,uuid,uuid,date,text,integer,uuid,uuid,text) IS
  'Atomically authorises, validates, charges, creates a gig and blocks every active member schedule. p_request_id makes retries idempotent.';

-- Administrator-only evidence report. Review activity metadata and adjacent transactions before crediting;
-- this deliberately does not mutate balances because the legacy activity feed is not a financial ledger.
CREATE OR REPLACE VIEW public.gig_booking_reconciliation_candidates
WITH (security_invoker=true) AS
SELECT af.id AS activity_id, af.user_id, af.created_at, af.earnings AS recorded_booking_fee,
       af.metadata->>'venue_id' AS venue_id, af.metadata->>'scheduled_date' AS intended_date, af.message
FROM public.activity_feed af
WHERE af.activity_type='gig_booking' AND af.earnings > 0
  AND NOT EXISTS (SELECT 1 FROM public.gigs g
    WHERE g.venue_id::text=af.metadata->>'venue_id'
      AND abs(extract(epoch FROM (g.scheduled_date - CASE
        WHEN af.metadata->>'scheduled_date' ~ '^\d{4}-\d{2}-\d{2}T'
        THEN (af.metadata->>'scheduled_date')::timestamptz ELSE '-infinity'::timestamptz END))) < 60);
REVOKE ALL ON public.gig_booking_reconciliation_candidates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.gig_booking_reconciliation_candidates TO service_role;
