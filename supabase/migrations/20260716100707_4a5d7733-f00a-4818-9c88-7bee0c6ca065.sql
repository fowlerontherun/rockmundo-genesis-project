
-- 1. Lifestyle catalog
CREATE TABLE IF NOT EXISTS public.wellness_lifestyles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'sparkles',
  accent_color text NOT NULL DEFAULT 'primary',
  bonuses text[] NOT NULL DEFAULT '{}',
  penalties text[] NOT NULL DEFAULT '{}',
  modifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  switch_cost integer NOT NULL DEFAULT 0,
  unlock_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wellness_lifestyles TO anon, authenticated;
GRANT ALL ON public.wellness_lifestyles TO service_role;

ALTER TABLE public.wellness_lifestyles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read lifestyle catalog"
  ON public.wellness_lifestyles FOR SELECT
  USING (is_active = true);

-- 2. Per-player lifestyle
CREATE TABLE IF NOT EXISTS public.player_wellness_lifestyle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  lifestyle_slug text NOT NULL REFERENCES public.wellness_lifestyles(slug),
  started_at timestamptz NOT NULL DEFAULT now(),
  switch_available_at timestamptz NOT NULL DEFAULT now(),
  total_switches integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_wellness_lifestyle TO authenticated;
GRANT ALL ON public.player_wellness_lifestyle TO service_role;

ALTER TABLE public.player_wellness_lifestyle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players read own lifestyle"
  ON public.player_wellness_lifestyle FOR SELECT
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players write own lifestyle"
  ON public.player_wellness_lifestyle FOR ALL
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE TRIGGER trg_player_wellness_lifestyle_updated_at
  BEFORE UPDATE ON public.player_wellness_lifestyle
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Seed lifestyles
INSERT INTO public.wellness_lifestyles (slug, name, tagline, description, icon, accent_color, bonuses, penalties, modifiers, switch_cost, sort_order) VALUES
('balanced', 'Balanced', 'Steady and safe', 'A well-rounded life. No standout gains, but no drift either. Great for new artists.',
 'scale', 'primary',
 ARRAY['Small vital regen', 'No stat drift', 'Neutral addiction risk'],
 ARRAY['No standout bonus'],
 '{"health_regen":1,"mood_regen":1,"energy_regen":1,"xp_multiplier":1.0,"fame_multiplier":1.0,"addiction_risk":1.0,"weekly_upkeep":0,"activity_slots":3}'::jsonb,
 0, 1),

('straight_edge', 'Straight Edge', 'Clean living, sharp focus', 'No booze, no substances, no compromises. Elite focus and health at the cost of scene cred.',
 'shield', 'success',
 ARRAY['+15% skill XP', '+2 Health regen', 'Immune to substance ailments'],
 ARRAY['-10% Fame gain', 'Party rep locked', 'Some indulgences unavailable'],
 '{"health_regen":3,"mood_regen":1,"energy_regen":1,"xp_multiplier":1.15,"fame_multiplier":0.9,"addiction_risk":0,"weekly_upkeep":0,"activity_slots":3,"locks_categories":["indulgence"]}'::jsonb,
 0, 2),

('party_animal', 'Party Animal', 'Live fast, sing loud', 'Fame and charisma soar, but your body pays. Every night is a headline.',
 'wine', 'warning',
 ARRAY['+20% Fame gain', '+15% Charisma events', 'Cheaper indulgences', 'Nightclub rep +'],
 ARRAY['-2 Health regen', '+50% addiction risk', 'Energy drain'],
 '{"health_regen":-2,"mood_regen":2,"energy_regen":-1,"xp_multiplier":0.95,"fame_multiplier":1.2,"addiction_risk":1.5,"weekly_upkeep":200,"activity_slots":3,"indulgence_discount":0.25}'::jsonb,
 0, 3),

('fitness_fanatic', 'Fitness Fanatic', 'Iron body, iron will', 'Marathon stamina and gig endurance. Your body is a temple; your dinner bill is huge.',
 'dumbbell', 'success',
 ARRAY['+3 Stamina cap', '+2 Health regen', '+20% gig endurance'],
 ARRAY['-10% Creativity XP', 'Higher food cost'],
 '{"health_regen":2,"mood_regen":1,"energy_regen":2,"xp_multiplier":1.0,"fame_multiplier":1.0,"addiction_risk":0.5,"weekly_upkeep":150,"activity_slots":4,"gig_endurance":1.2,"creativity_xp":0.9}'::jsonb,
 0, 4),

('workaholic', 'Workaholic', 'The grind never sleeps', 'Practice, record, repeat. Skills climb fast, but mood and relationships suffer.',
 'briefcase', 'primary',
 ARRAY['+25% Practice XP', '+15% Job income', '+1 activity slot'],
 ARRAY['-2 Mood regen', '-20% Relationship XP', 'Burnout risk'],
 '{"health_regen":0,"mood_regen":-2,"energy_regen":0,"xp_multiplier":1.25,"fame_multiplier":1.0,"addiction_risk":1.1,"weekly_upkeep":0,"activity_slots":4,"job_income":1.15,"relationship_xp":0.8,"burnout_risk":true}'::jsonb,
 0, 5),

('bohemian', 'Bohemian Creative', 'Art over everything', 'Songs flow, inspiration strikes. Money and health? Someone else''s problem.',
 'palette', 'info',
 ARRAY['+30% Songwriting XP', '+Inspiration events', '+Random muse rolls'],
 ARRAY['-15% Money income', '-1 Health regen'],
 '{"health_regen":-1,"mood_regen":2,"energy_regen":0,"xp_multiplier":1.05,"fame_multiplier":1.0,"addiction_risk":1.1,"weekly_upkeep":0,"activity_slots":3,"songwriting_xp":1.3,"money_income":0.85,"inspiration_boost":true}'::jsonb,
 0, 6),

('zen', 'Spiritual Zen', 'Calm mind, steady soul', 'Nothing rattles you. Stress rolls off, but the spotlight burns dimmer.',
 'sparkles', 'info',
 ARRAY['+3 Mood floor', 'Resist stress ailments', '-30% addiction risk'],
 ARRAY['-5% Fame gain', 'Slower aggression-based rep'],
 '{"health_regen":1,"mood_regen":3,"energy_regen":1,"xp_multiplier":1.0,"fame_multiplier":0.95,"addiction_risk":0.7,"weekly_upkeep":0,"activity_slots":3,"stress_resist":true,"mood_floor":40}'::jsonb,
 0, 7),

('rockstar', 'Luxury Rockstar', 'Living the dream', 'Fame multiplier through the roof, VIP everywhere. Weekly bill will make you sweat.',
 'crown', 'warning',
 ARRAY['+35% Fame gain', '+VIP access boost', '+20% Charisma events'],
 ARRAY['$500/week upkeep', 'Tabloid target', '+30% addiction risk'],
 '{"health_regen":0,"mood_regen":1,"energy_regen":0,"xp_multiplier":1.0,"fame_multiplier":1.35,"addiction_risk":1.3,"weekly_upkeep":500,"activity_slots":4,"vip_boost":true,"tabloid_risk":true}'::jsonb,
 0, 8)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  accent_color = EXCLUDED.accent_color,
  bonuses = EXCLUDED.bonuses,
  penalties = EXCLUDED.penalties,
  modifiers = EXCLUDED.modifiers,
  updated_at = now();

-- 4. Switch RPC (7-day cooldown between switches, first pick is free)
CREATE OR REPLACE FUNCTION public.switch_wellness_lifestyle(new_slug text)
RETURNS public.player_wellness_lifestyle
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile_id uuid;
  v_current public.player_wellness_lifestyle%ROWTYPE;
  v_row public.player_wellness_lifestyle%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;

  SELECT id INTO v_profile_id
    FROM public.profiles
   WHERE user_id = v_uid AND COALESCE(is_active, false) = true
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_profile_id IS NULL THEN
    SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_uid ORDER BY created_at LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'No active character'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.wellness_lifestyles WHERE slug = new_slug AND is_active = true) THEN
    RAISE EXCEPTION 'Unknown lifestyle: %', new_slug;
  END IF;

  SELECT * INTO v_current FROM public.player_wellness_lifestyle WHERE profile_id = v_profile_id;

  IF NOT FOUND THEN
    INSERT INTO public.player_wellness_lifestyle (profile_id, lifestyle_slug, switch_available_at, total_switches)
    VALUES (v_profile_id, new_slug, now() + interval '7 days', 0)
    RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  IF v_current.lifestyle_slug = new_slug THEN
    RETURN v_current;
  END IF;

  IF v_current.switch_available_at > now() THEN
    RAISE EXCEPTION 'Lifestyle switch on cooldown until %', v_current.switch_available_at;
  END IF;

  UPDATE public.player_wellness_lifestyle
     SET lifestyle_slug = new_slug,
         started_at = now(),
         switch_available_at = now() + interval '7 days',
         total_switches = total_switches + 1
   WHERE profile_id = v_profile_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.switch_wellness_lifestyle(text) TO authenticated;

-- 5. Helper: modifiers for other systems
CREATE OR REPLACE FUNCTION public.get_wellness_lifestyle_modifiers(p_profile_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(wl.modifiers, '{}'::jsonb)
    FROM public.player_wellness_lifestyle pwl
    JOIN public.wellness_lifestyles wl ON wl.slug = pwl.lifestyle_slug
   WHERE pwl.profile_id = p_profile_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_wellness_lifestyle_modifiers(uuid) TO authenticated, service_role;
