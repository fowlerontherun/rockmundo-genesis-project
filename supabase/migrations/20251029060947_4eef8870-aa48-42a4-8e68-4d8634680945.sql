-- Remove duplicate skill progress entries
-- Keep only the most recent entry for each (profile_id, skill_slug) combination

DELETE FROM skill_progress
WHERE id IN (
  SELECT id FROM (
    SELECT 
      id, 
      ROW_NUMBER() OVER (
        PARTITION BY profile_id, skill_slug 
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
      ) as row_num
    FROM skill_progress
  ) ranked
  WHERE row_num > 1
);

-- Add a unique constraint to prevent future duplicates
ALTER TABLE skill_progress
ADD CONSTRAINT skill_progress_profile_skill_unique 
UNIQUE (profile_id, skill_slug);