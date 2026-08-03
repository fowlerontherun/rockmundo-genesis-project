UPDATE public.songs s
SET profile_id = sp.profile_id
FROM public.songwriting_projects sp
WHERE s.songwriting_project_id = sp.id
  AND s.profile_id IS NULL
  AND sp.profile_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_song_profile_from_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.profile_id IS NULL AND NEW.songwriting_project_id IS NOT NULL THEN
    SELECT sp.profile_id INTO NEW.profile_id
    FROM public.songwriting_projects sp
    WHERE sp.id = NEW.songwriting_project_id;
  END IF;

  IF NEW.profile_id IS NULL AND NEW.parent_song_id IS NOT NULL THEN
    SELECT ps.profile_id INTO NEW.profile_id
    FROM public.songs ps
    WHERE ps.id = NEW.parent_song_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_song_profile_from_project ON public.songs;
CREATE TRIGGER trg_set_song_profile_from_project
BEFORE INSERT OR UPDATE OF songwriting_project_id, parent_song_id ON public.songs
FOR EACH ROW EXECUTE FUNCTION public.set_song_profile_from_project();

CREATE INDEX IF NOT EXISTS idx_songs_profile_id_created ON public.songs(profile_id, created_at DESC);