-- #4240 transition guard fixture: a legacy browser may not debit $75k
-- or insert an unpaid AI video, while the authorized reservation still works.
BEGIN;
CREATE TEMP TABLE video_legacy_guard_fixture AS
SELECT p.id profile_id,p.user_id,p.cash,
  (SELECT s.id FROM public.songs s WHERE s.user_id=p.user_id
    AND (s.profile_id IS NULL OR s.profile_id=p.id) ORDER BY id LIMIT 1) song_id
FROM public.profiles p
WHERE p.is_vip=true AND p.cash>=75000 AND p.is_active=true
 AND p.died_at IS NULL AND p.deleted_at IS NULL
 AND p.id=(SELECT q.id FROM public.profiles q WHERE q.user_id=p.user_id
   AND q.is_active=true AND q.died_at IS NULL ORDER BY q.updated_at DESC NULLS LAST,
     q.created_at DESC NULLS LAST,q.id LIMIT 1)
 AND EXISTS (SELECT 1 FROM public.songs s WHERE s.user_id=p.user_id
   AND (s.profile_id IS NULL OR s.profile_id=p.id)) LIMIT 1;
GRANT SELECT ON video_legacy_guard_fixture TO authenticated;
SELECT set_config('request.jwt.claim.sub',
 (SELECT user_id::text FROM video_legacy_guard_fixture),true);
SET LOCAL ROLE authenticated;
DO $guard$
DECLARE v_profile uuid; v_song uuid;
BEGIN
 SELECT profile_id,song_id INTO v_profile,v_song FROM video_legacy_guard_fixture;
 IF v_profile IS NULL OR v_song IS NULL THEN RAISE EXCEPTION 'Missing fixture'; END IF;
 BEGIN
   UPDATE public.profiles SET cash=cash-75000 WHERE id=v_profile;
   RAISE EXCEPTION 'Untrusted cash debit accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'AI_VIDEO_SECURE_RESERVATION_REQUIRED' THEN RAISE; END IF;
 END;
 BEGIN
   INSERT INTO public.music_videos(song_id,title,budget,production_quality,status,description)
    VALUES(v_song,'Blocked legacy video',75000,95,'planning','{"ai_generated":true}');
   RAISE EXCEPTION 'Untrusted video insert accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'AI_VIDEO_SECURE_RESERVATION_REQUIRED' THEN RAISE; END IF;
 END;
END;
$guard$;
CREATE TEMP TABLE video_secure_reservation AS
SELECT public.reserve_music_video_generation(
 (SELECT song_id FROM video_legacy_guard_fixture),
 'Protected reservation from old UI transition',
 '{"ai_generated":true}'::jsonb,
 'b1510000-0000-4000-8000-000000004240'::uuid
) result;
RESET ROLE;
SELECT
 (SELECT count(*)=1 FROM video_legacy_guard_fixture) AS fixture_present,
 (SELECT result->>'video_id' IS NOT NULL FROM video_secure_reservation) AS trusted_reservation_works,
 (SELECT p.cash=f.cash-75000 FROM public.profiles p JOIN video_legacy_guard_fixture f
  ON f.profile_id=p.id) AS only_protected_charge_applied,
 (SELECT count(*)=1 FROM public.music_video_generation_attempts
  WHERE id='b1510000-0000-4000-8000-000000004240'::uuid
  AND charge_amount=75000) AS audit_charge_created,
 (SELECT count(*)=1 FROM public.music_videos
  WHERE title='Protected reservation from old UI transition') AS only_verified_video_inserted;
ROLLBACK;
