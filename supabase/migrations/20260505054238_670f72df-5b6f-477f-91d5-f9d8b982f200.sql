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

  base_food INT := 0;
  base_sleep INT := 0;
  base_affection INT := 0;
  base_learning INT := 0;
  base_mood INT := 0;
  base_stability INT := 0;
  base_bond INT := 0;

  d_food INT := 0;
  d_sleep INT := 0;
  d_affection INT := 0;
  d_learning INT := 0;
  d_mood INT := 0;
  d_stability INT := 0;
  d_bond INT := 0;

  t_food INT := 0;
  t_sleep INT := 0;
  t_affection INT := 0;
  t_learning INT := 0;
  t_mood INT := 0;
  t_stability INT := 0;
  t_bond INT := 0;

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

  v_traits_text TEXT[] := ARRAY[]::TEXT[];
  v_syn RECORD;
  v_triggered_synergies JSONB := '[]'::jsonb;
  v_syn_bonus JSONB;
  b_food INT := 0; b_sleep INT := 0; b_aff INT := 0; b_learn INT := 0;
  b_mood INT := 0; b_stab INT := 0; b_bond INT := 0;

  v_effects JSONB := '{}'::jsonb;
  v_base JSONB := '{}'::jsonb;
  v_final JSONB := '{}'::jsonb;
  v_trait_delta JSONB := '{}'::jsonb;
  v_synergy_delta JSONB := '{}'::jsonb;
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
    WHEN 'feed' THEN base_food := 25; base_mood := 5;
    WHEN 'sleep' THEN base_sleep := 30; base_mood := 3;
    WHEN 'play' THEN base_affection := 20; base_mood := 10; base_bond := 5;
    WHEN 'teach_skill' THEN base_learning := 15; base_stability := 2;
    WHEN 'outing' THEN base_affection := 10; base_mood := 15; base_stability := 3; base_bond := 8;
    WHEN 'comfort' THEN base_mood := 8; base_stability := 5;
    WHEN 'homework' THEN base_learning := 25; base_mood := -3; base_stability := 2; base_bond := 4;
    WHEN 'talk' THEN base_stability := 10; base_mood := 6; base_bond := 10;
    WHEN 'allowance' THEN base_mood := 12; base_bond := 6;
    WHEN 'hobby' THEN base_affection := 12; base_learning := 12; base_mood := 8;
    WHEN 'discipline' THEN base_stability := 6; base_mood := -8; base_bond := -4;
    ELSE
      RAISE EXCEPTION 'Unknown interaction type: %', p_interaction_type;
  END CASE;

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

  t_food      := ROUND(base_food      * m_food)::int;
  t_sleep     := ROUND(base_sleep     * m_sleep)::int;
  t_affection := ROUND(base_affection * m_aff)::int   + a_aff;
  t_learning  := ROUND(base_learning  * m_learn)::int + a_learn;
  t_mood      := ROUND(base_mood      * m_mood)::int  + a_mood;
  t_stability := ROUND(base_stability * m_stab)::int  + a_stab;
  t_bond      := ROUND(base_bond      * m_bond)::int  + a_bond;

  d_food      := t_food      + b_food;
  d_sleep     := t_sleep     + b_sleep;
  d_affection := t_affection + b_aff;
  d_learning  := t_learning  + b_learn;
  d_mood      := t_mood      + b_mood;
  d_stability := t_stability + b_stab;
  d_bond      := t_bond      + b_bond;

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

  IF base_food      <> 0 THEN v_base := v_base || jsonb_build_object('food',      base_food);      END IF;
  IF base_sleep     <> 0 THEN v_base := v_base || jsonb_build_object('sleep',     base_sleep);     END IF;
  IF base_affection <> 0 THEN v_base := v_base || jsonb_build_object('affection', base_affection); END IF;
  IF base_learning  <> 0 THEN v_base := v_base || jsonb_build_object('learning',  base_learning);  END IF;
  IF base_mood      <> 0 THEN v_base := v_base || jsonb_build_object('mood',      base_mood);      END IF;
  IF base_stability <> 0 THEN v_base := v_base || jsonb_build_object('stability', base_stability); END IF;
  IF base_bond      <> 0 THEN v_base := v_base || jsonb_build_object('bond',      base_bond);      END IF;

  IF d_food      <> 0 THEN v_final := v_final || jsonb_build_object('food',      d_food);      END IF;
  IF d_sleep     <> 0 THEN v_final := v_final || jsonb_build_object('sleep',     d_sleep);     END IF;
  IF d_affection <> 0 THEN v_final := v_final || jsonb_build_object('affection', d_affection); END IF;
  IF d_learning  <> 0 THEN v_final := v_final || jsonb_build_object('learning',  d_learning);  END IF;
  IF d_mood      <> 0 THEN v_final := v_final || jsonb_build_object('mood',      d_mood);      END IF;
  IF d_stability <> 0 THEN v_final := v_final || jsonb_build_object('stability', d_stability); END IF;
  IF d_bond      <> 0 THEN v_final := v_final || jsonb_build_object('bond',      d_bond);      END IF;

  IF (t_food      - base_food)      <> 0 THEN v_trait_delta := v_trait_delta || jsonb_build_object('food',      t_food      - base_food);      END IF;
  IF (t_sleep     - base_sleep)     <> 0 THEN v_trait_delta := v_trait_delta || jsonb_build_object('sleep',     t_sleep     - base_sleep);     END IF;
  IF (t_affection - base_affection) <> 0 THEN v_trait_delta := v_trait_delta || jsonb_build_object('affection', t_affection - base_affection); END IF;
  IF (t_learning  - base_learning)  <> 0 THEN v_trait_delta := v_trait_delta || jsonb_build_object('learning',  t_learning  - base_learning);  END IF;
  IF (t_mood      - base_mood)      <> 0 THEN v_trait_delta := v_trait_delta || jsonb_build_object('mood',      t_mood      - base_mood);      END IF;
  IF (t_stability - base_stability) <> 0 THEN v_trait_delta := v_trait_delta || jsonb_build_object('stability', t_stability - base_stability); END IF;
  IF (t_bond      - base_bond)      <> 0 THEN v_trait_delta := v_trait_delta || jsonb_build_object('bond',      t_bond      - base_bond);      END IF;

  IF b_food  <> 0 THEN v_synergy_delta := v_synergy_delta || jsonb_build_object('food',      b_food);  END IF;
  IF b_sleep <> 0 THEN v_synergy_delta := v_synergy_delta || jsonb_build_object('sleep',     b_sleep); END IF;
  IF b_aff   <> 0 THEN v_synergy_delta := v_synergy_delta || jsonb_build_object('affection', b_aff);   END IF;
  IF b_learn <> 0 THEN v_synergy_delta := v_synergy_delta || jsonb_build_object('learning',  b_learn); END IF;
  IF b_mood  <> 0 THEN v_synergy_delta := v_synergy_delta || jsonb_build_object('mood',      b_mood);  END IF;
  IF b_stab  <> 0 THEN v_synergy_delta := v_synergy_delta || jsonb_build_object('stability', b_stab);  END IF;
  IF b_bond  <> 0 THEN v_synergy_delta := v_synergy_delta || jsonb_build_object('bond',      b_bond);  END IF;

  IF d_food      <> 0 THEN v_effects := v_effects || jsonb_build_object('food',      d_food);      END IF;
  IF d_sleep     <> 0 THEN v_effects := v_effects || jsonb_build_object('sleep',     d_sleep);     END IF;
  IF d_affection <> 0 THEN v_effects := v_effects || jsonb_build_object('affection', d_affection); END IF;
  IF d_learning  <> 0 THEN v_effects := v_effects || jsonb_build_object('learning',  d_learning);  END IF;
  IF d_mood      <> 0 THEN v_effects := v_effects || jsonb_build_object('mood',      d_mood);      END IF;
  IF d_stability <> 0 THEN v_effects := v_effects || jsonb_build_object('stability', d_stability); END IF;
  IF d_bond      <> 0 THEN v_effects := v_effects || jsonb_build_object('bond',      d_bond);      END IF;

  v_effects := v_effects || jsonb_build_object(
    'base', v_base,
    'final', v_final,
    'trait_delta', v_trait_delta,
    'synergy_delta', v_synergy_delta
  );

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