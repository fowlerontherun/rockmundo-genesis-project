-- =====================================================
-- 1. Child trait catalog
-- =====================================================
CREATE TABLE IF NOT EXISTS public.child_trait_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  icon text DEFAULT 'sparkles',
  -- Per-interaction modifiers. Keys = interaction_type, values = jsonb object of stat → multiplier (number) or flat add (string with +/-).
  -- Example: { "homework": { "learning_mult": 1.5, "mood_mult": 0.5 }, "talk": { "stability_add": 4 } }
  modifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Flat baseline tweaks applied at birth, e.g. {"emotional_stability": -5}
  baseline_adjustments jsonb NOT NULL DEFAULT '{}'::jsonb,
  conflicts_with text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.child_trait_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Child traits are viewable by everyone" ON public.child_trait_catalog;
CREATE POLICY "Child traits are viewable by everyone"
  ON public.child_trait_catalog FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage child trait catalog" ON public.child_trait_catalog;
CREATE POLICY "Admins manage child trait catalog"
  ON public.child_trait_catalog FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed 12 child-specific personality traits
INSERT INTO public.child_trait_catalog (key, name, description, icon, modifiers, baseline_adjustments, conflicts_with) VALUES
  ('bookish', 'Bookish', 'Loves stories and learning. Homework and lessons land harder.', 'book-open',
    '{"homework":{"learning_mult":1.6,"mood_mult":0.5},"teach_skill":{"learning_mult":1.4},"hobby":{"learning_mult":1.3}}'::jsonb,
    '{}'::jsonb, ARRAY['mischievous']),
  ('shy', 'Shy', 'Reserved with others. Outings tax mood; quiet talks soothe.', 'leaf',
    '{"outing":{"mood_mult":0.6,"affection_mult":0.7},"talk":{"stability_add":4,"bond_add":3},"play":{"affection_mult":0.8}}'::jsonb,
    '{"emotional_stability":-3}'::jsonb, ARRAY['sociable']),
  ('energetic', 'Energetic', 'Boundless energy. Play and outings shine; sleep is a struggle.', 'zap',
    '{"play":{"affection_mult":1.4,"mood_mult":1.3},"outing":{"mood_mult":1.3},"sleep":{"sleep_mult":0.7}}'::jsonb,
    '{}'::jsonb, ARRAY['anxious']),
  ('stubborn', 'Stubborn', 'Holds their ground. Discipline backfires; allowance bonds extra.', 'mountain',
    '{"discipline":{"mood_mult":1.5,"bond_mult":1.5,"stability_mult":0.7},"allowance":{"bond_mult":1.4}}'::jsonb,
    '{}'::jsonb, ARRAY['empath']),
  ('empath', 'Empath', 'Tunes into feelings. Comfort and talks are powerful.', 'heart',
    '{"comfort":{"mood_mult":1.5,"stability_mult":1.4},"talk":{"stability_mult":1.4,"bond_mult":1.3}}'::jsonb,
    '{}'::jsonb, ARRAY['stubborn']),
  ('prodigy', 'Prodigy', 'Soaks up skills fast. Teaching and homework are extra effective.', 'star',
    '{"teach_skill":{"learning_mult":1.6},"homework":{"learning_mult":1.5},"hobby":{"learning_mult":1.4}}'::jsonb,
    '{}'::jsonb, ARRAY[]::text[]),
  ('creative', 'Creative', 'Imaginative spirit. Hobbies and play unlock more affection.', 'palette',
    '{"hobby":{"affection_mult":1.5,"mood_mult":1.3},"play":{"affection_mult":1.3}}'::jsonb,
    '{}'::jsonb, ARRAY[]::text[]),
  ('anxious', 'Anxious', 'Worry runs high. Discipline cuts deep; comfort heals more.', 'cloud-rain',
    '{"discipline":{"mood_mult":1.6,"stability_mult":1.4},"comfort":{"stability_mult":1.4,"mood_mult":1.3},"talk":{"stability_mult":1.3}}'::jsonb,
    '{"emotional_stability":-5}'::jsonb, ARRAY['energetic','resilient']),
  ('mischievous', 'Mischievous', 'A handful. Discipline lands a little; play is wild fun.', 'flame',
    '{"discipline":{"stability_mult":1.2,"bond_mult":1.3},"play":{"mood_mult":1.3},"homework":{"learning_mult":0.7,"mood_mult":1.2}}'::jsonb,
    '{}'::jsonb, ARRAY['bookish']),
  ('resilient', 'Resilient', 'Bounces back. Penalties are softened across the board.', 'shield',
    '{"discipline":{"mood_mult":0.6,"bond_mult":0.5,"stability_mult":1.2},"homework":{"mood_mult":0.5}}'::jsonb,
    '{"emotional_stability":5}'::jsonb, ARRAY['anxious']),
  ('sociable', 'Sociable', 'Thrives with people. Outings, play and allowance all gain.', 'users',
    '{"outing":{"mood_mult":1.4,"bond_mult":1.3},"play":{"mood_mult":1.2,"bond_mult":1.2},"allowance":{"mood_mult":1.3}}'::jsonb,
    '{}'::jsonb, ARRAY['shy']),
  ('sensitive', 'Sensitive', 'Feels deeply. Mood swings amplified in both directions.', 'feather',
    '{"discipline":{"mood_mult":1.4},"comfort":{"mood_mult":1.3},"talk":{"mood_mult":1.3,"stability_mult":1.2},"homework":{"mood_mult":1.4}}'::jsonb,
    '{}'::jsonb, ARRAY[]::text[])
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  modifiers = EXCLUDED.modifiers,
  baseline_adjustments = EXCLUDED.baseline_adjustments,
  conflicts_with = EXCLUDED.conflicts_with;

-- =====================================================
-- 2. Trigger: auto-assign 2 birth traits on insert
-- =====================================================
CREATE OR REPLACE FUNCTION public.assign_child_birth_traits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_key text;
  v_second_key text;
  v_first_conflicts text[];
  v_baseline jsonb;
  v_stab_delta int := 0;
BEGIN
  -- Skip if caller already provided traits
  IF NEW.traits IS NOT NULL AND jsonb_array_length(NEW.traits) > 0 THEN
    RETURN NEW;
  END IF;

  -- Pick first random trait
  SELECT key, conflicts_with, baseline_adjustments
    INTO v_first_key, v_first_conflicts, v_baseline
  FROM public.child_trait_catalog
  ORDER BY random()
  LIMIT 1;

  IF v_first_key IS NULL THEN
    RETURN NEW;
  END IF;

  v_stab_delta := COALESCE((v_baseline->>'emotional_stability')::int, 0);

  -- Pick a second trait that isn't the same and isn't in conflicts
  SELECT key, baseline_adjustments INTO v_second_key, v_baseline
  FROM public.child_trait_catalog
  WHERE key <> v_first_key
    AND NOT (key = ANY(COALESCE(v_first_conflicts, '{}'::text[])))
    AND NOT (v_first_key = ANY(COALESCE(conflicts_with, '{}'::text[])))
  ORDER BY random()
  LIMIT 1;

  IF v_second_key IS NOT NULL THEN
    v_stab_delta := v_stab_delta + COALESCE((v_baseline->>'emotional_stability')::int, 0);
    NEW.traits := jsonb_build_array(v_first_key, v_second_key);
  ELSE
    NEW.traits := jsonb_build_array(v_first_key);
  END IF;

  -- Apply baseline emotional_stability adjustment, clamped 1..100
  NEW.emotional_stability := GREATEST(1, LEAST(100, COALESCE(NEW.emotional_stability, 50) + v_stab_delta));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_child_birth_traits ON public.player_children;
CREATE TRIGGER trg_assign_child_birth_traits
  BEFORE INSERT ON public.player_children
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_child_birth_traits();

-- =====================================================
-- 3. Rewrite apply_child_interaction with trait modulation
-- =====================================================
CREATE OR REPLACE FUNCTION public.apply_child_interaction(
  p_child_id UUID,
  p_interaction_type TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.child_interactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child public.player_children%ROWTYPE;
  v_parent UUID := auth.uid();
  v_needs JSONB;
  v_mood INT;
  v_bond_a INT;
  v_bond_b INT;
  v_stability INT;
  v_age INT;
  v_min_age INT := 0;
  v_row public.child_interactions%ROWTYPE;
  v_is_parent_a BOOLEAN;

  -- Base deltas (signed integers)
  d_food INT := 0;
  d_sleep INT := 0;
  d_affection INT := 0;
  d_learning INT := 0;
  d_mood INT := 0;
  d_stability INT := 0;
  d_bond INT := 0;

  -- Trait processing
  v_trait_key TEXT;
  v_trait_mods JSONB;
  v_total_mods JSONB := '{}'::jsonb;
  v_triggered_traits TEXT[] := ARRAY[]::TEXT[];

  -- Helper local for combined multipliers (defaults to 1.0)
  m_mood NUMERIC := 1.0;
  m_stab NUMERIC := 1.0;
  m_bond NUMERIC := 1.0;
  m_learn NUMERIC := 1.0;
  m_aff NUMERIC := 1.0;
  m_food NUMERIC := 1.0;
  m_sleep NUMERIC := 1.0;
  -- Flat adders
  a_mood INT := 0;
  a_stab INT := 0;
  a_bond INT := 0;
  a_learn INT := 0;
  a_aff INT := 0;

  v_effects JSONB := '{}'::jsonb;
BEGIN
  IF v_parent IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_child FROM public.player_children WHERE id = p_child_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Child not found';
  END IF;

  IF v_child.parent_a_id <> v_parent AND v_child.parent_b_id <> v_parent
     AND COALESCE(v_child.controller_user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> v_parent THEN
    RAISE EXCEPTION 'Not a parent of this child';
  END IF;

  v_needs := COALESCE(v_child.needs, '{"food":70,"sleep":70,"affection":70,"learning":50}'::jsonb);
  v_mood := COALESCE(v_child.mood, 70);
  v_bond_a := COALESCE(v_child.bond_parent_a, 50);
  v_bond_b := COALESCE(v_child.bond_parent_b, 50);
  v_stability := COALESCE(v_child.emotional_stability, 70);
  v_age := COALESCE(v_child.current_age, 0);
  v_is_parent_a := (v_child.parent_a_id = v_parent);

  -- Min age gate (server-side enforcement)
  v_min_age := CASE p_interaction_type
    WHEN 'homework' THEN 6
    WHEN 'talk' THEN 11
    WHEN 'allowance' THEN 11
    WHEN 'hobby' THEN 6
    WHEN 'discipline' THEN 4
    ELSE 0
  END;

  IF v_age < v_min_age THEN
    RAISE EXCEPTION 'Child too young for % (requires age %)', p_interaction_type, v_min_age;
  END IF;

  -- Base deltas per interaction type (positive or negative)
  CASE p_interaction_type
    WHEN 'feed' THEN d_food := 25; d_mood := 5;
    WHEN 'sleep' THEN d_sleep := 30; d_mood := 3;
    WHEN 'play' THEN d_affection := 20; d_mood := 10; d_bond := 5;
    WHEN 'teach_skill' THEN d_learning := 15; d_stability := 2;
    WHEN 'outing' THEN d_affection := 10; d_mood := 15; d_stability := 3; d_bond := 8;
    WHEN 'comfort' THEN d_mood := 8; d_stability := 5;
    WHEN 'homework' THEN d_learning := 25; d_mood := -3; d_stability := 2; d_bond := 4;
    WHEN 'talk' THEN d_stability := 10; d_mood := 6; d_bond := 10;
    WHEN 'allowance' THEN d_mood := 12; d_bond := 6;
    WHEN 'hobby' THEN d_affection := 12; d_learning := 12; d_mood := 8;
    WHEN 'discipline' THEN d_stability := 6; d_mood := -8; d_bond := -4;
    ELSE
      RAISE EXCEPTION 'Unknown interaction type: %', p_interaction_type;
  END CASE;

  -- Aggregate trait modifiers for this interaction type
  IF v_child.traits IS NOT NULL AND jsonb_array_length(v_child.traits) > 0 THEN
    FOR v_trait_key IN SELECT jsonb_array_elements_text(v_child.traits) LOOP
      SELECT modifiers->p_interaction_type INTO v_trait_mods
      FROM public.child_trait_catalog
      WHERE key = v_trait_key;

      IF v_trait_mods IS NOT NULL AND v_trait_mods <> 'null'::jsonb THEN
        v_triggered_traits := array_append(v_triggered_traits, v_trait_key);
        m_mood  := m_mood  * COALESCE((v_trait_mods->>'mood_mult')::numeric,  1.0);
        m_stab  := m_stab  * COALESCE((v_trait_mods->>'stability_mult')::numeric, 1.0);
        m_bond  := m_bond  * COALESCE((v_trait_mods->>'bond_mult')::numeric,  1.0);
        m_learn := m_learn * COALESCE((v_trait_mods->>'learning_mult')::numeric, 1.0);
        m_aff   := m_aff   * COALESCE((v_trait_mods->>'affection_mult')::numeric, 1.0);
        m_food  := m_food  * COALESCE((v_trait_mods->>'food_mult')::numeric, 1.0);
        m_sleep := m_sleep * COALESCE((v_trait_mods->>'sleep_mult')::numeric, 1.0);
        a_mood  := a_mood  + COALESCE((v_trait_mods->>'mood_add')::int, 0);
        a_stab  := a_stab  + COALESCE((v_trait_mods->>'stability_add')::int, 0);
        a_bond  := a_bond  + COALESCE((v_trait_mods->>'bond_add')::int, 0);
        a_learn := a_learn + COALESCE((v_trait_mods->>'learning_add')::int, 0);
        a_aff   := a_aff   + COALESCE((v_trait_mods->>'affection_add')::int, 0);
      END IF;
    END LOOP;
  END IF;

  -- Apply multipliers + flat adders to base deltas (preserve sign on negatives via multiplier on absolute magnitude)
  d_food      := ROUND(d_food      * m_food)::int;
  d_sleep     := ROUND(d_sleep     * m_sleep)::int;
  d_affection := ROUND(d_affection * m_aff)::int   + a_aff;
  d_learning  := ROUND(d_learning  * m_learn)::int + a_learn;
  d_mood      := ROUND(d_mood      * m_mood)::int  + a_mood;
  d_stability := ROUND(d_stability * m_stab)::int  + a_stab;
  d_bond      := ROUND(d_bond      * m_bond)::int  + a_bond;

  -- Apply to needs jsonb (clamped 0..100)
  IF d_food <> 0 THEN
    v_needs := jsonb_set(v_needs, '{food}', to_jsonb(GREATEST(0, LEAST(100, COALESCE((v_needs->>'food')::int, 70) + d_food))));
  END IF;
  IF d_sleep <> 0 THEN
    v_needs := jsonb_set(v_needs, '{sleep}', to_jsonb(GREATEST(0, LEAST(100, COALESCE((v_needs->>'sleep')::int, 70) + d_sleep))));
  END IF;
  IF d_affection <> 0 THEN
    v_needs := jsonb_set(v_needs, '{affection}', to_jsonb(GREATEST(0, LEAST(100, COALESCE((v_needs->>'affection')::int, 70) + d_affection))));
  END IF;
  IF d_learning <> 0 THEN
    v_needs := jsonb_set(v_needs, '{learning}', to_jsonb(GREATEST(0, LEAST(100, COALESCE((v_needs->>'learning')::int, 50) + d_learning))));
  END IF;

  v_mood      := GREATEST(0, LEAST(100, v_mood + d_mood));
  v_stability := GREATEST(0, LEAST(100, v_stability + d_stability));

  IF d_bond <> 0 THEN
    IF v_is_parent_a THEN
      v_bond_a := GREATEST(0, LEAST(100, v_bond_a + d_bond));
    ELSE
      v_bond_b := GREATEST(0, LEAST(100, v_bond_b + d_bond));
    END IF;
  END IF;

  -- Build effects JSON: only include non-zero deltas + which traits triggered
  IF d_food      <> 0 THEN v_effects := v_effects || jsonb_build_object('food',      d_food);      END IF;
  IF d_sleep     <> 0 THEN v_effects := v_effects || jsonb_build_object('sleep',     d_sleep);     END IF;
  IF d_affection <> 0 THEN v_effects := v_effects || jsonb_build_object('affection', d_affection); END IF;
  IF d_learning  <> 0 THEN v_effects := v_effects || jsonb_build_object('learning',  d_learning);  END IF;
  IF d_mood      <> 0 THEN v_effects := v_effects || jsonb_build_object('mood',      d_mood);      END IF;
  IF d_stability <> 0 THEN v_effects := v_effects || jsonb_build_object('stability', d_stability); END IF;
  IF d_bond      <> 0 THEN v_effects := v_effects || jsonb_build_object('bond',      d_bond);      END IF;
  IF array_length(v_triggered_traits, 1) IS NOT NULL THEN
    v_effects := v_effects || jsonb_build_object('traits', to_jsonb(v_triggered_traits));
  END IF;

  UPDATE public.player_children
  SET needs = v_needs,
      mood = v_mood,
      bond_parent_a = v_bond_a,
      bond_parent_b = v_bond_b,
      emotional_stability = v_stability,
      last_interaction_at = now(),
      updated_at = now()
  WHERE id = p_child_id;

  INSERT INTO public.child_interactions (child_id, parent_profile_id, interaction_type, effects, notes)
  VALUES (p_child_id, v_parent, p_interaction_type, v_effects, p_notes)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Backfill traits for existing children that don't have any
DO $$
DECLARE
  v_id uuid;
  v_first text;
  v_second text;
  v_conflicts text[];
BEGIN
  FOR v_id IN
    SELECT id FROM public.player_children
    WHERE traits IS NULL OR jsonb_array_length(traits) = 0
  LOOP
    SELECT key, conflicts_with INTO v_first, v_conflicts
    FROM public.child_trait_catalog ORDER BY random() LIMIT 1;

    SELECT key INTO v_second FROM public.child_trait_catalog
    WHERE key <> v_first
      AND NOT (key = ANY(COALESCE(v_conflicts, '{}'::text[])))
      AND NOT (v_first = ANY(COALESCE(conflicts_with, '{}'::text[])))
    ORDER BY random() LIMIT 1;

    UPDATE public.player_children
    SET traits = CASE
      WHEN v_second IS NOT NULL THEN jsonb_build_array(v_first, v_second)
      ELSE jsonb_build_array(v_first)
    END
    WHERE id = v_id;
  END LOOP;
END $$;