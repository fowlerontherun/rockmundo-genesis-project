-- Add helper function to increment release revenue
CREATE OR REPLACE FUNCTION increment_release_revenue(release_id UUID, amount NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE releases
  SET total_revenue = COALESCE(total_revenue, 0) + amount,
      updated_at = NOW()
  WHERE id = release_id;
END;
$$;

-- Add per-song and per-platform analytics
ALTER TABLE streaming_analytics_daily
ADD COLUMN IF NOT EXISTS platform_name TEXT,
ADD COLUMN IF NOT EXISTS listener_age_group TEXT,
ADD COLUMN IF NOT EXISTS listener_region TEXT;

-- Create index for better analytics queries
CREATE INDEX IF NOT EXISTS idx_streaming_analytics_platform 
ON streaming_analytics_daily(platform_name, analytics_date);

CREATE INDEX IF NOT EXISTS idx_streaming_analytics_song 
ON streaming_analytics_daily(song_release_id, analytics_date);