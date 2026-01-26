-- Add release_title column to chart_entries for album/EP display
ALTER TABLE public.chart_entries 
ADD COLUMN IF NOT EXISTS release_title TEXT;

-- Add index for faster album chart queries
CREATE INDEX IF NOT EXISTS idx_chart_entries_release_id ON public.chart_entries(release_id) WHERE release_id IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.chart_entries.release_title IS 'Album/EP title for entry_type=album entries, stored directly to avoid joins';