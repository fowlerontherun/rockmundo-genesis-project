-- Trigger to detect mentions in twaats and create mention records
CREATE OR REPLACE FUNCTION public.detect_twaat_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  mention_handle TEXT;
  mentioned_acc_id UUID;
BEGIN
  -- Extract @handles from the body using regex
  FOR mention_handle IN 
    SELECT DISTINCT regexp_matches(NEW.body, '@([a-zA-Z0-9_]+)', 'g')::text
  LOOP
    -- Clean the handle (remove @)
    mention_handle := trim(both '@' from mention_handle);
    mention_handle := trim(both '{' from mention_handle);
    mention_handle := trim(both '}' from mention_handle);
    
    -- Find the account with this handle
    SELECT id INTO mentioned_acc_id
    FROM twaater_accounts
    WHERE handle = mention_handle
    LIMIT 1;
    
    -- Create mention record if account found
    IF mentioned_acc_id IS NOT NULL THEN
      INSERT INTO twaater_mentions (mentioned_account_id, source_twaat_id)
      VALUES (mentioned_acc_id, NEW.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_twaat_created_detect_mentions
AFTER INSERT ON twaats
FOR EACH ROW
EXECUTE FUNCTION public.detect_twaat_mentions();

-- Trigger to award daily XP for twaats
CREATE OR REPLACE FUNCTION public.award_daily_twaat_xp()
RETURNS TRIGGER
LANGUAGE plpgsql
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

CREATE TRIGGER on_twaat_created_award_xp
AFTER INSERT ON twaats
FOR EACH ROW
EXECUTE FUNCTION public.award_daily_twaat_xp();