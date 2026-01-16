-- Set max_employees for all job types
UPDATE jobs SET max_employees = 5 WHERE title = 'Cleaner' AND max_employees IS NULL;
UPDATE jobs SET max_employees = 4 WHERE title = 'Dishwasher' AND max_employees IS NULL;
UPDATE jobs SET max_employees = 3 WHERE title = 'Garbage Collector' AND max_employees IS NULL;
UPDATE jobs SET max_employees = 6 WHERE title = 'Fast Food Worker' AND max_employees IS NULL;
UPDATE jobs SET max_employees = 8 WHERE title = 'Warehouse Worker' AND max_employees IS NULL;
UPDATE jobs SET max_employees = 10 WHERE title = 'Telemarketer' AND max_employees IS NULL;
UPDATE jobs SET max_employees = 4 WHERE title = 'Car Wash Attendant' AND max_employees IS NULL;
UPDATE jobs SET max_employees = 2 WHERE title = 'Music Blog Writer' AND max_employees IS NULL;
UPDATE jobs SET max_employees = 2 WHERE title = 'Session Musician' AND max_employees IS NULL;
UPDATE jobs SET max_employees = 2 WHERE title = 'Venue Sound Tech' AND max_employees IS NULL;
UPDATE jobs SET max_employees = 3 WHERE title = 'Music Store Clerk' AND max_employees IS NULL;
UPDATE jobs SET max_employees = 2 WHERE title = 'Radio Station Intern' AND max_employees IS NULL;
UPDATE jobs SET max_employees = 4 WHERE title = 'Roadie' AND max_employees IS NULL;
UPDATE jobs SET max_employees = 2 WHERE title = 'Studio Runner' AND max_employees IS NULL;
UPDATE jobs SET max_employees = 4 WHERE title ILIKE '%Bartender%' AND max_employees IS NULL;
UPDATE jobs SET max_employees = 6 WHERE title ILIKE '%Barista%' AND max_employees IS NULL;
UPDATE jobs SET max_employees = 4 WHERE title ILIKE '%Waiter%' OR title ILIKE '%Waitress%' AND max_employees IS NULL;
UPDATE jobs SET max_employees = 5 WHERE title ILIKE '%Cashier%' AND max_employees IS NULL;

-- Set default max_employees for any remaining jobs without limits
UPDATE jobs SET max_employees = 5 WHERE max_employees IS NULL;

-- Ensure current_employees is set to 0 where null
UPDATE jobs SET current_employees = 0 WHERE current_employees IS NULL;

-- Create function to hire a player atomically (prevents race conditions)
CREATE OR REPLACE FUNCTION hire_player(
  p_profile_id UUID,
  p_job_id UUID
) RETURNS UUID AS $$
DECLARE
  v_employment_id UUID;
  v_current_count INTEGER;
  v_max_count INTEGER;
  v_old_job_id UUID;
BEGIN
  -- Lock the job row to prevent concurrent hires
  SELECT current_employees, max_employees INTO v_current_count, v_max_count
  FROM jobs WHERE id = p_job_id FOR UPDATE;
  
  -- Check if position is available
  IF v_max_count IS NOT NULL AND v_current_count >= v_max_count THEN
    RAISE EXCEPTION 'Position is no longer available';
  END IF;
  
  -- Get any existing employment and decrement old job count
  SELECT job_id INTO v_old_job_id
  FROM player_employment 
  WHERE profile_id = p_profile_id AND status = 'employed';
  
  IF v_old_job_id IS NOT NULL THEN
    UPDATE jobs SET current_employees = GREATEST(0, COALESCE(current_employees, 1) - 1)
    WHERE id = v_old_job_id;
  END IF;
  
  -- Delete any existing employment for this player
  DELETE FROM player_employment WHERE profile_id = p_profile_id;
  
  -- Create new employment record
  INSERT INTO player_employment (profile_id, job_id, status, auto_clock_in)
  VALUES (p_profile_id, p_job_id, 'employed', true)
  RETURNING id INTO v_employment_id;
  
  -- Increment the employee count
  UPDATE jobs SET current_employees = COALESCE(current_employees, 0) + 1
  WHERE id = p_job_id;
  
  RETURN v_employment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to quit a job atomically
CREATE OR REPLACE FUNCTION quit_job(
  p_employment_id UUID
) RETURNS VOID AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Get job_id and update employment status
  UPDATE player_employment 
  SET status = 'quit', terminated_at = NOW()
  WHERE id = p_employment_id
  RETURNING job_id INTO v_job_id;
  
  -- Decrement employee count
  IF v_job_id IS NOT NULL THEN
    UPDATE jobs SET current_employees = GREATEST(0, COALESCE(current_employees, 1) - 1)
    WHERE id = v_job_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to sync employee counts (for fixing inconsistencies)
CREATE OR REPLACE FUNCTION sync_job_employee_counts()
RETURNS VOID AS $$
BEGIN
  UPDATE jobs j SET current_employees = (
    SELECT COUNT(*) FROM player_employment pe 
    WHERE pe.job_id = j.id AND pe.status = 'employed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;