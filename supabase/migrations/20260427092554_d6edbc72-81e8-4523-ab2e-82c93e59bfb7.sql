-- Create child_interactions table for parenting loop
CREATE TABLE IF NOT EXISTS public.child_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES public.player_children(id) ON DELETE CASCADE,
  parent_profile_id UUID NOT NULL,
  interaction_type TEXT NOT NULL,
  effects JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_child_interactions_child ON public.child_interactions(child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_child_interactions_parent ON public.child_interactions(parent_profile_id, created_at DESC);

ALTER TABLE public.child_interactions ENABLE ROW LEVEL SECURITY;

-- Parents can view interactions for their own children
CREATE POLICY "Parents can view child interactions"
ON public.child_interactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.player_children pc
    WHERE pc.id = child_interactions.child_id
      AND (pc.parent_a_id = auth.uid() OR pc.parent_b_id = auth.uid() OR pc.controller_user_id = auth.uid())
  )
);

-- Parents can insert interactions for their own children, and must be the parent_profile_id
CREATE POLICY "Parents can log child interactions"
ON public.child_interactions
FOR INSERT
TO authenticated
WITH CHECK (
  parent_profile_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.player_children pc
    WHERE pc.id = child_interactions.child_id
      AND (pc.parent_a_id = auth.uid() OR pc.parent_b_id = auth.uid() OR pc.controller_user_id = auth.uid())
  )
);

-- Function: apply interaction effects to player_children atomically
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

-- Add last_interaction_at column to player_children if missing
ALTER TABLE public.player_children
  ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;

GRANT EXECUTE ON FUNCTION public.apply_child_interaction(UUID, TEXT, TEXT) TO authenticated;