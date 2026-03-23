-- Fix existing enrollments where user_id was set to profile_id instead of auth user_id
UPDATE player_university_enrollments e
SET user_id = p.user_id
FROM profiles p
WHERE e.profile_id = p.id
AND e.user_id = e.profile_id;

-- Fix the trigger to use the correct user_id from profiles table
CREATE OR REPLACE FUNCTION log_university_attendance_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT NEW.was_locked_out THEN
    INSERT INTO activity_feed (user_id, profile_id, activity_type, message, metadata, earnings)
    SELECT p.user_id, pue.profile_id, 'university_attendance',
      'Attended class at ' || u.name || ' - earned ' || NEW.xp_earned || ' XP',
      jsonb_build_object('enrollment_id', pue.id, 'university_id', u.id, 'university_name', u.name, 'course_id', uc.id, 'course_name', uc.name, 'xp_earned', NEW.xp_earned),
      NEW.xp_earned
    FROM player_university_enrollments pue
    JOIN profiles p ON p.id = pue.profile_id
    JOIN universities u ON u.id = pue.university_id
    JOIN university_courses uc ON uc.id = pue.course_id
    WHERE pue.id = NEW.enrollment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;