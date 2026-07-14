
CREATE OR REPLACE FUNCTION public.submit_band_application(
  band_id uuid,
  requested_role text,
  message text DEFAULT NULL
) RETURNS public.band_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile_id uuid;
  v_band public.bands%ROWTYPE;
  v_existing public.band_applications%ROWTYPE;
  v_result public.band_applications%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_uid ORDER BY created_at LIMIT 1;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  SELECT * INTO v_band FROM public.bands WHERE id = band_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Band not found';
  END IF;
  IF COALESCE(v_band.is_recruiting, false) = false THEN
    RAISE EXCEPTION 'This band is not currently recruiting';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.band_members
    WHERE band_id = v_band.id AND profile_id = v_profile_id
      AND COALESCE(is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'You are already a member of this band';
  END IF;

  -- Idempotent: return existing pending application if present
  SELECT * INTO v_existing FROM public.band_applications
  WHERE band_id = v_band.id AND applicant_profile_id = v_profile_id AND status = 'pending'
  LIMIT 1;
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.band_applications (band_id, applicant_profile_id, instrument_role, message, status)
  VALUES (v_band.id, v_profile_id, requested_role, NULLIF(btrim(message), ''), 'pending')
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_band_application(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.withdraw_band_application(application_id uuid)
RETURNS public.band_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile_id uuid;
  v_app public.band_applications%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_uid ORDER BY created_at LIMIT 1;

  SELECT * INTO v_app FROM public.band_applications WHERE id = application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF v_app.applicant_profile_id <> v_profile_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_app.status <> 'pending' THEN
    RETURN v_app;
  END IF;

  UPDATE public.band_applications
     SET status = 'withdrawn', responded_at = now()
   WHERE id = application_id
   RETURNING * INTO v_app;
  RETURN v_app;
END;
$$;

GRANT EXECUTE ON FUNCTION public.withdraw_band_application(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_band_application(application_id uuid, decision text)
RETURNS public.band_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile_id uuid;
  v_app public.band_applications%ROWTYPE;
  v_band public.bands%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  IF decision NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_uid ORDER BY created_at LIMIT 1;

  SELECT * INTO v_app FROM public.band_applications WHERE id = application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF v_app.status <> 'pending' THEN RETURN v_app; END IF;

  SELECT * INTO v_band FROM public.bands WHERE id = v_app.band_id;
  IF v_band.leader_id <> v_profile_id THEN
    RAISE EXCEPTION 'Only the band leader can respond to applications';
  END IF;

  IF decision = 'approve' THEN
    UPDATE public.band_applications
       SET status = 'accepted', responded_at = now()
     WHERE id = application_id
     RETURNING * INTO v_app;

    INSERT INTO public.band_members (band_id, profile_id, role, is_active, instrument_role)
    VALUES (v_app.band_id, v_app.applicant_profile_id, 'member', true, v_app.instrument_role)
    ON CONFLICT DO NOTHING;
  ELSE
    UPDATE public.band_applications
       SET status = 'rejected', responded_at = now()
     WHERE id = application_id
     RETURNING * INTO v_app;
  END IF;

  RETURN v_app;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_band_application(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
