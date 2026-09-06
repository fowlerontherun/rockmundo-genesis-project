BEGIN;

ALTER TABLE public.band_vacancies
  ADD COLUMN IF NOT EXISTS application_questions jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.band_applications
  ADD COLUMN IF NOT EXISTS cover_message text,
  ADD COLUMN IF NOT EXISTS question_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.can_manage_band_recruitment(
  target_band_id uuid,
  actor_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.can_manage_band_invitations(target_band_id, actor_user_id);
$$;

REVOKE ALL ON FUNCTION public.can_manage_band_recruitment(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_band_recruitment(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_band_vacancy(
  target_band_id uuid,
  vacancy_payload jsonb,
  publish boolean DEFAULT false
)
RETURNS public.band_vacancies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_profile uuid := public.current_profile_id();
  v_row public.band_vacancies%ROWTYPE;
  v_questions jsonb := COALESCE(vacancy_payload->'application_questions', '[]'::jsonb);
  v_title text := btrim(COALESCE(vacancy_payload->>'title', ''));
  v_instrument text := btrim(COALESCE(vacancy_payload->>'instrument', ''));
BEGIN
  IF auth.uid() IS NULL OR v_actor_profile IS NULL THEN
    RAISE EXCEPTION 'Select an active player character before advertising a role.' USING ERRCODE='42501';
  END IF;
  IF NOT public.can_manage_band_recruitment(target_band_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are not allowed to manage recruitment for this band.' USING ERRCODE='42501';
  END IF;
  IF char_length(v_title) < 3 OR char_length(v_title) > 120 THEN
    RAISE EXCEPTION 'Advert title must be between 3 and 120 characters.' USING ERRCODE='22023';
  END IF;
  IF v_instrument = '' OR char_length(v_instrument) > 80 THEN
    RAISE EXCEPTION 'Choose a valid band role.' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(v_questions) <> 'array' OR jsonb_array_length(v_questions) > 8 THEN
    RAISE EXCEPTION 'Use 8 application questions or fewer.' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.band_vacancies (
    band_id, title, short_description, description, status, visibility, role_type,
    instrument, vocal_role, genres, commitment_level, positions_available,
    application_deadline, audition_required, remote_or_travel_allowed,
    direct_applications_allowed, application_questions, created_by_profile_id
  ) VALUES (
    target_band_id,
    v_title,
    nullif(left(btrim(COALESCE(vacancy_payload->>'short_description','')), 240), ''),
    left(btrim(COALESCE(vacancy_payload->>'description','')), 4000),
    CASE WHEN publish THEN 'open' ELSE 'draft' END,
    COALESCE(nullif(vacancy_payload->>'visibility',''), 'public'),
    'member',
    v_instrument,
    nullif(btrim(COALESCE(vacancy_payload->>'vocal_role','')), ''),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(vacancy_payload->'genres','[]'::jsonb))), '{}'::text[]),
    COALESCE(nullif(vacancy_payload->>'commitment_level',''), 'flexible'),
    greatest(1, least(20, COALESCE((vacancy_payload->>'positions_available')::int, 1))),
    nullif(vacancy_payload->>'application_deadline','')::timestamptz,
    COALESCE((vacancy_payload->>'audition_required')::boolean, false),
    COALESCE((vacancy_payload->>'remote_or_travel_allowed')::boolean, true),
    COALESCE((vacancy_payload->>'direct_applications_allowed')::boolean, true),
    v_questions,
    v_actor_profile
  ) RETURNING * INTO v_row;

  UPDATE public.bands
  SET is_recruiting = true, allow_applications = true
  WHERE id = target_band_id AND publish;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_band_vacancy(uuid, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_band_vacancy(uuid, jsonb, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_band_vacancy_status(target_vacancy_id uuid, next_status text)
RETURNS public.band_vacancies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.band_vacancies%ROWTYPE;
  v_status text := lower(btrim(COALESCE(next_status,'')));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in before managing recruitment.' USING ERRCODE='42501'; END IF;
  IF v_status NOT IN ('open','paused','closed','cancelled') THEN
    RAISE EXCEPTION 'Choose a valid advert status.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_row FROM public.band_vacancies WHERE id=target_vacancy_id FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'That band advert could not be found.' USING ERRCODE='22023'; END IF;
  IF NOT public.can_manage_band_recruitment(v_row.band_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are not allowed to manage recruitment for this band.' USING ERRCODE='42501';
  END IF;
  IF v_status='open' AND v_row.positions_filled >= v_row.positions_available THEN
    RAISE EXCEPTION 'This advert is already filled.' USING ERRCODE='23514';
  END IF;
  IF v_status='open' AND v_row.application_deadline IS NOT NULL AND v_row.application_deadline < now() THEN
    RAISE EXCEPTION 'Move the application deadline before reopening this advert.' USING ERRCODE='22023';
  END IF;
  UPDATE public.band_vacancies SET status=v_status, updated_at=now() WHERE id=v_row.id RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.update_band_vacancy_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_band_vacancy_status(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_band_vacancy(target_vacancy_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.band_vacancies%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in before managing recruitment.' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_row FROM public.band_vacancies WHERE id=target_vacancy_id FOR UPDATE;
  IF v_row.id IS NULL THEN RETURN true; END IF;
  IF NOT public.can_manage_band_recruitment(v_row.band_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are not allowed to manage recruitment for this band.' USING ERRCODE='42501';
  END IF;
  IF v_row.status NOT IN ('draft','closed','cancelled') THEN
    RAISE EXCEPTION 'Pause or close this advert before deleting it.' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.band_applications WHERE vacancy_id=v_row.id) THEN
    RAISE EXCEPTION 'This advert has application history. Keep it closed so that history is preserved.' USING ERRCODE='23514';
  END IF;
  DELETE FROM public.band_vacancies WHERE id=v_row.id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_band_vacancy(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_band_vacancy(uuid) TO authenticated;

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

  SELECT * INTO v_vacancy FROM public.band_vacancies WHERE id=target_vacancy_id FOR UPDATE;
  IF v_vacancy.id IS NULL OR v_vacancy.status <> 'open' OR v_vacancy.visibility <> 'public' OR NOT v_vacancy.direct_applications_allowed THEN
    RAISE EXCEPTION 'This vacancy is not open for direct applications.' USING ERRCODE='22023';
  END IF;
  IF v_vacancy.application_deadline IS NOT NULL AND v_vacancy.application_deadline < now() THEN
    UPDATE public.band_vacancies SET status='expired', updated_at=now() WHERE id=v_vacancy.id;
    RAISE EXCEPTION 'The application deadline has passed.' USING ERRCODE='22023';
  END IF;
  IF v_vacancy.positions_filled >= v_vacancy.positions_available THEN
    RAISE EXCEPTION 'This vacancy has already been filled.' USING ERRCODE='23514';
  END IF;

  FOR v_question IN SELECT value FROM jsonb_array_elements(COALESCE(v_vacancy.application_questions,'[]'::jsonb)) LOOP
    v_prompt := btrim(COALESCE(v_question->>'prompt',''));
    IF COALESCE((v_question->>'required')::boolean, true) AND v_prompt <> ''
       AND nullif(btrim(COALESCE(answers->>v_prompt,'')), '') IS NULL THEN
      RAISE EXCEPTION 'Answer all required application questions.' USING ERRCODE='22023';
    END IF;
  END LOOP;

  SELECT * INTO v_band FROM public.bands WHERE id=v_vacancy.band_id FOR UPDATE;
  IF v_band.id IS NULL OR v_band.status <> 'active'::public.band_status OR COALESCE(v_band.is_solo_artist,false) THEN
    RAISE EXCEPTION 'This band is not accepting applications.' USING ERRCODE='22023';
  END IF;
  IF v_band.leader_id = v_profile_id THEN RAISE EXCEPTION 'You cannot apply to your own band.' USING ERRCODE='22023'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.band_members bm JOIN public.bands b ON b.id=bm.band_id
    WHERE bm.profile_id=v_profile_id AND b.status='active'::public.band_status
      AND COALESCE(bm.member_status,'active')='active' AND NOT COALESCE(bm.is_touring_member,false)
  ) THEN RAISE EXCEPTION 'Leave your current active band before applying to another one.' USING ERRCODE='23505'; END IF;

  SELECT * INTO v_existing FROM public.band_applications
  WHERE band_id=v_vacancy.band_id AND applicant_profile_id=v_profile_id AND status='pending'
  ORDER BY created_at DESC LIMIT 1;
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
    manager.user_id, manager.id, 'band', 'band_request', 'New vacancy application',
    'A player applied for '||v_vacancy.title||' in '||v_band.name||'.',
    '/band/members',
    jsonb_build_object('band_application_id',v_result.id,'band_vacancy_id',v_vacancy.id,'band_id',v_vacancy.band_id,'applicant_profile_id',v_profile_id,'actionable',true)
  FROM public.profiles manager
  WHERE manager.user_id IS NOT NULL AND (
    manager.id=v_band.leader_id OR EXISTS (
      SELECT 1 FROM public.band_members bm WHERE bm.band_id=v_band.id AND bm.profile_id=manager.id
      AND COALESCE(bm.member_status,'active')='active'
      AND lower(COALESCE(bm.role,'')) IN ('leader','founder','co-leader','co_leader','manager','recruiter')
    )
  ) ORDER BY manager.user_id, (manager.id=v_band.leader_id) DESC;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_band_vacancy_application(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_band_vacancy_application(uuid, text, jsonb) TO authenticated;

DROP POLICY IF EXISTS "Open vacancies are viewable" ON public.band_vacancies;
DROP POLICY IF EXISTS "Recruitment vacancies are viewable" ON public.band_vacancies;
CREATE POLICY "Recruitment vacancies are viewable" ON public.band_vacancies
FOR SELECT TO authenticated
USING ((status='open' AND visibility='public') OR public.can_manage_band_recruitment(band_id, auth.uid()));

DROP POLICY IF EXISTS "Band leaders can create vacancies" ON public.band_vacancies;
DROP POLICY IF EXISTS "Band leaders can update vacancies" ON public.band_vacancies;
DROP POLICY IF EXISTS "Band leaders can delete vacancies" ON public.band_vacancies;

COMMIT;
