-- DJ-0503 / DJ-0505: capacity-bounded solo DJ crowds and persistent city fandom.
-- Never update band_city_fans; the solo DJ fan base is character-local and server-owned.
CREATE TABLE public.profile_city_dj_fans (
 profile_id uuid NOT NULL REFERENCES public.profiles(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 city_id uuid NOT NULL REFERENCES public.cities(id),
 total_fans integer NOT NULL DEFAULT 0 CHECK(total_fans>=0),
 sets_played integer NOT NULL DEFAULT 0 CHECK(sets_played>=0),
 total_attendance bigint NOT NULL DEFAULT 0 CHECK(total_attendance>=0),
 last_set_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(profile_id,city_id)
);
CREATE INDEX profile_city_dj_fans_city_popularity_idx
 ON public.profile_city_dj_fans(city_id,total_fans DESC);
ALTER TABLE public.profile_city_dj_fans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read only their solo DJ city fan populations"
 ON public.profile_city_dj_fans FOR SELECT TO authenticated
 USING(user_id=(select auth.uid())
   AND EXISTS(SELECT 1 FROM public.profiles p
    WHERE p.id=profile_city_dj_fans.profile_id AND p.user_id=(select auth.uid())));
REVOKE ALL ON public.profile_city_dj_fans FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.profile_city_dj_fans TO authenticated;

CREATE TABLE public.dj_booking_audiences (
 booking_id uuid PRIMARY KEY REFERENCES public.dj_bookings(id),
 profile_id uuid NOT NULL REFERENCES public.profiles(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 club_id uuid NOT NULL REFERENCES public.city_night_clubs(id),
 city_id uuid NOT NULL REFERENCES public.cities(id),
 venue_capacity integer NOT NULL CHECK(venue_capacity>=0),
 attendance integer NOT NULL CHECK(attendance>=0 AND attendance<=venue_capacity),
 returning_fans integer NOT NULL CHECK(returning_fans>=0 AND returning_fans<=attendance),
 new_local_fans integer NOT NULL CHECK(new_local_fans>=0
   AND new_local_fans+returning_fans<=attendance),
 satisfaction integer NOT NULL CHECK(satisfaction BETWEEN 0 AND 100),
 model_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
 settled_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX dj_booking_audiences_profile_date_idx
 ON public.dj_booking_audiences(profile_id,settled_at DESC);
ALTER TABLE public.dj_booking_audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "DJs read only their verified booking audiences"
 ON public.dj_booking_audiences FOR SELECT TO authenticated
 USING(user_id=(select auth.uid())
   AND EXISTS(SELECT 1 FROM public.profiles p
    WHERE p.id=dj_booking_audiences.profile_id AND p.user_id=(select auth.uid())));
REVOKE ALL ON public.dj_booking_audiences FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.dj_booking_audiences TO authenticated;

CREATE FUNCTION private.dj_estimate_club_attendance(
 p_capacity integer,p_fame integer,p_local_fans integer,
 p_quality integer,p_reputation integer,p_cover integer
) RETURNS integer LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path=pg_catalog
AS $estimate$
 SELECT least(greatest(0,p_capacity),
  greatest(0,round(
    greatest(0,p_capacity)::numeric *
    least(1.0::numeric,greatest(0.02::numeric,
       0.08::numeric
       + least(0.66::numeric, ln(1+greatest(0,p_fame)::numeric)/16.0)
       + least(0.18::numeric,
           greatest(0,p_local_fans)::numeric/greatest(1,p_capacity)*0.25)
       + least(0.06::numeric,greatest(0,p_quality)::numeric*0.012)
       + least(0.10::numeric,greatest(0,p_reputation)::numeric/1000.0)
       - least(0.20::numeric,greatest(0,p_cover)::numeric/600.0)
    ))
  )::integer));
$estimate$;
REVOKE ALL ON FUNCTION private.dj_estimate_club_attendance(integer,integer,integer,integer,integer,integer)
 FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE public.dj_booking_audiences IS
 'Immutable capacity-bounded settlement snapshot for verified scheduled DJ sets. Does not mint door intake or change nightclub revenue.';
COMMENT ON TABLE public.profile_city_dj_fans IS
 'Canonical solo DJ local following, distinct from band_city_fans; writes exclusively via server-verified DJ settlement.';

CREATE OR REPLACE FUNCTION private.dj_settle_booking_at(p_booking_id uuid, p_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
 v_actor uuid := (SELECT auth.uid());
 v_book public.dj_bookings%ROWTYPE;
 v_session public.dj_performance_sessions%ROWTYPE;
 v_profile public.profiles%ROWTYPE;
 v_score integer;
 v_cash integer;
 v_fame integer;
 v_xp integer;
 v_performance_id uuid;
 v_skill public.skill_progress%ROWTYPE;
 v_level integer;
 v_xp_remaining integer;
 v_required integer;
 v_max_level integer;
 v_funded public.nightclub_dj_funded_offers%ROWTYPE;
 v_remainder integer;
 v_old_context text:=current_setting('app.player_cash_context',true);
 v_city_id uuid;
 v_venue_capacity integer;
 v_cover_charge integer;
 v_quality integer;
 v_club_reputation integer;
 v_attendance integer;
 v_returning_fans integer;
 v_new_fans integer;
 v_fan_population public.profile_city_dj_fans%ROWTYPE;
BEGIN
 IF p_booking_id IS NULL OR p_at IS NULL OR v_actor IS NULL THEN
   RAISE EXCEPTION 'Authenticated due DJ booking required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_book FROM public.dj_bookings
  WHERE id=p_booking_id AND user_id=v_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cannot settle another character DJ booking'
   USING ERRCODE='42501'; END IF;

 -- Idempotent replay returns the same durable performance, never re-awards.
 IF v_book.status='completed' THEN
   SELECT l.performance_id INTO v_performance_id FROM public.dj_settlement_ledger l
   WHERE l.booking_id=v_book.id AND l.user_id=v_actor;
   IF v_performance_id IS NULL THEN
     RAISE EXCEPTION 'Completed DJ booking missing settlement ledger'
       USING ERRCODE='23503'; END IF;
   RETURN v_performance_id;
 END IF;

 IF v_book.status<>'live' OR p_at<v_book.ends_at THEN
   RAISE EXCEPTION 'Cannot settle DJ set before completion time'
     USING ERRCODE='22023'; END IF;

 SELECT * INTO v_session FROM public.dj_performance_sessions
   WHERE booking_id=v_book.id AND user_id=v_actor FOR UPDATE;
 IF NOT FOUND OR v_session.status<>'live' THEN
   RAISE EXCEPTION 'An active DJ performance session is required'
     USING ERRCODE='23503'; END IF;

 SELECT * INTO v_profile FROM public.profiles
 WHERE id=v_book.profile_id AND user_id=v_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DJ profile no longer belongs to user'
   USING ERRCODE='42501'; END IF;

 IF EXISTS(SELECT 1 FROM public.nightclub_dj_funded_offers f
   WHERE f.booking_id=v_book.id AND f.status<>'booked') THEN
  RAISE EXCEPTION 'Already closed funded DJ fee' USING ERRCODE='23503';END IF;
 SELECT * INTO v_funded FROM public.nightclub_dj_funded_offers f
 WHERE f.booking_id=v_book.id AND f.status='booked' FOR UPDATE;
 IF v_funded.id IS NOT NULL AND NOT EXISTS(SELECT 1
 FROM public.nightclub_dj_escrow_movements m WHERE m.offer_id=v_funded.id
  AND m.kind='fund' AND m.amount=v_funded.fee) THEN
 RAISE EXCEPTION 'Owner escrow debit is missing' USING ERRCODE='23503';END IF;
 -- Only persisted server-side snapshots influence rewards.
 v_score := least(100,greatest(0,
    30+v_session.dj_skill_level*3
    +v_session.stage_presence/5+v_session.charisma/6
    +v_session.club_quality*3+(floor(random()*11)::integer)-5));
 v_cash := least(5000,greatest(0,
   round(v_session.promised_payout*(0.55+v_score/180.0))::integer));
 IF v_funded.id IS NOT NULL THEN v_cash:=least(v_cash,v_funded.fee); END IF;
 v_fame := least(25,greatest(0,round(v_score/7.0)::integer));
 v_xp := least(120,greatest(25,round(40+v_score*0.65)::integer));

 -- Positive money delta automatically journals via the existing
 -- sync_profile_cash_financial_account trigger; do not post it twice.
 PERFORM set_config('app.player_cash_context',
   jsonb_build_object('classification','dj_performance','display_category','dj_performance',
     'description','Completed nightclub DJ performance',
     'dj_booking_id',v_book.id,'external_cash_flow',true)::text,true);
 UPDATE public.profiles SET cash=cash+v_cash,fame=fame+v_fame
 WHERE id=v_profile.id;
 PERFORM set_config('app.player_cash_context',coalesce(v_old_context,''),true);
 IF v_funded.id IS NOT NULL THEN
  INSERT INTO public.nightclub_dj_escrow_movements(offer_id,owner_profile_id,kind,amount)
  VALUES(v_funded.id,v_funded.owner_profile_id,'payout',v_cash);
  v_remainder:=v_funded.fee-v_cash;
  IF v_remainder>0 THEN
   PERFORM 1 FROM public.profiles WHERE id=v_funded.owner_profile_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'DJ owner missing for surplus refund' USING ERRCODE='23503';END IF;
   PERFORM set_config('app.player_cash_context',jsonb_build_object(
     'classification','nightclub_dj_settlement_surplus_refund',
     'display_category','nightclub_dj_offer',
     'description','Returned unearned part of DJ fee escrow',
     'dj_offer_id',v_funded.id,'dj_booking_id',v_book.id,'external_cash_flow',true,
     'idempotency_key','club-dj-escrow-refund:'||v_funded.id)::text,true);
   UPDATE public.profiles SET cash=cash+v_remainder WHERE id=v_funded.owner_profile_id;
   PERFORM set_config('app.player_cash_context',coalesce(v_old_context,''),true);
   INSERT INTO public.nightclub_dj_escrow_movements(offer_id,owner_profile_id,kind,amount)
   VALUES(v_funded.id,v_funded.owner_profile_id,'refund',v_remainder);
  END IF;
  UPDATE public.nightclub_dj_funded_offers SET status='settled',
    resolved_at=clock_timestamp(),updated_at=clock_timestamp()
  WHERE id=v_funded.id;
 END IF;
 -- Preserve tier unlock policy; never create a mastery row automatically.
 SELECT * INTO v_skill FROM public.skill_progress
 WHERE profile_id=v_book.profile_id AND skill_slug=v_session.skill_slug FOR UPDATE;
 v_level:=greatest(0,coalesce(v_skill.current_level,0));
 v_max_level:=public.progression_skill_max_level(v_session.skill_slug);
 v_xp_remaining:=greatest(0,coalesce(v_skill.current_xp,0))+v_xp;
 v_required:=greatest(1,public.progression_skill_required_xp(v_level));
 WHILE v_level<v_max_level AND v_xp_remaining>=v_required LOOP
   v_xp_remaining:=v_xp_remaining-v_required;
   v_level:=v_level+1;
   v_required:=greatest(1,public.progression_skill_required_xp(v_level));
 END LOOP;
 IF v_level>=v_max_level THEN v_xp_remaining:=0;v_required:=0; END IF;
 INSERT INTO public.skill_progress(
   profile_id,skill_slug,current_level,current_xp,required_xp,
   last_practiced_at,updated_at
 ) VALUES (
   v_book.profile_id,v_session.skill_slug,v_level,v_xp_remaining,v_required,p_at,now()
 )
 ON CONFLICT(profile_id,skill_slug) DO UPDATE SET
   current_level=excluded.current_level,
   current_xp=excluded.current_xp,
   required_xp=excluded.required_xp,
   last_practiced_at=excluded.last_practiced_at,
   updated_at=now();

 INSERT INTO public.experience_ledger(
   user_id,profile_id,activity_type,xp_amount,skill_slug,metadata
 ) VALUES (v_actor,v_book.profile_id,'dj_set',v_xp,v_session.skill_slug,
           jsonb_build_object('dj_booking_id',v_book.id));

 -- The only fan authority for a scheduled DJ set is this same locked
 -- settlement transaction. Legacy instant sets are deliberately excluded.
 SELECT club.city_id,
   greatest(0,least(club.capacity,coalesce(owned.capacity,club.capacity))),
   greatest(0,coalesce(owned.cover_charge,club.cover_charge,0)),
   greatest(0,coalesce(club.quality_level,1)),
   greatest(0,coalesce(owned.reputation_score,0))
 INTO v_city_id,v_venue_capacity,v_cover_charge,v_quality,v_club_reputation
 FROM public.city_night_clubs club
 LEFT JOIN LATERAL (
  SELECT o.capacity,o.cover_charge,o.reputation_score
  FROM public.player_owned_nightclubs o
  JOIN public.nightclub_purchase_receipts receipt
    ON receipt.id=o.verified_purchase_id
   AND receipt.profile_id=o.profile_id AND receipt.club_id=o.club_id
  WHERE o.club_id=club.id ORDER BY o.purchased_at DESC LIMIT 1
 ) owned ON true
 WHERE club.id=v_book.club_id;
 IF v_city_id IS NULL OR v_venue_capacity IS NULL THEN
  RAISE EXCEPTION 'Cannot record DJ audience without canonical venue'
    USING ERRCODE='23503';END IF;

 INSERT INTO public.profile_city_dj_fans(profile_id,user_id,city_id)
 VALUES(v_book.profile_id,v_actor,v_city_id)
 ON CONFLICT(profile_id,city_id) DO NOTHING;
 SELECT * INTO v_fan_population FROM public.profile_city_dj_fans f
 WHERE f.profile_id=v_book.profile_id AND f.city_id=v_city_id FOR UPDATE;
 IF NOT FOUND OR v_fan_population.user_id<>v_actor THEN
   RAISE EXCEPTION 'DJ city fan population owner mismatch' USING ERRCODE='42501';END IF;

 v_attendance:=private.dj_estimate_club_attendance(
  v_venue_capacity,greatest(0,coalesce(v_profile.fame,0)),
  v_fan_population.total_fans,v_quality,v_club_reputation,v_cover_charge);
 v_returning_fans:=least(v_attendance,v_fan_population.total_fans,
   greatest(0,floor(v_attendance*0.35)::integer));
 v_new_fans:=least(v_attendance-v_returning_fans,
   greatest(0,floor((v_attendance-v_returning_fans) *
      greatest(0,v_score-40)::numeric/1200.0)::integer));
 INSERT INTO public.dj_booking_audiences(
  booking_id,profile_id,user_id,club_id,city_id,venue_capacity,attendance,
  returning_fans,new_local_fans,satisfaction,model_inputs
 ) VALUES(
  v_book.id,v_book.profile_id,v_actor,v_book.club_id,v_city_id,
  v_venue_capacity,v_attendance,v_returning_fans,v_new_fans,v_score,
  jsonb_build_object('model','dj_local_v1','profile_fame_at_start',coalesce(v_profile.fame,0),
   'existing_local_fans',v_fan_population.total_fans,'club_quality',v_quality,
   'club_reputation',v_club_reputation,'cover_charge',v_cover_charge)
 );
 UPDATE public.profile_city_dj_fans
 SET total_fans=total_fans+v_new_fans,
  sets_played=sets_played+1,total_attendance=total_attendance+v_attendance,
  last_set_at=p_at,updated_at=clock_timestamp()
 WHERE profile_id=v_book.profile_id AND city_id=v_city_id;
 INSERT INTO public.player_dj_performances(
   user_id,profile_id,club_id,booking_id,performance_score,
   cash_earned,fame_gained,fans_gained,xp_gained,outcome_text,set_length_minutes
 ) VALUES (
   v_actor,v_book.profile_id,v_book.club_id,v_book.id,v_score,
   v_cash,v_fame,v_new_fans,v_xp,'Scheduled nightclub DJ performance',
   ceil(extract(epoch from v_book.ends_at-v_book.starts_at)/60)::integer
 ) RETURNING id INTO v_performance_id;

 INSERT INTO public.dj_settlement_ledger(
   booking_id,performance_id,session_id,user_id,profile_id,cash_amount,
   fame_amount,skill_xp_amount,skill_slug,score,metadata
 ) VALUES(
   v_book.id,v_performance_id,v_session.id,v_actor,v_book.profile_id,
   v_cash,v_fame,v_xp,v_session.skill_slug,v_score,
   jsonb_build_object('source','server_authoritative','fan_conversion_applied',true,
    'attendance',v_attendance,'venue_capacity',v_venue_capacity,
    'new_local_fans',v_new_fans,'city_id',v_city_id,'audience_model','dj_local_v1')
 );

 UPDATE public.dj_performance_sessions
 SET status='completed',completed_at=p_at WHERE id=v_session.id;
 UPDATE public.dj_bookings
 SET status='completed',updated_at=now() WHERE id=v_book.id;
 RETURN v_performance_id;
END;
$function$
;