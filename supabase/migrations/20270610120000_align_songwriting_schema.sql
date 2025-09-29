-- Align songwriting tables with updated songwriting experience
-- Adds new columns expected by the client while keeping legacy data in sync

-- Add modern songwriting project columns if they're missing
ALTER TABLE public.songwriting_projects
  ADD COLUMN IF NOT EXISTS lyrics TEXT,
  ADD COLUMN IF NOT EXISTS sessions_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS song_id UUID REFERENCES public.songs(id) ON DELETE SET NULL;

-- Ensure session counts are non-negative and have sensible defaults
ALTER TABLE public.songwriting_projects
  ALTER COLUMN sessions_completed SET DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'songwriting_projects_sessions_completed_check'
  ) THEN
    ALTER TABLE public.songwriting_projects
      ADD CONSTRAINT songwriting_projects_sessions_completed_check
        CHECK (sessions_completed >= 0)
        NOT VALID;
  END IF;
END $$;

-- Backfill newly added songwriting project columns from legacy data when available
UPDATE public.songwriting_projects
SET lyrics = COALESCE(lyrics, initial_lyrics)
WHERE lyrics IS NULL AND initial_lyrics IS NOT NULL;

UPDATE public.songwriting_projects
SET sessions_completed = COALESCE(sessions_completed, total_sessions)
WHERE (sessions_completed IS NULL OR sessions_completed = 0) AND total_sessions IS NOT NULL;

-- Add songwriting session timing columns expected by the UI
ALTER TABLE public.songwriting_sessions
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Populate the new session columns using legacy values when available
UPDATE public.songwriting_sessions
SET started_at = COALESCE(started_at, session_start)
WHERE started_at IS NULL;

UPDATE public.songwriting_sessions
SET completed_at = COALESCE(completed_at, session_end)
WHERE completed_at IS NULL;

-- Set sensible defaults and constraints on the new session columns
ALTER TABLE public.songwriting_sessions
  ALTER COLUMN started_at SET DEFAULT now();

ALTER TABLE public.songwriting_sessions
  ALTER COLUMN started_at SET NOT NULL;

-- Helpful indexes for lock lookups and ordering
CREATE INDEX IF NOT EXISTS songwriting_projects_locked_until_idx
  ON public.songwriting_projects (locked_until DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS songwriting_sessions_locked_until_idx
  ON public.songwriting_sessions (locked_until DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS songwriting_sessions_started_at_idx
  ON public.songwriting_sessions (started_at DESC);

-- Validate the new check constraint once existing data is in place
ALTER TABLE public.songwriting_projects
  VALIDATE CONSTRAINT songwriting_projects_sessions_completed_check;
