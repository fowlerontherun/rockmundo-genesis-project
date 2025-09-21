-- Add momentum and inspiration tracking to player profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS momentum integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inspiration integer NOT NULL DEFAULT 0;

-- Ensure PostgREST is aware of the new columns immediately
NOTIFY pgrst, 'reload schema';
