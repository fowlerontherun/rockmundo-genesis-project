-- DJ staged lifecycle and atomic settlement. All executable entry points
-- remain service-role only. The legacy instant DJ browser flow is untouched.
-- No payouts occur until an approved due-time booking is explicitly completed.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS public.dj_performance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.dj_bookings(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  club_id uuid NOT NULL REFERENCES public.city_night_clubs(id),
  started_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('live','completed')),
  skill_slug text NOT NULL,
  dj_skill_level integer NOT NULL CHECK (dj_skill_level>=0),
  stage_presence integer NOT NULL,
  charisma integer NOT NULL,
  club_quality integer NOT NULL CHECK (club_quality BETWEEN 1 AND 5),
  promised_payout integer NOT NULL CHECK (promised_payout BETWEEN 0 AND 5000),
  setlist_snapshot jsonb NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dj_settlement_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.dj_bookings(id) ON DELETE RESTRICT,
  performance_id uuid NOT NULL UNIQUE REFERENCES public.player_dj_performances(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL UNIQUE REFERENCES public.dj_performance_sessions(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  cash_amount integer NOT NULL CHECK (cash_amount BETWEEN 0 AND 5000),
  fame_amount integer NOT NULL CHECK (fame_amount BETWEEN 0 AND 25),
  skill_xp_amount integer NOT NULL CHECK (skill_xp_amount BETWEEN 0 AND 120),
  energy_amount integer NOT NULL DEFAULT 25 CHECK (energy_amount=25),
  skill_slug text NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  settled_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.player_dj_performances
 ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.dj_bookings(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS dj_performance_unique_booked_set
 ON public.player_dj_performances(booking_id)
 WHERE booking_id IS NOT NULL;

ALTER TABLE public.dj_performance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dj_settlement_ledger ENABLE ROW LEVEL SECURITY;
REVOKE INSERT,UPDATE,DELETE ON public.dj_performance_sessions FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.dj_settlement_ledger FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.dj_performance_sessions, public.dj_settlement_ledger TO authenticated;
DROP POLICY IF EXISTS "DJ session owner read" ON public.dj_performance_sessions;
CREATE POLICY "DJ session owner read" ON public.dj_performance_sessions FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) AND EXISTS (
   SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid())
 ));
DROP POLICY IF EXISTS "DJ settlement owner read" ON public.dj_settlement_ledger;
CREATE POLICY "DJ settlement owner read" ON public.dj_settlement_ledger FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) AND EXISTS (
   SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid())
 ));

-- Legacy direct DJ history writes remain possible for the old UI, but cannot
-- claim to originate from a server-verified booked set.
CREATE OR REPLACE FUNCTION public.guard_booked_dj_history_source()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.booking_id IS NOT NULL AND current_user NOT IN ('postgres','service_role') THEN
   RAISE EXCEPTION 'Booked DJ performance history is server-owned'
     USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_booked_dj_history_source() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_booked_dj_history_source_insert ON public.player_dj_performances;
CREATE TRIGGER guard_booked_dj_history_source_insert
 BEFORE INSERT OR UPDATE OF booking_id ON public.player_dj_performances
 FOR EACH ROW EXECUTE FUNCTION public.guard_booked_dj_history_source();

-- Only trusted backend code calls private start/settle with an effective
-- timestamp. Public service_role wrappers always pass clock_timestamp().
CREATE OR REPLACE FUNCTION private.dj_start_booking_at(p_booking_id uuid,p_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,private,pg_temp AS $$
DECLARE
 v_actor uuid := (SELECT auth.uid());
 v_book public.dj_bookings%ROWTYPE;
 v_profile public.profiles%ROWTYPE;
 v_club public.city_night_clubs%ROWTYPE;
 v_skill record;
 v_attrs record;
 v_track jsonb;
 v_track_id uuid;
 v_slug text := 'basic_dj_controller';
 v_level integer := 0;
 v_session uuid;
 v_payout integer;
BEGIN
 IF p_booking_id IS NULL OR v_actor IS NULL OR p_at IS NULL THEN
   RAISE EXCEPTION 'Authenticated DJ booking and effective time required'
      USING ERRCODE='42501'; END IF;

 SELECT * INTO v_book FROM public.dj_bookings
 WHERE id=p_booking_id AND user_id=v_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DJ booking does not belong to player'
   USING ERRCODE='42501'; END IF;

 IF v_book.status='live' THEN
   SELECT id INTO v_session FROM public.dj_performance_sessions
     WHERE booking_id=v_book.id AND user_id=v_actor;
   IF v_session IS NULL THEN RAISE EXCEPTION 'Live DJ session missing'
     USING ERRCODE='23503'; END IF;
   RETURN v_session;
 END IF;

 IF v_book.status NOT IN ('booked','ready')
   OR p_at < v_book.starts_at-interval '5 minutes'
   OR p_at >= least(v_book.starts_at+interval '10 minutes',v_book.ends_at)
 THEN RAISE EXCEPTION 'DJ set is not due to start' USING ERRCODE='22023'; END IF;

 SELECT * INTO v_profile FROM public.profiles
 WHERE id=v_book.profile_id AND user_id=v_actor FOR UPDATE;
 IF NOT FOUND OR COALESCE(v_profile.is_active,true)=false
 THEN RAISE EXCEPTION 'Active owner character required'
   USING ERRCODE='42501'; END IF;

 SELECT * INTO v_club FROM public.city_night_clubs WHERE id=v_book.club_id;
 IF NOT FOUND OR v_profile.current_city_id IS DISTINCT FROM v_club.city_id
 THEN RAISE EXCEPTION 'DJ must be in the booked nightclub city'
   USING ERRCODE='42501'; END IF;
 IF COALESCE(v_profile.fame,0)<COALESCE((v_club.dj_slot_config->>'minimum_fame')::integer,0)
 THEN RAISE EXCEPTION 'Character no longer meets nightclub fame requirement'
   USING ERRCODE='42501'; END IF;
 IF v_profile.energy<25 THEN
   RAISE EXCEPTION '25 energy required to start scheduled DJ set'
    USING ERRCODE='22023'; END IF;

 IF (SELECT count(*) FROM public.player_scheduled_activities a
   WHERE a.linked_dj_booking_id=v_book.id
     AND a.profile_id=v_book.profile_id
     AND a.scheduled_start=v_book.starts_at
     AND a.scheduled_end=v_book.ends_at
     AND a.status='scheduled')<>1
 THEN RAISE EXCEPTION 'DJ booking calendar reservation not ready'
   USING ERRCODE='23503'; END IF;

 -- Consent and publish state are checked AGAIN at the actual performance,
 -- independent of the old setlist version or the earlier booking snapshot.
 FOR v_track IN SELECT value FROM jsonb_array_elements(v_book.setlist_snapshot)
 LOOP
   v_track_id := (v_track->>'id')::uuid;
   IF v_track->>'source'='game' THEN
     IF NOT EXISTS(SELECT 1 FROM public.songs s
        WHERE s.id=v_track_id AND NOT COALESCE(s.archived,false)
          AND (s.audio_url IS NOT NULL OR s.extended_audio_url IS NOT NULL)
          AND (
            (s.profile_id=v_book.profile_id AND s.user_id=v_actor AND
              s.status IN ('recorded','released','completed','mastered'))
            OR (s.dj_use_allowed IS TRUE AND s.status IN ('recorded','released'))
          )
       ) THEN RAISE EXCEPTION 'DJ song consent or audio availability changed'
          USING ERRCODE='42501'; END IF;
   ELSIF v_track->>'source'='admin' THEN
     IF NOT EXISTS(SELECT 1 FROM public.dj_audio_tracks t WHERE t.id=v_track_id
        AND t.is_active AND t.rights_confirmed)
     THEN RAISE EXCEPTION 'DJ catalogue music no longer licensed'
        USING ERRCODE='42501'; END IF;
   ELSE RAISE EXCEPTION 'Unsupported DJ music source'
     USING ERRCODE='42501'; END IF;
 END LOOP;

 FOR v_skill IN
   SELECT sp.skill_slug,sp.current_level
   FROM public.skill_progress sp
   WHERE sp.profile_id=v_book.profile_id AND
     sp.skill_slug IN ('dj_mastery','professional_djing','basic_dj_controller')
   ORDER BY CASE sp.skill_slug WHEN 'dj_mastery' THEN 1
                 WHEN 'professional_djing' THEN 2 ELSE 3 END
 LOOP
   IF COALESCE(v_skill.current_level,0)>0
     AND v_skill.current_level<public.progression_skill_max_level(v_skill.skill_slug)
   THEN v_slug:=v_skill.skill_slug;
        v_level:=v_skill.current_level;
        EXIT; END IF;
 END LOOP;
 SELECT coalesce(a.stage_presence,0) stage_presence,
        coalesce(a.charisma,0) charisma INTO v_attrs
 FROM public.player_attributes a WHERE a.profile_id=v_book.profile_id LIMIT 1;

 v_payout := least(5000,greatest(0,coalesce((v_club.dj_slot_config->>'payout')::integer,200)));
 INSERT INTO public.dj_performance_sessions(
   booking_id,user_id,profile_id,club_id,started_at,status,skill_slug,
   dj_skill_level,stage_presence,charisma,club_quality,promised_payout,setlist_snapshot
 ) VALUES (
   v_book.id,v_actor,v_book.profile_id,v_book.club_id,p_at,'live',v_slug,
   v_level,coalesce(v_attrs.stage_presence,0),coalesce(v_attrs.charisma,0),
   least(5,greatest(1,coalesce(v_club.quality_level,1))),
   v_payout,v_book.setlist_snapshot
 ) RETURNING id INTO v_session;

 UPDATE public.profiles SET energy=energy-25 WHERE id=v_profile.id;
 UPDATE public.dj_bookings SET status='live',updated_at=now()
 WHERE id=v_book.id;
 RETURN v_session;
END;
$$;
REVOKE ALL ON FUNCTION private.dj_start_booking_at(uuid,timestamptz)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.start_dj_booking_internal(p_booking_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,private,pg_temp AS $$
BEGIN
 RETURN private.dj_start_booking_at(p_booking_id,clock_timestamp());
END;
$$;
REVOKE ALL ON FUNCTION public.start_dj_booking_internal(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_dj_booking_internal(uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.dj_settle_booking_at(p_booking_id uuid,p_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,private,pg_temp AS $$
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

 -- Only persisted server-side snapshots influence rewards.
 v_score := least(100,greatest(0,
    30+v_session.dj_skill_level*3
    +v_session.stage_presence/5+v_session.charisma/6
    +v_session.club_quality*3+(floor(random()*11)::integer)-5));
 v_cash := least(5000,greatest(0,
   round(v_session.promised_payout*(0.55+v_score/180.0))::integer));
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
 PERFORM set_config('app.player_cash_context','',true);

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

 -- Fans are intentionally zero until the canonical city fan population
 -- settlement model is integrated; do not claim phantom fan conversions.
 INSERT INTO public.player_dj_performances(
   user_id,profile_id,club_id,booking_id,performance_score,
   cash_earned,fame_gained,fans_gained,xp_gained,outcome_text,set_length_minutes
 ) VALUES (
   v_actor,v_book.profile_id,v_book.club_id,v_book.id,v_score,
   v_cash,v_fame,0,v_xp,'Scheduled nightclub DJ performance',
   ceil(extract(epoch from v_book.ends_at-v_book.starts_at)/60)::integer
 ) RETURNING id INTO v_performance_id;

 INSERT INTO public.dj_settlement_ledger(
   booking_id,performance_id,session_id,user_id,profile_id,cash_amount,
   fame_amount,skill_xp_amount,skill_slug,score,metadata
 ) VALUES(
   v_book.id,v_performance_id,v_session.id,v_actor,v_book.profile_id,
   v_cash,v_fame,v_xp,v_session.skill_slug,v_score,
   jsonb_build_object('source','server_authoritative','fan_conversion_applied',false)
 );

 UPDATE public.dj_performance_sessions
 SET status='completed',completed_at=p_at WHERE id=v_session.id;
 UPDATE public.dj_bookings
 SET status='completed',updated_at=now() WHERE id=v_book.id;
 RETURN v_performance_id;
END;
$$;
REVOKE ALL ON FUNCTION private.dj_settle_booking_at(uuid,timestamptz)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.settle_dj_booking_internal(p_booking_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,private,pg_temp AS $$
BEGIN
 RETURN private.dj_settle_booking_at(p_booking_id,clock_timestamp());
END;
$$;
REVOKE ALL ON FUNCTION public.settle_dj_booking_internal(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_dj_booking_internal(uuid) TO service_role;

COMMENT ON TABLE public.dj_settlement_ledger IS
 'Private server-authoritative booked DJ settlement; one row per booking. No direct client write or payout entry points.';
