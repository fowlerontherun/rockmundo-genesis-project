-- Keep the intake bucket private while allowing checksum-verified source extraction.
UPDATE storage.buckets SET allowed_mime_types = ARRAY[
  'application/zip', 'application/x-zip-compressed', 'application/octet-stream',
  'model/gltf-binary', 'image/png', 'application/json', 'text/plain'
] WHERE id = 'avatar-v2-authoring';
GRANT SELECT ON public.avatar_v2_authoring_reviews TO authenticated;
