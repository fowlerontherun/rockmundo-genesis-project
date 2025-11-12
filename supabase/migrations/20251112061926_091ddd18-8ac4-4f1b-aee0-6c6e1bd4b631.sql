-- Fix university attendance XP constraint to allow proper XP ranges
ALTER TABLE player_university_attendance 
DROP CONSTRAINT IF EXISTS player_university_attendance_xp_earned_check;

-- Add new constraint allowing XP from 0 to 1000 (covering all course types)
ALTER TABLE player_university_attendance 
ADD CONSTRAINT player_university_attendance_xp_earned_check 
CHECK (xp_earned >= 0 AND xp_earned <= 1000);