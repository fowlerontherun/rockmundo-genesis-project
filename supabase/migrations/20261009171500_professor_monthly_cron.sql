-- Server-side monthly scheduler; pg_cron invokes as database owner.
-- Cron cannot call the externally exposed service-role-only RPC directly.
CREATE OR REPLACE FUNCTION public.rotate_travelling_professors_internal(
  p_month date DEFAULT (now() AT TIME ZONE 'UTC')::date
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_start timestamptz := date_trunc('month', p_month::timestamp) AT TIME ZONE 'UTC';
  v_end timestamptz := (date_trunc('month', p_month::timestamp) + interval '1 month') AT TIME ZONE 'UTC';
  v_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(741102, 10);
  SELECT count(*) INTO v_count FROM public.professor_residencies WHERE starts_at = v_start;
  IF v_count > 0 THEN RETURN v_count; END IF;
  -- Greedily choose a distinct eligible host for each professor, in a stable
  -- least-visited order. The used-host array prevents two simultaneous visits
  -- from landing at the same university.
  WITH RECURSIVE eligible_professors AS (
    SELECT p.id, p.skill_family,
      row_number() OVER (
        ORDER BY (SELECT count(*) FROM public.professor_residencies h WHERE h.professor_id = p.id),
          md5(p.id::text || v_start::text), p.id
      ) AS rn
    FROM public.travelling_professors p
    WHERE p.is_enabled AND EXISTS (
      SELECT 1 FROM public.professor_skill_memberships m
      JOIN public.university_courses c ON c.skill_slug = m.skill_slug
      WHERE m.skill_family = p.skill_family
    )
  ), assignments AS (
    SELECT 0::bigint AS rn, NULL::uuid AS professor_id,
      NULL::uuid AS university_id, ARRAY[]::uuid[] AS used_hosts
    UNION ALL
    SELECT p.rn, p.id, host.id, a.used_hosts || host.id
    FROM assignments a
    JOIN eligible_professors p ON p.rn = a.rn + 1
    JOIN LATERAL (
      SELECT u.id
      FROM public.universities u
      WHERE u.id <> ALL(a.used_hosts)
        AND EXISTS (
          SELECT 1 FROM public.professor_skill_memberships m
          JOIN public.university_courses c ON c.skill_slug = m.skill_slug
          WHERE m.skill_family = p.skill_family AND c.university_id = u.id
        )
      ORDER BY (SELECT count(*) FROM public.professor_residencies h WHERE h.university_id = u.id),
        md5(u.id::text || p.id::text || v_start::text), u.id
      LIMIT 1
    ) host ON true
    WHERE a.rn < 10
  )
  INSERT INTO public.professor_residencies (professor_id, university_id, starts_at, ends_at)
  SELECT a.professor_id, a.university_id, v_start, v_end
  FROM assignments a WHERE a.rn > 0 ORDER BY a.rn;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.rotate_travelling_professors_internal(date) FROM PUBLIC, anon, authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly_travelling_professors') THEN
      PERFORM cron.unschedule('monthly_travelling_professors');
    END IF;
    PERFORM cron.schedule(
      'monthly_travelling_professors', '5 0 1 * *',
      'SELECT public.rotate_travelling_professors_internal((now() AT TIME ZONE ''UTC'')::date);'
    );
  END IF;
END $$;
