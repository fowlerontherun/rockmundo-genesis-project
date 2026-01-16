-- Update setlist limit from 3 to 5
CREATE OR REPLACE FUNCTION public.check_setlist_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  IF (SELECT COUNT(*) FROM setlists WHERE band_id = NEW.band_id AND is_active = true) >= 5 THEN
    RAISE EXCEPTION 'Band can only have 5 active setlists';
  END IF;
  RETURN NEW;
END;
$function$;

-- Add linked_gig_id to player_scheduled_activities for gig scheduling
ALTER TABLE public.player_scheduled_activities
ADD COLUMN IF NOT EXISTS linked_gig_id UUID REFERENCES gigs(id) ON DELETE SET NULL;

-- Add 'failed' status to gigs if not already in the status check
-- First check the current gig statuses and add failure_reason column
ALTER TABLE public.gigs
ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Update gig_outcomes trigger to use actual tickets_sold when available
CREATE OR REPLACE FUNCTION create_gig_outcome_on_start()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_venue_capacity INT;
  v_venue_name TEXT;
  v_actual_attendance INT;
  v_ticket_revenue INT;
BEGIN
  -- Only trigger when status changes to 'in_progress'
  IF NEW.status = 'in_progress' AND (OLD IS NULL OR OLD.status != 'in_progress') THEN
    -- Get venue info
    SELECT capacity, name INTO v_venue_capacity, v_venue_name 
    FROM venues WHERE id = NEW.venue_id;
    
    -- Use tickets_sold if available, otherwise calculate random attendance
    IF COALESCE(NEW.tickets_sold, 0) > 0 THEN
      v_actual_attendance := NEW.tickets_sold;
    ELSE
      -- Fallback: Random 60-90% of capacity
      v_actual_attendance := FLOOR(v_venue_capacity * (0.6 + RANDOM() * 0.3));
    END IF;
    
    -- Calculate ticket revenue
    v_ticket_revenue := v_actual_attendance * COALESCE(NEW.ticket_price, 20);
    
    -- Check if outcome already exists
    IF NOT EXISTS (SELECT 1 FROM gig_outcomes WHERE gig_id = NEW.id) THEN
      INSERT INTO gig_outcomes (
        gig_id, 
        band_id, 
        venue_id, 
        actual_attendance,
        ticket_revenue,
        venue_name
      ) VALUES (
        NEW.id,
        NEW.band_id,
        NEW.venue_id,
        v_actual_attendance,
        v_ticket_revenue,
        v_venue_name
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create index on linked_gig_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_player_scheduled_activities_linked_gig_id 
ON player_scheduled_activities(linked_gig_id);

-- Add 'gig' to activity_type if not present (drop and recreate constraint)
ALTER TABLE public.player_scheduled_activities DROP CONSTRAINT IF EXISTS player_scheduled_activities_activity_type_check;

ALTER TABLE public.player_scheduled_activities
ADD CONSTRAINT player_scheduled_activities_activity_type_check
CHECK (activity_type IN (
  'songwriting', 'gig', 'rehearsal', 'busking', 'recording',
  'travel', 'work', 'university', 'reading', 'mentorship',
  'youtube_video', 'health', 'skill_practice', 'open_mic',
  'pr_appearance', 'film_production', 'jam_session', 'other'
));