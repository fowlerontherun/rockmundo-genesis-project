-- Top of the Pops: always locate the next valid fortnightly episode, not merely the
-- immediately upcoming Thursday, and never build invitations from a stale UK chart snapshot.

CREATE OR REPLACE FUNCTION public.totp_prepare_next_episode()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_episode_date date;
  v_latest_chart_date date;
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

  SELECT max(ce.chart_date)
  INTO v_latest_chart_date
  FROM public.chart_entries ce
  WHERE ce.country = 'United Kingdom'
    AND ce.entry_type = 'song'
    AND ce.chart_type IN ('streaming', 'digital_sales')
    AND ce.rank BETWEEN 1 AND 40;

  IF v_latest_chart_date IS NULL OR v_latest_chart_date < current_date - 3 THEN
    RAISE EXCEPTION 'Top of the Pops preparation blocked: UK streaming/digital chart snapshot is stale (latest %)',
      coalesce(v_latest_chart_date::text, 'none');
  END IF;

  RETURN public.totp_prepare_episode(v_next_episode_date);
END;
$$;

REVOKE ALL ON FUNCTION public.totp_prepare_next_episode() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_prepare_next_episode() TO service_role;

COMMENT ON FUNCTION public.totp_prepare_next_episode() IS
  'Idempotently finds the next valid fortnightly TOTP Thursday within 28 days, skipping off-week Thursdays and refusing to prepare invitations from a UK chart snapshot older than three days.';
