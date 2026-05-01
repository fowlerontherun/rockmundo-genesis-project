-- Auto-generated school milestones (stage starts, term report cards, graduation)
-- Adds a milestone_key for idempotent insertion, plus an RPC that backfills any
-- missing milestones for a child based on their current age.

ALTER TABLE public.child_school_events
  ADD COLUMN IF NOT EXISTS milestone_key TEXT;

-- Allow auto milestones to skip the 1-5 rating check by relaxing constraint.
ALTER TABLE public.child_school_events
  DROP CONSTRAINT IF EXISTS child_school_events_rating_check;
ALTER TABLE public.child_school_events
  ADD CONSTRAINT child_school_events_rating_check
  CHECK (rating BETWEEN 0 AND 5);

CREATE UNIQUE INDEX IF NOT EXISTS uq_child_school_events_milestone
  ON public.child_school_events(child_id, milestone_key)
  WHERE milestone_key IS NOT NULL;

-- Helper: stage label for a given age (mirrors SCHOOL_STAGES on the client)
CREATE OR REPLACE FUNCTION public.child_stage_for_age(p_age INT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_age <= 1 THEN 'infant'
    WHEN p_age <= 3 THEN 'toddler'
    WHEN p_age <= 5 THEN 'preschool'
    WHEN p_age <= 10 THEN 'primary'
    WHEN p_age <= 13 THEN 'middle'
    WHEN p_age <= 17 THEN 'high'
    ELSE 'graduated'
  END;
$$;

-- Backfill / generate milestones up to the child's current age. Idempotent.
CREATE OR REPLACE FUNCTION public.generate_child_school_milestones(p_child_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child public.player_children%ROWTYPE;
  v_caller UUID := auth.uid();
  v_age INT;
  v_inserted INT := 0;
  v_age_iter INT;
  v_stage TEXT;
  v_prev_stage TEXT := NULL;
  v_key TEXT;
  v_event_type TEXT;
  v_subject TEXT;
  v_notes TEXT;
  v_rating SMALLINT;
  v_parent_for_log UUID;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_child FROM public.player_children WHERE id = p_child_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Child not found'; END IF;

  IF v_child.parent_a_id <> v_caller AND COALESCE(v_child.parent_b_id, '00000000-0000-0000-0000-000000000000'::uuid) <> v_caller
     AND COALESCE(v_child.controller_user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> v_caller THEN
    RAISE EXCEPTION 'Not a parent of this child';
  END IF;

  v_age := COALESCE(v_child.current_age, 0);
  v_parent_for_log := COALESCE(v_child.parent_a_id, v_caller);

  -- Walk every age from 0..current_age and emit any missing milestones.
  FOR v_age_iter IN 0..v_age LOOP
    v_stage := public.child_stage_for_age(v_age_iter);

    -- Stage transition (only when stage actually changes from previous age)
    IF v_prev_stage IS NULL OR v_prev_stage <> v_stage THEN
      v_key := 'stage_started:' || v_stage || ':' || v_age_iter;
      v_event_type := 'stage_started';
      v_notes := CASE v_stage
        WHEN 'infant' THEN 'Welcomed home — the infant years begin.'
        WHEN 'toddler' THEN 'Toddler years: walking, talking, exploring.'
        WHEN 'preschool' THEN 'Started preschool — early lessons and social play.'
        WHEN 'primary' THEN 'First day of primary school! Backpack, pencils, big smiles.'
        WHEN 'middle' THEN 'Started middle school — friendships shift, talents emerge.'
        WHEN 'high' THEN 'Started high school — bigger choices ahead.'
        WHEN 'graduated' THEN 'Officially an adult.'
        ELSE 'New chapter begins.'
      END;
      v_rating := 0;
      v_subject := initcap(replace(v_stage, '_', ' '));

      INSERT INTO public.child_school_events
        (child_id, parent_profile_id, event_type, subject, rating, notes, milestone_key, effects, occurred_at)
      VALUES
        (p_child_id, v_parent_for_log, v_event_type, v_subject, v_rating, v_notes, v_key,
         jsonb_build_object('auto', true, 'stage', v_stage, 'age', v_age_iter), now())
      ON CONFLICT (child_id, milestone_key) WHERE milestone_key IS NOT NULL DO NOTHING;
      GET DIAGNOSTICS v_inserted = ROW_COUNT;
    END IF;

    -- Term report card: once per school year for school-aged children (4..17)
    IF v_age_iter BETWEEN 4 AND 17 THEN
      v_key := 'report_card:' || v_age_iter;
      v_event_type := 'report_card';
      -- Pseudo-random but stable rating per child+age
      v_rating := 2 + ((abs(hashtext(p_child_id::text || ':' || v_age_iter::text)) % 4))::smallint;  -- 2..5
      v_subject := 'Annual Report';
      v_notes := CASE
        WHEN v_rating >= 5 THEN 'Outstanding year — top of the class.'
        WHEN v_rating = 4 THEN 'Strong progress across most subjects.'
        WHEN v_rating = 3 THEN 'Steady year, a few areas to work on.'
        ELSE 'Struggled in some classes — could use extra support.'
      END;

      INSERT INTO public.child_school_events
        (child_id, parent_profile_id, event_type, subject, rating, academic_rating, behavior_rating, notes, milestone_key, effects, occurred_at)
      VALUES
        (p_child_id, v_parent_for_log, v_event_type, v_subject, v_rating, v_rating, v_rating, v_notes, v_key,
         jsonb_build_object('auto', true, 'age', v_age_iter), now())
      ON CONFLICT (child_id, milestone_key) WHERE milestone_key IS NOT NULL DO NOTHING;
    END IF;

    -- Graduation milestone at 18
    IF v_age_iter = 18 THEN
      v_key := 'graduation:high_school';
      INSERT INTO public.child_school_events
        (child_id, parent_profile_id, event_type, subject, rating, notes, milestone_key, effects, occurred_at)
      VALUES
        (p_child_id, v_parent_for_log, 'graduation', 'High School', 5,
         'High school graduation — caps in the air!', v_key,
         jsonb_build_object('auto', true, 'age', 18), now())
      ON CONFLICT (child_id, milestone_key) WHERE milestone_key IS NOT NULL DO NOTHING;
    END IF;

    v_prev_stage := v_stage;
  END LOOP;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_child_school_milestones(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.child_stage_for_age(INT) TO authenticated;