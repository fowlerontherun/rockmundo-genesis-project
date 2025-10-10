-- Add auto_attend column to player_university_enrollments
ALTER TABLE player_university_enrollments
ADD COLUMN auto_attend BOOLEAN DEFAULT false;

-- Add activity feed entry when attending class
CREATE OR REPLACE FUNCTION log_university_attendance_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT NEW.was_locked_out THEN
    -- Log attendance in activity feed
    INSERT INTO activity_feed (user_id, activity_type, message, metadata, earnings)
    SELECT
      pue.user_id,
      'university_attendance',
      'Attended class at ' || u.name || ' - earned ' || NEW.xp_earned || ' XP',
      jsonb_build_object(
        'enrollment_id', pue.id,
        'university_id', u.id,
        'university_name', u.name,
        'course_id', uc.id,
        'course_name', uc.name,
        'xp_earned', NEW.xp_earned
      ),
      NEW.xp_earned
    FROM player_university_enrollments pue
    JOIN universities u ON u.id = pue.university_id
    JOIN university_courses uc ON uc.id = pue.course_id
    WHERE pue.id = NEW.enrollment_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for activity logging
DROP TRIGGER IF EXISTS log_university_attendance_trigger ON player_university_attendance;
CREATE TRIGGER log_university_attendance_trigger
  AFTER INSERT ON player_university_attendance
  FOR EACH ROW
  EXECUTE FUNCTION log_university_attendance_activity();