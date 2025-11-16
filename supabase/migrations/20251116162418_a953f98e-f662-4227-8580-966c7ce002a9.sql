-- Create function to complete travel and update player location
CREATE OR REPLACE FUNCTION complete_travel_and_update_location()
RETURNS trigger AS $$
BEGIN
  -- When travel status changes to 'completed', update player's current city
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE profiles
    SET current_city_id = NEW.to_city_id
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update player location when travel completes
DROP TRIGGER IF EXISTS update_location_on_travel_complete ON player_travel_history;
CREATE TRIGGER update_location_on_travel_complete
  AFTER UPDATE ON player_travel_history
  FOR EACH ROW
  EXECUTE FUNCTION complete_travel_and_update_location();

-- Create function to automatically complete travel when arrival time is reached
CREATE OR REPLACE FUNCTION auto_complete_travel()
RETURNS void AS $$
BEGIN
  UPDATE player_travel_history
  SET status = 'completed'
  WHERE status = 'in_progress'
    AND arrival_time <= NOW();
    
  -- Also start scheduled travel that has reached departure time
  UPDATE player_travel_history
  SET status = 'in_progress',
      departure_time = scheduled_departure_time
  WHERE status = 'scheduled'
    AND scheduled_departure_time <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;