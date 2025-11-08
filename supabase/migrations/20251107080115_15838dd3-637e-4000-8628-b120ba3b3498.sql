-- Drop trigger with CASCADE
DROP TRIGGER IF EXISTS create_gig_outcome_trigger ON gigs CASCADE;
DROP TRIGGER IF EXISTS create_gig_outcome_on_start_trigger ON gigs CASCADE;
DROP FUNCTION IF EXISTS create_gig_outcome_on_start() CASCADE;

-- Create improved trigger function that captures venue details
CREATE OR REPLACE FUNCTION create_gig_outcome_on_start()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_venue_capacity INT;
  v_venue_name TEXT;
  v_actual_attendance INT;
  v_ticket_revenue INT;
BEGIN
  -- Only create outcome when status changes to in_progress
  IF NEW.status = 'in_progress' AND (OLD IS NULL OR OLD.status != 'in_progress') THEN
    -- Get venue details
    SELECT capacity, name INTO v_venue_capacity, v_venue_name
    FROM venues
    WHERE id = NEW.venue_id;
    
    -- Calculate attendance (60-90% of capacity)
    v_actual_attendance := FLOOR(v_venue_capacity * (0.6 + RANDOM() * 0.3));
    v_ticket_revenue := v_actual_attendance * COALESCE(NEW.ticket_price, 20);
    
    -- Create initial outcome with venue info
    INSERT INTO gig_outcomes (
      gig_id,
      actual_attendance,
      attendance_percentage,
      ticket_revenue,
      merch_revenue,
      total_revenue,
      venue_cost,
      crew_cost,
      equipment_cost,
      total_costs,
      net_profit,
      overall_rating,
      performance_grade,
      venue_name,
      venue_capacity
    ) VALUES (
      NEW.id,
      v_actual_attendance,
      (v_actual_attendance::FLOAT / v_venue_capacity::FLOAT) * 100,
      v_ticket_revenue,
      0,
      v_ticket_revenue,
      0,
      0,
      0,
      0,
      v_ticket_revenue,
      0,
      'pending',
      v_venue_name,
      v_venue_capacity
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER create_gig_outcome_on_start_trigger
AFTER UPDATE ON gigs
FOR EACH ROW
EXECUTE FUNCTION create_gig_outcome_on_start();