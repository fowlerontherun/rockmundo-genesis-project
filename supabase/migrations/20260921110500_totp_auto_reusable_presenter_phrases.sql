-- Automatically vary reusable presenter introductions while keeping song titles visual-only.
-- Only wording that is always true from the function's existing inputs is selected here.
-- Context-dependent phrases (new entry, climber, returning act) are selected by richer callers
-- when those facts are available.

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
DECLARE
  v_rank integer := greatest(1, least(40, coalesce(p_rank, 40)));
  v_band text := nullif(btrim(coalesce(p_band_name, '')), '');
  v_seed integer;
  v_prefix text;
BEGIN
  v_band := coalesce(v_band, 'the next act');
  v_seed := get_byte(
    decode(md5(coalesce(p_presenter_key, '') || ':' || v_rank::text || ':' || v_band), 'hex'),
    0
  );

  IF p_show_variant = 'christmas' THEN
    RETURN format('It is Christmas on Top of the Pops — at number %s, welcome %s!', v_rank, v_band);
  END IF;

  IF p_show_variant = 'anniversary' THEN
    RETURN format('It is our Top of the Pops anniversary show — at number %s, welcome %s!', v_rank, v_band);
  END IF;

  IF p_show_variant = 'milestone' THEN
    RETURN format('A milestone night on Top of the Pops — at number %s, make some noise for %s!', v_rank, v_band);
  END IF;

  IF v_rank = 1 THEN
    RETURN format('At number one, it''s %s!', v_band);
  END IF;

  IF v_rank <= 10 THEN
    v_prefix := CASE (v_seed % 4)
      WHEN 0 THEN 'In the Top Ten this week, it''s'
      WHEN 1 THEN 'Up next, it''s'
      WHEN 2 THEN 'And now, it''s'
      ELSE 'Please welcome'
    END;
    RETURN format('%s %s!', v_prefix, v_band);
  END IF;

  v_prefix := CASE (v_seed % 6)
    WHEN 0 THEN 'Please welcome'
    WHEN 1 THEN 'Up next, it''s'
    WHEN 2 THEN 'And now, it''s'
    WHEN 3 THEN 'It''s time for'
    WHEN 4 THEN 'Here''s another chart hit from'
    ELSE 'The studio''s ready for'
  END;

  RETURN format('%s %s!', v_prefix, v_band);
END;
$$;

COMMENT ON FUNCTION public.totp_presenter_intro(text,text,integer,text,text) IS
  'Builds deterministic, varied band-led presenter introductions from reusable phrase wording. Song titles remain visual-only.';
