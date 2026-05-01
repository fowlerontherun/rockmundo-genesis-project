-- =====================================================
-- 1. Synergy catalog
-- =====================================================
CREATE TABLE IF NOT EXISTS public.child_trait_synergies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  trait_a TEXT NOT NULL,
  trait_b TEXT NOT NULL,
  interaction_type TEXT, -- null = any interaction
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  flavor TEXT,
  icon TEXT,
  trigger_chance NUMERIC NOT NULL DEFAULT 0.25 CHECK (trigger_chance > 0 AND trigger_chance <= 1),
  bonus_effects JSONB NOT NULL DEFAULT '{}'::jsonb, -- {mood:+5, stability:+3, bond:+4, learning:+6, affection:+3}
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Normalize pair so (a,b) and (b,a) are the same row
CREATE UNIQUE INDEX IF NOT EXISTS uq_synergy_pair ON public.child_trait_synergies (
  LEAST(trait_a, trait_b),
  GREATEST(trait_a, trait_b),
  COALESCE(interaction_type, '*')
);

ALTER TABLE public.child_trait_synergies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trait synergies are viewable by everyone" ON public.child_trait_synergies;
CREATE POLICY "Trait synergies are viewable by everyone"
  ON public.child_trait_synergies FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage trait synergies" ON public.child_trait_synergies;
CREATE POLICY "Admins manage trait synergies"
  ON public.child_trait_synergies FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 2. Seed synergies
-- =====================================================
INSERT INTO public.child_trait_synergies
  (key, trait_a, trait_b, interaction_type, label, description, flavor, icon, trigger_chance, bonus_effects)
VALUES
  ('bookish_prodigy_homework', 'bookish', 'prodigy', 'homework',
    'Study Flow', 'Bookish + Prodigy clicks during homework — extra learning & a tiny bond.',
    'They blaze through the worksheet with quiet focus.', 'sparkles', 0.45,
    '{"learning": 12, "bond": 3, "stability": 2}'::jsonb),
  ('bookish_prodigy_teach', 'bookish', 'prodigy', 'teach_skill',
    'Quick Study', 'Bookish + Prodigy turns lessons into leaps.',
    'A new concept clicks instantly — eyes light up.', 'sparkles', 0.45,
    '{"learning": 14, "mood": 4}'::jsonb),
  ('creative_prodigy_hobby', 'creative', 'prodigy', 'hobby',
    'Creative Spark', 'Creative + Prodigy makes hobby time genuinely brilliant.',
    'They invent their own little twist on the activity.', 'wand-2', 0.40,
    '{"learning": 8, "affection": 6, "mood": 5}'::jsonb),
  ('empath_sensitive_talk', 'empath', 'sensitive', 'talk',
    'Heart-to-Heart', 'Empath + Sensitive turns a chat into something profound.',
    'Tears, hugs — and a real breakthrough.', 'heart-handshake', 0.50,
    '{"stability": 8, "bond": 6, "mood": 4}'::jsonb),
  ('empath_anxious_comfort', 'empath', 'anxious', 'comfort',
    'Soothing Presence', 'Empath + Anxious makes comfort deeply restorative.',
    'You sit together until the worry melts away.', 'heart-handshake', 0.45,
    '{"stability": 9, "mood": 6}'::jsonb),
  ('sociable_energetic_outing', 'sociable', 'energetic', 'outing',
    'Adventure Mode', 'Sociable + Energetic turns an outing into a memorable day.',
    'They make a friend, climb everything, refuse to go home.', 'compass', 0.45,
    '{"mood": 8, "bond": 5, "affection": 4}'::jsonb),
  ('sociable_creative_play', 'sociable', 'creative', 'play',
    'Imaginary Worlds', 'Sociable + Creative turns play into elaborate make-believe.',
    'Suddenly the living room is a pirate ship.', 'palette', 0.40,
    '{"affection": 7, "mood": 5, "learning": 3}'::jsonb),
  ('resilient_stubborn_discipline', 'resilient', 'stubborn', 'discipline',
    'Iron Will', 'Resilient + Stubborn — discipline lands without breaking trust.',
    'They take it on the chin, lesson learned.', 'shield', 0.35,
    '{"stability": 6, "bond": 3}'::jsonb),
  ('resilient_anxious_comfort', 'resilient', 'anxious', 'comfort',
    'Quiet Strength', 'Resilient + Anxious — comfort builds lasting steadiness.',
    'They steady their breathing and smile.', 'shield', 0.40,
    '{"stability": 7, "mood": 4}'::jsonb),
  ('mischievous_creative_play', 'mischievous', 'creative', 'play',
    'Chaos Theatre', 'Mischievous + Creative turns play into wild invention.',
    'You will be cleaning glitter for weeks. Worth it.', 'flame', 0.40,
    '{"affection": 8, "mood": 6}'::jsonb),
  ('shy_empath_talk', 'shy', 'empath', 'talk',
    'Safe Confiding', 'Shy + Empath — they finally open up.',
    'Something they have been holding back comes out.', 'leaf', 0.45,
    '{"stability": 7, "bond": 7}'::jsonb),
  ('energetic_sociable_play', 'energetic', 'sociable', 'play',
    'Best Day Ever', 'Energetic + Sociable — play time is pure joy.',
    'Belly laughs, sweat, and a triumphant collapse on the sofa.', 'zap', 0.45,
    '{"mood": 8, "affection": 5, "bond": 3}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  trait_a = EXCLUDED.trait_a,
  trait_b = EXCLUDED.trait_b,
  interaction_type = EXCLUDED.interaction_type,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  flavor = EXCLUDED.flavor,
  icon = EXCLUDED.icon,
  trigger_chance = EXCLUDED.trigger_chance,
  bonus_effects = EXCLUDED.bonus_effects,
  is_active = true;

-- =====================================================
-- 3. Update apply_child_interaction with synergy rolls
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

  d_food INT := 0;
  d_sleep INT := 0;
  d_affection INT := 0;
  d_learning INT := 0;
  d_mood INT := 0;
  d_stability INT := 0;
  d_bond INT := 0;

  v_trait_key TEXT;
  v_trait_mods JSONB;
  v_triggered_traits TEXT[] := ARRAY[]::TEXT[];

  m_mood NUMERIC := 1.0;
  m_stab NUMERIC := 1.0;
  m_bond NUMERIC := 1.0;
  m_learn NUMERIC := 1.0;
  m_aff NUMERIC := 1.0;
  m_food NUMERIC := 1.0;
  m_sleep NUMERIC := 1.0;
  a_mood INT := 0;
  a_stab INT := 0;
  a_bond INT := 0;
  a_learn INT := 0;
  a_aff INT := 0;

  -- Synergy tracking
  v_traits_text TEXT[] := ARRAY[]::TEXT[];
  v_syn RECORD;
  v_triggered_synergies JSONB := '[]'::jsonb;
  v_syn_bonus JSONB;
  b_food INT := 0; b_sleep INT := 0; b_aff INT := 0; b_learn INT := 0;
  b_mood INT := 0; b_stab INT := 0; b_bond INT := 0;

  v_effects JSONB := '{}'::jsonb;
BEGIN
  IF v_parent IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_child FROM public.player_children WHERE id = p_child_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Child not found'; END IF;

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

  -- Aggregate per-trait modifiers
  IF v_child.traits IS NOT NULL AND jsonb_array_length(v_child.traits) > 0 THEN
    SELECT array_agg(value::text) INTO v_traits_text
    FROM jsonb_array_elements_text(v_child.traits) AS value;

    FOR v_trait_key IN SELECT unnest(v_traits_text) LOOP
      SELECT modifiers->p_interaction_type INTO v_trait_mods
      FROM public.child_trait_catalog
      WHERE key = v_trait_key;

      IF v_trait_mods IS NOT NULL AND v_trait_mods <> 'null'::jsonb THEN
        v_triggered_traits := array_append(v_triggered_traits, v_trait_key);
        m_mood  := m_mood  * COALESCE((v_trait_mods->>'mood_mult')::numeric, 1.0);
        m_stab  := m_stab  * COALESCE((v_trait_mods->>'stability_mult')::numeric, 1.0);
        m_bond  := m_bond  * COALESCE((v_trait_mods->>'bond_mult')::numeric, 1.0);
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

    -- ===== Synergy rolls =====
    -- Find every active synergy where both traits are present and the interaction matches (or is null).
    FOR v_syn IN
      SELECT s.key, s.label, s.flavor, s.trigger_chance, s.bonus_effects
      FROM public.child_trait_synergies s
      WHERE s.is_active = true
        AND s.trait_a = ANY(v_traits_text)
        AND s.trait_b = ANY(v_traits_text)
        AND (s.interaction_type IS NULL OR s.interaction_type = p_interaction_type)
    LOOP
      IF random() < v_syn.trigger_chance THEN
        v_syn_bonus := v_syn.bonus_effects;
        b_food  := b_food  + COALESCE((v_syn_bonus->>'food')::int, 0);
        b_sleep := b_sleep + COALESCE((v_syn_bonus->>'sleep')::int, 0);
        b_aff   := b_aff   + COALESCE((v_syn_bonus->>'affection')::int, 0);
        b_learn := b_learn + COALESCE((v_syn_bonus->>'learning')::int, 0);
        b_mood  := b_mood  + COALESCE((v_syn_bonus->>'mood')::int, 0);
        b_stab  := b_stab  + COALESCE((v_syn_bonus->>'stability')::int, 0);
        b_bond  := b_bond  + COALESCE((v_syn_bonus->>'bond')::int, 0);
        v_triggered_synergies := v_triggered_synergies || jsonb_build_array(jsonb_build_object(
          'key', v_syn.key,
          'label', v_syn.label,
          'flavor', v_syn.flavor,
          'bonus', v_syn_bonus
        ));
      END IF;
    END LOOP;
  END IF;

  -- Apply per-trait multipliers + flat adders, then add synergy bonuses
  d_food      := ROUND(d_food      * m_food)::int  + b_food;
  d_sleep     := ROUND(d_sleep     * m_sleep)::int + b_sleep;
  d_affection := ROUND(d_affection * m_aff)::int   + a_aff   + b_aff;
  d_learning  := ROUND(d_learning  * m_learn)::int + a_learn + b_learn;
  d_mood      := ROUND(d_mood      * m_mood)::int  + a_mood  + b_mood;
  d_stability := ROUND(d_stability * m_stab)::int  + a_stab  + b_stab;
  d_bond      := ROUND(d_bond      * m_bond)::int  + a_bond  + b_bond;

  -- Apply to needs jsonb
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
  IF jsonb_array_length(v_triggered_synergies) > 0 THEN
    v_effects := v_effects || jsonb_build_object('synergies', v_triggered_synergies);
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