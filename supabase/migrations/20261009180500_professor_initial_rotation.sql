-- Activate the current UTC month's residency cohort at rollout.
-- The scheduler otherwise waits until the first of the next month.
-- Both operations are idempotent; notifications only target enrolled students.
DO $bootstrap$
DECLARE
  v_month date := (now() AT TIME ZONE 'UTC')::date;
  v_created integer;
  v_announced integer;
BEGIN
  v_created := public.rotate_travelling_professors_internal(v_month);
  v_announced := public.announce_travelling_professors(v_month);
  RAISE NOTICE 'Travelling professors: % current-month residencies, % arrival notifications',
    v_created, v_announced;
END
$bootstrap$;
