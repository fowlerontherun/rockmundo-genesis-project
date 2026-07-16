CREATE OR REPLACE FUNCTION public.respond_band_application(application_id uuid, decision text)
 RETURNS band_applications
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    INSERT INTO public.band_members (band_id, profile_id, role, member_status, instrument_role)
    VALUES (v_app.band_id, v_app.applicant_profile_id, 'member', 'active', v_app.instrument_role)
    ON CONFLICT DO NOTHING;
  ELSE
    UPDATE public.band_applications
       SET status = 'rejected', responded_at = now()
     WHERE id = application_id
     RETURNING * INTO v_app;
  END IF;

  RETURN v_app;
END;
$function$;