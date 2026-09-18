CREATE OR REPLACE FUNCTION public.totp_presenter_intro(
  p_presenter_key text,
  p_show_variant text,
  p_rank integer,
  p_band_name text,
  p_song_title text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_show_variant = 'milestone' THEN
    RETURN format('This is a huge Top of the Pops night! At number %s — make some serious noise for %s, with %s!', p_rank, p_band_name, p_song_title);
  END IF;

  RETURN CASE p_presenter_key
    WHEN 'maya_stone' THEN format('Here we go! At number %s this week — get on your feet for %s with %s!', p_rank, p_band_name, p_song_title)
    WHEN 'jack_mercer' THEN format('London, I want to hear you! At number %s — this is %s performing %s!', p_rank, p_band_name, p_song_title)
    WHEN 'nia_vale' THEN format('The studio is ready, the crowd is ready — at number %s, give it up for %s with %s!', p_rank, p_band_name, p_song_title)
    ELSE format('Come on, studio — make some noise! At number %s this week, here are %s with %s!', p_rank, p_band_name, p_song_title)
  END;
END;
$$;