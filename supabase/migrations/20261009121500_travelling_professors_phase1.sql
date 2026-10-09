-- Phase 1: travelling professors data foundation. No professor is activated by this migration.
CREATE TABLE public.travelling_professors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  skill_family text NOT NULL UNIQUE,
  biography text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT professor_skill_family_nonempty CHECK (length(btrim(skill_family)) > 0)
);

CREATE TABLE public.professor_residencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid NOT NULL REFERENCES public.travelling_professors(id) ON DELETE RESTRICT,
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT professor_residency_dates CHECK (ends_at > starts_at),
  CONSTRAINT professor_residency_month CHECK (
    starts_at = date_trunc('month', starts_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
    AND ends_at = (date_trunc('month', starts_at AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC'
  ),
  UNIQUE (professor_id, starts_at)
);

CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE public.professor_residencies
  ADD CONSTRAINT professor_no_overlapping_residencies
  EXCLUDE USING gist (professor_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&);
CREATE INDEX professor_residencies_university_dates_idx
  ON public.professor_residencies(university_id, starts_at, ends_at);

-- Serialise all assignment writes, including concurrent inserts and updates.
CREATE FUNCTION public.enforce_professor_residency_limit()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  overlapping_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(741102, 10);
  SELECT count(*) INTO overlapping_count
  FROM public.professor_residencies r
  WHERE r.id IS DISTINCT FROM NEW.id
    AND tstzrange(r.starts_at, r.ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)');
  IF overlapping_count >= 10 THEN
    RAISE EXCEPTION 'Only ten travelling professors may be active simultaneously';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.travelling_professors p WHERE p.id = NEW.professor_id AND p.is_enabled) THEN
    RAISE EXCEPTION 'Professor must be enabled to receive a residency';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER enforce_professor_residency_limit_trigger
BEFORE INSERT OR UPDATE ON public.professor_residencies
FOR EACH ROW EXECUTE FUNCTION public.enforce_professor_residency_limit();

ALTER TABLE public.travelling_professors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professor_residencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Professors are publicly readable"
  ON public.travelling_professors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Residencies are publicly readable"
  ON public.professor_residencies FOR SELECT TO authenticated USING (true);
-- No client INSERT/UPDATE/DELETE policies: assignments must be server-controlled.

CREATE VIEW public.active_professor_residencies
WITH (security_invoker = true) AS
SELECT r.id, r.professor_id, r.university_id, r.starts_at, r.ends_at,
       p.name, p.skill_family, p.biography
FROM public.professor_residencies r
JOIN public.travelling_professors p ON p.id = r.professor_id
WHERE p.is_enabled AND r.starts_at <= now() AND r.ends_at > now();

COMMENT ON TABLE public.professor_residencies IS
  'UTC calendar-month professor visits. Attendance XP integration and monthly scheduler follow in later phases.';
