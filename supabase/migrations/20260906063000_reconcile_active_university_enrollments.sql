-- Reconcile active university enrolments after the 2026-09-03 course rebalance.
-- The rebalance changed course durations but intentionally preserved existing
-- scheduled_end_date snapshots, leaving some active enrolments on the old,
-- much longer schedule. Recalculate only active enrolments against the current
-- course/university rules and complete anyone who has already attended the
-- newly-required number of days. Earned XP and attendance history are preserved.

WITH recalculated AS (
  SELECT
    enrollment.id,
    enrollment.enrolled_at,
    enrollment.days_attended,
    GREATEST(
      1,
      CEIL(
        course.base_duration_days
        * (
          (200 - GREATEST(0, LEAST(100, COALESCE(university.quality_of_learning, 50))))::numeric
          / 100.0
        )
      )
    )::integer AS adjusted_days
  FROM public.player_university_enrollments AS enrollment
  JOIN public.university_courses AS course
    ON course.id = enrollment.course_id
  JOIN public.universities AS university
    ON university.id = enrollment.university_id
  WHERE enrollment.status IN ('enrolled', 'in_progress')
)
UPDATE public.player_university_enrollments AS enrollment
SET
  scheduled_end_date = recalculated.enrolled_at
    + make_interval(days => recalculated.adjusted_days),
  status = CASE
    WHEN recalculated.days_attended >= recalculated.adjusted_days
      THEN 'completed'::public.enrollment_status
    ELSE enrollment.status
  END,
  actual_completion_date = CASE
    WHEN recalculated.days_attended >= recalculated.adjusted_days
      THEN COALESCE(enrollment.actual_completion_date, now())
    ELSE enrollment.actual_completion_date
  END,
  auto_attend = CASE
    WHEN recalculated.days_attended >= recalculated.adjusted_days THEN false
    ELSE enrollment.auto_attend
  END
FROM recalculated
WHERE enrollment.id = recalculated.id
  AND (
    enrollment.scheduled_end_date IS DISTINCT FROM
      recalculated.enrolled_at + make_interval(days => recalculated.adjusted_days)
    OR (
      recalculated.days_attended >= recalculated.adjusted_days
      AND enrollment.status <> 'completed'
    )
  );
