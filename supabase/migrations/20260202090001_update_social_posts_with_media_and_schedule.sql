-- Add support for media uploads and scheduling to social posts

-- Ensure a public storage bucket exists for social post media
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('social-posts', 'social-posts', true);
EXCEPTION
  WHEN unique_violation THEN
    NULL;
END;
$$;

UPDATE storage.buckets
SET public = true
WHERE id = 'social-posts';

-- Refresh storage policies for the social post media bucket
DROP POLICY IF EXISTS "Social post media are publicly accessible" ON storage.objects;
CREATE POLICY "Social post media are publicly accessible"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'social-posts');

DROP POLICY IF EXISTS "Users can upload social post media" ON storage.objects;
CREATE POLICY "Users can upload social post media"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'social-posts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update social post media" ON storage.objects;
CREATE POLICY "Users can update social post media"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'social-posts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can remove social post media" ON storage.objects;
CREATE POLICY "Users can remove social post media"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'social-posts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Extend the social_posts table with media metadata and scheduling
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS media_path text,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

-- Constrain media_type to known formats when provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.social_posts'::regclass
      AND conname = 'social_posts_media_type_check'
  ) THEN
    ALTER TABLE public.social_posts
      ADD CONSTRAINT social_posts_media_type_check
        CHECK (media_type IN ('image', 'video'));
  END IF;
END;
$$;

-- Index scheduled posts per user for quicker lookups
CREATE INDEX IF NOT EXISTS social_posts_user_scheduled_idx
  ON public.social_posts (user_id, scheduled_for);
