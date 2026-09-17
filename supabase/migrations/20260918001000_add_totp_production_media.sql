-- Top of the Pops production media + read-only demo song audio.
-- Public bucket is for programme assets only; writes remain admin-only.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'totp-media',
  'totp-media',
  true,
  52428800,
  ARRAY[
    'video/webm','video/mp4',
    'audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/webm','audio/mp4'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "TOTP admins can view media objects" ON storage.objects;
CREATE POLICY "TOTP admins can view media objects"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'totp-media'
  AND public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "TOTP admins can upload media objects" ON storage.objects;
CREATE POLICY "TOTP admins can upload media objects"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'totp-media'
  AND public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "TOTP admins can update media objects" ON storage.objects;
CREATE POLICY "TOTP admins can update media objects"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'totp-media'
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'totp-media'
  AND public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "TOTP admins can delete media objects" ON storage.objects;
CREATE POLICY "TOTP admins can delete media objects"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'totp-media'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE OR REPLACE FUNCTION public.totp_admin_test_song_audio(p_song_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT coalesce(
    jsonb_object_agg(
      s.id::text,
      jsonb_build_object(
        'audio_url', s.audio_url,
        'extended_audio_url', s.extended_audio_url,
        'audio_generation_status', s.audio_generation_status,
        'duration_seconds', s.duration_seconds
      )
    ),
    '{}'::jsonb
  )
  INTO v_result
  FROM public.songs s
  WHERE s.id = ANY(coalesce(p_song_ids, ARRAY[]::uuid[]));

  RETURN coalesce(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_test_song_audio(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_admin_test_song_audio(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.totp_admin_test_song_audio(uuid[]) IS
  'Admin-only read-only song audio lookup used by the Top of the Pops dry-run viewer.';
