-- Character aging, birthday rewards/events, and age-aware wellness

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_game_month smallint,
  ADD COLUMN IF NOT EXISTS birth_game_day smallint,
  ADD COLUMN IF NOT EXISTS age_anchor_age integer,
  ADD COLUMN IF NOT EXISTS age_anchor_game_year integer,
  ADD COLUMN IF NOT EXISTS age_anchor_game_month smallint,
  ADD COLUMN IF NOT EXISTS age_anchor_game_day smallint;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_birth_game_month_check,
  ADD CONSTRAINT profiles_birth_game_month_check CHECK (birth_game_month BETWEEN 1 AND 12),
  DROP CONSTRAINT IF EXISTS profiles_birth_game_day_check,
  ADD CONSTRAINT profiles_birth_game_day_check CHECK (birth_game_day BETWEEN 1 AND 30);

CREATE OR REPLACE FUNCTION public.rockmundo_game_date(_real_date date DEFAULT current_date)
RETURNS TABLE(game_year integer, game_month integer, game_day integer)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days_per_month numeric := 10;
  v_real_days integer;
  v_game_days integer;
  v_remaining integer;
BEGIN
  SELECT COALESCE(real_world_days_per_game_month, 10)::numeric
    INTO v_days_per_month
  FROM public.game_calendar_config
  WHERE is_active = true
  LIMIT 1;

  v_days_per_month := GREATEST(1, COALESCE(v_days_per_month, 10));
  v_real_days := GREATEST(0, _real_date - DATE '2026-01-01');
  v_game_days := FLOOR(v_real_days * (30.0 / v_days_per_month));

  game_year := FLOOR(v_game_days / 360.0)::integer + 1;
  v_remaining := MOD(v_game_days, 360);
  game_month := FLOOR(v_remaining / 30.0)::integer + 1;
  game_day := MOD(v_remaining, 30) + 1;
  RETURN NEXT;
END;
$$;

DO $$
DECLARE
  g record;
BEGIN
  SELECT * INTO g FROM public.rockmundo_game_date(current_date);

  UPDATE public.profiles p
  SET birth_game_month = COALESCE(
        p.birth_game_month,
        NULLIF(EXTRACT(MONTH FROM p.character_birth_date)::integer, 0),
        1 + MOD(ABS(hashtext(p.id::text)::bigint), 12)::integer
      ),
      birth_game_day = COALESCE(
        p.birth_game_day,
        NULLIF(LEAST(30, EXTRACT(DAY FROM p.character_birth_date)::integer), 0),
        1 + MOD(ABS(hashtext(reverse(p.id::text))::bigint), 30)::integer
      ),
      age_anchor_age = COALESCE(
        p.age_anchor_age,
        GREATEST(16, COALESCE(p.age, 16)::integer + GREATEST(0, g.game_year - 1))
      ),
      age_anchor_game_year = COALESCE(p.age_anchor_game_year, g.game_year),
      age_anchor_game_month = COALESCE(p.age_anchor_game_month, g.game_month),
      age_anchor_game_day = COALESCE(p.age_anchor_game_day, g.game_day)
  WHERE p.deleted_at IS NULL;
END $$;

CREATE OR REPLACE FUNCTION public.calculate_character_age(
  _profile_id uuid,
  _game_year integer,
  _game_month integer,
  _game_day integer
)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT GREATEST(
    16,
    COALESCE(p.age_anchor_age, COALESCE(p.age, 16)::integer)
      + (_game_year - COALESCE(p.age_anchor_game_year, 1))
      + CASE WHEN (_game_month, _game_day) >= (COALESCE(p.birth_game_month, 1), COALESCE(p.birth_game_day, 1)) THEN 1 ELSE 0 END
      - CASE WHEN (COALESCE(p.age_anchor_game_month, 1), COALESCE(p.age_anchor_game_day, 1)) >= (COALESCE(p.birth_game_month, 1), COALESCE(p.birth_game_day, 1)) THEN 1 ELSE 0 END
  )::integer
  FROM public.profiles p
  WHERE p.id = _profile_id;
$$;

CREATE OR REPLACE FUNCTION public.is_character_birthday(
  _profile_id uuid,
  _game_month integer,
  _game_day integer
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((p.birth_game_month, p.birth_game_day) = (_game_month, _game_day), false)
  FROM public.profiles p
  WHERE p.id = _profile_id;
$$;

CREATE TABLE IF NOT EXISTS public.birthday_event_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  min_age integer NOT NULL DEFAULT 16 CHECK (min_age BETWEEN 0 AND 100),
  max_age integer NOT NULL DEFAULT 100 CHECK (max_age BETWEEN 0 AND 100 AND max_age >= min_age),
  weight integer NOT NULL DEFAULT 100 CHECK (weight > 0),
  choices jsonb NOT NULL CHECK (jsonb_typeof(choices) = 'array' AND jsonb_array_length(choices) >= 2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.birthday_event_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "birthday events readable" ON public.birthday_event_catalog;
CREATE POLICY "birthday events readable" ON public.birthday_event_catalog FOR SELECT TO authenticated USING (is_active = true);
GRANT SELECT ON public.birthday_event_catalog TO authenticated;

CREATE TABLE IF NOT EXISTS public.player_birthday_event_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_year integer NOT NULL,
  age integer NOT NULL,
  event_id uuid NOT NULL REFERENCES public.birthday_event_catalog(id),
  selected_choice integer,
  outcome_text text,
  effects_applied jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, game_year)
);

ALTER TABLE public.player_birthday_event_instances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own birthday event instances readable" ON public.player_birthday_event_instances;
CREATE POLICY "own birthday event instances readable" ON public.player_birthday_event_instances FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
GRANT SELECT ON public.player_birthday_event_instances TO authenticated;

ALTER TABLE public.player_birthday_rewards
  ADD COLUMN IF NOT EXISTS ap_awarded integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS age integer;

INSERT INTO public.birthday_event_catalog (slug,title,description,min_age,max_age,weight,choices) VALUES
('fan-made-cake','A Cake From the Front Row','A group of loyal fans has somehow delivered an enormous cake with your face iced across the top.',16,100,100,'[{"label":"Share it with the fans","effects":{"fans":120,"happiness":6},"outcome":"The photos go everywhere and the fanbase loves the gesture."},{"label":"Take it backstage","effects":{"energy":4,"fans":35},"outcome":"The crew demolishes the cake and morale gets a lift."}]'),
('birthday-afterparty','The Birthday Afterparty','Your crew has found a venue willing to keep the night going after the show.',18,65,90,'[{"label":"Go all in","effects":{"fame":30,"happiness":8,"energy":-12,"stress":4},"outcome":"It becomes one of those legendary nights people keep talking about."},{"label":"Keep it low-key","effects":{"health":4,"energy":6,"happiness":3},"outcome":"You celebrate without wrecking tomorrow."}]'),
('surprise-session','Surprise Studio Session','A producer offers you a free late-night birthday session with a strange collection of vintage gear.',16,70,80,'[{"label":"Record something weird","effects":{"xp":180,"energy":-8},"outcome":"The experiment teaches you more than expected."},{"label":"Jam with everyone","effects":{"xp":100,"happiness":7},"outcome":"The room turns into a joyful birthday jam."}]'),
('old-friend-call','A Call From the Early Days','Someone who knew you before the fame rings to wish you happy birthday and reminds you where you started.',25,100,100,'[{"label":"Spend time catching up","effects":{"stress":-8,"happiness":8},"outcome":"The conversation grounds you and clears your head."},{"label":"Invite them to the next show","effects":{"fans":50,"fame":10,"happiness":4},"outcome":"They get a side-stage view and the reunion becomes part of the story."}]'),
('milestone-interview','The Milestone Interview','A music magazine wants a birthday interview looking back over your career so far.',30,100,80,'[{"label":"Be completely candid","effects":{"fame":45,"fans":80,"stress":3},"outcome":"The honest interview earns respect and plenty of attention."},{"label":"Keep it polished","effects":{"fame":25,"stress":-3},"outcome":"It lands well without exposing too much."}]'),
('birthday-charity','Birthday Charity Challenge','A charity asks whether you will turn your birthday attention into a fundraising push.',20,100,70,'[{"label":"Make a generous donation","effects":{"cash":-500,"fame":30,"fans":100,"happiness":6},"outcome":"The fundraiser beats its target and fans rally behind it."},{"label":"Promote it instead","effects":{"fame":15,"fans":60},"outcome":"Your reach gives the campaign a useful boost."}]'),
('quiet-retreat','A Quiet Birthday Escape','Your team offers to clear the diary and get you somewhere peaceful for the day.',40,100,90,'[{"label":"Take the whole day off","effects":{"health":5,"energy":10,"stress":-10},"outcome":"You return rested and noticeably sharper."},{"label":"Just take the evening","effects":{"energy":5,"stress":-5,"xp":80},"outcome":"You still get work done without sacrificing the celebration."}]'),
('legacy-gift','A Gift From Your Archive','Your team uncovers an old demo, poster and ticket stub from one of your earliest shows.',50,100,80,'[{"label":"Share the memory publicly","effects":{"fans":140,"fame":35,"happiness":5},"outcome":"Long-time fans get nostalgic and newer fans discover the old story."},{"label":"Keep it personal","effects":{"stress":-7,"happiness":10},"outcome":"The private reminder of the journey means more than publicity."}]'),
('doctor-birthday-check','The Sensible Birthday Present','Someone close to you has booked a proper health check and refuses to let you cancel it.',55,100,75,'[{"label":"Actually go","effects":{"health":8,"energy":3,"stress":-2},"outcome":"A few small changes leave you feeling better prepared for the year ahead."},{"label":"Reschedule and rest instead","effects":{"energy":8,"stress":-5},"outcome":"You avoid the appointment for now, but at least you genuinely recover."}]'),
('tribute-night','A Night In Your Honour','A local venue wants to host a birthday tribute night built around songs from across your career.',60,100,65,'[{"label":"Perform a surprise encore","effects":{"fans":180,"fame":45,"energy":-10,"happiness":8},"outcome":"The surprise appearance becomes an unforgettable moment."},{"label":"Watch from the balcony","effects":{"fans":90,"stress":-6,"happiness":10},"outcome":"Hearing the crowd sing the songs back at you hits differently."}]'),
('century-toast','The Century Toast','The music world marks an extraordinary 100th birthday with messages from artists, fans and venues everywhere.',100,100,100,'[{"label":"Address the world","effects":{"fame":100,"fans":500,"happiness":10},"outcome":"Your birthday message becomes an instant piece of RockMundo history."},{"label":"Celebrate privately","effects":{"health":5,"stress":-10,"happiness":15},"outcome":"You choose the people closest to you over the spectacle."}]')
ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,min_age=EXCLUDED.min_age,max_age=EXCLUDED.max_age,weight=EXCLUDED.weight,choices=EXCLUDED.choices,is_active=true,updated_at=now();

CREATE OR REPLACE FUNCTION public.ensure_birthday_state(
  _profile_id uuid,
  _game_year integer,
  _game_month integer,
  _game_day integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  p public.profiles%rowtype;
  v_age integer;
  v_event public.birthday_event_catalog%rowtype;
  v_instance public.player_birthday_event_instances%rowtype;
  v_sxp integer;
  v_ap integer;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = _profile_id;
  IF NOT FOUND OR p.user_id <> (SELECT auth.uid()) THEN RAISE EXCEPTION 'Profile unavailable'; END IF;

  v_age := public.calculate_character_age(_profile_id,_game_year,_game_month,_game_day);
  IF NOT public.is_character_birthday(_profile_id,_game_month,_game_day) THEN
    RETURN jsonb_build_object('is_birthday',false,'age',v_age);
  END IF;

  v_sxp := LEAST(1000, 500 + v_age * 5);
  v_ap := LEAST(10, 5 + FLOOR(v_age / 20.0)::integer);

  IF v_age <= 100 THEN
    SELECT * INTO v_instance FROM public.player_birthday_event_instances WHERE profile_id=_profile_id AND game_year=_game_year;
    IF NOT FOUND THEN
      SELECT * INTO v_event
      FROM public.birthday_event_catalog e
      WHERE e.is_active=true AND v_age BETWEEN e.min_age AND e.max_age
      ORDER BY md5(_profile_id::text || ':' || _game_year::text || ':' || e.id::text)
      LIMIT 1;

      IF v_event.id IS NOT NULL THEN
        INSERT INTO public.player_birthday_event_instances(user_id,profile_id,game_year,age,event_id)
        VALUES(p.user_id,p.id,_game_year,v_age,v_event.id)
        RETURNING * INTO v_instance;
      END IF;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.profile_id=p.id AND n.type='birthday'
      AND n.metadata->>'game_year' = _game_year::text
  ) THEN
    INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata)
    VALUES(p.user_id,p.id,'character','birthday','🎂 Happy Birthday!',
      format('You turned %s today. Your birthday reward is %s SXP + %s AP.',v_age,v_sxp,v_ap),
      '/character',jsonb_build_object('game_year',_game_year,'age',v_age,'sxp',v_sxp,'ap',v_ap));
  END IF;

  RETURN jsonb_build_object(
    'is_birthday',true,
    'age',v_age,
    'reward',jsonb_build_object('sxp',v_sxp,'ap',v_ap),
    'claimed',EXISTS(SELECT 1 FROM public.player_birthday_rewards r WHERE r.profile_id=p.id AND r.game_year=_game_year),
    'event',CASE WHEN v_instance.id IS NULL THEN NULL ELSE (
      SELECT jsonb_build_object('instance_id',v_instance.id,'title',e.title,'description',e.description,'choices',e.choices,'resolved',v_instance.resolved_at IS NOT NULL,'selected_choice',v_instance.selected_choice,'outcome_text',v_instance.outcome_text)
      FROM public.birthday_event_catalog e WHERE e.id=v_instance.event_id
    ) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_character_birthday_reward(
  _profile_id uuid,
  _game_year integer,
  _game_month integer,
  _game_day integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  p public.profiles%rowtype;
  v_age integer;
  v_sxp integer;
  v_ap integer;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id=_profile_id FOR UPDATE;
  IF NOT FOUND OR p.user_id <> (SELECT auth.uid()) THEN RAISE EXCEPTION 'Profile unavailable'; END IF;
  IF NOT public.is_character_birthday(_profile_id,_game_month,_game_day) THEN RAISE EXCEPTION 'Birthday reward is only available on your birthday'; END IF;
  IF EXISTS(SELECT 1 FROM public.player_birthday_rewards WHERE profile_id=_profile_id AND game_year=_game_year) THEN RAISE EXCEPTION 'Birthday reward already claimed'; END IF;

  v_age := public.calculate_character_age(_profile_id,_game_year,_game_month,_game_day);
  v_sxp := LEAST(1000, 500 + v_age * 5);
  v_ap := LEAST(10, 5 + FLOOR(v_age / 20.0)::integer);

  INSERT INTO public.player_xp_wallet(profile_id,xp_balance,lifetime_xp,skill_xp_balance,skill_xp_lifetime,attribute_points_balance,attribute_points_lifetime,last_recalculated)
  VALUES(_profile_id,v_sxp,v_sxp,v_sxp,v_sxp,v_ap,v_ap,now())
  ON CONFLICT(profile_id) DO UPDATE SET
    xp_balance=COALESCE(public.player_xp_wallet.xp_balance,0)+v_sxp,
    lifetime_xp=COALESCE(public.player_xp_wallet.lifetime_xp,0)+v_sxp,
    skill_xp_balance=COALESCE(public.player_xp_wallet.skill_xp_balance,public.player_xp_wallet.xp_balance,0)+v_sxp,
    skill_xp_lifetime=COALESCE(public.player_xp_wallet.skill_xp_lifetime,public.player_xp_wallet.lifetime_xp,0)+v_sxp,
    attribute_points_balance=COALESCE(public.player_xp_wallet.attribute_points_balance,0)+v_ap,
    attribute_points_lifetime=COALESCE(public.player_xp_wallet.attribute_points_lifetime,0)+v_ap,
    last_recalculated=now();

  INSERT INTO public.experience_ledger(user_id,profile_id,activity_type,xp_amount,metadata)
  VALUES(p.user_id,p.id,'birthday_reward',v_sxp,jsonb_build_object('game_year',_game_year,'age',v_age,'ap',v_ap));

  INSERT INTO public.player_birthday_rewards(user_id,profile_id,game_year,xp_awarded,cash_awarded,ap_awarded,age)
  VALUES(p.user_id,p.id,_game_year,v_sxp,0,v_ap,v_age);

  RETURN jsonb_build_object('success',true,'age',v_age,'sxp',v_sxp,'ap',v_ap);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_birthday_event_choice(
  _instance_id uuid,
  _choice_index integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  i public.player_birthday_event_instances%rowtype;
  e public.birthday_event_catalog%rowtype;
  c jsonb;
  fx jsonb;
  v_xp integer := 0;
  v_ap integer := 0;
BEGIN
  SELECT * INTO i FROM public.player_birthday_event_instances WHERE id=_instance_id FOR UPDATE;
  IF NOT FOUND OR i.user_id <> (SELECT auth.uid()) THEN RAISE EXCEPTION 'Birthday event unavailable'; END IF;
  IF i.resolved_at IS NOT NULL THEN RAISE EXCEPTION 'Birthday event already resolved'; END IF;

  SELECT * INTO e FROM public.birthday_event_catalog WHERE id=i.event_id;
  IF _choice_index < 0 OR _choice_index >= jsonb_array_length(e.choices) THEN RAISE EXCEPTION 'Invalid birthday choice'; END IF;
  c := e.choices -> _choice_index;
  fx := COALESCE(c->'effects','{}'::jsonb);
  v_xp := COALESCE((fx->>'xp')::integer,0);
  v_ap := COALESCE((fx->>'ap')::integer,0);

  UPDATE public.profiles p SET
    health=LEAST(100,GREATEST(0,COALESCE(p.health,100)+COALESCE((fx->>'health')::integer,0))),
    physical_health=LEAST(100,GREATEST(0,COALESCE(p.physical_health,p.health,100)+COALESCE((fx->>'health')::integer,0))),
    energy=LEAST(100,GREATEST(0,COALESCE(p.energy,80)+COALESCE((fx->>'energy')::integer,0))),
    happiness=LEAST(100,GREATEST(0,COALESCE(p.happiness,72)+COALESCE((fx->>'happiness')::integer,0))),
    stress=LEAST(100,GREATEST(0,COALESCE(p.stress,28)+COALESCE((fx->>'stress')::integer,0))),
    fame=GREATEST(0,COALESCE(p.fame,0)+COALESCE((fx->>'fame')::integer,0)),
    fans=GREATEST(0,COALESCE(p.fans,0)+COALESCE((fx->>'fans')::integer,0)),
    cash=GREATEST(0,COALESCE(p.cash,0)+COALESCE((fx->>'cash')::integer,0))
  WHERE p.id=i.profile_id;

  IF v_xp <> 0 OR v_ap <> 0 THEN
    INSERT INTO public.player_xp_wallet(profile_id,xp_balance,lifetime_xp,skill_xp_balance,skill_xp_lifetime,attribute_points_balance,attribute_points_lifetime,last_recalculated)
    VALUES(i.profile_id,GREATEST(0,v_xp),GREATEST(0,v_xp),GREATEST(0,v_xp),GREATEST(0,v_xp),GREATEST(0,v_ap),GREATEST(0,v_ap),now())
    ON CONFLICT(profile_id) DO UPDATE SET
      xp_balance=GREATEST(0,COALESCE(public.player_xp_wallet.xp_balance,0)+v_xp),
      lifetime_xp=GREATEST(0,COALESCE(public.player_xp_wallet.lifetime_xp,0)+GREATEST(0,v_xp)),
      skill_xp_balance=GREATEST(0,COALESCE(public.player_xp_wallet.skill_xp_balance,public.player_xp_wallet.xp_balance,0)+v_xp),
      skill_xp_lifetime=GREATEST(0,COALESCE(public.player_xp_wallet.skill_xp_lifetime,public.player_xp_wallet.lifetime_xp,0)+GREATEST(0,v_xp)),
      attribute_points_balance=GREATEST(0,COALESCE(public.player_xp_wallet.attribute_points_balance,0)+v_ap),
      attribute_points_lifetime=GREATEST(0,COALESCE(public.player_xp_wallet.attribute_points_lifetime,0)+GREATEST(0,v_ap)),
      last_recalculated=now();
  END IF;

  UPDATE public.player_birthday_event_instances SET selected_choice=_choice_index,outcome_text=c->>'outcome',effects_applied=fx,resolved_at=now() WHERE id=i.id;
  RETURN jsonb_build_object('success',true,'outcome',c->>'outcome','effects',fx);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_birthday_state(uuid,integer,integer,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_character_birthday_reward(uuid,integer,integer,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_birthday_event_choice(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_birthday_state(uuid,integer,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_character_birthday_reward(uuid,integer,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_birthday_event_choice(uuid,integer) TO authenticated;

-- Age now gently affects natural recovery. There is no penalty before 35; later ages
-- progressively recover a little more slowly and physical health can decline occasionally.
CREATE OR REPLACE FUNCTION public.process_daily_wellness(_profile_id uuid, _day date DEFAULT current_date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  p profiles%rowtype;
  g record;
  v_age integer;
  v_age_recovery numeric := 1;
  v_age_health_delta integer := 0;
  new_energy int;
  new_fatigue int;
  new_nutrition int;
  new_stress int;
  new_sleep int;
  new_motivation int;
  new_burnout int;
  new_physical_health int;
  score int;
  state text;
  v_recovery_multiplier numeric := 1;
  v_effective_recovery numeric := 1;
  v_ailment_recovery_step int;
  v_elapsed integer;
BEGIN
  SELECT * INTO p FROM profiles WHERE id = _profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;

  SELECT * INTO g FROM public.rockmundo_game_date(_day);
  v_age := public.calculate_character_age(_profile_id,g.game_year,g.game_month,g.game_day);

  v_age_recovery := CASE
    WHEN v_age < 35 THEN 1.000
    WHEN v_age < 50 THEN 0.995
    WHEN v_age < 65 THEN 0.990
    WHEN v_age < 80 THEN 0.980
    WHEN v_age < 90 THEN 0.970
    ELSE 0.960
  END;

  v_elapsed := GREATEST(0,_day - DATE '2026-01-01');
  v_age_health_delta := CASE
    WHEN v_age >= 85 AND MOD(v_elapsed,10)=0 THEN -1
    WHEN v_age >= 70 AND MOD(v_elapsed,20)=0 THEN -1
    WHEN v_age >= 55 AND MOD(v_elapsed,30)=0 THEN -1
    ELSE 0
  END;

  IF p.current_city_id IS NOT NULL THEN
    SELECT COALESCE(m.recovery_multiplier, 1) INTO v_recovery_multiplier FROM public.city_gameplay_modifiers(p.current_city_id) m;
  END IF;
  v_recovery_multiplier := LEAST(1.10, GREATEST(0.90, COALESCE(v_recovery_multiplier, 1)));
  v_effective_recovery := v_recovery_multiplier * v_age_recovery;

  IF p.wellness_last_processed_on IS NOT NULL AND p.wellness_last_processed_on >= _day THEN
    score := calculate_overall_wellness(p.energy,p.physical_health,p.happiness,p.stress,p.fatigue,p.sleep_quality,p.nutrition,p.fitness,p.motivation,p.burnout_risk);
    RETURN jsonb_build_object('ok',true,'idempotent',true,'overall_wellness',score,'state',wellness_state(score),'city_recovery_multiplier',v_recovery_multiplier,'age',v_age,'age_recovery_multiplier',v_age_recovery);
  END IF;

  new_energy := least(100,greatest(0,coalesce(p.energy,80)+round(3*v_effective_recovery)::int));
  new_fatigue := least(100,greatest(0,coalesce(p.fatigue,35)-round(4*v_effective_recovery)::int));
  new_nutrition := least(100,greatest(0,coalesce(p.nutrition,68)-3));
  new_stress := least(100,greatest(0,coalesce(p.stress,28)+1));
  new_sleep := least(100,greatest(0,coalesce(p.sleep_quality,72)-2));
  new_motivation := least(100,greatest(0,coalesce(p.motivation,72)+case when coalesce(p.happiness,72)>70 then 1 else -1 end));
  new_burnout := least(100,greatest(0,coalesce(p.burnout_risk,18)+case when coalesce(p.stress,28)>70 then 5 else -round(3*v_effective_recovery)::int end+case when coalesce(p.fatigue,35)>75 then 4 else 0 end));
  new_physical_health := least(100,greatest(0,coalesce(p.physical_health,p.health,100)+v_age_health_delta));
  score := calculate_overall_wellness(new_energy,new_physical_health,p.happiness,new_stress,new_fatigue,new_sleep,new_nutrition,p.fitness,new_motivation,new_burnout);
  state := wellness_state(score);

  UPDATE profiles SET energy=new_energy,fatigue=new_fatigue,nutrition=new_nutrition,stress=new_stress,sleep_quality=new_sleep,motivation=new_motivation,burnout_risk=new_burnout,physical_health=new_physical_health,health=new_physical_health,wellness_last_processed_on=_day,last_health_update=now() WHERE id=_profile_id;

  INSERT INTO wellness_history(user_id,profile_id,processed_on,overall_wellness,state,values,source)
  VALUES(p.user_id,p.id,_day,score,state,jsonb_build_object('energy',new_energy,'physical_health',new_physical_health,'happiness',p.happiness,'stress',new_stress,'fatigue',new_fatigue,'sleep_quality',new_sleep,'nutrition',new_nutrition,'fitness',p.fitness,'motivation',new_motivation,'burnout_risk',new_burnout,'city_recovery_multiplier',v_recovery_multiplier,'age',v_age,'age_recovery_multiplier',v_age_recovery,'age_health_delta',v_age_health_delta),'daily')
  ON CONFLICT(profile_id,processed_on,source) DO NOTHING;

  v_ailment_recovery_step := GREATEST(1,ROUND((CASE WHEN new_fatigue<50 THEN 26 ELSE 18 END)*v_effective_recovery)::int);
  UPDATE player_ailments SET recovery_progress=least(100,recovery_progress+v_ailment_recovery_step),resolved_at=CASE WHEN recovery_progress+v_ailment_recovery_step>=100 THEN now() ELSE resolved_at END WHERE profile_id=_profile_id AND resolved_at IS NULL;

  RETURN jsonb_build_object('ok',true,'idempotent',false,'overall_wellness',score,'state',state,'city_recovery_multiplier',v_recovery_multiplier,'age',v_age,'age_recovery_multiplier',v_age_recovery,'age_health_delta',v_age_health_delta,'ailment_recovery_step',v_ailment_recovery_step);
END;
$$;

REVOKE ALL ON FUNCTION public.process_daily_wellness(uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_daily_wellness(uuid,date) TO authenticated,service_role;

NOTIFY pgrst, 'reload schema';