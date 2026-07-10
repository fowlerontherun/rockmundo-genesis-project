ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'band_application_approved';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'band_application_rejected';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'band_application_response_denied';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'band_application_response_retry';

CREATE INDEX IF NOT EXISTS band_applications_band_status_created_idx
  ON public.band_applications (band_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS band_members_active_profile_band_idx
  ON public.band_members (profile_id, band_id)
  WHERE profile_id IS NOT NULL AND COALESCE(member_status, 'active') = 'active';

CREATE OR REPLACE FUNCTION public.can_manage_band_invitations(target_band_id uuid, actor_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_band_id IS NOT NULL
    AND actor_user_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.bands b WHERE b.id = target_band_id AND b.leader_id = actor_user_id)
      OR EXISTS (
        SELECT 1 FROM public.band_members bm
        WHERE bm.band_id = target_band_id
          AND bm.user_id = actor_user_id
          AND lower(bm.role) IN ('leader', 'founder')
          AND COALESCE(bm.member_status, 'active') = 'active'
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.respond_band_application(
  application_id uuid,
  decision text
)
RETURNS public.band_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile_id uuid;
  applicant_user_id uuid;
  application_row public.band_applications;
  normalized_decision text;
  final_status text;
  member_id uuid;
  band_name text;
  notification_title text;
  notification_message text;
BEGIN
  SELECT p.id INTO actor_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile before responding to band applications.' USING ERRCODE = '28000';
  END IF;
  IF application_id IS NULL THEN
    RAISE EXCEPTION 'Choose a valid band application.' USING ERRCODE = '22023';
  END IF;

  normalized_decision := lower(btrim(COALESCE(decision, '')));
  IF normalized_decision NOT IN ('approve', 'approved', 'accept', 'accepted', 'reject', 'rejected') THEN
    RAISE EXCEPTION 'Choose approve or reject for this band application.' USING ERRCODE = '22023';
  END IF;
  final_status := CASE WHEN normalized_decision IN ('approve', 'approved', 'accept', 'accepted') THEN 'accepted' ELSE 'rejected' END;

  SELECT * INTO application_row
  FROM public.band_applications ba
  WHERE ba.id = application_id
  FOR UPDATE;

  IF application_row.id IS NULL THEN
    RAISE EXCEPTION 'That band application could not be found.' USING ERRCODE = '22023';
  END IF;

  SELECT p.user_id INTO applicant_user_id
  FROM public.profiles p
  WHERE p.id = application_row.applicant_profile_id;

  IF applicant_user_id IS NULL THEN
    RAISE EXCEPTION 'That applicant profile could not be found.' USING ERRCODE = '22023';
  END IF;

  IF application_row.applicant_profile_id = actor_profile_id THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, application_row.applicant_profile_id, 'band_application_response_denied'::public.social_action_audit_kind, 'band_application', application_id, jsonb_build_object('reason', 'self_approval_guard'));
    RAISE EXCEPTION 'You cannot approve or reject your own band application.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_manage_band_invitations(application_row.band_id, auth.uid()) THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, application_row.applicant_profile_id, 'band_application_response_denied'::public.social_action_audit_kind, 'band_application', application_id, jsonb_build_object('reason', 'unauthorised_band_role'));
    RAISE EXCEPTION 'You are not allowed to respond to applications for this band.' USING ERRCODE = '42501';
  END IF;

  IF application_row.status = final_status THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, application_row.applicant_profile_id, 'band_application_response_retry'::public.social_action_audit_kind, 'band_application', application_id, jsonb_build_object('status', final_status));
    RETURN application_row;
  END IF;
  IF application_row.status <> 'pending' THEN
    RAISE EXCEPTION 'This band application is no longer pending.' USING ERRCODE = '22023';
  END IF;

  IF public.are_profiles_blocked(actor_profile_id, application_row.applicant_profile_id) THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, application_row.applicant_profile_id, 'band_application_response_denied'::public.social_action_audit_kind, 'band_application', application_id, jsonb_build_object('reason', 'block_guard'));
    RAISE EXCEPTION 'This application cannot be approved or rejected while one of you has blocked the other.' USING ERRCODE = '42501';
  END IF;

  IF final_status = 'accepted' THEN
    SELECT bm.id INTO member_id
    FROM public.band_members bm
    WHERE bm.band_id = application_row.band_id
      AND (bm.user_id = applicant_user_id OR bm.profile_id = application_row.applicant_profile_id)
      AND COALESCE(bm.member_status, 'active') = 'active'
    LIMIT 1;

    IF member_id IS NOT NULL THEN
      RAISE EXCEPTION 'That player already belongs to this band.' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.band_members (band_id, user_id, profile_id, role, instrument_role, vocal_role, member_status)
    VALUES (application_row.band_id, applicant_user_id, application_row.applicant_profile_id, 'member', application_row.instrument_role, application_row.vocal_role, 'active')
    ON CONFLICT (band_id, user_id) DO NOTHING
    RETURNING id INTO member_id;

    IF member_id IS NULL THEN
      SELECT bm.id INTO member_id
      FROM public.band_members bm
      WHERE bm.band_id = application_row.band_id
        AND bm.user_id = applicant_user_id
        AND COALESCE(bm.member_status, 'active') = 'active'
      LIMIT 1;
    END IF;
    IF member_id IS NULL THEN
      RAISE EXCEPTION 'Band membership could not be created.' USING ERRCODE = '23505';
    END IF;
  END IF;

  UPDATE public.band_applications
  SET status = final_status, responded_at = now()
  WHERE id = application_id
  RETURNING * INTO application_row;

  SELECT COALESCE(b.name, 'the band') INTO band_name FROM public.bands b WHERE b.id = application_row.band_id;
  notification_title := CASE WHEN final_status = 'accepted' THEN 'Band application approved' ELSE 'Band application declined' END;
  notification_message := CASE WHEN final_status = 'accepted'
    THEN 'You joined ' || band_name || '.'
    ELSE band_name || ' declined your band application.' END;

  INSERT INTO public.notifications(user_id, profile_id, category, type, title, message, action_path, metadata)
  SELECT applicant_user_id, application_row.applicant_profile_id, 'band', 'band_request', notification_title, notification_message,
    '/bands/' || application_row.band_id::text,
    jsonb_build_object('band_application_id', application_row.id, 'band_id', application_row.band_id, 'band_application_status', final_status)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = applicant_user_id
      AND n.type = 'band_request'
      AND n.metadata->>'band_application_id' = application_row.id::text
      AND n.metadata->>'band_application_status' = final_status
  );

  INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
  VALUES (actor_profile_id, application_row.applicant_profile_id,
    CASE WHEN final_status = 'accepted' THEN 'band_application_approved'::public.social_action_audit_kind ELSE 'band_application_rejected'::public.social_action_audit_kind END,
    'band_application', application_id, jsonb_build_object('band_id', application_row.band_id));

  RETURN application_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_band_application(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Leaders can respond to applications" ON public.band_applications;
DROP POLICY IF EXISTS "Band application responses use guarded RPC" ON public.band_applications;
CREATE POLICY "Band application responses use guarded RPC"
ON public.band_applications FOR UPDATE
USING (false)
WITH CHECK (false);
