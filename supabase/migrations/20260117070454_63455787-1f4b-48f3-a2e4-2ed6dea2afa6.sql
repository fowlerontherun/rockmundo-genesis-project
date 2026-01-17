-- Update all tour gigs with midnight times to 8pm (20:00) - a typical gig time
UPDATE gigs
SET scheduled_date = scheduled_date + INTERVAL '20 hours'
WHERE tour_id IS NOT NULL
  AND EXTRACT(HOUR FROM scheduled_date) = 0
  AND EXTRACT(MINUTE FROM scheduled_date) = 0;