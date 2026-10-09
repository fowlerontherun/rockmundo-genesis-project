-- Server-owned, idempotent monthly rotation. Invoke from an authenticated cron/service role.
-- Future-month scheduling is allowed; each calendar month has at most ten appointments.
CREATE OR REPLACE FUNCTION public.rotate_travelling_professors(p_month date DEFAULT (now() AT TIME ZONE 'UTC')::date)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_count integer;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Only the service role can schedule professors' USING ERRCODE = '42501';
  END IF;
  v_start := date_trunc('month', p_month::timestamp) AT TIME ZONE 'UTC';
  v_end := (date_trunc('month', p_month::timestamp) + interval '1 month') AT TIME ZONE 'UTC';
  PERFORM pg_advisory_xact_lock(741102, 10);
  -- Repeated runs never replace published schedules.
  SELECT count(*) INTO v_count FROM public.professor_residencies
  WHERE starts_at = v_start;
  IF v_count > 0 THEN
    RETURN v_count;
  END IF;

  -- Rank professors and universities by their historical number of visits.
  -- Deterministic tie breaks vary by month and avoid unstable random() selection.
  WITH eligible_professors AS (
    SELECT p.id,
      row_number() OVER (
        ORDER BY (SELECT count(*) FROM public.professor_residencies history WHERE history.professor_id = p.id),
          md5(p.id::text || v_start::text), p.id
      ) AS rn
    FROM public.travelling_professors p
    WHERE p.is_enabled
  ), eligible_universities AS (
    SELECT u.id,
      row_number() OVER (
        ORDER BY (SELECT count(*) FROM public.professor_residencies history WHERE history.university_id = u.id),
          md5(u.id::text || v_start::text), u.id
      ) AS rn
    FROM public.universities u
  )
  INSERT INTO public.professor_residencies(professor_id, university_id, starts_at, ends_at)
  SELECT p.id, u.id, v_start, v_end
  FROM eligible_professors p
  JOIN eligible_universities u ON u.rn = p.rn
  WHERE p.rn <= 10
  ORDER BY p.rn;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.rotate_travelling_professors(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_travelling_professors(date) TO service_role;
COMMENT ON FUNCTION public.rotate_travelling_professors(date) IS
  'Schedule up to ten month-long professor visits, idempotently. Requires a service-role cron invocation.';
