BEGIN;
-- Reconcile independent vacancy applications while maintaining general-band
-- pending uniqueness and preserving legacy accepted/rejected history.
DROP INDEX IF EXISTS public.band_applications_one_pending_per_band_idx;
CREATE UNIQUE INDEX band_applications_general_pending_one_per_band
ON public.band_applications(band_id,applicant_profile_id)
WHERE vacancy_id IS NULL AND status='pending';
CREATE UNIQUE INDEX IF NOT EXISTS band_applications_one_pending_per_vacancy
ON public.band_applications(vacancy_id,applicant_profile_id)
WHERE vacancy_id IS NOT NULL AND status='pending';

CREATE OR REPLACE FUNCTION public.guard_band_vacancy_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_capacity integer;v_members integer;v_reserved integer;
BEGIN
 IF NEW.status<>'open' THEN RETURN NEW;END IF;
 IF NEW.application_deadline IS NOT NULL AND NEW.application_deadline<=now() THEN
   RAISE EXCEPTION 'Move the application deadline before publishing this advert.' USING ERRCODE='22023';
 END IF;
 SELECT coalesce(b.max_members,4) INTO v_capacity
 FROM public.bands b WHERE b.id=NEW.band_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Band not found.' USING ERRCODE='22023';END IF;
 SELECT count(*) INTO v_members FROM public.band_members bm
 WHERE bm.band_id=NEW.band_id AND coalesce(bm.member_status,'active')='active'
 AND NOT coalesce(bm.is_touring_member,false);
 SELECT coalesce(sum(greatest(v.positions_available-v.positions_filled,0)),0)
 INTO v_reserved FROM public.band_vacancies v
 WHERE v.band_id=NEW.band_id AND v.id IS DISTINCT FROM NEW.id
 AND v.status='open' AND (v.application_deadline IS NULL OR v.application_deadline>now());
 IF v_members+v_reserved+greatest(NEW.positions_available-NEW.positions_filled,0)>v_capacity THEN
   RAISE EXCEPTION 'These positions exceed the remaining band member capacity.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$f$;
DROP TRIGGER IF EXISTS band_vacancy_capacity_guard ON public.band_vacancies;
CREATE TRIGGER band_vacancy_capacity_guard
BEFORE INSERT OR UPDATE OF band_id,status,positions_available,positions_filled,application_deadline
ON public.band_vacancies FOR EACH ROW
EXECUTE FUNCTION public.guard_band_vacancy_capacity();
REVOKE ALL ON FUNCTION public.guard_band_vacancy_capacity() FROM PUBLIC,anon,authenticated;


CREATE OR REPLACE FUNCTION public.expire_band_recruitment_records()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_count integer;
BEGIN
 UPDATE public.band_vacancies SET status='expired',updated_at=now()
 WHERE status='open' AND application_deadline IS NOT NULL
 AND application_deadline<=now();
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN v_count;
END;
$f$;
REVOKE ALL ON FUNCTION public.expire_band_recruitment_records() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_band_recruitment_records() TO service_role;

CREATE OR REPLACE FUNCTION public.submit_band_vacancy_application(target_vacancy_id uuid, cover text DEFAULT ''::text, answers jsonb DEFAULT '{}'::jsonb)
 RETURNS band_applications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    -- Returning rather than raising lets the expiry persist atomically.
    RETURN NULL;
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
  IF v_band.id IS NULL OR v_band.status <> 'active'::public.band_status OR COALESCE(v_band.is_solo_artist,false)
     OR NOT COALESCE(v_band.is_recruiting,false) OR NOT COALESCE(v_band.allow_applications,true) THEN
    RAISE EXCEPTION 'This band is not accepting applications.' USING ERRCODE='22023';
  END IF;
  IF v_band.leader_id = v_profile_id THEN RAISE EXCEPTION 'You cannot apply to your own band.' USING ERRCODE='22023'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.band_members bm JOIN public.bands b ON b.id=bm.band_id
    WHERE bm.profile_id=v_profile_id AND b.status='active'::public.band_status
      AND COALESCE(bm.member_status,'active')='active' AND NOT COALESCE(bm.is_touring_member,false)
  ) THEN RAISE EXCEPTION 'Leave your current active band before applying to another one.' USING ERRCODE='23505'; END IF;

  IF (
    SELECT count(*) FROM public.band_members bm
    WHERE bm.band_id=v_band.id
      AND COALESCE(bm.member_status,'active')='active'
      AND NOT COALESCE(bm.is_touring_member,false)
  ) >= COALESCE(v_band.max_members,4) THEN
    RAISE EXCEPTION 'This band has no open member slots.' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_existing FROM public.band_applications
  WHERE vacancy_id=v_vacancy.id AND applicant_profile_id=v_profile_id AND status='pending'
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
$function$
;
CREATE OR REPLACE FUNCTION public.respond_band_application(application_id uuid, decision text)
 RETURNS band_applications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_application_id uuid := application_id;
  v_decision text := lower(btrim(COALESCE(decision, '')));
  v_application public.band_applications%ROWTYPE;
  v_band public.bands%ROWTYPE;
  v_vacancy public.band_vacancies%ROWTYPE;
  v_applicant public.profiles%ROWTYPE;
  v_member public.band_members%ROWTYPE;
  v_joined boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before responding to an application.' USING ERRCODE = '42501';
  END IF;
  IF v_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Choose approve or reject.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_application
  FROM public.band_applications ba
  WHERE ba.id = v_application_id
  FOR UPDATE;

  IF v_application.id IS NULL THEN
    RAISE EXCEPTION 'That band application could not be found.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_manage_band_invitations(v_application.band_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are not allowed to manage applications for this band.' USING ERRCODE = '42501';
  END IF;

  IF (v_application.status = 'accepted' AND v_decision = 'approve')
     OR (v_application.status = 'rejected' AND v_decision = 'reject') THEN
    RETURN v_application;
  END IF;
  IF v_application.status <> 'pending' THEN
    RAISE EXCEPTION 'This application has already been resolved.' USING ERRCODE = '22023';
  END IF;

  IF v_decision = 'reject' THEN
    UPDATE public.band_applications
    SET status = 'rejected', responded_at = now()
    WHERE id = v_application.id
    RETURNING * INTO v_application;
  ELSE
    IF v_application.vacancy_id IS NOT NULL THEN
      SELECT * INTO v_vacancy
      FROM public.band_vacancies bv
      WHERE bv.id = v_application.vacancy_id
      FOR UPDATE;

      IF v_vacancy.id IS NULL
         OR v_vacancy.band_id <> v_application.band_id
         OR v_vacancy.status <> 'open'
         OR (v_vacancy.application_deadline IS NOT NULL
             AND v_vacancy.application_deadline <= now())
         OR v_vacancy.positions_filled >= v_vacancy.positions_available THEN
        RAISE EXCEPTION 'This vacancy no longer has an open position.' USING ERRCODE = '23514';
      END IF;
    END IF;

    SELECT * INTO v_band
    FROM public.bands b
    WHERE b.id = v_application.band_id
    FOR UPDATE;

    IF v_band.id IS NULL OR v_band.status <> 'active'::public.band_status THEN
      RAISE EXCEPTION 'This band is not currently active.' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(v_band.is_solo_artist, false) THEN
      RAISE EXCEPTION 'Solo artists cannot add regular band members.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_applicant
    FROM public.profiles p
    WHERE p.id = v_application.applicant_profile_id
    FOR UPDATE;

    IF v_applicant.id IS NULL
       OR NOT COALESCE(v_applicant.is_active, false)
       OR v_applicant.deleted_at IS NOT NULL
       OR v_applicant.died_at IS NOT NULL THEN
      RAISE EXCEPTION 'The applicant no longer has an active player character.' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_applicant.id::text, 0));

    SELECT * INTO v_member
    FROM public.band_members bm
    WHERE bm.band_id = v_band.id
      AND bm.profile_id = v_applicant.id
    FOR UPDATE;

    IF v_member.id IS NULL OR COALESCE(v_member.member_status, 'active') <> 'active' THEN
      IF EXISTS (
        SELECT 1
        FROM public.band_members bm
        JOIN public.bands other_band ON other_band.id = bm.band_id
        WHERE bm.profile_id = v_applicant.id
          AND bm.band_id <> v_band.id
          AND other_band.status = 'active'::public.band_status
          AND COALESCE(bm.member_status, 'active') = 'active'
          AND NOT COALESCE(bm.is_touring_member, false)
      ) THEN
        RAISE EXCEPTION 'The applicant already belongs to another active band.' USING ERRCODE = '23505';
      END IF;

      IF (
        SELECT count(*) FROM public.band_members bm
        WHERE bm.band_id = v_band.id
          AND COALESCE(bm.member_status, 'active') = 'active'
          AND NOT COALESCE(bm.is_touring_member, false)
      ) >= COALESCE(v_band.max_members, 4) THEN
        RAISE EXCEPTION 'This band has no open member slots.' USING ERRCODE = '23514';
      END IF;

      IF v_member.id IS NULL THEN
        INSERT INTO public.band_members (
          band_id, user_id, profile_id, role, instrument_role,
          vocal_role, member_status, is_touring_member
        ) VALUES (
          v_band.id, v_applicant.user_id, v_applicant.id, 'member',
          v_application.instrument_role, v_application.vocal_role, 'active', false
        )
        RETURNING * INTO v_member;
      ELSE
        UPDATE public.band_members
        SET user_id = v_applicant.user_id,
            role = 'member',
            instrument_role = v_application.instrument_role,
            vocal_role = v_application.vocal_role,
            member_status = 'active',
            is_touring_member = false
        WHERE id = v_member.id
        RETURNING * INTO v_member;
      END IF;
      v_joined := true;
    END IF;

    UPDATE public.band_applications
    SET status = 'accepted', responded_at = now()
    WHERE id = v_application.id
    RETURNING * INTO v_application;

    IF v_joined AND v_application.vacancy_id IS NOT NULL THEN
      UPDATE public.band_vacancies
      SET positions_filled = positions_filled + 1,
          status = CASE
            WHEN positions_filled + 1 >= positions_available THEN 'filled'
            ELSE status
          END,
          updated_at = now()
      WHERE id = v_application.vacancy_id;
    END IF;
  END IF;

  UPDATE public.notifications n
  SET read_at = COALESCE(n.read_at, now()),
      metadata = COALESCE(n.metadata, '{}'::jsonb)
        || jsonb_build_object('band_application_status', v_application.status, 'actionable', false)
  WHERE n.metadata->>'band_application_id' = v_application.id::text;

  INSERT INTO public.notifications (
    user_id, profile_id, category, type, title, message, action_path, metadata
  )
  SELECT p.user_id,
         p.id,
         'band',
         'band_request',
         CASE WHEN v_application.status = 'accepted'
           THEN 'Band application approved'
           ELSE 'Band application update'
         END,
         CASE WHEN v_application.status = 'accepted'
           THEN 'Your application to join ' || b.name || ' was approved.'
           ELSE 'Your application to join ' || b.name || ' was not accepted.'
         END,
         CASE WHEN v_application.status = 'accepted' THEN '/band-manager' ELSE '/bands/' || b.id END,
         jsonb_build_object(
           'band_application_id', v_application.id,
           'band_id', b.id,
           'band_application_status', v_application.status,
           'actionable', false
         )
  FROM public.profiles p
  JOIN public.bands b ON b.id = v_application.band_id
  WHERE p.id = v_application.applicant_profile_id;

  RETURN v_application;
END;
$function$
;
REVOKE ALL ON FUNCTION public.submit_band_vacancy_application(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_band_vacancy_application(uuid,text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.respond_band_application(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_band_application(uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;