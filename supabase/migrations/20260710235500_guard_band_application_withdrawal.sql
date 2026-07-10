ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'band_application_withdrawn';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'band_application_withdraw_denied';

ALTER TABLE public.band_applications
  DROP CONSTRAINT IF EXISTS band_applications_status_check;
ALTER TABLE public.band_applications
  ADD CONSTRAINT band_applications_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn'));

CREATE OR REPLACE FUNCTION public.withdraw_band_application(application_id uuid)
RETURNS public.band_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile_id uuid;
  application_row public.band_applications;
BEGIN
  SELECT p.id INTO actor_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile before withdrawing band applications.' USING ERRCODE = '28000';
  END IF;
  IF application_id IS NULL THEN
    RAISE EXCEPTION 'Choose a valid band application.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO application_row
  FROM public.band_applications ba
  WHERE ba.id = application_id
  FOR UPDATE;

  IF application_row.id IS NULL THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, metadata)
    VALUES (actor_profile_id, 'band_application_withdraw_denied'::public.social_action_audit_kind, 'band_application', jsonb_build_object('reason', 'missing_application'));
    RAISE EXCEPTION 'That band application could not be found.' USING ERRCODE = '22023';
  END IF;

  IF application_row.applicant_profile_id <> actor_profile_id THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, application_row.applicant_profile_id, 'band_application_withdraw_denied'::public.social_action_audit_kind, 'band_application', application_id, jsonb_build_object('reason', 'not_applicant'));
    RAISE EXCEPTION 'You can only withdraw your own band applications.' USING ERRCODE = '42501';
  END IF;

  IF application_row.status = 'withdrawn' THEN
    RETURN application_row;
  END IF;

  IF application_row.status <> 'pending' THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, application_row.applicant_profile_id, 'band_application_withdraw_denied'::public.social_action_audit_kind, 'band_application', application_id, jsonb_build_object('reason', 'final_state', 'status', application_row.status));
    RAISE EXCEPTION 'Only pending band applications can be withdrawn.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.band_applications
  SET status = 'withdrawn', responded_at = now()
  WHERE id = application_id
  RETURNING * INTO application_row;

  UPDATE public.notifications n
  SET read_at = COALESCE(n.read_at, now()),
      metadata = COALESCE(n.metadata, '{}'::jsonb) || jsonb_build_object('band_application_status', 'withdrawn', 'actionable', false)
  WHERE n.type = 'band_request'
    AND n.metadata->>'band_application_id' = application_row.id::text;

  INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
  VALUES (actor_profile_id, application_row.applicant_profile_id, 'band_application_withdrawn'::public.social_action_audit_kind, 'band_application', application_id, jsonb_build_object('band_id', application_row.band_id));

  RETURN application_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.withdraw_band_application(uuid) TO authenticated;
