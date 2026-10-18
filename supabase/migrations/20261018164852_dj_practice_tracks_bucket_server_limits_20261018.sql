-- Directly applied to production Supabase as migration 20261018164852.
-- Legacy stage-practice audio was admin-write-only but lacked Storage upload
-- limits: the frontend's 50 MiB/type checks can be bypassed via the API.
-- Preserve public reads, the existing admin-only RLS policies and all objects.
UPDATE storage.buckets
SET file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
      'audio/mpeg','audio/mp3','audio/x-mpeg',
      'audio/mp4','audio/x-m4a','audio/m4a',
      'audio/ogg','application/ogg',
      'audio/wav','audio/x-wav','audio/wave','audio/vnd.wave',
      'audio/webm'
    ]::text[]
WHERE id = 'practice-tracks';

DO $dj_bucket_limit_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'practice-tracks'
      AND public IS TRUE
      AND file_size_limit = 52428800
      AND 'audio/mpeg' = ANY(allowed_mime_types)
      AND 'audio/webm' = ANY(allowed_mime_types)
  ) THEN
    RAISE EXCEPTION 'Legacy DJ practice bucket limits were not applied';
  END IF;
END;
$dj_bucket_limit_check$;
