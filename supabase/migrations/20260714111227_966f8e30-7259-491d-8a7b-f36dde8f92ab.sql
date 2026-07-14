
ALTER TABLE public.songwriting_sessions
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS effort_hours integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS progress_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS songwriting_sessions_project_idem_uidx
  ON public.songwriting_sessions(project_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
