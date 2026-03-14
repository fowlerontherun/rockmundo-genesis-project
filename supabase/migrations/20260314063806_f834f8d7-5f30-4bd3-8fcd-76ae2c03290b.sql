
-- =============================================
-- Marriage & Children System — Phase 1
-- =============================================

-- 1. Marriages table
CREATE TABLE public.marriages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_a_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_b_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'active', 'separated', 'divorced')),
  proposed_at timestamptz DEFAULT now(),
  wedding_date timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  ended_by uuid REFERENCES public.profiles(id),
  end_reason text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one active/proposed/accepted marriage per profile
CREATE UNIQUE INDEX idx_marriages_active_partner_a ON public.marriages (partner_a_id)
  WHERE status IN ('proposed', 'accepted', 'active');
CREATE UNIQUE INDEX idx_marriages_active_partner_b ON public.marriages (partner_b_id)
  WHERE status IN ('proposed', 'accepted', 'active');

ALTER TABLE public.marriages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own marriages"
  ON public.marriages FOR SELECT TO authenticated
  USING (
    partner_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR partner_b_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can insert marriages as partner_a"
  ON public.marriages FOR INSERT TO authenticated
  WITH CHECK (
    partner_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Participants can update own marriages"
  ON public.marriages FOR UPDATE TO authenticated
  USING (
    partner_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR partner_b_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- 2. Child requests table
CREATE TABLE public.child_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_a_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_b_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  marriage_id uuid NOT NULL REFERENCES public.marriages(id) ON DELETE CASCADE,
  controller_parent_id uuid REFERENCES public.profiles(id),
  surname_policy text DEFAULT 'parent_a' CHECK (surname_policy IN ('parent_a', 'parent_b', 'hyphenated', 'custom')),
  custom_surname text,
  upbringing_focus text DEFAULT 'balanced' CHECK (upbringing_focus IN ('balanced', 'artistic', 'academic', 'athletic', 'social')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'completed')),
  expires_at timestamptz,
  gestation_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.child_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own child requests"
  ON public.child_requests FOR SELECT TO authenticated
  USING (
    parent_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR parent_b_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can insert child requests as parent_a"
  ON public.child_requests FOR INSERT TO authenticated
  WITH CHECK (
    parent_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Partner can update child requests"
  ON public.child_requests FOR UPDATE TO authenticated
  USING (
    parent_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR parent_b_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- 3. Player children table
CREATE TABLE public.player_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_a_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_b_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  controller_user_id uuid REFERENCES auth.users(id),
  child_profile_id uuid REFERENCES public.profiles(id),
  child_request_id uuid REFERENCES public.child_requests(id),
  marriage_id uuid REFERENCES public.marriages(id),
  name text NOT NULL,
  surname text NOT NULL,
  birth_game_date jsonb DEFAULT '{}',
  current_age int DEFAULT 0,
  playability_state text DEFAULT 'npc' CHECK (playability_state IN ('npc', 'guided', 'playable')),
  inherited_potentials jsonb DEFAULT '{}',
  traits jsonb DEFAULT '[]',
  emotional_stability int DEFAULT 50,
  bond_parent_a int DEFAULT 50,
  bond_parent_b int DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.player_children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own children"
  ON public.player_children FOR SELECT TO authenticated
  USING (
    parent_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR parent_b_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR controller_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can insert children"
  ON public.player_children FOR INSERT TO authenticated
  WITH CHECK (
    parent_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR parent_b_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Parents can update children"
  ON public.player_children FOR UPDATE TO authenticated
  USING (
    parent_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR parent_b_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR controller_user_id = auth.uid()
  );

-- Triggers for updated_at
CREATE TRIGGER update_marriages_updated_at BEFORE UPDATE ON public.marriages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_child_requests_updated_at BEFORE UPDATE ON public.child_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_player_children_updated_at BEFORE UPDATE ON public.player_children
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function to check marriage eligibility
CREATE OR REPLACE FUNCTION public.check_marriage_eligibility(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_active_marriage boolean;
  v_age int;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.marriages
    WHERE (partner_a_id = p_profile_id OR partner_b_id = p_profile_id)
      AND status IN ('proposed', 'accepted', 'active')
  ) INTO v_has_active_marriage;

  SELECT COALESCE(age, 18) INTO v_age FROM public.profiles WHERE id = p_profile_id;

  RETURN jsonb_build_object(
    'eligible', NOT v_has_active_marriage AND v_age >= 18,
    'has_active_marriage', v_has_active_marriage,
    'age', v_age,
    'reason', CASE
      WHEN v_has_active_marriage THEN 'Already in a marriage'
      WHEN v_age < 18 THEN 'Must be at least 18'
      ELSE NULL
    END
  );
END;
$$;
