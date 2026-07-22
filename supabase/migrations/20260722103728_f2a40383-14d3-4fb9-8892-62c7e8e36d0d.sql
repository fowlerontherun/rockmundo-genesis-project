
CREATE OR REPLACE FUNCTION public.admin_gift_song_to_band(
  p_band_id uuid,
  p_title text,
  p_genre text,
  p_lyrics text,
  p_quality_score int,
  p_song_rating int,
  p_lyrics_strength int,
  p_melody_strength int,
  p_rhythm_strength int,
  p_arrangement_strength int,
  p_production_potential int,
  p_ai_generated_lyrics boolean,
  p_duration_seconds int,
  p_duration_display text,
  p_gift_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_leader uuid;
  v_song_id uuid;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'Only admins can gift songs';
  END IF;

  SELECT leader_id INTO v_leader FROM public.bands WHERE id = p_band_id;
  IF v_leader IS NULL THEN
    RAISE EXCEPTION 'Band not found';
  END IF;

  INSERT INTO public.songs(
    title, genre, lyrics, quality_score, song_rating, status,
    band_id, user_id, duration_seconds, duration_display,
    lyrics_strength, melody_strength, rhythm_strength,
    arrangement_strength, production_potential, ai_generated_lyrics,
    ownership_type, catalog_status
  ) VALUES (
    p_title, p_genre, p_lyrics, p_quality_score, p_song_rating, 'recorded',
    p_band_id, v_leader, p_duration_seconds, p_duration_display,
    p_lyrics_strength, p_melody_strength, p_rhythm_strength,
    p_arrangement_strength, p_production_potential, p_ai_generated_lyrics,
    'band', 'private'
  ) RETURNING id INTO v_song_id;

  INSERT INTO public.admin_song_gifts(
    song_id, gifted_to_band_id, gifted_to_user_id, gifted_by_admin_id, gift_message
  ) VALUES (
    v_song_id, p_band_id, v_leader, v_admin, p_gift_message
  );

  RETURN v_song_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_gift_song_to_band(uuid,text,text,text,int,int,int,int,int,int,int,boolean,int,text,text) TO authenticated;
