-- 1. Fix song creation trigger: resolve band by the writing CHARACTER (profile), not the account
CREATE OR REPLACE FUNCTION public.create_song_from_completed_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_song_id uuid;
  duration_seconds int;
  song_quality int;
  song_genre text;
  project_band_id uuid;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT id INTO existing_song_id FROM public.songs WHERE songwriting_project_id = NEW.id;

    IF existing_song_id IS NULL THEN
      duration_seconds := 180 + floor(random() * 120)::int;

      song_quality := LEAST(1000, GREATEST(50,
        COALESCE(NEW.quality_score, 50) + floor(random() * 50)::int - 25
      ));

      song_genre := COALESCE(NEW.creative_brief->>'genre', NEW.genres[1], 'Rock');

      -- Resolve the band of the CHARACTER that wrote the song
      IF NEW.profile_id IS NOT NULL THEN
        SELECT b.id INTO project_band_id
        FROM public.bands b
        JOIN public.band_members bm ON bm.band_id = b.id
        WHERE bm.profile_id = NEW.profile_id
          AND COALESCE(bm.member_status, 'active') = 'active'
          AND COALESCE(bm.is_touring_member, false) = false
          AND b.status = 'active'
        ORDER BY (bm.role IN ('leader', 'Founder')) DESC, bm.joined_at ASC
        LIMIT 1;
      END IF;

      INSERT INTO public.songs (
        user_id, profile_id, band_id, title, genre, duration_seconds,
        quality_score, songwriting_project_id, status, lyrics,
        ownership_type, added_to_repertoire_at, added_to_repertoire_by, created_at
      ) VALUES (
        NEW.user_id, NEW.profile_id, project_band_id, NEW.title, song_genre, duration_seconds,
        song_quality, NEW.id, 'draft',
        COALESCE(NEW.lyrics, NEW.creative_brief->>'lyrics'),
        CASE WHEN project_band_id IS NULL THEN 'personal' ELSE 'band' END,
        CASE WHEN project_band_id IS NULL THEN NULL ELSE now() END,
        CASE WHEN project_band_id IS NULL THEN NULL ELSE NEW.user_id END,
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Any active band member can contribute one of their own songs to the band repertoire
CREATE OR REPLACE FUNCTION public.contribute_song_to_band(
  p_song_id uuid,
  p_band_id uuid,
  p_profile_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_song record;
  v_member record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT * INTO v_song FROM public.songs WHERE id = p_song_id;
  IF v_song IS NULL THEN
    RAISE EXCEPTION 'SONG_NOT_FOUND';
  END IF;

  IF v_song.user_id <> v_uid THEN
    RAISE EXCEPTION 'NOT_SONG_OWNER';
  END IF;

  SELECT bm.* INTO v_member
  FROM public.band_members bm
  WHERE bm.band_id = p_band_id
    AND bm.user_id = v_uid
    AND (p_profile_id IS NULL OR bm.profile_id = p_profile_id)
    AND COALESCE(bm.member_status, 'active') = 'active'
  ORDER BY bm.joined_at ASC
  LIMIT 1;

  IF v_member IS NULL THEN
    RAISE EXCEPTION 'NOT_BAND_MEMBER';
  END IF;

  UPDATE public.songs
  SET band_id = p_band_id,
      ownership_type = 'band',
      added_to_repertoire_at = now(),
      added_to_repertoire_by = v_uid
  WHERE id = p_song_id;

  INSERT INTO public.band_song_ownership (
    song_id, band_id, user_id, ownership_percentage, original_percentage, role, is_active_member
  ) VALUES (p_song_id, p_band_id, v_uid, 100, 100, 'writer', true)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'song_id', p_song_id, 'band_id', p_band_id);
END;
$$;

REVOKE ALL ON FUNCTION public.contribute_song_to_band(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contribute_song_to_band(uuid, uuid, uuid) TO authenticated;

-- 3. Backfill: repoint existing songs whose band does not match the writing character's band
UPDATE public.songs s
SET band_id = correct.band_id
FROM (
  SELECT s2.id AS song_id, bm.band_id
  FROM public.songs s2
  JOIN public.band_members bm ON bm.profile_id = s2.profile_id
    AND COALESCE(bm.member_status, 'active') = 'active'
    AND COALESCE(bm.is_touring_member, false) = false
  WHERE s2.profile_id IS NOT NULL
) correct
WHERE s.id = correct.song_id
  AND s.band_id IS DISTINCT FROM correct.band_id;