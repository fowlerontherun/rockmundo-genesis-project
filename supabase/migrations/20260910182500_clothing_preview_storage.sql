-- Public generated clothing previews. Writes remain admin-only.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clothing-previews',
  'clothing-previews',
  true,
  3145728,
  ARRAY['image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 3145728,
  allowed_mime_types = ARRAY['image/webp'];

DROP POLICY IF EXISTS "Public read clothing previews" ON storage.objects;
CREATE POLICY "Public read clothing previews"
ON storage.objects FOR SELECT
USING (bucket_id = 'clothing-previews');

DROP POLICY IF EXISTS "Admins upload clothing previews" ON storage.objects;
CREATE POLICY "Admins upload clothing previews"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'clothing-previews'
  AND public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Admins update clothing previews" ON storage.objects;
CREATE POLICY "Admins update clothing previews"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'clothing-previews'
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'clothing-previews'
  AND public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Admins delete clothing previews" ON storage.objects;
CREATE POLICY "Admins delete clothing previews"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'clothing-previews'
  AND public.has_role(auth.uid(), 'admin')
);
