-- #4004: no applications may be approved after vacancy closes/pauses/expires.
-- #4005: accepted recruitment seats are released when the joined member leaves.
BEGIN;

ALTER TABLE public.band_members
  ADD COLUMN IF NOT EXISTS recruitment_application_id uuid
  REFERENCES public.band_applications(id) ON DELETE SET NULL;

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
         OR v_vacancy.status <> 'open'
         OR (v_vacancy.application_deadline IS NOT NULL AND v_vacancy.application_deadline <= now())
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
    IF v_application.vacancy_id IS NOT NULL AND
       (NOT COALESCE(v_band.is_recruiting, false) OR NOT COALESCE(v_band.allow_applications,true)) THEN
      RAISE EXCEPTION 'Band recruitment is paused or closed.' USING ERRCODE = '23514';
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
      -- Persist the exact application that earned this seat; only the member
      -- created by that acceptance is eligible to release it on departure.
      UPDATE public.band_members
      SET recruitment_application_id = v_application.id WHERE id = v_member.id;
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

-- Changes in band_members may originate from leaving, kicking, disbanding,
-- character death, or direct administrative membership corrections.
CREATE OR REPLACE FUNCTION public.release_departed_recruitment_slot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
  v_application uuid;
  v_vacancy uuid;
  v_b public.bands%ROWTYPE;
  v_reserved integer;
  v_active_members integer;
  v_row public.band_vacancies%ROWTYPE;
BEGIN
  IF COALESCE(OLD.member_status,'active') <> 'active'
     OR COALESCE(OLD.is_touring_member,false)
     OR OLD.profile_id IS NULL THEN RETURN NULL; END IF;

  IF TG_OP='UPDATE' THEN
    IF NEW.band_id=OLD.band_id AND NEW.profile_id=OLD.profile_id
       AND COALESCE(NEW.member_status,'active')='active'
       AND NOT COALESCE(NEW.is_touring_member,false) THEN RETURN NULL; END IF;
  END IF;

  v_application := OLD.recruitment_application_id;
  IF v_application IS NULL THEN
    -- Legacy memberships: release only if exactly one accepted vacancy
    -- application identifies the departing character; do not guess a slot.
    SELECT CASE WHEN count(*)=1 THEN (array_agg(a.id))[1] END
    INTO v_application
    FROM public.band_applications a WHERE a.band_id=OLD.band_id
      AND a.applicant_profile_id=OLD.profile_id AND a.status='accepted'
      AND a.vacancy_id IS NOT NULL;
  END IF;
  IF v_application IS NULL THEN RETURN NULL; END IF;

  SELECT a.vacancy_id INTO v_vacancy FROM public.band_applications a
  WHERE a.id=v_application AND a.applicant_profile_id=OLD.profile_id
    AND a.band_id=OLD.band_id AND a.status='accepted';
  IF v_vacancy IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_b FROM public.bands b WHERE b.id=OLD.band_id FOR UPDATE;
  SELECT * INTO v_row FROM public.band_vacancies v
  WHERE v.id=v_vacancy AND v.band_id=OLD.band_id FOR UPDATE;
  IF NOT FOUND OR v_row.positions_filled=0 THEN RETURN NULL; END IF;

  -- Reopen only auto-filled adverts, and only when band capacity is not
  -- already reserved by another open advert. Manager-closed adverts stay closed.
  SELECT count(*) INTO v_active_members FROM public.band_members bm
  WHERE bm.band_id=OLD.band_id
    AND COALESCE(bm.member_status,'active')='active'
    AND NOT COALESCE(bm.is_touring_member,false);
  SELECT COALESCE(sum(GREATEST(v.positions_available-v.positions_filled,0)),0)
    INTO v_reserved FROM public.band_vacancies v
  WHERE v.band_id=OLD.band_id AND v.id<>v_vacancy AND v.status='open'
    AND (v.application_deadline IS NULL OR v.application_deadline>now());

  UPDATE public.band_vacancies v
  SET positions_filled=GREATEST(v.positions_filled-1,0),
      status=CASE
        WHEN v.status<>'filled' THEN v.status
        WHEN v.application_deadline IS NOT NULL AND v.application_deadline<=now() THEN 'expired'
        WHEN v_b.status='active'::public.band_status
          AND COALESCE(v_b.is_recruiting,false)
          AND COALESCE(v_b.allow_applications,true)
          AND v_active_members+v_reserved+(v.positions_available-GREATEST(v.positions_filled-1,0))
             <= COALESCE(v_b.max_members,4)
          THEN 'open'
        ELSE 'paused' END,
      updated_at=now()
  WHERE v.id=v_vacancy;

  -- One physical membership may have been restored/removed later; never
  -- decrement it a second time on a subsequent status change.
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS band_member_recruitment_slot_departure ON public.band_members;
CREATE TRIGGER band_member_recruitment_slot_departure
AFTER DELETE OR UPDATE OF band_id, profile_id, member_status, is_touring_member
ON public.band_members FOR EACH ROW EXECUTE FUNCTION public.release_departed_recruitment_slot();
REVOKE ALL ON FUNCTION public.release_departed_recruitment_slot() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.respond_band_application(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_band_application(uuid,text) TO authenticated;

COMMIT;
