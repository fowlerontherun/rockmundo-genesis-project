-- Reconcile the profile-facing song owner reference from the authoritative
-- auth-user owner stored in songs.artist_id.

ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS rating_revealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_activity text;

UPDATE public.songs s
SET profile_id = p.id
FROM public.profiles p
WHERE s.artist_id = p.user_id
  AND s.profile_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_songs_profile_id
  ON public.songs (profile_id);

NOTIFY pgrst, 'reload schema';
