-- Band recruitment: six independent audit issues covered by one verified schema contract.
-- Relies on the later, hardened vacancy/application RPCs (Sept 2026).
BEGIN;

-- #4000: a pending application is unique per vacancy and character. Preserve
-- non-vacancy applications' original uniqueness, but allow multiple roles.
DROP INDEX IF EXISTS public.band_applications_one_pending_per_band_idx;
DROP INDEX IF EXISTS public.band_applications_one_pending_per_profile_band_idx;
CREATE UNIQUE INDEX IF NOT EXISTS band_applications_general_pending_one_per_band
  ON public.band_applications(band_id, applicant_profile_id)
  WHERE vacancy_id IS NULL AND status='pending';
CREATE UNIQUE INDEX IF NOT EXISTS band_applications_one_pending_per_vacancy
  ON public.band_applications(vacancy_id, applicant_profile_id)
  WHERE vacancy_id IS NOT NULL AND status='pending';

-- #4002: reserve a real vacant band slot for each still-advertised position.
-- Locking the band serializes concurrent adverts and status changes.
CREATE OR REPLACE FUNCTION public.guard_band_vacancy_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
  v_capacity integer;
  v_members integer;
  v_other_reserved integer;
BEGIN
  IF NEW.status <> 'open' THEN RETURN NEW; END IF;
  IF NEW.application_deadline IS NOT NULL AND NEW.application_deadline <= now() THEN
    RAISE EXCEPTION 'Move the application deadline before publishing this advert.'
      USING ERRCODE='22023';
  END IF;
  SELECT COALESCE(b.max_members,4) INTO v_capacity
  FROM public.bands b WHERE b.id=NEW.band_id FOR UPDATE;
  IF v_capacity IS NULL THEN RAISE EXCEPTION 'Band not found.' USING ERRCODE='22023'; END IF;
  SELECT count(*) INTO v_members FROM public.band_members bm
  WHERE bm.band_id=NEW.band_id AND COALESCE(bm.member_status,'active')='active'
    AND NOT COALESCE(bm.is_touring_member,false);
  SELECT COALESCE(sum(GREATEST(v.positions_available-v.positions_filled,0)),0)
    INTO v_other_reserved
  FROM public.band_vacancies v
  WHERE v.band_id=NEW.band_id AND v.id IS DISTINCT FROM NEW.id
    AND v.status='open'
    AND (v.application_deadline IS NULL OR v.application_deadline > now());
  IF v_members + v_other_reserved +
    GREATEST(NEW.positions_available-NEW.positions_filled,0) > v_capacity THEN
    RAISE EXCEPTION 'These positions exceed the band''s remaining member capacity.'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS band_vacancy_capacity_guard ON public.band_vacancies;
CREATE TRIGGER band_vacancy_capacity_guard
BEFORE INSERT OR UPDATE OF band_id, status, positions_available, positions_filled, application_deadline
ON public.band_vacancies
FOR EACH ROW EXECUTE FUNCTION public.guard_band_vacancy_capacity();
REVOKE ALL ON FUNCTION public.guard_band_vacancy_capacity() FROM PUBLIC, anon, authenticated;

-- #3997/#3998: durable expiration even when no player interacts with a record.
CREATE OR REPLACE FUNCTION public.expire_band_recruitment_records()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE v_vacancies integer; v_offers integer;
BEGIN
  UPDATE public.band_vacancies
  SET status='expired', closed_at=COALESCE(closed_at,now()), updated_at=now()
  WHERE status='open' AND application_deadline IS NOT NULL AND application_deadline<=now();
  GET DIAGNOSTICS v_vacancies = ROW_COUNT;
  UPDATE public.band_membership_offers SET status='expired', responded_at=COALESCE(responded_at,now())
  WHERE status='pending' AND expires_at IS NOT NULL AND expires_at<=now();
  GET DIAGNOSTICS v_offers = ROW_COUNT;
  RETURN v_vacancies+v_offers;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_band_recruitment_records() FROM PUBLIC, anon, authenticated;

-- Where pg_cron is installed, expire untouched records every 15 minutes.
-- The direct application/acceptance RPCs below also expire a touched record
-- and return NULL without raising, so that their updates are not rolled back.
DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NOT NULL THEN
    EXECUTE 'SELECT cron.schedule($1,$2,$3)'
      USING 'rockmundo-band-recruitment-expiry', '*/15 * * * *',
        'SELECT public.expire_band_recruitment_records()';
  END IF;
END;
$$;

-- #3999: these hardened functions consistently use current_profile_id(),
-- which resolves the account's selected character, not its oldest character.
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

-- #4000/#3998: no cross-vacancy pending reuse, and expiry writes can commit.
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
    -- Raising an exception would roll back this expiration update.
    UPDATE public.band_vacancies SET status='expired', closed_at=now(), updated_at=now()
    WHERE id=v_vacancy.id;
    RETURN NULL;
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
  WHERE vacancy_id=v_vacancy.id
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

-- #3997/#3999: the offer acceptance is profile-specific, with durable expiry.
CREATE OR REPLACE FUNCTION public.accept_band_offer(offer_id uuid) RETURNS public.band_members LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor_profile uuid; offer public.band_membership_offers; uid uuid; member public.band_members; v public.band_vacancies;
BEGIN
 actor_profile := public.current_profile_id();
 SELECT p.user_id INTO uid FROM public.profiles p
 WHERE p.id=actor_profile AND p.user_id=auth.uid() AND p.deleted_at IS NULL AND p.died_at IS NULL;
 IF uid IS NULL THEN RAISE EXCEPTION 'Select an active player character before accepting an offer.' USING ERRCODE='42501'; END IF;
 SELECT * INTO offer FROM public.band_membership_offers WHERE id=offer_id FOR UPDATE;
 IF offer.id IS NULL OR offer.recipient_id<>actor_profile OR offer.status<>'pending' THEN RAISE EXCEPTION 'This offer is no longer available.'; END IF;
 IF offer.expires_at IS NOT NULL AND offer.expires_at <= now() THEN
   -- Return NULL so the expiry write commits; callers must treat it as no acceptance.
   UPDATE public.band_membership_offers SET status='expired', responded_at=now() WHERE id=offer.id;
   RETURN NULL;
 END IF;
 IF EXISTS (SELECT 1 FROM public.band_members WHERE band_id=offer.band_id AND (user_id=uid OR profile_id=actor_profile) AND COALESCE(member_status,'active')='active') THEN RAISE EXCEPTION 'You already belong to this band.'; END IF;
 INSERT INTO public.band_members(band_id,user_id,profile_id,role,instrument_role,member_status) VALUES(offer.band_id,uid,actor_profile,offer.role_type,offer.instrument,'active') RETURNING * INTO member;
 UPDATE public.band_membership_offers SET status='accepted', responded_at=now() WHERE id=offer.id; UPDATE public.band_applications SET status='accepted', responded_at=now() WHERE id=offer.application_id;
 IF offer.vacancy_id IS NOT NULL THEN UPDATE public.band_vacancies SET positions_filled=positions_filled+1, status=CASE WHEN positions_filled+1>=positions_available THEN 'filled' ELSE status END, closed_at=CASE WHEN positions_filled+1>=positions_available THEN now() ELSE closed_at END WHERE id=offer.vacancy_id RETURNING * INTO v; END IF;
 RETURN member;
END; $$;

REVOKE ALL ON FUNCTION public.create_band_vacancy(uuid,jsonb,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.submit_band_vacancy_application(uuid,text,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.accept_band_offer(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_band_vacancy(uuid,jsonb,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_band_vacancy_application(uuid,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_band_offer(uuid) TO authenticated;
COMMIT;
