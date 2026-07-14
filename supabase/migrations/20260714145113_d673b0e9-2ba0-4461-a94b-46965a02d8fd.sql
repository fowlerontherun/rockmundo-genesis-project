CREATE OR REPLACE FUNCTION public.submit_band_application(band_id uuid, requested_role text, message text DEFAULT NULL::text)
RETURNS band_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_profile_id uuid;
  v_band_id uuid := band_id;
  v_message text := message;
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

  SELECT * INTO v_band FROM public.bands WHERE id = v_band_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Band not found';
  END IF;
  IF COALESCE(v_band.is_recruiting, false) = false THEN
    RAISE EXCEPTION 'This band is not currently recruiting';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = v_band.id AND bm.profile_id = v_profile_id
      AND COALESCE(bm.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'You are already a member of this band';
  END IF;

  SELECT * INTO v_existing FROM public.band_applications ba
  WHERE ba.band_id = v_band.id AND ba.applicant_profile_id = v_profile_id AND ba.status = 'pending'
  LIMIT 1;
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.band_applications (band_id, applicant_profile_id, instrument_role, message, status)
  VALUES (v_band.id, v_profile_id, requested_role, NULLIF(btrim(v_message), ''), 'pending')
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;