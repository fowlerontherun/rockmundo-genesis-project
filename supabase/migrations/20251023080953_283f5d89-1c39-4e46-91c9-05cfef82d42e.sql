-- Phase 1: Add rehearsal stage tracking to band_song_familiarity
ALTER TABLE band_song_familiarity
  ADD COLUMN IF NOT EXISTS rehearsal_stage TEXT 
  GENERATED ALWAYS AS (
    CASE 
      WHEN familiarity_minutes < 21 THEN 'unrehearsed'
      WHEN familiarity_minutes < 41 THEN 'tight'
      ELSE 'perfect'
    END
  ) STORED;

-- Phase 2: Unify release systems - add release_id to song_releases
ALTER TABLE song_releases
  ADD COLUMN IF NOT EXISTS release_id UUID REFERENCES releases(id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_song_releases_release_id ON song_releases(release_id);

-- Phase 3: Extend chart_entries for comprehensive charts
ALTER TABLE chart_entries
  ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'stream' CHECK (sale_type IN ('stream', 'digital', 'cd', 'vinyl', 'record')),
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS genre TEXT;

-- Add indexes for filtering
CREATE INDEX IF NOT EXISTS idx_chart_entries_sale_type ON chart_entries(sale_type);
CREATE INDEX IF NOT EXISTS idx_chart_entries_country ON chart_entries(country);
CREATE INDEX IF NOT EXISTS idx_chart_entries_genre ON chart_entries(genre);

-- Phase 4: Create streaming analytics daily table
CREATE TABLE IF NOT EXISTS streaming_analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_release_id UUID NOT NULL REFERENCES song_releases(id) ON DELETE CASCADE,
  analytics_date DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_streams INTEGER DEFAULT 0,
  daily_revenue INTEGER DEFAULT 0,
  unique_listeners INTEGER DEFAULT 0,
  skip_rate DECIMAL(5,2),
  completion_rate DECIMAL(5,2),
  platform_id UUID REFERENCES streaming_platforms(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(song_release_id, analytics_date, platform_id)
);

-- Enable RLS on streaming_analytics_daily
ALTER TABLE streaming_analytics_daily ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own analytics
CREATE POLICY "Users can view their own streaming analytics"
ON streaming_analytics_daily
FOR SELECT
USING (
  song_release_id IN (
    SELECT sr.id FROM song_releases sr
    JOIN songs s ON s.id = sr.song_id
    WHERE s.user_id = auth.uid() OR s.band_id IN (
      SELECT band_id FROM band_members WHERE user_id = auth.uid()
    )
  )
);

-- System can insert analytics
CREATE POLICY "System can insert streaming analytics"
ON streaming_analytics_daily
FOR INSERT
WITH CHECK (true);

-- Add index for query performance
CREATE INDEX IF NOT EXISTS idx_streaming_analytics_date ON streaming_analytics_daily(analytics_date DESC);
CREATE INDEX IF NOT EXISTS idx_streaming_analytics_song_release ON streaming_analytics_daily(song_release_id);

COMMENT ON TABLE streaming_analytics_daily IS 'Daily granular streaming analytics for detailed performance tracking';
COMMENT ON COLUMN band_song_familiarity.rehearsal_stage IS 'Auto-calculated rehearsal stage: unrehearsed (<21 min), tight (21-40 min), perfect (41-60 min)';