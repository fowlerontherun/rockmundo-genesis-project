-- Parent-teacher day events for school-aged children
CREATE TABLE IF NOT EXISTS public.child_school_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES public.player_children(id) ON DELETE CASCADE,
  parent_profile_id UUID NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'parent_teacher_day',
  teacher_name TEXT,
  subject TEXT,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  behavior_rating SMALLINT CHECK (behavior_rating BETWEEN 1 AND 5),
  academic_rating SMALLINT CHECK (academic_rating BETWEEN 1 AND 5),
  notes TEXT,
  effects JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_child_school_events_child ON public.child_school_events(child_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_child_school_events_parent ON public.child_school_events(parent_profile_id, occurred_at DESC);

ALTER TABLE public.child_school_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view child school events"
ON public.child_school_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.player_children pc
    WHERE pc.id = child_school_events.child_id
      AND (pc.parent_a_id = auth.uid() OR pc.parent_b_id = auth.uid() OR pc.controller_user_id = auth.uid())
  )
);

CREATE POLICY "Parents can log child school events"
ON public.child_school_events
FOR INSERT
TO authenticated
WITH CHECK (
  parent_profile_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.player_children pc
    WHERE pc.id = child_school_events.child_id
      AND (pc.parent_a_id = auth.uid() OR pc.parent_b_id = auth.uid() OR pc.controller_user_id = auth.uid())
  )
);

CREATE POLICY "Parents can update child school events"
ON public.child_school_events
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.player_children pc
    WHERE pc.id = child_school_events.child_id
      AND (pc.parent_a_id = auth.uid() OR pc.parent_b_id = auth.uid() OR pc.controller_user_id = auth.uid())
  )
);

-- RPC: log a parent-teacher day, apply small stat effects scaled by rating
CREATE OR REPLACE FUNCTION public.log_child_school_event(
  p_child_id UUID,
  p_event_type TEXT DEFAULT 'parent_teacher_day',
  p_teacher_name TEXT DEFAULT NULL,
  p_subject TEXT DEFAULT NULL,
  p_rating SMALLINT DEFAULT 3,
  p_behavior_rating SMALLINT DEFAULT NULL,
  p_academic_rating SMALLINT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.child_school_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child public.player_children%ROWTYPE;
  v_parent UUID := auth.uid();
  v_age INT;
  v_effects JSONB := '{}'::jsonb;
  v_needs JSONB;
  v_mood INT;
  v_stability INT;
  v_bond_a INT;
  v_bond_b INT;
  v_learning INT;
  v_delta_mood INT := 0;
  v_delta_stab INT := 0;
  v_delta_bond INT := 0;
  v_delta_learn INT := 0;
  v_row public.child_school_events%ROWTYPE;
BEGIN
  IF v_parent IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be 1-5';
  END IF;

  SELECT * INTO v_child FROM public.player_children WHERE id = p_child_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Child not found'; END IF;

  IF v_child.parent_a_id <> v_parent AND v_child.parent_b_id <> v_parent
     AND COALESCE(v_child.controller_user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> v_parent THEN
    RAISE EXCEPTION 'Not a parent of this child';
  END IF;

  v_age := COALESCE(v_child.current_age, 0);
  IF v_age < 4 THEN
    RAISE EXCEPTION 'Child too young for school events (requires age 4+)';
  END IF;

  v_needs := COALESCE(v_child.needs, '{"food":70,"sleep":70,"affection":70,"learning":50}'::jsonb);
  v_mood := COALESCE(v_child.mood, 70);
  v_stability := COALESCE(v_child.emotional_stability, 70);
  v_bond_a := COALESCE(v_child.bond_parent_a, 50);
  v_bond_b := COALESCE(v_child.bond_parent_b, 50);
  v_learning := COALESCE((v_needs->>'learning')::int, 50);

  -- Rating drives mood/stability/bond. 3 is neutral.
  v_delta_mood := (p_rating - 3) * 4;        -- -8..+8
  v_delta_stab := (p_rating - 3) * 3;        -- -6..+6
  v_delta_bond := (p_rating - 3) * 2;        -- -4..+4
  v_delta_learn := COALESCE(p_academic_rating, p_rating) * 2;  -- 2..10

  v_mood := GREATEST(0, LEAST(100, v_mood + v_delta_mood));
  v_stability := GREATEST(0, LEAST(100, v_stability + v_delta_stab));
  v_learning := GREATEST(0, LEAST(100, v_learning + v_delta_learn));
  IF v_child.parent_a_id = v_parent THEN
    v_bond_a := GREATEST(0, LEAST(100, v_bond_a + v_delta_bond));
  ELSE
    v_bond_b := GREATEST(0, LEAST(100, v_bond_b + v_delta_bond));
  END IF;
  v_needs := jsonb_set(v_needs, '{learning}', to_jsonb(v_learning));

  v_effects := jsonb_build_object(
    'mood', v_delta_mood,
    'stability', v_delta_stab,
    'bond', v_delta_bond,
    'learning', v_delta_learn,
    'rating', p_rating
  );

  UPDATE public.player_children
  SET needs = v_needs,
      mood = v_mood,
      emotional_stability = v_stability,
      bond_parent_a = v_bond_a,
      bond_parent_b = v_bond_b,
      last_interaction_at = now(),
      updated_at = now()
  WHERE id = p_child_id;

  INSERT INTO public.child_school_events (
    child_id, parent_profile_id, event_type, teacher_name, subject,
    rating, behavior_rating, academic_rating, notes, effects
  )
  VALUES (
    p_child_id, v_parent, COALESCE(p_event_type, 'parent_teacher_day'), p_teacher_name, p_subject,
    p_rating, p_behavior_rating, p_academic_rating, p_notes, v_effects
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_child_school_event(UUID, TEXT, TEXT, TEXT, SMALLINT, SMALLINT, SMALLINT, TEXT) TO authenticated;