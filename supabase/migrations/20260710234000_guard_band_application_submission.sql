ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'band_application_submitted';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'band_application_submit_denied';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'band_application_submit_retry';

ALTER TABLE public.band_applications
  DROP CONSTRAINT IF EXISTS band_applications_band_id_applicant_profile_id_key;

ALTER TABLE public.band_applications
  DROP CONSTRAINT IF EXISTS band_applications_message_length;
ALTER TABLE public.band_applications
  ADD CONSTRAINT band_applications_message_length
  CHECK (message IS NULL OR (message = btrim(message) AND char_length(message) <= 500));

CREATE UNIQUE INDEX IF NOT EXISTS band_applications_one_pending_per_profile_band_idx
  ON public.band_applications (band_id, applicant_profile_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS band_applications_applicant_status_created_idx
  ON public.band_applications (applicant_profile_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.submit_band_application(
  band_id uuid,
  requested_role text DEFAULT 'Guitar',
  message text DEFAULT NULL
)
RETURNS public.band_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_band_id ALIAS FOR $1;
  raw_requested_role ALIAS FOR $2;
  raw_message ALIAS FOR $3;
  applicant_profile_id uuid;
  target_band public.bands;
  normalized_role text;
  trimmed_message text;
  existing_application public.band_applications;
  application_row public.band_applications;
  manager_record record;
BEGIN
  SELECT p.id INTO applicant_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF applicant_profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile before applying to bands.' USING ERRCODE = '28000';
  END IF;
  IF target_band_id IS NULL THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, metadata)
    VALUES (applicant_profile_id, 'band_application_submit_denied'::public.social_action_audit_kind, 'band', jsonb_build_object('reason', 'invalid_band'));
    RAISE EXCEPTION 'Choose a valid band before applying.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO target_band FROM public.bands b WHERE b.id = target_band_id;
  IF target_band.id IS NULL THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (applicant_profile_id, 'band_application_submit_denied'::public.social_action_audit_kind, 'band', target_band_id, jsonb_build_object('reason', 'missing_band'));
    RAISE EXCEPTION 'That band could not be found.' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(target_band.is_recruiting, false) THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (applicant_profile_id, 'band_application_submit_denied'::public.social_action_audit_kind, 'band', target_band_id, jsonb_build_object('reason', 'recruitment_closed'));
    RAISE EXCEPTION 'This band is not accepting applications right now.' USING ERRCODE = '22023';
  END IF;

  normalized_role := COALESCE(NULLIF(btrim(raw_requested_role), ''), 'Guitar');
  IF normalized_role NOT IN ('Guitar', 'Bass', 'Drums', 'Vocals', 'Keyboard', 'Rhythm Guitar', 'Lead Guitar', 'Saxophone', 'Trumpet', 'Violin', 'Other') THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (applicant_profile_id, 'band_application_submit_denied'::public.social_action_audit_kind, 'band', target_band_id, jsonb_build_object('reason', 'invalid_role'));
    RAISE EXCEPTION 'Choose a valid instrument role.' USING ERRCODE = '22023';
  END IF;

  trimmed_message := NULLIF(btrim(COALESCE(raw_message, '')), '');
  IF trimmed_message IS NOT NULL AND char_length(trimmed_message) > 500 THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (applicant_profile_id, 'band_application_submit_denied'::public.social_action_audit_kind, 'band', target_band_id, jsonb_build_object('reason', 'message_too_long'));
    RAISE EXCEPTION 'Band application messages must be 500 characters or fewer.' USING ERRCODE = '22023';
  END IF;
  IF trimmed_message IS NOT NULL AND trimmed_message <> regexp_replace(trimmed_message, '<[^>]*>', '', 'g') THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (applicant_profile_id, 'band_application_submit_denied'::public.social_action_audit_kind, 'band', target_band_id, jsonb_build_object('reason', 'html_message'));
    RAISE EXCEPTION 'Band application messages must be plain text.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = target_band_id
      AND (bm.profile_id = applicant_profile_id OR bm.user_id = auth.uid())
      AND COALESCE(bm.member_status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'You already belong to this band.' USING ERRCODE = '22023';
  END IF;

  FOR manager_record IN
    SELECT DISTINCT COALESCE(bm.profile_id, p.id) AS profile_id
    FROM public.band_members bm
    LEFT JOIN public.profiles p ON p.user_id = bm.user_id
    WHERE bm.band_id = target_band_id
      AND lower(bm.role) IN ('leader', 'founder')
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND COALESCE(bm.profile_id, p.id) IS NOT NULL
    UNION
    SELECT p.id FROM public.profiles p WHERE p.user_id = target_band.leader_id
  LOOP
    IF public.are_profiles_blocked(applicant_profile_id, manager_record.profile_id) THEN
      INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
      VALUES (applicant_profile_id, manager_record.profile_id, 'band_application_submit_denied'::public.social_action_audit_kind, 'band', target_band_id, jsonb_build_object('reason', 'block_guard'));
      RAISE EXCEPTION 'You cannot apply to this band while one of you has blocked the other.' USING ERRCODE = '42501';
    END IF;
  END LOOP;

  SELECT * INTO existing_application
  FROM public.band_applications ba
  WHERE ba.band_id = target_band_id AND ba.applicant_profile_id = applicant_profile_id AND ba.status = 'pending'
  ORDER BY ba.created_at DESC
  LIMIT 1;
  IF existing_application.id IS NOT NULL THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (applicant_profile_id, 'band_application_submit_retry'::public.social_action_audit_kind, 'band_application', existing_application.id, jsonb_build_object('band_id', target_band_id));
    RETURN existing_application;
  END IF;

  INSERT INTO public.band_applications (band_id, applicant_profile_id, instrument_role, vocal_role, message, status)
  VALUES (target_band_id, applicant_profile_id, normalized_role, NULL, trimmed_message, 'pending')
  RETURNING * INTO application_row;

  INSERT INTO public.notifications(user_id, profile_id, category, type, title, message, action_path, metadata)
  SELECT DISTINCT manager_user_id, manager_profile_id, 'band', 'band_request', 'New band application', 'A player applied to join ' || COALESCE(target_band.name, 'your band') || '.',
    '/bands/' || target_band_id::text || '?tab=applications',
    jsonb_build_object('band_application_id', application_row.id, 'band_id', target_band_id, 'applicant_profile_id', applicant_profile_id)
  FROM (
    SELECT bm.user_id AS manager_user_id, COALESCE(bm.profile_id, p.id) AS manager_profile_id
    FROM public.band_members bm
    LEFT JOIN public.profiles p ON p.user_id = bm.user_id
    WHERE bm.band_id = target_band_id
      AND lower(bm.role) IN ('leader', 'founder')
      AND COALESCE(bm.member_status, 'active') = 'active'
    UNION
    SELECT target_band.leader_id, p.id FROM public.profiles p WHERE p.user_id = target_band.leader_id
  ) managers
  WHERE manager_user_id IS NOT NULL
    AND manager_profile_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = manager_user_id
        AND n.type = 'band_request'
        AND n.metadata->>'band_application_id' = application_row.id::text
    );

  INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
  VALUES (applicant_profile_id, 'band_application_submitted'::public.social_action_audit_kind, 'band_application', application_row.id, jsonb_build_object('band_id', target_band_id, 'requested_role', normalized_role));

  RETURN application_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_band_application(uuid, text, text) TO authenticated;

DROP POLICY IF EXISTS "Users can apply to bands" ON public.band_applications;
DROP POLICY IF EXISTS "Band application submissions use guarded RPC" ON public.band_applications;
CREATE POLICY "Band application submissions use guarded RPC"
ON public.band_applications FOR INSERT TO authenticated
WITH CHECK (false);
