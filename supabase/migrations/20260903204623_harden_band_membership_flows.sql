BEGIN;

-- Band membership was being mutated through several incompatible paths.  Keep
-- the browser contract small and make applications/invitations character-aware,
-- transactional and safe to retry.

ALTER TABLE public.band_invitations
  ADD COLUMN IF NOT EXISTS invited_profile_id uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.band_invitations bi
SET invited_profile_id = (
  SELECT p.id
  FROM public.profiles p
  WHERE p.user_id = bi.invited_user_id
    AND p.deleted_at IS NULL
    AND p.died_at IS NULL
  ORDER BY COALESCE(p.is_active, false) DESC,
           p.updated_at DESC NULLS LAST,
           p.created_at DESC,
           p.id
  LIMIT 1
)
WHERE bi.invited_profile_id IS NULL;

CREATE INDEX IF NOT EXISTS band_invitations_profile_status_idx
  ON public.band_invitations (invited_profile_id, status, created_at DESC);

ALTER TABLE public.band_applications
  DROP CONSTRAINT IF EXISTS band_applications_band_id_applicant_profile_id_key,
  DROP CONSTRAINT IF EXISTS band_applications_status_check;

DROP INDEX IF EXISTS public.band_applications_band_id_applicant_profile_id_key;
DROP INDEX IF EXISTS public.band_applications_one_pending_per_band_idx;

ALTER TABLE public.band_applications
  ADD CONSTRAINT band_applications_status_check
    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn'));

CREATE UNIQUE INDEX band_applications_one_pending_per_band_idx
  ON public.band_applications (band_id, applicant_profile_id)
  WHERE status = 'pending';

ALTER TABLE public.band_invitations
  DROP CONSTRAINT IF EXISTS unique_active_invitation,
  DROP CONSTRAINT IF EXISTS band_invitations_status_check;

DROP INDEX IF EXISTS public.unique_active_invitation;
DROP INDEX IF EXISTS public.band_invitations_one_pending_per_user_band_idx;

ALTER TABLE public.band_invitations
  ADD CONSTRAINT band_invitations_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled'));

CREATE UNIQUE INDEX band_invitations_one_pending_per_user_band_idx
  ON public.band_invitations (band_id, invited_user_id)
  WHERE status = 'pending';

-- The old partial unique index treated a membership in a band on hiatus as an
-- active-band conflict.  A trigger can include the band's actual lifecycle and
-- take an advisory lock so simultaneous accept requests cannot race.
DROP INDEX IF EXISTS public.idx_one_band_per_profile;

CREATE OR REPLACE FUNCTION public.guard_active_band_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_status public.band_status;
BEGIN
  IF COALESCE(NEW.is_touring_member, false)
     OR COALESCE(NEW.member_status, 'active') <> 'active' THEN
    RETURN NEW;
  END IF;

  IF NEW.profile_id IS NULL THEN
    RAISE EXCEPTION 'A player character is required for an active band membership.'
      USING ERRCODE = '23502';
  END IF;

  SELECT b.status INTO v_target_status
  FROM public.bands b
  WHERE b.id = NEW.band_id;

  IF v_target_status IS DISTINCT FROM 'active'::public.band_status THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.profile_id::text, 0));

  IF EXISTS (
    SELECT 1
    FROM public.band_members bm
    JOIN public.bands b ON b.id = bm.band_id
    WHERE bm.profile_id = NEW.profile_id
      AND bm.band_id <> NEW.band_id
      AND b.status = 'active'::public.band_status
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND NOT COALESCE(bm.is_touring_member, false)
  ) THEN
    RAISE EXCEPTION 'This player already belongs to another active band.'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_guard_active_band_membership_trigger
  ON public.band_members;
CREATE TRIGGER zz_guard_active_band_membership_trigger
BEFORE INSERT OR UPDATE OF band_id, user_id, profile_id, member_status, is_touring_member
ON public.band_members
FOR EACH ROW
EXECUTE FUNCTION public.guard_active_band_membership();

CREATE OR REPLACE FUNCTION public.can_manage_band_invitations(
  target_band_id uuid,
  actor_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT target_band_id IS NOT NULL
    AND actor_user_id IS NOT NULL
    AND actor_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles actor
      WHERE actor.id = public.current_profile_id()
        AND actor.user_id = actor_user_id
        AND COALESCE(actor.is_active, false)
        AND actor.deleted_at IS NULL
        AND actor.died_at IS NULL
        AND (
          EXISTS (
            SELECT 1
            FROM public.bands b
            WHERE b.id = target_band_id
              AND b.leader_id = actor.id
          )
          OR EXISTS (
            SELECT 1
            FROM public.band_members bm
            WHERE bm.band_id = target_band_id
              AND (bm.profile_id = actor.id OR (bm.profile_id IS NULL AND bm.user_id = actor_user_id))
              AND COALESCE(bm.member_status, 'active') = 'active'
              AND NOT COALESCE(bm.is_touring_member, false)
              AND lower(COALESCE(bm.role, '')) IN (
                'leader', 'founder', 'co-leader', 'co_leader', 'manager', 'recruiter'
              )
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_receive_band_invitation(
  inviter_profile_id uuid,
  target_profile_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inviter_user_id uuid;
  v_target_user_id uuid;
  v_allows_invites boolean := true;
BEGIN
  SELECT p.user_id INTO v_inviter_user_id
  FROM public.profiles p
  WHERE p.id = inviter_profile_id
    AND COALESCE(p.is_active, false)
    AND p.deleted_at IS NULL
    AND p.died_at IS NULL;

  SELECT p.user_id INTO v_target_user_id
  FROM public.profiles p
  WHERE p.id = target_profile_id
    AND COALESCE(p.is_active, false)
    AND p.deleted_at IS NULL
    AND p.died_at IS NULL;

  IF v_inviter_user_id IS NULL
     OR v_target_user_id IS NULL
     OR v_inviter_user_id = v_target_user_id
     OR inviter_profile_id = target_profile_id THEN
    RETURN false;
  END IF;

  IF public.are_profiles_blocked(inviter_profile_id, target_profile_id) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status::text = 'accepted'
      AND (
        (f.requestor_id = inviter_profile_id AND f.addressee_id = target_profile_id)
        OR (f.requestor_id = target_profile_id AND f.addressee_id = inviter_profile_id)
      )
  ) THEN
    RETURN false;
  END IF;

  -- Some installations have the optional privacy table and some do not.
  IF to_regclass('public.profile_privacy_settings') IS NOT NULL THEN
    EXECUTE
      'SELECT COALESCE((SELECT allow_band_invites FROM public.profile_privacy_settings WHERE profile_id = $1), true)'
      INTO v_allows_invites
      USING target_profile_id;
  END IF;

  RETURN COALESCE(v_allows_invites, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_band_application(
  band_id uuid,
  requested_role text,
  message text DEFAULT NULL
)
RETURNS public.band_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_band_id uuid := band_id;
  v_role text := NULLIF(btrim(COALESCE(requested_role, '')), '');
  v_message text := NULLIF(btrim(COALESCE(message, '')), '');
  v_band public.bands%ROWTYPE;
  v_existing public.band_applications%ROWTYPE;
  v_result public.band_applications%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before applying to a band.' USING ERRCODE = '42501';
  END IF;

  v_profile_id := public.current_profile_id();
  IF v_profile_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_profile_id
      AND p.user_id = v_user_id
      AND COALESCE(p.is_active, false)
      AND p.deleted_at IS NULL
      AND p.died_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Select an active player character before applying.' USING ERRCODE = '42501';
  END IF;

  IF v_band_id IS NULL OR v_role IS NULL OR char_length(v_role) > 50 THEN
    RAISE EXCEPTION 'Choose a valid band and performance role.' USING ERRCODE = '22023';
  END IF;
  IF v_message IS NOT NULL AND char_length(v_message) > 500 THEN
    RAISE EXCEPTION 'Band application messages must be 500 characters or fewer.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_band
  FROM public.bands b
  WHERE b.id = v_band_id
  FOR UPDATE;

  IF v_band.id IS NULL THEN
    RAISE EXCEPTION 'That band could not be found.' USING ERRCODE = '22023';
  END IF;
  IF v_band.status <> 'active'::public.band_status THEN
    RAISE EXCEPTION 'This band is not currently active.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_band.is_solo_artist, false) THEN
    RAISE EXCEPTION 'Solo artists cannot accept band applications.' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(v_band.is_recruiting, false)
     OR NOT COALESCE(v_band.allow_applications, true) THEN
    RAISE EXCEPTION 'This band is not currently accepting applications.' USING ERRCODE = '22023';
  END IF;
  IF v_band.leader_id = v_profile_id THEN
    RAISE EXCEPTION 'You cannot apply to your own band.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = v_band.id
      AND (bm.profile_id = v_profile_id OR (bm.profile_id IS NULL AND bm.user_id = v_user_id))
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND NOT COALESCE(bm.is_touring_member, false)
  ) THEN
    RAISE EXCEPTION 'You are already a member of this band.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.band_members bm
    JOIN public.bands other_band ON other_band.id = bm.band_id
    WHERE (bm.profile_id = v_profile_id OR (bm.profile_id IS NULL AND bm.user_id = v_user_id))
      AND other_band.status = 'active'::public.band_status
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND NOT COALESCE(bm.is_touring_member, false)
  ) THEN
    RAISE EXCEPTION 'Leave your current active band before applying to another one.' USING ERRCODE = '23505';
  END IF;

  IF (
    SELECT count(*)
    FROM public.band_members bm
    WHERE bm.band_id = v_band.id
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND NOT COALESCE(bm.is_touring_member, false)
  ) >= COALESCE(v_band.max_members, 4) THEN
    RAISE EXCEPTION 'This band has no open member slots.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_existing
  FROM public.band_applications ba
  WHERE ba.band_id = v_band.id
    AND ba.applicant_profile_id = v_profile_id
    AND ba.status = 'pending'
  ORDER BY ba.created_at DESC
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.band_applications (
    band_id, applicant_profile_id, instrument_role, message, status
  ) VALUES (
    v_band.id, v_profile_id, v_role, v_message, 'pending'
  )
  RETURNING * INTO v_result;

  INSERT INTO public.notifications (
    user_id, profile_id, category, type, title, message, action_path, metadata
  )
  SELECT DISTINCT ON (manager.user_id)
    manager.user_id,
    manager.id,
    'band',
    'band_request',
    'New band application',
    'A player applied to join ' || v_band.name || '.',
    '/band-manager?section=members',
    jsonb_build_object(
      'band_application_id', v_result.id,
      'band_id', v_band.id,
      'applicant_profile_id', v_profile_id,
      'actionable', true
    )
  FROM public.profiles manager
  WHERE manager.user_id IS NOT NULL
    AND (
      manager.id = v_band.leader_id
      OR EXISTS (
        SELECT 1 FROM public.band_members bm
        WHERE bm.band_id = v_band.id
          AND bm.profile_id = manager.id
          AND COALESCE(bm.member_status, 'active') = 'active'
          AND lower(COALESCE(bm.role, '')) IN ('leader', 'founder', 'co-leader', 'co_leader', 'manager', 'recruiter')
      )
    )
  ORDER BY manager.user_id, (manager.id = v_band.leader_id) DESC;

  RETURN v_result;
END;
$$;

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
  v_profile_id uuid;
  v_cover text := NULLIF(btrim(COALESCE(cover, '')), '');
  v_vacancy public.band_vacancies%ROWTYPE;
  v_band public.bands%ROWTYPE;
  v_existing public.band_applications%ROWTYPE;
  v_result public.band_applications%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before applying to a vacancy.' USING ERRCODE = '42501';
  END IF;

  v_profile_id := public.current_profile_id();
  IF v_profile_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_profile_id
      AND p.user_id = v_user_id
      AND COALESCE(p.is_active, false)
      AND p.deleted_at IS NULL
      AND p.died_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Select an active player character before applying.' USING ERRCODE = '42501';
  END IF;

  IF v_cover IS NOT NULL AND char_length(v_cover) > 500 THEN
    RAISE EXCEPTION 'Band application messages must be 500 characters or fewer.' USING ERRCODE = '22023';
  END IF;
  IF answers IS NULL OR jsonb_typeof(answers) <> 'object' THEN
    RAISE EXCEPTION 'Vacancy answers must be an object.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_vacancy
  FROM public.band_vacancies bv
  WHERE bv.id = target_vacancy_id
  FOR UPDATE;

  IF v_vacancy.id IS NULL
     OR v_vacancy.status <> 'open'
     OR v_vacancy.visibility <> 'public'
     OR NOT v_vacancy.direct_applications_allowed THEN
    RAISE EXCEPTION 'This vacancy is not open for direct applications.' USING ERRCODE = '22023';
  END IF;
  IF v_vacancy.application_deadline IS NOT NULL
     AND v_vacancy.application_deadline < now() THEN
    UPDATE public.band_vacancies SET status = 'expired', updated_at = now()
    WHERE id = v_vacancy.id;
    RAISE EXCEPTION 'The application deadline has passed.' USING ERRCODE = '22023';
  END IF;
  IF v_vacancy.positions_filled >= v_vacancy.positions_available THEN
    RAISE EXCEPTION 'This vacancy has already been filled.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_band
  FROM public.bands b
  WHERE b.id = v_vacancy.band_id
  FOR UPDATE;

  IF v_band.id IS NULL
     OR v_band.status <> 'active'::public.band_status
     OR COALESCE(v_band.is_solo_artist, false)
     OR NOT COALESCE(v_band.is_recruiting, false)
     OR NOT COALESCE(v_band.allow_applications, true) THEN
    RAISE EXCEPTION 'This band is not accepting applications.' USING ERRCODE = '22023';
  END IF;
  IF v_band.leader_id = v_profile_id THEN
    RAISE EXCEPTION 'You cannot apply to your own band.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.band_members bm
    JOIN public.bands existing_band ON existing_band.id = bm.band_id
    WHERE (bm.profile_id = v_profile_id OR (bm.profile_id IS NULL AND bm.user_id = v_user_id))
      AND existing_band.status = 'active'::public.band_status
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND NOT COALESCE(bm.is_touring_member, false)
  ) THEN
    RAISE EXCEPTION 'Leave your current active band before applying to another one.' USING ERRCODE = '23505';
  END IF;

  IF (
    SELECT count(*) FROM public.band_members bm
    WHERE bm.band_id = v_band.id
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND NOT COALESCE(bm.is_touring_member, false)
  ) >= COALESCE(v_band.max_members, 4) THEN
    RAISE EXCEPTION 'This band has no open member slots.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_existing
  FROM public.band_applications ba
  WHERE ba.band_id = v_band.id
    AND ba.applicant_profile_id = v_profile_id
    AND ba.status = 'pending'
  ORDER BY ba.created_at DESC
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.band_applications (
    band_id, vacancy_id, applicant_profile_id, instrument_role,
    vocal_role, message, status
  ) VALUES (
    v_band.id, v_vacancy.id, v_profile_id, v_vacancy.instrument,
    v_vacancy.vocal_role, v_cover, 'pending'
  )
  RETURNING * INTO v_result;

  INSERT INTO public.notifications (
    user_id, profile_id, category, type, title, message, action_path, metadata
  )
  SELECT DISTINCT ON (manager.user_id)
    manager.user_id,
    manager.id,
    'band',
    'band_request',
    'New vacancy application',
    'A player applied for ' || v_vacancy.title || ' in ' || v_band.name || '.',
    '/band-manager?section=members',
    jsonb_build_object(
      'band_application_id', v_result.id,
      'band_vacancy_id', v_vacancy.id,
      'band_id', v_band.id,
      'applicant_profile_id', v_profile_id,
      'actionable', true
    )
  FROM public.profiles manager
  WHERE manager.user_id IS NOT NULL
    AND (
      manager.id = v_band.leader_id
      OR EXISTS (
        SELECT 1 FROM public.band_members bm
        WHERE bm.band_id = v_band.id
          AND bm.profile_id = manager.id
          AND COALESCE(bm.member_status, 'active') = 'active'
          AND lower(COALESCE(bm.role, '')) IN ('leader', 'founder', 'co-leader', 'co_leader', 'manager', 'recruiter')
      )
    )
  ORDER BY manager.user_id, (manager.id = v_band.leader_id) DESC;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_band_application(application_id uuid)
RETURNS public.band_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid := public.current_profile_id();
  v_application_id uuid := application_id;
  v_application public.band_applications%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_profile_id IS NULL
     OR NOT public.profile_belongs_to_current_user(v_profile_id) THEN
    RAISE EXCEPTION 'Select an active player character before withdrawing an application.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_application
  FROM public.band_applications ba
  WHERE ba.id = v_application_id
  FOR UPDATE;

  IF v_application.id IS NULL THEN
    RAISE EXCEPTION 'That band application could not be found.' USING ERRCODE = '22023';
  END IF;
  IF v_application.applicant_profile_id <> v_profile_id THEN
    RAISE EXCEPTION 'You can only withdraw applications for the active character.' USING ERRCODE = '42501';
  END IF;
  IF v_application.status = 'withdrawn' THEN
    RETURN v_application;
  END IF;
  IF v_application.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending band applications can be withdrawn.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.band_applications
  SET status = 'withdrawn', responded_at = now()
  WHERE id = v_application.id
  RETURNING * INTO v_application;

  UPDATE public.notifications n
  SET read_at = COALESCE(n.read_at, now()),
      metadata = COALESCE(n.metadata, '{}'::jsonb)
        || jsonb_build_object('band_application_status', 'withdrawn', 'actionable', false)
  WHERE n.metadata->>'band_application_id' = v_application.id::text;

  RETURN v_application;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_band_application(
  application_id uuid,
  decision text
)
RETURNS public.band_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.send_band_invitation(
  target_profile_id uuid,
  target_band_id uuid,
  requested_instrument_role text DEFAULT 'Electric Guitar',
  requested_vocal_role text DEFAULT NULL,
  invite_message text DEFAULT NULL
)
RETURNS public.band_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inviter_profile_id uuid := public.current_profile_id();
  v_target_profile_id uuid := target_profile_id;
  v_target_band_id uuid := target_band_id;
  v_instrument text := NULLIF(btrim(COALESCE(requested_instrument_role, '')), '');
  v_vocal text := NULLIF(btrim(COALESCE(requested_vocal_role, '')), '');
  v_message text := NULLIF(btrim(COALESCE(invite_message, '')), '');
  v_band public.bands%ROWTYPE;
  v_target public.profiles%ROWTYPE;
  v_existing public.band_invitations%ROWTYPE;
  v_result public.band_invitations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_inviter_profile_id IS NULL THEN
    RAISE EXCEPTION 'Select an active player character before sending invitations.' USING ERRCODE = '42501';
  END IF;
  IF v_target_profile_id IS NULL OR v_target_band_id IS NULL
     OR v_instrument IS NULL OR char_length(v_instrument) > 50 THEN
    RAISE EXCEPTION 'Choose a valid band, player and performance role.' USING ERRCODE = '22023';
  END IF;
  IF v_vocal = 'None' THEN v_vocal := NULL; END IF;
  IF v_vocal IS NOT NULL AND char_length(v_vocal) > 50 THEN
    RAISE EXCEPTION 'Vocal roles must be 50 characters or fewer.' USING ERRCODE = '22023';
  END IF;
  IF v_message IS NOT NULL AND char_length(v_message) > 280 THEN
    RAISE EXCEPTION 'Band invitation messages must be 280 characters or fewer.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_band
  FROM public.bands b
  WHERE b.id = v_target_band_id
  FOR UPDATE;

  IF v_band.id IS NULL THEN
    RAISE EXCEPTION 'That band could not be found.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_manage_band_invitations(v_band.id, auth.uid()) THEN
    RAISE EXCEPTION 'You are not allowed to invite players to this band.' USING ERRCODE = '42501';
  END IF;
  IF v_band.status <> 'active'::public.band_status THEN
    RAISE EXCEPTION 'This band is not currently active.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_band.is_solo_artist, false) THEN
    RAISE EXCEPTION 'Solo artists cannot invite regular band members.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_target
  FROM public.profiles p
  WHERE p.id = v_target_profile_id
  FOR UPDATE;

  IF v_target.id IS NULL
     OR NOT COALESCE(v_target.is_active, false)
     OR v_target.deleted_at IS NOT NULL
     OR v_target.died_at IS NOT NULL THEN
    RAISE EXCEPTION 'That player does not have an active character available.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_receive_band_invitation(v_inviter_profile_id, v_target.id) THEN
    RAISE EXCEPTION 'This player is not available for band invitations.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = v_band.id
      AND bm.profile_id = v_target.id
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND NOT COALESCE(bm.is_touring_member, false)
  ) THEN
    RAISE EXCEPTION 'That player already belongs to this band.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.band_members bm
    JOIN public.bands other_band ON other_band.id = bm.band_id
    WHERE bm.profile_id = v_target.id
      AND other_band.status = 'active'::public.band_status
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND NOT COALESCE(bm.is_touring_member, false)
  ) THEN
    RAISE EXCEPTION 'That player already belongs to another active band.' USING ERRCODE = '23505';
  END IF;

  IF (
    SELECT count(*) FROM public.band_members bm
    WHERE bm.band_id = v_band.id
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND NOT COALESCE(bm.is_touring_member, false)
  ) >= COALESCE(v_band.max_members, 4) THEN
    RAISE EXCEPTION 'This band has no open member slots.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_existing
  FROM public.band_invitations bi
  WHERE bi.band_id = v_band.id
    AND bi.invited_user_id = v_target.user_id
    AND bi.status = 'pending'
  ORDER BY bi.created_at DESC
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.invited_profile_id IS NOT NULL
       AND v_existing.invited_profile_id <> v_target.id THEN
      RAISE EXCEPTION 'That account already has a pending invitation for another character.' USING ERRCODE = '23505';
    END IF;
    RETURN v_existing;
  END IF;

  INSERT INTO public.band_invitations (
    band_id, inviter_user_id, invited_user_id, invited_profile_id,
    instrument_role, vocal_role, message, status
  ) VALUES (
    v_band.id, auth.uid(), v_target.user_id, v_target.id,
    v_instrument, v_vocal, v_message, 'pending'
  )
  RETURNING * INTO v_result;

  INSERT INTO public.notifications (
    user_id, profile_id, category, type, title, message, action_path, metadata
  ) VALUES (
    v_target.user_id,
    v_target.id,
    'band',
    'band_request',
    'New band invitation',
    'You have been invited to join ' || v_band.name || '.',
    '/band-manager',
    jsonb_build_object(
      'band_invitation_id', v_result.id,
      'band_id', v_band.id,
      'inviter_profile_id', v_inviter_profile_id,
      'invited_profile_id', v_target.id,
      'actionable', true
    )
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_band_invitation(
  invitation_id uuid,
  response_status text
)
RETURNS public.band_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation_id uuid := invitation_id;
  v_response text := lower(btrim(COALESCE(response_status, '')));
  v_active_profile_id uuid := public.current_profile_id();
  v_invitation public.band_invitations%ROWTYPE;
  v_band public.bands%ROWTYPE;
  v_target public.profiles%ROWTYPE;
  v_member public.band_members%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_active_profile_id IS NULL THEN
    RAISE EXCEPTION 'Select an active player character before responding.' USING ERRCODE = '42501';
  END IF;
  IF v_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Choose accept or decline.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_invitation
  FROM public.band_invitations bi
  WHERE bi.id = v_invitation_id
  FOR UPDATE;

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'That band invitation could not be found.' USING ERRCODE = '22023';
  END IF;
  IF v_invitation.invited_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'This invitation belongs to another account.' USING ERRCODE = '42501';
  END IF;

  IF v_invitation.invited_profile_id IS NULL THEN
    UPDATE public.band_invitations
    SET invited_profile_id = v_active_profile_id
    WHERE id = v_invitation.id
    RETURNING * INTO v_invitation;
  ELSIF v_invitation.invited_profile_id <> v_active_profile_id THEN
    RAISE EXCEPTION 'Switch to the character who was invited before responding.' USING ERRCODE = '42501';
  END IF;

  IF v_invitation.status = v_response THEN
    RETURN v_invitation;
  END IF;
  IF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'This invitation has already been resolved.' USING ERRCODE = '22023';
  END IF;

  IF v_response = 'declined' THEN
    UPDATE public.band_invitations
    SET status = 'declined', responded_at = now()
    WHERE id = v_invitation.id
    RETURNING * INTO v_invitation;
  ELSE
    SELECT * INTO v_band
    FROM public.bands b
    WHERE b.id = v_invitation.band_id
    FOR UPDATE;

    IF v_band.id IS NULL OR v_band.status <> 'active'::public.band_status THEN
      RAISE EXCEPTION 'This band is not currently active.' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(v_band.is_solo_artist, false) THEN
      RAISE EXCEPTION 'Solo artists cannot add regular band members.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_target
    FROM public.profiles p
    WHERE p.id = v_active_profile_id
    FOR UPDATE;

    IF v_target.id IS NULL
       OR v_target.user_id <> auth.uid()
       OR NOT COALESCE(v_target.is_active, false)
       OR v_target.deleted_at IS NOT NULL
       OR v_target.died_at IS NOT NULL THEN
      RAISE EXCEPTION 'The invited character is no longer active.' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_target.id::text, 0));

    SELECT * INTO v_member
    FROM public.band_members bm
    WHERE bm.band_id = v_band.id
      AND bm.profile_id = v_target.id
    FOR UPDATE;

    IF v_member.id IS NULL OR COALESCE(v_member.member_status, 'active') <> 'active' THEN
      IF EXISTS (
        SELECT 1
        FROM public.band_members bm
        JOIN public.bands other_band ON other_band.id = bm.band_id
        WHERE bm.profile_id = v_target.id
          AND bm.band_id <> v_band.id
          AND other_band.status = 'active'::public.band_status
          AND COALESCE(bm.member_status, 'active') = 'active'
          AND NOT COALESCE(bm.is_touring_member, false)
      ) THEN
        RAISE EXCEPTION 'Leave your current active band before accepting this invitation.' USING ERRCODE = '23505';
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
          v_band.id, v_target.user_id, v_target.id, 'member',
          v_invitation.instrument_role, v_invitation.vocal_role, 'active', false
        )
        RETURNING * INTO v_member;
      ELSE
        UPDATE public.band_members
        SET user_id = v_target.user_id,
            role = 'member',
            instrument_role = v_invitation.instrument_role,
            vocal_role = v_invitation.vocal_role,
            member_status = 'active',
            is_touring_member = false
        WHERE id = v_member.id
        RETURNING * INTO v_member;
      END IF;
    END IF;

    UPDATE public.band_invitations
    SET status = 'accepted', responded_at = now()
    WHERE id = v_invitation.id
    RETURNING * INTO v_invitation;

    UPDATE public.band_applications
    SET status = 'withdrawn', responded_at = now()
    WHERE applicant_profile_id = v_target.id
      AND status = 'pending';
  END IF;

  UPDATE public.notifications n
  SET read_at = COALESCE(n.read_at, now()),
      metadata = COALESCE(n.metadata, '{}'::jsonb)
        || jsonb_build_object('band_invitation_status', v_invitation.status, 'actionable', false)
  WHERE n.metadata->>'band_invitation_id' = v_invitation.id::text;

  RETURN v_invitation;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_band_invitation(invitation_id uuid)
RETURNS public.band_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation_id uuid := invitation_id;
  v_invitation public.band_invitations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before cancelling an invitation.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invitation
  FROM public.band_invitations bi
  WHERE bi.id = v_invitation_id
  FOR UPDATE;

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'That band invitation could not be found.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_manage_band_invitations(v_invitation.band_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are not allowed to cancel this invitation.' USING ERRCODE = '42501';
  END IF;
  IF v_invitation.status = 'cancelled' THEN
    RETURN v_invitation;
  END IF;
  IF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending invitations can be cancelled.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.band_invitations
  SET status = 'cancelled', responded_at = now()
  WHERE id = v_invitation.id
  RETURNING * INTO v_invitation;

  UPDATE public.notifications n
  SET read_at = COALESCE(n.read_at, now()),
      metadata = COALESCE(n.metadata, '{}'::jsonb)
        || jsonb_build_object('band_invitation_status', 'cancelled', 'actionable', false)
  WHERE n.metadata->>'band_invitation_id' = v_invitation.id::text;

  RETURN v_invitation;
END;
$$;

-- All application and invitation state changes now go through the functions
-- above.  RLS remains useful for participant reads, but is no longer the only
-- thing standing between a browser and a forged membership action.
DROP POLICY IF EXISTS "Users can apply to bands" ON public.band_applications;
DROP POLICY IF EXISTS "Leaders can respond to applications" ON public.band_applications;
DROP POLICY IF EXISTS "Users can view own applications" ON public.band_applications;
DROP POLICY IF EXISTS "Leaders can view band applications" ON public.band_applications;
DROP POLICY IF EXISTS "Band application participants can view" ON public.band_applications;

CREATE POLICY "Band application participants can view"
ON public.band_applications
FOR SELECT TO authenticated
USING (
  public.profile_belongs_to_current_user(applicant_profile_id)
  OR public.can_manage_band_invitations(band_id, auth.uid())
);

DROP POLICY IF EXISTS "Band invitations are viewable by everyone" ON public.band_invitations;
DROP POLICY IF EXISTS "Band members can view their band invitations" ON public.band_invitations;
DROP POLICY IF EXISTS "Band leaders can create invitations" ON public.band_invitations;
DROP POLICY IF EXISTS "Invited users can respond to invitations" ON public.band_invitations;
DROP POLICY IF EXISTS "Band leaders can update invitations" ON public.band_invitations;
DROP POLICY IF EXISTS "Band leaders can cancel invitations" ON public.band_invitations;
DROP POLICY IF EXISTS "Band invitation participants can view" ON public.band_invitations;

CREATE POLICY "Band invitation participants can view"
ON public.band_invitations
FOR SELECT TO authenticated
USING (
  invited_user_id = auth.uid()
  OR public.can_manage_band_invitations(band_id, auth.uid())
);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.band_applications, public.band_invitations
  FROM anon, authenticated;
GRANT SELECT ON public.band_applications, public.band_invitations TO authenticated;

-- Prevent arbitrary self-joins while retaining the founder insert used by band
-- creation and the existing manager/member update and delete workflows.
DROP POLICY IF EXISTS "Users can join bands" ON public.band_members;
DROP POLICY IF EXISTS "Band leaders can manage members" ON public.band_members;
DROP POLICY IF EXISTS "Founders can create their membership" ON public.band_members;
DROP POLICY IF EXISTS "Band managers can update members" ON public.band_members;
DROP POLICY IF EXISTS "Band managers can remove members" ON public.band_members;
DROP POLICY IF EXISTS "Members can leave bands" ON public.band_members;

CREATE POLICY "Founders can create their membership"
ON public.band_members
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.profile_belongs_to_current_user(profile_id)
  AND NOT COALESCE(is_touring_member, false)
  AND lower(COALESCE(role, '')) IN ('founder', 'leader')
  AND EXISTS (
    SELECT 1 FROM public.bands b
    WHERE b.id = band_members.band_id
      AND b.leader_id = band_members.profile_id
  )
);

CREATE POLICY "Band managers can update members"
ON public.band_members
FOR UPDATE TO authenticated
USING (public.can_manage_band_invitations(band_id, auth.uid()))
WITH CHECK (public.can_manage_band_invitations(band_id, auth.uid()));

CREATE POLICY "Band managers can remove members"
ON public.band_members
FOR DELETE TO authenticated
USING (public.can_manage_band_invitations(band_id, auth.uid()));

CREATE POLICY "Members can leave bands"
ON public.band_members
FOR DELETE TO authenticated
USING (
  public.profile_belongs_to_current_user(profile_id)
  AND lower(COALESCE(role, '')) NOT IN ('founder', 'leader')
  AND NOT COALESCE(is_touring_member, false)
);

REVOKE INSERT ON public.band_members FROM anon;

-- Repair the inconsistent rows that exposed the bug in production.  Solo acts
-- cannot recruit regular members, and active bands must retain their founder.
UPDATE public.bands
SET is_recruiting = false,
    allow_applications = false,
    updated_at = now()
WHERE COALESCE(is_solo_artist, false)
  AND (COALESCE(is_recruiting, false) OR COALESCE(allow_applications, true));

WITH repaired AS (
  UPDATE public.band_applications ba
  SET status = 'rejected', responded_at = COALESCE(ba.responded_at, now())
  FROM public.bands b
  WHERE b.id = ba.band_id
    AND COALESCE(b.is_solo_artist, false)
    AND ba.status IN ('pending', 'accepted')
    AND NOT EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id = ba.band_id
        AND bm.profile_id = ba.applicant_profile_id
        AND COALESCE(bm.member_status, 'active') = 'active'
        AND NOT COALESCE(bm.is_touring_member, false)
    )
  RETURNING ba.*
)
INSERT INTO public.notifications (
  user_id, profile_id, category, type, title, message, action_path, metadata
)
SELECT p.user_id,
       p.id,
       'band',
       'band_request',
       'Band application closed',
       'This application was closed because solo artists cannot add regular band members.',
       '/bands/' || repaired.band_id,
       jsonb_build_object(
         'band_application_id', repaired.id,
         'band_id', repaired.band_id,
         'band_application_status', 'rejected',
         'actionable', false,
         'repair', 'solo_artist_membership_guard'
       )
FROM repaired
JOIN public.profiles p ON p.id = repaired.applicant_profile_id;

INSERT INTO public.band_members (
  band_id, user_id, profile_id, role, instrument_role,
  member_status, is_touring_member
)
SELECT b.id,
       leader.user_id,
       leader.id,
       'Founder',
       COALESCE((
         SELECT NULLIF(btrim(ba.instrument_role), '')
         FROM public.band_applications ba
         WHERE ba.band_id = b.id
           AND ba.applicant_profile_id = leader.id
         ORDER BY ba.created_at DESC
         LIMIT 1
       ), 'Electric Guitar'),
       'active',
       false
FROM public.bands b
JOIN public.profiles leader ON leader.id = b.leader_id
WHERE b.status = 'active'::public.band_status
  AND leader.user_id IS NOT NULL
  AND COALESCE(leader.is_active, false)
  AND leader.deleted_at IS NULL
  AND leader.died_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.band_members existing
    WHERE existing.band_id = b.id
      AND existing.profile_id = leader.id
      AND COALESCE(existing.member_status, 'active') = 'active'
      AND NOT COALESCE(existing.is_touring_member, false)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.band_members other_membership
    JOIN public.bands other_band ON other_band.id = other_membership.band_id
    WHERE other_membership.profile_id = leader.id
      AND other_membership.band_id <> b.id
      AND other_band.status = 'active'::public.band_status
      AND COALESCE(other_membership.member_status, 'active') = 'active'
      AND NOT COALESCE(other_membership.is_touring_member, false)
  )
  AND (
    SELECT count(*) FROM public.band_members bm
    WHERE bm.band_id = b.id
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND NOT COALESCE(bm.is_touring_member, false)
  ) < COALESCE(b.max_members, 4)
ON CONFLICT (band_id, profile_id) WHERE profile_id IS NOT NULL
DO UPDATE SET
  user_id = EXCLUDED.user_id,
  role = 'Founder',
  instrument_role = EXCLUDED.instrument_role,
  member_status = 'active',
  is_touring_member = false;

REVOKE ALL ON FUNCTION public.guard_active_band_membership() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_band_invitations(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_receive_band_invitation(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_band_application(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_band_vacancy_application(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.withdraw_band_application(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_band_application(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_band_invitation(uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_band_invitation(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_band_invitation(uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.can_manage_band_invitations(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_receive_band_invitation(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_band_application(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_band_vacancy_application(uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.withdraw_band_application(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.respond_band_application(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.send_band_invitation(uuid, uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.respond_band_invitation(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_band_invitation(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.can_manage_band_invitations(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_receive_band_invitation(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_band_application(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_band_vacancy_application(uuid, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_band_application(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_band_application(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_band_invitation(uuid, uuid, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_band_invitation(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_band_invitation(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
