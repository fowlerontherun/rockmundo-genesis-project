-- Part 1: Delete legacy skill progress entries
DELETE FROM skill_progress 
WHERE skill_slug IN ('guitar', 'bass', 'drums', 'vocals', 'songwriting', 'performance');

-- Part 2: Add seasonal availability to mentors
ALTER TABLE education_mentors 
  ADD COLUMN IF NOT EXISTS available_seasons TEXT[] DEFAULT NULL;

ALTER TABLE education_mentors 
  ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT NULL;

ALTER TABLE education_mentors 
  ADD COLUMN IF NOT EXISTS current_students INTEGER DEFAULT 0;

ALTER TABLE education_mentors 
  ALTER COLUMN bonus_description DROP NOT NULL;