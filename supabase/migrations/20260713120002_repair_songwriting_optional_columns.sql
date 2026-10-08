-- Repair songwriting progression schema drift without rewriting deployed history.
-- Keeps the writing desk usable even when 20260712120000 partially applied.

ALTER TABLE public.songwriting_projects
  ADD COLUMN IF NOT EXISTS arrangement_progress integer NOT NULL DEFAULT 0 CHECK (arrangement_progress BETWEEN 0 AND 2000),
  ADD COLUMN IF NOT EXISTS polish_progress integer NOT NULL DEFAULT 0 CHECK (polish_progress BETWEEN 0 AND 500),
  ADD COLUMN IF NOT EXISTS consistency_score integer NOT NULL DEFAULT 0 CHECK (consistency_score BETWEEN 0 AND 500),
  ADD COLUMN IF NOT EXISTS songwriting_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS calculation_version text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE public.songwriting_sessions
  ADD COLUMN IF NOT EXISTS effort_hours integer NOT NULL DEFAULT 1 CHECK (effort_hours IN (1,2,4)),
  ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'balanced' CHECK (session_type IN ('balanced','music','lyrics','arrangement','polish')),
  ADD COLUMN IF NOT EXISTS progress_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
