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
  WITH professors AS (
    SELECT p.id, row_number() OVER (
      ORDER BY (SELECT count(*) FROM public.professor_residencies r WHERE r.professor_id = p.id),
      md5(p.id::text || v_start::text), p.id
    ) rn
    FROM public.travelling_professors p WHERE p.is_enabled
  ), universities AS (
    SELECT u.id, row_number() OVER (
      ORDER BY (SELECT count(*) FROM public.professor_residencies r WHERE r.university_id = u.id),
      md5(u.id::text || v_start::text), u.id
    ) rn
    FROM public.universities u
  )
  INSERT INTO public.professor_residencies (professor_id, university_id, starts_at, ends_at)
  SELECT p.id,u.id,v_start,v_end FROM professors p JOIN universities u ON p.rn=u.rn
  WHERE p.rn<=10 ORDER BY p.rn;
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
