-- Add weekly_plays column for actual weekly metrics
ALTER TABLE public.chart_entries 
ADD COLUMN IF NOT EXISTS weekly_plays bigint DEFAULT 0;

-- Add combined_score column for weighted chart rankings
ALTER TABLE public.chart_entries 
ADD COLUMN IF NOT EXISTS combined_score bigint DEFAULT 0;

-- Add comments for clarity
COMMENT ON COLUMN public.chart_entries.weekly_plays IS 'Weekly streams/sales for this chart period. plays_count holds all-time total.';
COMMENT ON COLUMN public.chart_entries.combined_score IS 'Weighted score for combined chart: (streams/150) + digital + physical sales';

-- Add index for combined chart sorting
CREATE INDEX IF NOT EXISTS idx_chart_entries_combined_score ON public.chart_entries(combined_score DESC);