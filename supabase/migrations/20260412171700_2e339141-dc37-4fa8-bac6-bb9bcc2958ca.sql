
-- Backfill chemistry_contribution based on band chemistry_level and days in band
UPDATE band_members bm
SET chemistry_contribution = LEAST(
  b.chemistry_level,
  GREATEST(1, ROUND(b.chemistry_level * (1.0 + EXTRACT(EPOCH FROM (now() - bm.joined_at)) / 86400 / 100.0)))
)
FROM bands b
WHERE bm.band_id = b.id
  AND (bm.chemistry_contribution IS NULL OR bm.chemistry_contribution = 0)
  AND bm.joined_at IS NOT NULL;

-- Set a baseline skill_contribution for members that have 0 or 1
-- This will be overwritten by the live skill calculator on next gig/rehearsal
UPDATE band_members
SET skill_contribution = 10
WHERE (skill_contribution IS NULL OR skill_contribution <= 1)
  AND is_touring_member = false;
