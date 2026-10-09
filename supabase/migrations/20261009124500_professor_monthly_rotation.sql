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
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
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
  -- Only assign professors to universities teaching their speciality.
  -- Rank available professors by fewest historical visits, then select a
  -- distinct eligible host for each professor using a deterministic order.
  WITH eligible_professors AS (
    SELECT p.id, p.skill_family,
      row_number() OVER (
        ORDER BY (SELECT count(*) FROM public.professor_residencies history WHERE history.professor_id = p.id),
          md5(p.id::text || v_start::text), p.id
      ) AS rn
    FROM public.travelling_professors p
    WHERE p.is_enabled
      AND EXISTS (
        SELECT 1 FROM public.professor_skill_memberships m
        JOIN public.university_courses c ON c.skill_slug = m.skill_slug
        WHERE m.skill_family = p.skill_family
      )
  ), candidates AS (
    SELECT p.id AS professor_id, u.id AS university_id, p.rn,
      row_number() OVER (
        PARTITION BY p.id ORDER BY
          (SELECT count(*) FROM public.professor_residencies history WHERE history.university_id = u.id),
          md5(u.id::text || p.id::text || v_start::text), u.id
      ) AS host_rank
    FROM eligible_professors p
    JOIN public.professor_skill_memberships m ON m.skill_family = p.skill_family
    JOIN public.university_courses c ON c.skill_slug = m.skill_slug
    JOIN public.universities u ON u.id = c.university_id
    WHERE p.rn <= 10
    GROUP BY p.id, u.id, p.rn
  ), assignments AS (
    SELECT DISTINCT ON (professor_id) professor_id, university_id, rn
    FROM candidates WHERE host_rank = 1
    ORDER BY professor_id, rn
  )
  INSERT INTO public.professor_residencies (professor_id, university_id, starts_at, ends_at)
  SELECT a.professor_id, a.university_id, v_start, v_end
  FROM assignments a ORDER BY a.rn;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.rotate_travelling_professors(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_travelling_professors(date) TO service_role;
COMMENT ON FUNCTION public.rotate_travelling_professors(date) IS
  'Schedule up to ten month-long professor visits, idempotently. Requires a service-role cron invocation.';
