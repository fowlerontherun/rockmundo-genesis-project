CREATE TABLE IF NOT EXISTS public.profile_daily_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  snapshot_date date NOT NULL,
  fame integer NOT NULL DEFAULT 0,
  fans integer NOT NULL DEFAULT 0,
  cash bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, snapshot_date)
);

ALTER TABLE public.profile_daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots owner can read"
  ON public.profile_daily_snapshots FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_daily_snapshots.profile_id AND p.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_profile_daily_snapshots_profile_date
  ON public.profile_daily_snapshots (profile_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_player_inbox_metadata_gin
  ON public.player_inbox USING gin (metadata);
