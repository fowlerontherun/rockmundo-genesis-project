-- Media submissions belong to the authenticated account, not the active profile.
-- Supplying this default keeps inserts compatible with RLS even when a client
-- omits user_id, while the existing WITH CHECK policies still prevent spoofing.
ALTER TABLE public.newspaper_submissions
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.magazine_submissions
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.podcast_submissions
  ALTER COLUMN user_id SET DEFAULT auth.uid();
