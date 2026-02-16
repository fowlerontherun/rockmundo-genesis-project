-- Add frequency_years to major_events (1 = annual, 2 = biennial, 4 = quadrennial)
ALTER TABLE public.major_events ADD COLUMN frequency_years integer NOT NULL DEFAULT 1;

-- Add last_occurrence_year to track when to next generate an instance
ALTER TABLE public.major_events ADD COLUMN last_occurrence_year integer;

-- Update major_event_instances to support 'completed' status for history
-- (status already supports 'upcoming', let's also allow 'completed' and 'past')
