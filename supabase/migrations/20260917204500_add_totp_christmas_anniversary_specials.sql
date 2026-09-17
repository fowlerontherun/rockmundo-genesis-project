-- Top of the Pops phase 6: deterministic Christmas and anniversary special editions.
-- Specials remain normal fortnightly Thursday episodes: chart eligibility, immutable snapshots,
-- previous-episode exclusion, invitation/check-in requirements and reward settlement are unchanged.

ALTER TABLE public.totp_episodes
  DROP CONSTRAINT IF EXISTS totp_episodes_show_variant_check;
ALTER TABLE public.totp_episodes
  ADD CONSTRAINT totp_episodes_show_variant_check
  CHECK (show_variant IN ('regular','guest_host','milestone','christmas','anniversary'));

CREATE OR REPLACE FUNCTION public.totp_is_christmas_special_date(p_episode_date date)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.totp_is_episode_date(p_episode_date)
    AND p_episode_date <= make_date(extract(year FROM p_episode_date)::integer, 12, 25)
    AND p_episode_date > make_date(extract(year FROM p_episode_date)::integer, 12, 25) - 14;
$$;

CREATE OR REPLACE FUNCTION public.totp_is_anniversary_special_date(p_episode_date date)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT extract(year FROM p_episode_date)::integer > 2026
    AND public.totp_is_episode_date(p_episode_date)
    AND p_episode_date <= make_date(extract(year FROM p_episode_date)::integer, 9, 17)
    AND p_episode_date > make_date(extract(year FROM p_episode_date)::integer, 9, 17) - 14;
$$;

-- Keep the original one-argument helpers for backwards compatibility. Date-aware episode
-- assignment uses the overloads below so seasonal editions take priority over numeric rotations.
CREATE OR REPLACE FUNCTION public.totp_show_variant_for_episode(
  p_episode_number bigint,
  p_episode_date date
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN public.totp_is_christmas_special_date(p_episode_date) THEN 'christmas'
    WHEN public.totp_is_anniversary_special_date(p_episode_date) THEN 'anniversary'
    WHEN mod(p_episode_number,25) = 0 THEN 'milestone'
    WHEN mod(p_episode_number,5) = 0 THEN 'guest_host'
    ELSE 'regular'
  END;
$$;

CREATE OR REPLACE FUNCTION public.totp_presenter_key_for_episode(
  p_episode_number bigint,
  p_episode_date date
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    -- Annual specials use the programme's main presenter so the special identity is stable
    -- and cannot be manipulated through the guest-host rotation.
    WHEN public.totp_is_christmas_special_date(p_episode_date)
      OR public.totp_is_anniversary_special_date(p_episode_date)
      THEN 'alex_rayne'
    ELSE public.totp_presenter_key_for_episode(p_episode_number)
  END;
$$;

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
    RETURN format('It is Christmas on Top of the Pops — at number %s, welcome %s performing %s!', p_rank, p_band_name, p_song_title);
  END IF;

  IF p_show_variant = 'anniversary' THEN
    RETURN format('It is our Top of the Pops anniversary show — at number %s, welcome %s performing %s!', p_rank, p_band_name, p_song_title);
  END IF;

  IF p_show_variant = 'milestone' THEN
    RETURN format('A milestone night on Top of the Pops — at number %s, welcome %s performing %s!', p_rank, p_band_name, p_song_title);
  END IF;

  RETURN CASE p_presenter_key
    WHEN 'maya_stone' THEN format('Chart watchers, this is Maya Stone. At number %s, give it up for %s with %s!', p_rank, p_band_name, p_song_title)
    WHEN 'jack_mercer' THEN format('London, make some noise. At number %s this week, here are %s performing %s!', p_rank, p_band_name, p_song_title)
    WHEN 'nia_vale' THEN format('Tonight on RockMundo Television, number %s belongs to %s with %s. Here they are!', p_rank, p_band_name, p_song_title)
    ELSE format('At number %s this week, please welcome %s performing %s!', p_rank, p_band_name, p_song_title)
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_assign_episode_presentation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.totp_episodes
  SET presenter_key = public.totp_presenter_key_for_episode(NEW.episode_number, NEW.episode_date),
      show_variant = public.totp_show_variant_for_episode(NEW.episode_number, NEW.episode_date),
      updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_assign_episode_presentation() FROM PUBLIC,anon,authenticated;

-- Recalculate episode presentation metadata using the date-aware rules. Canonical archived
-- replay payloads are intentionally not rewritten; completed broadcasts remain immutable.
UPDATE public.totp_episodes
SET presenter_key = public.totp_presenter_key_for_episode(episode_number, episode_date),
    show_variant = public.totp_show_variant_for_episode(episode_number, episode_date),
    updated_at = now();

COMMENT ON FUNCTION public.totp_is_christmas_special_date(date) IS
  'True only for the final scheduled fortnightly TOTP episode on or before Christmas Day.';
COMMENT ON FUNCTION public.totp_is_anniversary_special_date(date) IS
  'True only for the final scheduled fortnightly TOTP episode on or before 17 September, from 2027 onward.';
COMMENT ON FUNCTION public.totp_show_variant_for_episode(bigint,date) IS
  'Date-aware deterministic TOTP presentation variant. Seasonal specials take priority over milestone and guest-host rotations.';
