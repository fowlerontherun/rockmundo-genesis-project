-- Confirm Storage enforces the same 50 MiB and audio-only rules as
-- src/features/nightclub-dj/practiceTrackAudio.ts, after a local DB reset.
BEGIN;
DO $test$
DECLARE
 v_bucket storage.buckets%ROWTYPE;
BEGIN
 SELECT * INTO v_bucket FROM storage.buckets WHERE id='practice-tracks';
 IF NOT FOUND OR v_bucket.public IS DISTINCT FROM TRUE
    OR v_bucket.file_size_limit <> 52428800 THEN
   RAISE EXCEPTION 'Practice bucket accessibility or size limit drift';
 END IF;

 IF v_bucket.allowed_mime_types IS NULL OR NOT (
     ARRAY['audio/mpeg','audio/mp3','audio/x-mpeg',
       'audio/mp4','audio/x-m4a','audio/m4a',
       'audio/ogg','application/ogg','audio/wav','audio/x-wav',
       'audio/wave','audio/vnd.wave','audio/webm']::text[]
     <@ v_bucket.allowed_mime_types
   ) OR 'text/html'=ANY(v_bucket.allowed_mime_types)
 THEN RAISE EXCEPTION 'Practice bucket MIME whitelist drift'; END IF;

 IF NOT EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname='storage'
    AND tablename='objects' AND policyname='Admins upload practice tracks'
    AND cmd='INSERT' AND with_check ILIKE '%has_role%'
 ) THEN RAISE EXCEPTION 'Practice track storage write policy lost'; END IF;
END;
$test$;
ROLLBACK;
