-- Drop the conflicting unique indexes that don't include country
DROP INDEX IF EXISTS idx_chart_entries_unique_song_date;
DROP INDEX IF EXISTS chart_entries_song_unique;

-- Create new unique index that includes country
CREATE UNIQUE INDEX idx_chart_entries_unique_song_date ON public.chart_entries 
  USING btree (song_id, chart_type, chart_date, country) 
  WHERE (song_id IS NOT NULL);