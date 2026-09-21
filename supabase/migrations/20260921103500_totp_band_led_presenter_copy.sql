-- Keep Top of the Pops presenter voice copy independent of song-title pronunciation.
-- Song titles remain visual in lower thirds, chart graphics and running-order UI.
-- The signature is unchanged for backwards compatibility; p_song_title is deliberately unused.

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
  IF p_show_variant = 'christmas' THEN
    RETURN format('It is Christmas on Top of the Pops — at number %s, welcome %s!', p_rank, p_band_name);
  END IF;

  IF p_show_variant = 'anniversary' THEN
    RETURN format('It is our Top of the Pops anniversary show — at number %s, welcome %s!', p_rank, p_band_name);
  END IF;

  IF p_show_variant = 'milestone' THEN
    RETURN format('A milestone night on Top of the Pops — at number %s, make some noise for %s!', p_rank, p_band_name);
  END IF;

  RETURN CASE p_presenter_key
    WHEN 'maya_stone' THEN format('Chart watchers, this is Maya Stone. At number %s, give it up for %s!', p_rank, p_band_name)
    WHEN 'jack_mercer' THEN format('London, make some noise. At number %s this week, here is another chart hit from %s!', p_rank, p_band_name)
    WHEN 'nia_vale' THEN format('Tonight on RockMundo Television, number %s belongs to %s. Here they are!', p_rank, p_band_name)
    ELSE format('At number %s this week, please welcome %s!', p_rank, p_band_name)
  END;
END;
$$;

COMMENT ON FUNCTION public.totp_presenter_intro(text,text,integer,text,text) IS
  'Builds band-led presenter introductions without speaking song titles; song titles remain visual-only in the broadcast package.';
