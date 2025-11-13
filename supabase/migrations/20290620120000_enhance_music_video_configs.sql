-- Extend music video config tables with workflow fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_status_enum') THEN
    CREATE TYPE public.video_status_enum AS ENUM (
      'draft',
      'planned',
      'in_production',
      'post_production',
      'released',
      'archived'
    );
  END IF;
END $$;

ALTER TABLE public.music_video_configs
  ADD COLUMN IF NOT EXISTS status public.video_status_enum NOT NULL DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS target_release_date date,
  ADD COLUMN IF NOT EXISTS shoot_start_date date,
  ADD COLUMN IF NOT EXISTS shoot_end_date date,
  ADD COLUMN IF NOT EXISTS primary_platform text,
  ADD COLUMN IF NOT EXISTS kpi_view_target bigint,
  ADD COLUMN IF NOT EXISTS kpi_chart_target text,
  ADD COLUMN IF NOT EXISTS sync_strategy text NOT NULL DEFAULT 'manual';

ALTER TABLE public.music_video_metrics
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS views_target bigint,
  ADD COLUMN IF NOT EXISTS chart_target text;

-- Ensure existing rows adopt the new defaults
UPDATE public.music_video_configs
SET status = COALESCE(status, 'planned'::public.video_status_enum),
    sync_strategy = COALESCE(sync_strategy, 'manual')
WHERE TRUE;

UPDATE public.music_video_metrics
SET platform = COALESCE(platform, 'youtube')
WHERE platform IS NULL;
