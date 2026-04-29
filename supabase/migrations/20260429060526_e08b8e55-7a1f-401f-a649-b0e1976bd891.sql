-- Extend apply_child_interaction with stage-gated interaction types.
-- New types: homework, talk, allowance, hobby, discipline.
-- Each enforces a min_age (server-side) so the UI gating cannot be bypassed.

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
  v_effects JSONB := '{}'::jsonb;
  v_needs JSONB;
  v_mood INT;
  v_bond_a INT;
  v_bond_b INT;
  v_stability INT;
  v_age INT;
  v_min_age INT := 0;
  v_row public.child_interactions%ROWTYPE;
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

  -- Determine minimum age requirement per interaction
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
    WHEN 'feed' THEN
      v_needs := jsonb_set(v_needs, '{food}', to_jsonb(LEAST(100, COALESCE((v_needs->>'food')::int,70) + 25)));
      v_mood := LEAST(100, v_mood + 5);
      v_effects := jsonb_build_object('food', '+25', 'mood', '+5');
    WHEN 'sleep' THEN
      v_needs := jsonb_set(v_needs, '{sleep}', to_jsonb(LEAST(100, COALESCE((v_needs->>'sleep')::int,70) + 30)));
      v_mood := LEAST(100, v_mood + 3);
      v_effects := jsonb_build_object('sleep', '+30', 'mood', '+3');
    WHEN 'play' THEN
      v_needs := jsonb_set(v_needs, '{affection}', to_jsonb(LEAST(100, COALESCE((v_needs->>'affection')::int,70) + 20)));
      v_mood := LEAST(100, v_mood + 10);
      IF v_child.parent_a_id = v_parent THEN
        v_bond_a := LEAST(100, v_bond_a + 5);
      ELSE
        v_bond_b := LEAST(100, v_bond_b + 5);
      END IF;
      v_effects := jsonb_build_object('affection', '+20', 'mood', '+10', 'bond', '+5');
    WHEN 'teach_skill' THEN
      v_needs := jsonb_set(v_needs, '{learning}', to_jsonb(LEAST(100, COALESCE((v_needs->>'learning')::int,50) + 15)));
      v_stability := LEAST(100, v_stability + 2);
      v_effects := jsonb_build_object('learning', '+15', 'stability', '+2');
    WHEN 'outing' THEN
      v_needs := jsonb_set(v_needs, '{affection}', to_jsonb(LEAST(100, COALESCE((v_needs->>'affection')::int,70) + 10)));
      v_mood := LEAST(100, v_mood + 15);
      v_stability := LEAST(100, v_stability + 3);
      IF v_child.parent_a_id = v_parent THEN
        v_bond_a := LEAST(100, v_bond_a + 8);
      ELSE
        v_bond_b := LEAST(100, v_bond_b + 8);
      END IF;
      v_effects := jsonb_build_object('mood', '+15', 'stability', '+3', 'bond', '+8');
    WHEN 'comfort' THEN
      v_mood := LEAST(100, v_mood + 8);
      v_stability := LEAST(100, v_stability + 5);
      v_effects := jsonb_build_object('mood', '+8', 'stability', '+5');

    -- NEW: Primary+ — homework boosts learning hard, small mood dip, +bond
    WHEN 'homework' THEN
      v_needs := jsonb_set(v_needs, '{learning}', to_jsonb(LEAST(100, COALESCE((v_needs->>'learning')::int,50) + 25)));
      v_mood := GREATEST(0, v_mood - 3);
      v_stability := LEAST(100, v_stability + 2);
      IF v_child.parent_a_id = v_parent THEN
        v_bond_a := LEAST(100, v_bond_a + 4);
      ELSE
        v_bond_b := LEAST(100, v_bond_b + 4);
      END IF;
      v_effects := jsonb_build_object('learning', '+25', 'mood', '-3', 'stability', '+2', 'bond', '+4');

    -- NEW: Middle+ — heart-to-heart boosts stability and bond strongly
    WHEN 'talk' THEN
      v_stability := LEAST(100, v_stability + 10);
      v_mood := LEAST(100, v_mood + 6);
      IF v_child.parent_a_id = v_parent THEN
        v_bond_a := LEAST(100, v_bond_a + 10);
      ELSE
        v_bond_b := LEAST(100, v_bond_b + 10);
      END IF;
      v_effects := jsonb_build_object('stability', '+10', 'mood', '+6', 'bond', '+10');

    -- NEW: Middle+ — allowance: +mood, +bond (handled as pure stat for now; cash hook can be added later)
    WHEN 'allowance' THEN
      v_mood := LEAST(100, v_mood + 12);
      IF v_child.parent_a_id = v_parent THEN
        v_bond_a := LEAST(100, v_bond_a + 6);
      ELSE
        v_bond_b := LEAST(100, v_bond_b + 6);
      END IF;
      v_effects := jsonb_build_object('mood', '+12', 'bond', '+6');

    -- NEW: Primary+ — hobby session: +affection, +learning, +mood
    WHEN 'hobby' THEN
      v_needs := jsonb_set(v_needs, '{affection}', to_jsonb(LEAST(100, COALESCE((v_needs->>'affection')::int,70) + 12)));
      v_needs := jsonb_set(v_needs, '{learning}', to_jsonb(LEAST(100, COALESCE((v_needs->>'learning')::int,50) + 12)));
      v_mood := LEAST(100, v_mood + 8);
      v_effects := jsonb_build_object('affection', '+12', 'learning', '+12', 'mood', '+8');

    -- NEW: Preschool+ — discipline: +stability, -mood, -bond (risk/reward)
    WHEN 'discipline' THEN
      v_stability := LEAST(100, v_stability + 6);
      v_mood := GREATEST(0, v_mood - 8);
      IF v_child.parent_a_id = v_parent THEN
        v_bond_a := GREATEST(0, v_bond_a - 4);
      ELSE
        v_bond_b := GREATEST(0, v_bond_b - 4);
      END IF;
      v_effects := jsonb_build_object('stability', '+6', 'mood', '-8', 'bond', '-4');

    ELSE
      RAISE EXCEPTION 'Unknown interaction type: %', p_interaction_type;
  END CASE;

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