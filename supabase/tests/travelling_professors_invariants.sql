-- Run against a staging database AFTER all travelling professor migrations.
-- Read-only checks: no scheduling, XP grants, or notifications are created.
DO $test$
DECLARE
  v_count integer;
BEGIN
  IF to_regclass('public.travelling_professors') IS NULL
     OR to_regclass('public.professor_residencies') IS NULL
     OR to_regclass('public.professor_skill_memberships') IS NULL
     OR to_regclass('public.active_professor_residencies') IS NULL THEN
    RAISE EXCEPTION 'Professor schema is incomplete';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.professor_residencies a
  JOIN public.professor_residencies b ON a.id < b.id
    AND tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')
    AND a.professor_id=b.professor_id;
  IF v_count > 0 THEN RAISE EXCEPTION 'Overlapping professor assignments: %',v_count; END IF;

  SELECT count(*) INTO v_count FROM (
    SELECT date_trunc('month', starts_at AT TIME ZONE 'UTC') AS month, count(*) AS total
    FROM public.professor_residencies GROUP BY 1 HAVING count(*) > 10
  ) violations;
  IF v_count > 0 THEN RAISE EXCEPTION 'More than ten professor assignments in a month'; END IF;

  SELECT count(*) INTO v_count
  FROM public.professor_residencies
  WHERE starts_at <> (date_trunc('month', starts_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
    OR ends_at <> ((date_trunc('month', starts_at AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC');
  IF v_count > 0 THEN RAISE EXCEPTION 'Residency boundaries are not UTC calendar months'; END IF;

  SELECT count(*) INTO v_count
  FROM public.professor_residencies r
  JOIN public.travelling_professors p ON p.id = r.professor_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.professor_skill_memberships m
    JOIN public.university_courses uc ON uc.skill_slug = m.skill_slug
    WHERE m.skill_family = p.skill_family AND uc.university_id = r.university_id
  );
  IF v_count > 0 THEN RAISE EXCEPTION 'Professor assigned to university without matching courses: %', v_count; END IF;

  SELECT count(*) INTO v_count FROM (
    SELECT university_id, starts_at
    FROM public.professor_residencies
    GROUP BY university_id, starts_at HAVING count(*) > 1
  ) duplicate_hosts;
  IF v_count > 0 THEN RAISE EXCEPTION 'Multiple professors assigned to same host university'; END IF;

  SELECT count(*) INTO v_count FROM public.professor_residencies
  WHERE starts_at = (date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');
  IF v_count = 0 THEN RAISE EXCEPTION 'No professors scheduled for current UTC month'; END IF;

  SELECT count(*) INTO v_count FROM (
    SELECT profile_id, metadata->>'residency_id', count(*) AS total
    FROM public.notifications WHERE type='visiting_professor_arrival'
    GROUP BY 1,2 HAVING count(*) > 1
  ) duplicates;
  IF v_count > 0 THEN RAISE EXCEPTION 'Duplicate professor arrival notifications'; END IF;

  IF (SELECT prosecdef FROM pg_catalog.pg_proc
      WHERE oid = 'public.university_visiting_professor_bonus(uuid,text,timestamptz)'::regprocedure) THEN
    RAISE EXCEPTION 'Professor bonus lookup must not be SECURITY DEFINER';
  END IF;

  IF has_function_privilege('authenticated',
      'public.rotate_travelling_professors(date)', 'EXECUTE')
     OR has_function_privilege('authenticated',
      'public.announce_travelling_professors(date)', 'EXECUTE')
     OR has_function_privilege('authenticated',
      'public.rotate_travelling_professors_internal(date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Professor scheduling/notification RPC exposed to players';
  END IF;

  IF public.university_visiting_professor_bonus(gen_random_uuid(), '__unknown_skill__', now()) <> 0 THEN
    RAISE EXCEPTION 'Unmatched professor lookup awarded XP bonus';
  END IF;
  RAISE NOTICE 'Professor staging invariant checks passed';
END
$test$;
