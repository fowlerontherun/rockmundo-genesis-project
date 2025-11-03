-- Add completed_at column to gig_outcomes if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gig_outcomes' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE gig_outcomes ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Mark stuck gigs as completed
UPDATE gigs 
SET status = 'completed'
WHERE id IN ('37c7d99b-12ad-4a88-8d9f-1a5cbb88a6f8', '86c00b1a-9eb0-4678-ad48-3c671307809b')
  AND status = 'in_progress';

-- Update their outcomes
UPDATE gig_outcomes
SET completed_at = NOW(),
    overall_rating = 15.0,
    performance_grade = 'B',
    fame_gained = 5,
    chemistry_change = 0
WHERE gig_id IN ('37c7d99b-12ad-4a88-8d9f-1a5cbb88a6f8', '86c00b1a-9eb0-4678-ad48-3c671307809b')
  AND completed_at IS NULL;