-- Persist review of private Avatar V2 authoring archives. Never promotes assets to runtime.
CREATE TABLE IF NOT EXISTS public.avatar_v2_authoring_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key text NOT NULL UNIQUE CHECK (storage_key ~ '^incoming/[a-f0-9-]{36}-[A-Za-z0-9._-]+[.]zip$'),
  archive_sha256 text NOT NULL CHECK (archive_sha256 ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'source_verified' CHECK (status IN ('source_verified','rejected')),
  source_file_count integer NOT NULL CHECK (source_file_count BETWEEN 0 AND 100),
  glb_model_count integer NOT NULL CHECK (glb_model_count BETWEEN 0 AND 100),
  review_notes text NOT NULL DEFAULT '',
  validated_by uuid NOT NULL REFERENCES auth.users(id),
  validated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.avatar_v2_authoring_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Avatar V2 admins read source reviews" ON public.avatar_v2_authoring_reviews;
CREATE POLICY "Avatar V2 admins read source reviews"
  ON public.avatar_v2_authoring_reviews FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
-- No client-side write policy: only the authenticated validation function, after
-- checking the caller's admin role through the private storage bucket, writes reviews.
