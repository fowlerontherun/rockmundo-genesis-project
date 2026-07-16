
-- 1. Extend catalog
ALTER TABLE public.wellness_activity_catalog
  ADD COLUMN IF NOT EXISTS can_overlap boolean NOT NULL DEFAULT true;

-- Make existing rows overlap-safe by default so wellness doesn't block gigs/tours
UPDATE public.wellness_activity_catalog SET can_overlap = true WHERE can_overlap IS DISTINCT FROM true;

-- 2. Seed a large batch of new activities (idempotent via ON CONFLICT slug)
INSERT INTO public.wellness_activity_catalog
  (slug, name, category, description, duration_minutes, cooldown_hours, stamina_cost, cost_cents, stat_effects, ailment_risk, treats_ailment_slug, unlock_min_fame, sort_order, is_active, can_overlap)
VALUES
  -- Recovery (short, cheap, mood/energy focused)
  ('power_nap','Power Nap','recovery','A 20 minute nap to reset your focus.',20,6,0,0,'{"energy":10,"fatigue":-8,"mood":3}','{}',NULL,0,10,true,true),
  ('breathing_exercise','Breathing Exercise','recovery','Box breathing to lower stress fast.',10,4,0,0,'{"stress":-8,"mood":4,"burnout_risk":-3}','{}',NULL,0,11,true,true),
  ('warm_bath','Warm Bath','recovery','A long soak — melts tension away.',45,12,0,500,'{"stress":-10,"mood":6,"sleep_quality":4}','{}',NULL,0,12,true,true),
  ('nature_walk','Nature Walk','recovery','Fresh air, no phone.',60,10,5,0,'{"mood":8,"stress":-8,"fitness":2}','{}',NULL,0,13,true,true),
  ('journaling','Evening Journaling','recovery','Write it down, let it go.',20,8,0,0,'{"stress":-6,"motivation":4,"mood":3}','{}',NULL,0,14,true,true),
  ('digital_detox','Digital Detox','recovery','Phone off, brain on.',120,24,0,0,'{"stress":-14,"mood":8,"burnout_risk":-8}','{}',NULL,0,15,true,true),
  ('acupuncture','Acupuncture Session','recovery','Tiny needles, big relief.',60,48,0,4500,'{"stress":-12,"mood":6,"physical_health":5}','{}',NULL,0,16,true,true),
  ('float_tank','Sensory Deprivation Float','recovery','Zero gravity, zero noise.',90,72,0,7500,'{"stress":-18,"mood":10,"sleep_quality":6}','{}',NULL,20,17,true,true),

  -- Fitness
  ('morning_run','Morning Run','fitness','Cardio to start the day.',30,10,15,0,'{"fitness":4,"energy":-10,"physical_health":3,"mood":4}','{}',NULL,0,20,true,true),
  ('yoga_home','Home Yoga','fitness','Bodyweight flow.',30,8,10,0,'{"fitness":2,"stress":-6,"physical_health":2}','{}',NULL,0,21,true,true),
  ('swimming','Swimming Laps','fitness','Low-impact, full-body.',45,14,20,1500,'{"fitness":5,"physical_health":4,"stress":-5}','{}',NULL,0,22,true,true),
  ('cycling','Cycling','fitness','Long ride, clear head.',75,18,25,0,'{"fitness":6,"physical_health":4,"mood":4,"stress":-4}','{}',NULL,0,23,true,true),
  ('boxing_class','Boxing Class','fitness','Punch out the stress.',60,18,30,2500,'{"fitness":6,"stress":-10,"physical_health":3}','{"minor_injury":0.05}',NULL,0,24,true,true),
  ('pilates','Pilates','fitness','Core strength, posture.',45,16,15,2000,'{"fitness":4,"physical_health":3,"posture":0}','{}',NULL,0,25,true,true),
  ('hiit_workout','HIIT Workout','fitness','High intensity, high reward.',30,14,25,0,'{"fitness":6,"physical_health":3,"energy":-5}','{"minor_injury":0.06}',NULL,0,26,true,true),
  ('stretch_routine','Stretch Routine','fitness','Loosen up, prevent injury.',20,6,5,0,'{"fitness":1,"stress":-3,"physical_health":2}','{}',NULL,0,27,true,true),
  ('rock_climbing','Rock Climbing','fitness','Grip strength and focus.',90,20,30,3500,'{"fitness":7,"mood":6,"physical_health":4}','{"minor_injury":0.08}',NULL,10,28,true,true),

  -- Medical
  ('eye_checkup','Eye Checkup','medical','Keep your vision sharp.',45,8760,5,4000,'{"physical_health":2}','{}',NULL,0,40,true,true),
  ('vaccination','Seasonal Vaccination','medical','Skip the flu this year.',20,4320,5,3000,'{"physical_health":3}','{}',NULL,0,41,true,true),
  ('blood_test','Full Blood Panel','medical','Baseline health check.',30,4320,5,8000,'{"physical_health":4,"motivation":2}','{}',NULL,0,42,true,true),
  ('chiropractor','Chiropractor Visit','medical','For the road-warrior back.',45,336,10,6500,'{"physical_health":6,"stress":-4}','{}','back_pain',0,43,true,true),
  ('nutritionist','Nutritionist Consult','medical','Custom meal plan.',60,720,5,9000,'{"nutrition":10,"motivation":4}','{}',NULL,0,44,true,true),
  ('sleep_clinic','Sleep Clinic Study','medical','Diagnose the insomnia.',480,8760,10,25000,'{"sleep_quality":15,"fatigue":-10}','{}','insomnia',0,45,true,true),
  ('cognitive_therapy','CBT Session','medical','Talk therapy, evidence-based.',60,168,5,12000,'{"mood":8,"stress":-10,"motivation":5}','{}','anxiety',0,46,true,true),

  -- Indulgence
  ('coffee_run','Coffee Run','indulgence','Sweet, sweet caffeine.',15,6,0,600,'{"energy":6,"mood":3,"stress":2}','{}',NULL,0,60,true,true),
  ('takeout_dinner','Takeout Dinner','indulgence','Nothing beats greasy comfort food.',45,12,0,3500,'{"mood":6,"nutrition":-4,"happiness":5}','{}',NULL,0,61,true,true),
  ('shopping_spree','Shopping Spree','indulgence','Retail therapy — literally.',120,48,10,15000,'{"mood":10,"stress":-6,"happiness":8}','{}',NULL,0,62,true,true),
  ('after_hours_bar','After Hours Bar','indulgence','Bourbon and bad decisions.',180,24,15,6000,'{"mood":8,"stress":-6,"fatigue":10}','{"hangover":0.35}',NULL,0,63,true,true),
  ('groupie_night','Groupie Night','indulgence','Rockstar behavior.',240,36,25,0,'{"mood":10,"happiness":10,"energy":-15,"burnout_risk":6}','{"stds":0.05,"scandal":0.08}',NULL,25,64,true,true),
  ('junk_food_binge','Junk Food Binge','indulgence','Regret it in the morning.',60,12,0,2500,'{"mood":5,"nutrition":-8,"physical_health":-2}','{"stomach_upset":0.2}',NULL,0,65,true,true),
  ('video_game_marathon','Video Game Marathon','indulgence','One more level. Then another.',240,24,10,0,'{"mood":8,"stress":-6,"fatigue":8,"burnout_risk":4}','{}',NULL,0,66,true,true),
  ('spa_weekend','Spa Weekend','indulgence','Two-day escape.',1440,720,0,50000,'{"mood":20,"stress":-25,"burnout_risk":-15,"sleep_quality":10}','{}',NULL,15,67,true,true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  duration_minutes = EXCLUDED.duration_minutes,
  cooldown_hours = EXCLUDED.cooldown_hours,
  stamina_cost = EXCLUDED.stamina_cost,
  cost_cents = EXCLUDED.cost_cents,
  stat_effects = EXCLUDED.stat_effects,
  ailment_risk = EXCLUDED.ailment_risk,
  can_overlap = EXCLUDED.can_overlap,
  is_active = true,
  updated_at = now();

-- 3. Habit templates catalog
CREATE TABLE IF NOT EXISTS public.wellness_habit_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  target_per_week integer NOT NULL DEFAULT 7,
  stat_bonus jsonb NOT NULL DEFAULT '{}'::jsonb,
  streak_bonus jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wellness_habit_templates TO anon, authenticated;
GRANT ALL ON public.wellness_habit_templates TO service_role;
ALTER TABLE public.wellness_habit_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Habit templates are public" ON public.wellness_habit_templates;
CREATE POLICY "Habit templates are public" ON public.wellness_habit_templates FOR SELECT USING (true);

INSERT INTO public.wellness_habit_templates (slug, name, description, category, target_per_week, stat_bonus, streak_bonus, sort_order)
VALUES
  ('morning_stretch','Morning Stretch','5 minutes of stretching every morning.','fitness',7,'{"physical_health":1,"stress":-1}','{"7":{"fitness":2},"30":{"physical_health":5}}',1),
  ('hydration','Drink 2L Water','Stay hydrated. Yes, this matters.','fitness',7,'{"nutrition":1,"energy":1}','{"14":{"physical_health":3}}',2),
  ('early_bed','Early to Bed','Lights out before midnight.','recovery',5,'{"sleep_quality":2,"fatigue":-2}','{"14":{"mood":5},"30":{"burnout_risk":-8}}',3),
  ('daily_practice','Daily Instrument Practice','30 min of deliberate practice.','fitness',6,'{"motivation":2}','{"30":{"fame":2}}',4),
  ('no_alcohol','Sober Streak','No booze today.','recovery',7,'{"physical_health":2,"burnout_risk":-1}','{"30":{"physical_health":10}}',5),
  ('meditation_daily','Meditate 10 min','A daily reset for the mind.','recovery',7,'{"stress":-2,"mood":1}','{"21":{"burnout_risk":-6}}',6),
  ('meal_prep','Home Cooked Meal','Skip the takeout.','fitness',5,'{"nutrition":2}','{"14":{"physical_health":4}}',7),
  ('social_call','Call a Friend','Ten minutes with someone who matters.','recovery',3,'{"happiness":2,"stress":-1}','{"14":{"mood":5}}',8),
  ('read_20','Read for 20 min','Books, not doom-scrolls.','recovery',5,'{"motivation":1,"stress":-1}','{"30":{"motivation":6}}',9),
  ('gratitude','Gratitude Note','List one thing you''re grateful for.','recovery',7,'{"mood":1}','{"30":{"happiness":6}}',10)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,
  target_per_week = EXCLUDED.target_per_week, stat_bonus = EXCLUDED.stat_bonus,
  streak_bonus = EXCLUDED.streak_bonus, sort_order = EXCLUDED.sort_order, is_active = true;

-- 4. Ensure player_habits has fields we need
ALTER TABLE public.player_habits
  ADD COLUMN IF NOT EXISTS template_slug text,
  ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_completed_date date;

-- 5. RPCs
CREATE OR REPLACE FUNCTION public.start_wellness_habit(_template_slug text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile_id uuid;
  v_tpl public.wellness_habit_templates;
  v_habit_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id=v_uid AND is_active_character=true LIMIT 1;
  IF v_profile_id IS NULL THEN
    SELECT id INTO v_profile_id FROM public.profiles WHERE user_id=v_uid LIMIT 1;
  END IF;
  SELECT * INTO v_tpl FROM public.wellness_habit_templates WHERE slug=_template_slug AND is_active=true;
  IF v_tpl IS NULL THEN RAISE EXCEPTION 'template not found'; END IF;
  SELECT id INTO v_habit_id FROM public.player_habits WHERE user_id=v_uid AND profile_id=v_profile_id AND template_slug=_template_slug LIMIT 1;
  IF v_habit_id IS NULL THEN
    INSERT INTO public.player_habits(user_id, profile_id, name, description, category, frequency, target_per_week, is_active, template_slug)
    VALUES (v_uid, v_profile_id, v_tpl.name, v_tpl.description, v_tpl.category, 'daily', v_tpl.target_per_week, true, _template_slug)
    RETURNING id INTO v_habit_id;
  ELSE
    UPDATE public.player_habits SET is_active=true WHERE id=v_habit_id;
  END IF;
  RETURN v_habit_id;
END $$;

CREATE OR REPLACE FUNCTION public.complete_wellness_habit(_habit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_habit public.player_habits;
  v_today date := (now() at time zone 'UTC')::date;
  v_new_streak integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO v_habit FROM public.player_habits WHERE id=_habit_id AND user_id=v_uid;
  IF v_habit IS NULL THEN RAISE EXCEPTION 'habit not found'; END IF;
  IF v_habit.last_completed_date = v_today THEN
    RETURN jsonb_build_object('ok',false,'reason','already_done_today','streak',v_habit.current_streak);
  END IF;
  IF v_habit.last_completed_date = v_today - 1 THEN
    v_new_streak := coalesce(v_habit.current_streak,0) + 1;
  ELSE
    v_new_streak := 1;
  END IF;
  INSERT INTO public.player_habit_completions(habit_id, completed_date) VALUES (_habit_id, v_today)
    ON CONFLICT DO NOTHING;
  UPDATE public.player_habits
    SET current_streak = v_new_streak,
        best_streak = GREATEST(best_streak, v_new_streak),
        last_completed_date = v_today
    WHERE id=_habit_id;
  RETURN jsonb_build_object('ok',true,'streak',v_new_streak);
END $$;

CREATE OR REPLACE FUNCTION public.stop_wellness_habit(_habit_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.player_habits SET is_active=false WHERE id=_habit_id AND user_id=auth.uid();
END $$;

GRANT EXECUTE ON FUNCTION public.start_wellness_habit(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_wellness_habit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_wellness_habit(uuid) TO authenticated;
