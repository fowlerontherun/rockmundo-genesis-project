-- Private, admin-only intake for unvalidated Avatar V2 authoring archives.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatar-v2-authoring', 'avatar-v2-authoring', false, 52428800, ARRAY['application/zip','application/x-zip-compressed','application/octet-stream'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar V2 admins upload authoring archives"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatar-v2-authoring' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Avatar V2 admins read authoring archives"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatar-v2-authoring' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Avatar V2 admins remove authoring archives"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatar-v2-authoring' AND public.has_role(auth.uid(), 'admin'));
