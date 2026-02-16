
-- Add genre and duration to major_events
ALTER TABLE public.major_events 
  ADD COLUMN IF NOT EXISTS genre text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS duration_hours integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS cooldown_years integer DEFAULT 3;

-- Add event_start and event_end to instances for schedule blocking
ALTER TABLE public.major_event_instances
  ADD COLUMN IF NOT EXISTS event_start timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS event_end timestamptz DEFAULT NULL;

-- Update events with genres and durations
-- Music events get specific genres
UPDATE public.major_events SET genre = 'Rock', duration_hours = 2 WHERE name = 'Glastonbury Pyramid Stage Headline';
UPDATE public.major_events SET genre = 'Pop', duration_hours = 2 WHERE name = 'Coachella Main Stage Headline';
UPDATE public.major_events SET genre = 'Pop', duration_hours = 4 WHERE name = 'Grammy Awards';
UPDATE public.major_events SET genre = 'Hip Hop', duration_hours = 3 WHERE name = 'MTV VMAs';
UPDATE public.major_events SET genre = 'Pop', duration_hours = 3 WHERE name = 'Brit Awards';
UPDATE public.major_events SET genre = 'R&B', duration_hours = 2 WHERE name = 'Super Bowl Halftime Show';
UPDATE public.major_events SET genre = 'Electronica', duration_hours = 5 WHERE name = 'New Year''s Eve Times Square';
UPDATE public.major_events SET genre = 'Pop', duration_hours = 2 WHERE name = 'BBC Variety Show';
-- Sports/ceremony events are multi-genre (NULL = any genre can be invited)
UPDATE public.major_events SET genre = NULL, duration_hours = 4 WHERE name = 'Olympics Opening Ceremony';
UPDATE public.major_events SET genre = NULL, duration_hours = 3 WHERE name = 'Olympics Closing Ceremony';
UPDATE public.major_events SET genre = NULL, duration_hours = 3 WHERE name = 'Men''s World Cup Final';
UPDATE public.major_events SET genre = NULL, duration_hours = 3 WHERE name = 'Women''s World Cup Final';
UPDATE public.major_events SET genre = NULL, duration_hours = 4 WHERE name = 'Winter Olympics Opening Ceremony';
UPDATE public.major_events SET genre = NULL, duration_hours = 3 WHERE name = 'Winter Olympics Closing Ceremony';

-- Clear all instances and repopulate with proper event_start/event_end
TRUNCATE public.major_event_song_performances CASCADE;
TRUNCATE public.major_event_performances CASCADE;
TRUNCATE public.major_event_instances CASCADE;

-- Repopulate instances for years 1-10 with event_start/event_end
-- Using game epoch: Jan 1, 2026 = Year 1. Each game year = 120 real days.
-- Month offset within a game year: (month-1)*10 days into the year
DO $$
DECLARE
  ev RECORD;
  yr INT;
  epoch TIMESTAMPTZ := '2026-01-01T00:00:00Z';
  day_offset INT;
  ev_start TIMESTAMPTZ;
  ev_end TIMESTAMPTZ;
BEGIN
  FOR ev IN SELECT * FROM public.major_events WHERE is_active = true LOOP
    FOR yr IN 1..10 LOOP
      -- Check frequency
      IF ev.frequency_years = 1 OR (yr % ev.frequency_years = 0) THEN
        -- Calculate real-world datetime
        -- Year starts at epoch + (yr-1)*120 days, month adds (month-1)*10 days
        day_offset := (yr - 1) * 120 + (ev.month - 1) * 10;
        ev_start := epoch + (day_offset || ' days')::interval + interval '18 hours'; -- 6pm start
        ev_end := ev_start + ((ev.duration_hours || ' hours')::interval);
        
        INSERT INTO public.major_event_instances (event_id, year, status, invited_band_ids, event_date, event_start, event_end)
        VALUES (ev.id, yr, 'upcoming', '{}', ev_start, ev_start, ev_end);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Set max 2 bands invited per event based on genre matching and fame
-- This will be handled in the application logic instead of pre-populating invited_band_ids
