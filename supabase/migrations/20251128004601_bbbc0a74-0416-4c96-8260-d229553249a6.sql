-- Add ticket sales tracking to gigs table
ALTER TABLE public.gigs 
ADD COLUMN IF NOT EXISTS predicted_tickets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tickets_sold INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_ticket_update TIMESTAMPTZ DEFAULT now();

-- Create index for efficient ticket sale queries
CREATE INDEX IF NOT EXISTS idx_gigs_ticket_sales ON public.gigs(scheduled_date, status) 
WHERE status IN ('scheduled', 'confirmed');

-- Function to calculate predicted tickets based on band fame and venue capacity
CREATE OR REPLACE FUNCTION calculate_predicted_tickets(
  p_band_id UUID,
  p_venue_capacity INTEGER,
  p_scheduled_date TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band_fame INTEGER;
  v_days_until_gig INTEGER;
  v_predicted INTEGER;
  v_fame_multiplier NUMERIC;
BEGIN
  -- Get band fame
  SELECT COALESCE(fame, 0) INTO v_band_fame
  FROM bands
  WHERE id = p_band_id;
  
  -- Calculate days until gig
  v_days_until_gig := GREATEST(0, EXTRACT(DAY FROM (p_scheduled_date - NOW())));
  
  -- Fame-based multiplier (0.2 to 1.0 based on fame 0-10000)
  v_fame_multiplier := LEAST(1.0, 0.2 + (v_band_fame::NUMERIC / 10000.0 * 0.8));
  
  -- Base prediction: 30-90% of capacity based on fame
  v_predicted := FLOOR(p_venue_capacity * v_fame_multiplier);
  
  -- Apply time-based modifier (gigs far in future sell fewer early tickets)
  IF v_days_until_gig > 7 THEN
    v_predicted := FLOOR(v_predicted * 0.3); -- Only 30% predicted for distant gigs
  ELSIF v_days_until_gig > 3 THEN
    v_predicted := FLOOR(v_predicted * 0.6); -- 60% for medium-term gigs
  END IF;
  
  RETURN GREATEST(10, v_predicted); -- Minimum 10 tickets
END;
$$;

-- Function to simulate ticket sales over time
CREATE OR REPLACE FUNCTION simulate_ticket_sales()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gig RECORD;
  v_days_until_gig INTEGER;
  v_daily_sales INTEGER;
  v_new_total INTEGER;
BEGIN
  -- Process all scheduled gigs
  FOR v_gig IN 
    SELECT g.id, g.band_id, g.scheduled_date, g.predicted_tickets, 
           g.tickets_sold, v.capacity,
           COALESCE(g.last_ticket_update, g.created_at) as last_update
    FROM gigs g
    JOIN venues v ON g.venue_id = v.id
    WHERE g.status IN ('scheduled', 'confirmed')
    AND g.scheduled_date > NOW()
    AND g.scheduled_date < NOW() + INTERVAL '30 days'
  LOOP
    -- Calculate days until gig
    v_days_until_gig := GREATEST(0, EXTRACT(DAY FROM (v_gig.scheduled_date - NOW())));
    
    -- Skip if updated recently (within last 6 hours)
    IF v_gig.last_update > NOW() - INTERVAL '6 hours' THEN
      CONTINUE;
    END IF;
    
    -- Calculate daily sales based on proximity to gig
    IF v_days_until_gig <= 1 THEN
      v_daily_sales := FLOOR((v_gig.predicted_tickets - v_gig.tickets_sold) * 0.4); -- 40% remaining in final day
    ELSIF v_days_until_gig <= 3 THEN
      v_daily_sales := FLOOR((v_gig.predicted_tickets - v_gig.tickets_sold) * 0.15); -- 15% per day
    ELSIF v_days_until_gig <= 7 THEN
      v_daily_sales := FLOOR((v_gig.predicted_tickets - v_gig.tickets_sold) * 0.08); -- 8% per day
    ELSE
      v_daily_sales := FLOOR((v_gig.predicted_tickets - v_gig.tickets_sold) * 0.03); -- 3% per day for far-out gigs
    END IF;
    
    -- Add some randomness (±30%)
    v_daily_sales := FLOOR(v_daily_sales * (0.7 + random() * 0.6));
    v_daily_sales := GREATEST(1, v_daily_sales); -- At least 1 ticket
    
    -- Calculate new total, capped at predicted tickets
    v_new_total := LEAST(v_gig.predicted_tickets, v_gig.tickets_sold + v_daily_sales);
    
    -- Update the gig
    UPDATE gigs
    SET tickets_sold = v_new_total,
        last_ticket_update = NOW()
    WHERE id = v_gig.id;
    
  END LOOP;
END;
$$;

-- Trigger to set predicted tickets when gig is created
CREATE OR REPLACE FUNCTION set_predicted_tickets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity INTEGER;
BEGIN
  -- Get venue capacity
  SELECT capacity INTO v_capacity
  FROM venues
  WHERE id = NEW.venue_id;
  
  -- Set predicted tickets
  NEW.predicted_tickets := calculate_predicted_tickets(
    NEW.band_id,
    COALESCE(v_capacity, 100),
    NEW.scheduled_date
  );
  
  -- Initialize tickets_sold if not set
  IF NEW.tickets_sold IS NULL THEN
    NEW.tickets_sold := 0;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_predicted_tickets
BEFORE INSERT OR UPDATE OF scheduled_date, band_id, venue_id ON gigs
FOR EACH ROW
WHEN (NEW.status IN ('scheduled', 'confirmed'))
EXECUTE FUNCTION set_predicted_tickets();

-- Backfill predicted tickets for existing gigs
UPDATE gigs g
SET predicted_tickets = calculate_predicted_tickets(
  g.band_id,
  COALESCE(v.capacity, 100),
  g.scheduled_date
),
tickets_sold = FLOOR(calculate_predicted_tickets(
  g.band_id,
  COALESCE(v.capacity, 100),
  g.scheduled_date
) * CASE 
  WHEN EXTRACT(DAY FROM (g.scheduled_date - NOW())) > 7 THEN 0.2
  WHEN EXTRACT(DAY FROM (g.scheduled_date - NOW())) > 3 THEN 0.5
  ELSE 0.8
END)
FROM venues v
WHERE g.venue_id = v.id
AND g.status IN ('scheduled', 'confirmed')
AND g.scheduled_date > NOW();