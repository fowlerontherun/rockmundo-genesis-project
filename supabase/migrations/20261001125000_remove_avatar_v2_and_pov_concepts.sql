-- Remove abandoned Avatar V2 authoring and POV video concept data from deployed databases.
-- Safe on environments where some or all objects were never created.

DROP TABLE IF EXISTS public.avatar_v2_authoring_reviews CASCADE;
DROP TABLE IF EXISTS public.pov_clip_templates CASCADE;

DELETE FROM storage.objects WHERE bucket_id IN ('avatar-v2-authoring', 'pov-clips');
DELETE FROM storage.buckets WHERE id IN ('avatar-v2-authoring', 'pov-clips');
