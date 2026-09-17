-- Top of the Pops: always locate the next valid fortnightly episode, not merely the
-- immediately upcoming Thursday. This also gives fresh deployments a safe bootstrap path.

CREATE OR REPLACE FUNCTION public.totp_prepare_next_episode()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_episode_date date;
BEGIN
  SELECT d::date
  INTO v_next_episode_date
  FROM generate_series(current_date + 1, current_date + 28, interval '1 day') AS candidate(d)
  WHERE extract(isodow FROM d)::integer = 4
    AND public.totp_is_episode_date(d::date)
  ORDER BY d
  LIMIT 1;

  IF v_next_episode_date IS NULL THEN
    RAISE EXCEPTION 'Could not find a Top of the Pops episode date in the next 28 days';
  END IF;

  RETURN public.totp_prepare_episode(v_next_episode_date);
END;
$$;

REVOKE ALL ON FUNCTION public.totp_prepare_next_episode() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_prepare_next_episode() TO service_role;

-- Bootstrap the next valid show immediately. totp_prepare_episode is idempotent, so this is
-- safe if the Monday-Wednesday preparation job has already created the episode.
DO $$
BEGIN
  PERFORM public.totp_prepare_next_episode();
END;
$$;

COMMENT ON FUNCTION public.totp_prepare_next_episode() IS
  'Idempotently finds and prepares the next valid fortnightly TOTP Thursday within 28 days. It skips non-TOTP Thursdays instead of returning NULL.';
