-- Reconcile activity-status timer fields for databases where the historical
-- compatibility migration was already recorded before song_id was added.

ALTER TABLE public.profile_activity_statuses
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profile_activity_statuses_duration_check'
      AND conrelid = 'public.profile_activity_statuses'::regclass
  ) THEN
    ALTER TABLE public.profile_activity_statuses
      ADD CONSTRAINT profile_activity_statuses_duration_check
      CHECK (duration_minutes IS NULL OR duration_minutes >= 0)
      NOT VALID;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS profile_activity_statuses_song_id_idx
  ON public.profile_activity_statuses (song_id);

NOTIFY pgrst, 'reload schema';
