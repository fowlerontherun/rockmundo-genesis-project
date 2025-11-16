-- Add manufacturing validation trigger for releases
CREATE OR REPLACE FUNCTION check_manufacturing_before_release()
RETURNS TRIGGER AS $$
BEGIN
  -- If release_status is being set to 'released'
  IF NEW.release_status = 'released' THEN
    -- Check if manufacturing is complete
    IF NEW.manufacturing_complete_at IS NULL THEN
      RAISE EXCEPTION 'Cannot release before manufacturing is complete';
    END IF;
    
    -- Check if manufacturing completion date has passed
    IF NEW.manufacturing_complete_at > NOW() THEN
      RAISE EXCEPTION 'Cannot release before manufacturing completion date: %', NEW.manufacturing_complete_at;
    END IF;
    
    -- If there's a scheduled release date, check it
    IF NEW.scheduled_release_date IS NOT NULL AND NEW.scheduled_release_date > CURRENT_DATE THEN
      RAISE EXCEPTION 'Cannot release before scheduled release date: %', NEW.scheduled_release_date;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_manufacturing_before_release
  BEFORE UPDATE ON releases
  FOR EACH ROW
  EXECUTE FUNCTION check_manufacturing_before_release();

-- Add columns to releases table for better tracking
ALTER TABLE releases
ADD COLUMN IF NOT EXISTS format_type text CHECK (format_type IN ('digital', 'cd', 'vinyl', 'cassette')),
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS total_units_sold integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS digital_sales integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS cd_sales integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS vinyl_sales integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS cassette_sales integer DEFAULT 0;

-- Create index for charts queries
CREATE INDEX IF NOT EXISTS idx_releases_status ON releases(release_status);
CREATE INDEX IF NOT EXISTS idx_releases_country ON releases(country);
CREATE INDEX IF NOT EXISTS idx_releases_format ON releases(format_type);
CREATE INDEX IF NOT EXISTS idx_release_sales_date ON release_sales(sale_date);

-- Add streaming platform tracking columns
ALTER TABLE song_releases
ADD COLUMN IF NOT EXISTS platform_name text,
ADD COLUMN IF NOT EXISTS country text;

-- Create comprehensive charts view for singles
CREATE OR REPLACE VIEW chart_singles AS
SELECT 
  s.id as song_id,
  s.title,
  s.genre,
  b.name as band_name,
  sr.country,
  sr.platform_name,
  SUM(COALESCE(sr.total_streams, 0)) as total_streams,
  SUM(COALESCE(sr.total_revenue, 0)) as streaming_revenue,
  COUNT(DISTINCT sr.id) as platform_count
FROM songs s
LEFT JOIN bands b ON s.band_id = b.id
LEFT JOIN song_releases sr ON s.id = sr.song_id
WHERE sr.release_type = 'streaming'
GROUP BY s.id, s.title, s.genre, b.name, sr.country, sr.platform_name;

-- Create comprehensive charts view for albums/releases
CREATE OR REPLACE VIEW chart_albums AS
SELECT 
  r.id as release_id,
  r.title,
  b.name as band_name,
  r.country,
  r.format_type,
  r.digital_sales,
  r.cd_sales,
  r.vinyl_sales,
  r.cassette_sales,
  r.total_units_sold,
  r.total_revenue,
  r.release_status,
  r.created_at
FROM releases r
LEFT JOIN bands b ON r.band_id = b.id
WHERE r.release_status = 'released';

COMMENT ON VIEW chart_singles IS 'Aggregated view of single songs across streaming platforms by country';
COMMENT ON VIEW chart_albums IS 'Aggregated view of album/release sales by format and country';