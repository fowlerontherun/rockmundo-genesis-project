-- Supports course lookups performed when a university's ratings change.
CREATE INDEX IF NOT EXISTS university_courses_university_id_idx
ON public.university_courses (university_id);
