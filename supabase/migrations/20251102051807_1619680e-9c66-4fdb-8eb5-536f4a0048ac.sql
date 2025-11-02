-- Create function to create initial gig outcome when gig starts
CREATE OR REPLACE FUNCTION create_gig_outcome_on_start()
RETURNS TRIGGER AS $$
DECLARE
  v_venue_capacity INT;
  v_actual_attendance INT;
  v_ticket_revenue INT;
BEGIN
  -- Only create outcome when status changes to in_progress
  IF NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status != 'in_progress') THEN
    -- Get venue capacity
    SELECT capacity INTO v_venue_capacity
    FROM venues
    WHERE id = NEW.venue_id;
    
    -- Calculate attendance (60-90% of capacity)
    v_actual_attendance := FLOOR(v_venue_capacity * (0.6 + RANDOM() * 0.3));
    v_ticket_revenue := v_actual_attendance * COALESCE(NEW.ticket_price, 20);
    
    -- Create initial outcome
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
      performance_grade
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
      'pending'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for gig outcome creation
DROP TRIGGER IF EXISTS create_gig_outcome_trigger ON gigs;
CREATE TRIGGER create_gig_outcome_trigger
  AFTER UPDATE ON gigs
  FOR EACH ROW
  EXECUTE FUNCTION create_gig_outcome_on_start();