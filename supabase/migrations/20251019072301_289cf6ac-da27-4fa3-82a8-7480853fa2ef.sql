-- Convert completed songwriting projects into draft songs using the established
-- auth-user owner stored in songs.artist_id and the derived character profile.

ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

INSERT INTO public.songs (
  artist_id,
  profile_id,
  title,
  genre,
  lyrics,
  quality_score,
  song_rating,
  status,
  completed_at,
  songwriting_project_id,
  catalog_status,
  streams,
  revenue
)
SELECT
  sp.user_id,
  p.id,
  sp.title,
  COALESCE(sp.genres[1], 'Rock'),
  COALESCE(sp.initial_lyrics, ''),
  COALESCE(sp.quality_score, 50),
  COALESCE(sp.song_rating, 1),
  'draft',
  now(),
  sp.id,
  'private',
  0,
  0
FROM public.songwriting_projects sp
LEFT JOIN public.profiles p
  ON p.user_id = sp.user_id
WHERE sp.status IN ('completed', 'complete')
  AND NOT EXISTS (
    SELECT 1
    FROM public.songs s
    WHERE s.songwriting_project_id = sp.id
  );

NOTIFY pgrst, 'reload schema';
