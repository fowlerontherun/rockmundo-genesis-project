-- Top of the Pops presenter/band-name audio regression harness.
-- Runs entirely inside a transaction and leaves no test band, notification or audio row behind.
BEGIN;

DO $$
DECLARE
  v_admin uuid;
  v_leader uuid;
  v_band uuid;
  v_catalog jsonb;
  v_saved jsonb;
  v_unread integer;
BEGIN
  SELECT user_id INTO v_admin
  FROM public.user_roles
  WHERE role = 'admin'::public.app_role
  LIMIT 1;

  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'No admin available for TOTP audio harness';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);

  v_catalog := public.totp_admin_band_name_audio_catalog();
  IF jsonb_typeof(v_catalog) <> 'array' THEN
    RAISE EXCEPTION 'Band-name audio catalog must return a JSON array';
  END IF;

  SELECT leader_id INTO v_leader FROM public.bands LIMIT 1;
  IF v_leader IS NULL THEN
    RAISE EXCEPTION 'No existing band leader available for TOTP audio harness';
  END IF;

  INSERT INTO public.bands(name, leader_id)
  VALUES ('__TOTP_AUDIO_HARNESS__', v_leader)
  RETURNING id INTO v_band;

  SELECT count(*) INTO v_unread
  FROM public.notifications
  WHERE user_id = v_admin
    AND read_at IS NULL
    AND metadata->>'notification_kind' = 'totp_band_name_audio_required'
    AND metadata->>'band_id' = v_band::text;

  IF v_unread <> 1 THEN
    RAISE EXCEPTION 'Expected one admin band-name audio action, got %', v_unread;
  END IF;

  v_saved := public.totp_admin_save_band_name_audio(
    v_band,
    'https://example.invalid/test.wav',
    'band-names/test/test.wav',
    1200,
    repeat('a', 64)
  );

  IF v_saved->>'status' <> 'recorded' OR (v_saved->>'version')::integer <> 1 THEN
    RAISE EXCEPTION 'Band-name audio save did not return recorded v1';
  END IF;

  SELECT count(*) INTO v_unread
  FROM public.notifications
  WHERE user_id = v_admin
    AND read_at IS NULL
    AND metadata->>'notification_kind' = 'totp_band_name_audio_required'
    AND metadata->>'band_id' = v_band::text;

  IF v_unread <> 0 THEN
    RAISE EXCEPTION 'Saving band-name audio did not clear the admin action';
  END IF;
END
$$;

ROLLBACK;
