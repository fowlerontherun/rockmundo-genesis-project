-- Phase 3: run with an owner connection against an environment that has
-- one recorded/audio song belonging to a normal user's current profile.
-- All test writes ROLLBACK; never grant payment/XP in this test.
\set ON_ERROR_STOP on
BEGIN;

SELECT set_config('request.jwt.claim.sub', (
 SELECT s.user_id::text
 FROM public.songs s
 JOIN public.profiles p ON p.id=s.profile_id AND p.user_id=s.user_id
 JOIN public.user_roles ur ON ur.user_id=s.user_id AND ur.role='user'::public.app_role
 WHERE s.audio_url IS NOT NULL AND s.status='recorded' LIMIT 1
), true);
SET LOCAL ROLE authenticated;

DO $setlist$
DECLARE
  v_actor uuid := auth.uid();
  v_profile uuid;
  v_song uuid;
  v_saved uuid;
  v_version integer;
  v_other uuid;
  v_unshared uuid;
BEGIN
  SELECT s.profile_id,s.id INTO v_profile,v_song
  FROM public.songs s
  WHERE s.user_id=v_actor AND s.audio_url IS NOT NULL AND s.status='recorded'
  LIMIT 1;
  IF v_actor IS NULL OR v_profile IS NULL THEN
    RAISE EXCEPTION 'Missing normal-player profile with recorded audio';
  END IF;

  INSERT INTO public.dj_setlists(user_id,profile_id,name,items)
  VALUES(v_actor,v_profile,'DJ SQL rehearsal fixture',
    jsonb_build_array(jsonb_build_object('source','game','id',v_song)))
  RETURNING id,version INTO v_saved,v_version;
  IF v_version<>1 THEN RAISE EXCEPTION 'Expected version 1'; END IF;

  UPDATE public.dj_setlists SET name='DJ SQL fixture v2' WHERE id=v_saved
  RETURNING version INTO v_version;
  IF v_version<>2 THEN RAISE EXCEPTION 'Version did not increment'; END IF;

  BEGIN
    UPDATE public.dj_setlists SET items='[{"source":"admin","id":"11111111-1111-1111-1111-111111111111"}]'
      WHERE id=v_saved;
    RAISE EXCEPTION 'SECURITY FAILURE: unavailable admin track was saved';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE public.dj_setlists SET items='[{"source":"hacked","id":"11111111-1111-1111-1111-111111111111"}]'
      WHERE id=v_saved;
    RAISE EXCEPTION 'SECURITY FAILURE: unknown source was saved';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  BEGIN
    UPDATE public.dj_setlists SET items='[]'::jsonb WHERE id=v_saved;
    RAISE EXCEPTION 'SECURITY FAILURE: empty DJ set was saved';
  EXCEPTION WHEN check_violation OR invalid_parameter_value THEN NULL;
  END;

  SELECT id INTO v_other FROM public.profiles WHERE user_id<>v_actor LIMIT 1;
  IF v_other IS NULL THEN RAISE EXCEPTION 'Missing cross-account profile fixture'; END IF;
  BEGIN
    INSERT INTO public.dj_setlists(user_id,profile_id,name,items)
    VALUES(v_actor,v_other,'Unauthorized DJ set',
      jsonb_build_array(jsonb_build_object('source','game','id',v_song)));
    RAISE EXCEPTION 'SECURITY FAILURE: cross-account profile created';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE public.dj_setlists SET profile_id=v_other WHERE id=v_saved;
    RAISE EXCEPTION 'SECURITY FAILURE: set ownership changed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  SELECT s.id INTO v_unshared FROM public.songs s
  WHERE s.user_id <> v_actor AND s.audio_url IS NOT NULL AND s.status='recorded'
    AND s.dj_use_allowed = false LIMIT 1;
  IF v_unshared IS NOT NULL THEN
    BEGIN
      UPDATE public.dj_setlists SET items=jsonb_build_array(
        jsonb_build_object('source','game','id',v_unshared)) WHERE id=v_saved;
      RAISE EXCEPTION 'SECURITY FAILURE: non-opted-in song saved';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END IF;

  IF (SELECT version FROM public.dj_setlists WHERE id=v_saved) <> 2 THEN
    RAISE EXCEPTION 'Failed save unexpectedly incremented revision';
  END IF;
END $setlist$;
ROLLBACK;
