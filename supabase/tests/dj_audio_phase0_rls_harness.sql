-- DJ Phase 0 permission gate.
-- Run using a database owner/service connection with real admin and normal
-- user roles seeded; every fixture is rolled back. No Storage object is deleted
-- directly (Supabase Storage prohibits direct SQL deletes).
\set ON_ERROR_STOP on

BEGIN;

DO $setup$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin'::public.app_role)
    OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role='user'::public.app_role)
 THEN RAISE EXCEPTION 'Seed one admin and one normal user before DJ RLS testing'; END IF;
 IF to_regclass('public.dj_audio_tracks') IS NULL
    OR NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='dj-tracks' AND public = false)
 THEN RAISE EXCEPTION 'DJ Phase 0 catalogue/bucket is not deployed'; END IF;
END $setup$;

-- Temporary active and inactive DJ records for row visibility assertions.
INSERT INTO public.dj_audio_tracks(id,title,artist,genre,storage_path,uploaded_by,rights_confirmed,rights_notes,is_active)
SELECT '11111111-1111-1111-1111-111111111114'::uuid, 'PHASE0 ACTIVE', 'Fixture DJ', 'House',
 'catalog/11111111-1111-1111-1111-111111111114/track.mp3', user_id, true, 'Fixture', true
FROM public.user_roles WHERE role='admin'::public.app_role LIMIT 1;

INSERT INTO public.dj_audio_tracks(id,title,artist,genre,storage_path,uploaded_by,rights_confirmed,rights_notes,is_active)
SELECT '11111111-1111-1111-1111-111111111115'::uuid, 'PHASE0 INACTIVE', 'Fixture DJ', 'House',
 'catalog/11111111-1111-1111-1111-111111111115/track.mp3', user_id, true, 'Fixture', false
FROM public.user_roles WHERE role='admin'::public.app_role LIMIT 1;

INSERT INTO public.practice_track_audio(track_id,track_title,genre,audio_url)
VALUES('dj-phase0-rls-fixture','PHASE0 Fixture','House','https://example.invalid/fixture.mp3');

-- Storage test objects are created by the privileged harness transaction;
-- an ordinary player must not be able to replace or remove either object.
INSERT INTO storage.objects(bucket_id,name)
VALUES ('practice-tracks','dj-phase0-protected-practice.mp3'),
       ('dj-tracks','catalog/11111111-1111-1111-1111-111111111118/track.mp3');

SELECT set_config('request.jwt.claim.sub',
 (SELECT user_id::text FROM public.user_roles WHERE role='user'::public.app_role LIMIT 1), true);
SET LOCAL ROLE authenticated;

DO $user$
DECLARE actor uuid := (SELECT auth.uid());
DECLARE n int;
BEGIN
 IF actor IS NULL OR public.has_role(actor,'admin'::public.app_role)
 THEN RAISE EXCEPTION 'Invalid non-admin test actor'; END IF;

 SELECT count(*) INTO n FROM public.dj_audio_tracks WHERE title='PHASE0 ACTIVE';
 IF n <> 1 THEN RAISE EXCEPTION 'Player cannot see cleared active DJ track'; END IF;
 SELECT count(*) INTO n FROM public.dj_audio_tracks WHERE title='PHASE0 INACTIVE';
 IF n <> 0 THEN RAISE EXCEPTION 'SECURITY FAILURE: player sees inactive DJ track'; END IF;

 BEGIN
  INSERT INTO public.dj_audio_tracks(title,artist,genre,storage_path,uploaded_by)
  VALUES('UNAUTHORIZED','Fixture DJ','House','catalog/11111111-1111-1111-1111-111111111116/track.mp3',actor);
  RAISE EXCEPTION 'SECURITY FAILURE: player can insert DJ catalogue';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;

 BEGIN
  INSERT INTO public.practice_track_audio(track_id,track_title,genre,audio_url)
  VALUES('dj-unauthorized','UNAUTHORIZED','House','https://example.invalid/fixture.mp3');
  RAISE EXCEPTION 'SECURITY FAILURE: player can insert practice track';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;

 UPDATE public.dj_audio_tracks SET title='UNAUTHORIZED' WHERE title='PHASE0 ACTIVE';
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n <> 0 THEN RAISE EXCEPTION 'SECURITY FAILURE: player can update DJ catalogue'; END IF;

 DELETE FROM public.dj_audio_tracks WHERE title='PHASE0 ACTIVE';
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n <> 0 THEN RAISE EXCEPTION 'SECURITY FAILURE: player can delete DJ catalogue'; END IF;

 UPDATE public.practice_track_audio SET track_title='UNAUTHORIZED' WHERE track_id='dj-phase0-rls-fixture';
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n <> 0 THEN RAISE EXCEPTION 'SECURITY FAILURE: player can update practice track'; END IF;

 DELETE FROM public.practice_track_audio WHERE track_id='dj-phase0-rls-fixture';
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n <> 0 THEN RAISE EXCEPTION 'SECURITY FAILURE: player can delete practice track'; END IF;

 BEGIN
  INSERT INTO storage.objects(bucket_id,name)
  VALUES('dj-tracks','catalog/11111111-1111-1111-1111-111111111116/track.mp3');
  RAISE EXCEPTION 'SECURITY FAILURE: player can insert DJ audio';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;

 BEGIN
  INSERT INTO storage.objects(bucket_id,name)
  VALUES('practice-tracks','dj-phase0-unauthorized.mp3');
  RAISE EXCEPTION 'SECURITY FAILURE: player can insert practice audio';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;

 -- Storage upserts require UPDATE; absence of this test allowed the initial
 -- public practice bucket to remain writable even after UI route hardening.
 BEGIN
  UPDATE storage.objects SET name='dj-phase0-unauthorized-replace.mp3'
  WHERE bucket_id='practice-tracks' AND name='dj-phase0-protected-practice.mp3';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'SECURITY FAILURE: player can replace practice audio'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id='practice-tracks' AND name='dj-phase0-protected-practice.mp3';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'SECURITY FAILURE: player can remove practice audio'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  UPDATE storage.objects SET name='catalog/11111111-1111-1111-1111-111111111118/replaced.mp3'
  WHERE bucket_id='dj-tracks' AND name='catalog/11111111-1111-1111-1111-111111111118/track.mp3';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'SECURITY FAILURE: player can replace DJ club audio'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id='dj-tracks' AND name='catalog/11111111-1111-1111-1111-111111111118/track.mp3';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'SECURITY FAILURE: player can remove DJ club audio'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $user$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub',
 (SELECT user_id::text FROM public.user_roles WHERE role='admin'::public.app_role LIMIT 1), true);
SET LOCAL ROLE authenticated;

DO $admin$
DECLARE actor uuid := (SELECT auth.uid());
DECLARE n int;
BEGIN
 IF NOT public.has_role(actor,'admin'::public.app_role)
 THEN RAISE EXCEPTION 'Invalid admin fixture'; END IF;
 SELECT count(*) INTO n FROM public.dj_audio_tracks WHERE title='PHASE0 INACTIVE';
 IF n <> 1 THEN RAISE EXCEPTION 'Admin must see unpublished catalogue rows'; END IF;
 INSERT INTO public.dj_audio_tracks(id,title,artist,genre,storage_path,uploaded_by,rights_confirmed,rights_notes,is_active)
 VALUES('11111111-1111-1111-1111-111111111117','PHASE0 ADMIN', 'Fixture DJ','House',
 'catalog/11111111-1111-1111-1111-111111111117/track.mp3',actor,true,'Fixture',true);
 UPDATE public.dj_audio_tracks SET title='PHASE0 ADMIN UPDATED'
 WHERE id='11111111-1111-1111-1111-111111111117';
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n <> 1 THEN RAISE EXCEPTION 'Admin DJ update must work'; END IF;
 INSERT INTO storage.objects(bucket_id,name)
 VALUES('dj-tracks','catalog/11111111-1111-1111-1111-111111111117/track.mp3');
 INSERT INTO storage.objects(bucket_id,name)
 VALUES('practice-tracks','dj-phase0-admin.mp3');
 UPDATE public.practice_track_audio SET track_title='PHASE0 ADMIN UPDATED'
 WHERE track_id='dj-phase0-rls-fixture';
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n <> 1 THEN RAISE EXCEPTION 'Admin must be able to update practice metadata'; END IF;
 DELETE FROM public.practice_track_audio WHERE track_id='dj-phase0-rls-fixture';
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n <> 1 THEN RAISE EXCEPTION 'Admin must be able to remove practice metadata'; END IF;
END $admin$;


-- Use an existing song owned by an auth user to check genuine creator consent.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',
 (SELECT s.user_id::text FROM public.songs s
  WHERE s.audio_url IS NOT NULL AND s.user_id IS NOT NULL LIMIT 1), true);
SET LOCAL ROLE authenticated;
DO $owner$
DECLARE target_song uuid;
DECLARE changed integer;
BEGIN
 IF auth.uid() IS NOT NULL THEN
  SELECT s.id INTO target_song FROM public.songs s
  WHERE s.user_id=auth.uid() AND s.audio_url IS NOT NULL LIMIT 1;
  IF target_song IS NOT NULL THEN
   UPDATE public.songs SET dj_use_allowed=NOT dj_use_allowed WHERE id=target_song;
   GET DIAGNOSTICS changed=ROW_COUNT;
   IF changed<>1 THEN RAISE EXCEPTION 'Song owner should be able to change DJ consent'; END IF;
  END IF;
 END IF;
END $owner$;

-- Existing band-member RLS is intentionally broader than song-consent rights.
-- A collaborator must not alter user_id then grant themselves DJ use.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',
 (SELECT bm.user_id::text FROM public.songs s
  JOIN public.band_members bm ON bm.band_id=s.band_id AND bm.user_id <> s.user_id
  WHERE s.audio_url IS NOT NULL AND bm.member_status='active' LIMIT 1), true);
SET LOCAL ROLE authenticated;
DO $collaborator$
DECLARE target_song uuid;
DECLARE changed integer;
BEGIN
 IF auth.uid() IS NULL THEN RETURN; END IF;
 SELECT s.id INTO target_song FROM public.songs s
 JOIN public.band_members bm ON bm.band_id=s.band_id
 WHERE bm.user_id=auth.uid() AND s.user_id<>auth.uid() AND s.audio_url IS NOT NULL
 LIMIT 1;
 IF target_song IS NULL THEN RETURN; END IF;
 BEGIN
  UPDATE public.songs SET user_id=auth.uid() WHERE id=target_song;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed>0 THEN RAISE EXCEPTION 'SECURITY FAILURE: collaborator stole song ownership'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  UPDATE public.songs SET dj_use_allowed=NOT dj_use_allowed WHERE id=target_song;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed>0 THEN RAISE EXCEPTION 'SECURITY FAILURE: collaborator changed DJ consent'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $collaborator$;

ROLLBACK;
