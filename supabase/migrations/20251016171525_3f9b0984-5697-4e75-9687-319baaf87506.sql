-- Fix the award_daily_twaat_xp trigger function to use SECURITY DEFINER
-- Drop the function with CASCADE to remove dependent triggers
DROP FUNCTION IF EXISTS award_daily_twaat_xp() CASCADE;

CREATE OR REPLACE FUNCTION public.award_daily_twaat_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER  -- This allows the trigger to bypass RLS
SET search_path TO 'public'
AS $function$
DECLARE
  today_date DATE;
  current_twaats INTEGER;
  current_xp INTEGER;
  xp_to_award INTEGER;
BEGIN
  today_date := CURRENT_DATE;
  
  -- Get or create today's award record
  INSERT INTO twaater_daily_awards (account_id, date, twaats_awarded, xp_awarded)
  VALUES (NEW.account_id, today_date, 0, 0)
  ON CONFLICT (account_id, date) DO NOTHING;
  
  -- Get current stats
  SELECT twaats_awarded, xp_awarded INTO current_twaats, current_xp
  FROM twaater_daily_awards
  WHERE account_id = NEW.account_id AND date = today_date;
  
  -- Calculate XP (max 3 twaats per day)
  IF current_twaats < 3 THEN
    xp_to_award := 5; -- Base XP
    
    -- Bonus for linked content
    IF NEW.linked_type IS NOT NULL THEN
      xp_to_award := xp_to_award + 2;
    END IF;
    
    -- Update daily award record
    UPDATE twaater_daily_awards
    SET twaats_awarded = current_twaats + 1,
        xp_awarded = current_xp + xp_to_award
    WHERE account_id = NEW.account_id AND date = today_date;
    
    -- Award XP to the user's profile (find owner)
    IF NEW.account_id IN (SELECT id FROM twaater_accounts WHERE owner_type = 'persona') THEN
      UPDATE profiles
      SET experience = COALESCE(experience, 0) + xp_to_award
      WHERE id = (SELECT owner_id FROM twaater_accounts WHERE id = NEW.account_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER award_daily_twaat_xp_trigger
AFTER INSERT ON twaats
FOR EACH ROW
EXECUTE FUNCTION award_daily_twaat_xp();