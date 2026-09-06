BEGIN;

-- Older recruitment lifecycle installs exposed statuses that are incompatible
-- with the current pending/accepted/rejected/withdrawn application model.
DROP FUNCTION IF EXISTS public.update_band_application_stage(uuid, text);

CREATE OR REPLACE FUNCTION public.submit_band_vacancy_application(
  target_vacancy_id uuid,
  cover text DEFAULT '',
  answers jsonb DEFAULT '{}'::jsonb
)
RETURNS public.band_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid := public.current_profile_id();
  v_cover text := nullif(btrim(COALESCE(cover,'')), '');
  v_vacancy public.band_vacancies%ROWTYPE;
  v_band public.bands%ROWTYPE;
  v_existing public.band_applications%ROWTYPE;
  v_result public.band_applications%ROWTYPE;
  v_question jsonb;
  v_prompt text;
BEGIN
  IF v_user_id IS NULL OR v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Select an active player character before applying.' USING ERRCODE='42501';
  END IF;
  IF v_cover IS NOT NULL AND char_length(v_cover) > 500 THEN
    RAISE EXCEPTION 'Band application messages must be 500 characters or fewer.' USING ERRCODE='22023';
  END IF;
  IF answers IS NULL OR jsonb_typeof(answers) <> 'object' THEN
    RAISE EXCEPTION 'Vacancy answers must be an object.' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_vacancy
  FROM public.band_vacancies
  WHERE id=target_vacancy_id
  FOR UPDATE;

  IF v_vacancy.id IS NULL OR v_vacancy.status <> 'open' OR v_vacancy.visibility <> 'public'
     OR NOT v_vacancy.direct_applications_allowed THEN
    RAISE EXCEPTION 'This vacancy is not open for direct applications.' USING ERRCODE='22023';
  END IF;
  IF v_vacancy.application_deadline IS NOT NULL AND v_vacancy.application_deadline < now() THEN
    UPDATE public.band_vacancies SET status='expired', updated_at=now() WHERE id=v_vacancy.id;
    RAISE EXCEPTION 'The application deadline has passed.' USING ERRCODE='22023';
  END IF;
  IF v_vacancy.positions_filled >= v_vacancy.positions_available THEN
    RAISE EXCEPTION 'This vacancy has already been filled.' USING ERRCODE='23514';
  END IF;

  FOR v_question IN
    SELECT value FROM jsonb_array_elements(COALESCE(v_vacancy.application_questions,'[]'::jsonb))
  LOOP
    v_prompt := btrim(COALESCE(v_question->>'prompt',''));
    IF COALESCE((v_question->>'required')::boolean, true)
       AND v_prompt <> ''
       AND nullif(btrim(COALESCE(answers->>v_prompt,'')), '') IS NULL THEN
      RAISE EXCEPTION 'Answer all required application questions.' USING ERRCODE='22023';
    END IF;
  END LOOP;

  SELECT * INTO v_band FROM public.bands WHERE id=v_vacancy.band_id FOR UPDATE;
  IF v_band.id IS NULL OR v_band.status <> 'active'::public.band_status
     OR COALESCE(v_band.is_solo_artist,false)
     OR NOT COALESCE(v_band.is_recruiting,false)
     OR NOT COALESCE(v_band.allow_applications,true) THEN
    RAISE EXCEPTION 'This band is not accepting applications.' USING ERRCODE='22023';
  END IF;
  IF v_band.leader_id = v_profile_id THEN
    RAISE EXCEPTION 'You cannot apply to your own band.' USING ERRCODE='22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.band_members bm
    JOIN public.bands b ON b.id=bm.band_id
    WHERE bm.profile_id=v_profile_id
      AND b.status='active'::public.band_status
      AND COALESCE(bm.member_status,'active')='active'
      AND NOT COALESCE(bm.is_touring_member,false)
  ) THEN
    RAISE EXCEPTION 'Leave your current active band before applying to another one.' USING ERRCODE='23505';
  END IF;

  IF (
    SELECT count(*)
    FROM public.band_members bm
    WHERE bm.band_id=v_band.id
      AND COALESCE(bm.member_status,'active')='active'
      AND NOT COALESCE(bm.is_touring_member,false)
  ) >= COALESCE(v_band.max_members,4) THEN
    RAISE EXCEPTION 'This band has no open member slots.' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_existing
  FROM public.band_applications
  WHERE band_id=v_vacancy.band_id
    AND applicant_profile_id=v_profile_id
    AND status='pending'
  ORDER BY created_at DESC
  LIMIT 1;
  IF v_existing.id IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO public.band_applications (
    band_id, vacancy_id, applicant_profile_id, instrument_role, vocal_role,
    message, cover_message, question_answers, status
  ) VALUES (
    v_vacancy.band_id, v_vacancy.id, v_profile_id, v_vacancy.instrument, v_vacancy.vocal_role,
    v_cover, v_cover, answers, 'pending'
  ) RETURNING * INTO v_result;

  INSERT INTO public.notifications(user_id, profile_id, category, type, title, message, action_path, metadata)
  SELECT DISTINCT ON (manager.user_id)
    manager.user_id,
    manager.id,
    'band',
    'band_request',
    'New vacancy application',
    'A player applied for '||v_vacancy.title||' in '||v_band.name||'.',
    '/band/members',
    jsonb_build_object(
      'band_application_id',v_result.id,
      'band_vacancy_id',v_vacancy.id,
      'band_id',v_vacancy.band_id,
      'applicant_profile_id',v_profile_id,
      'actionable',true
    )
  FROM public.profiles manager
  WHERE manager.user_id IS NOT NULL AND (
    manager.id=v_band.leader_id OR EXISTS (
      SELECT 1
      FROM public.band_members bm
      WHERE bm.band_id=v_band.id
        AND bm.profile_id=manager.id
        AND COALESCE(bm.member_status,'active')='active'
        AND lower(COALESCE(bm.role,'')) IN ('leader','founder','co-leader','co_leader','manager','recruiter')
    )
  )
  ORDER BY manager.user_id, (manager.id=v_band.leader_id) DESC;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_band_vacancy_application(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_band_vacancy_application(uuid, text, jsonb) TO authenticated;

COMMIT;
