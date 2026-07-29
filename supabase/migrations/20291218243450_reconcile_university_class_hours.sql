-- Restore class-hour fields for databases where the premature migration was
-- recorded or skipped before public.university_courses existed.

ALTER TABLE public.university_courses
  ADD COLUMN IF NOT EXISTS class_start_hour integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS class_end_hour integer NOT NULL DEFAULT 14;

ALTER TABLE public.university_courses
  DROP CONSTRAINT IF EXISTS university_courses_class_hours_check;

ALTER TABLE public.university_courses
  ADD CONSTRAINT university_courses_class_hours_check
  CHECK (
    class_start_hour >= 0
    AND class_start_hour < 24
    AND class_end_hour > class_start_hour
    AND class_end_hour <= 24
  ) NOT VALID;

COMMENT ON CONSTRAINT university_courses_class_hours_check
  ON public.university_courses IS
  'Course class hours must be a valid same-day interval. Existing rows remain unvalidated until reviewed.';
