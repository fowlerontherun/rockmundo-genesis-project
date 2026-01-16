-- ===================================================
-- TWAATER SYSTEM OVERHAUL v1.0.398
-- Adds cron jobs, fame sync, and organic followers
-- ===================================================

-- 1. Create function to sync fame scores from profiles to twaater_accounts
CREATE OR REPLACE FUNCTION public.sync_twaater_fame_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update persona accounts with fame from profiles
  UPDATE twaater_accounts ta
  SET fame_score = COALESCE(p.fame, 0),
      updated_at = now()
  FROM profiles p
  WHERE ta.owner_type = 'persona'
    AND ta.persona_id = p.id
    AND ta.deleted_at IS NULL;

  -- Update band accounts with fame from bands
  UPDATE twaater_accounts ta
  SET fame_score = COALESCE(b.fame, 0),
      updated_at = now()
  FROM bands b
  WHERE ta.owner_type = 'band'
    AND ta.band_id = b.id
    AND ta.deleted_at IS NULL;
    
  RAISE NOTICE 'Synced fame scores for all twaater accounts';
END;
$$;

-- 2. Create function to calculate organic followers based on fame/fans
CREATE OR REPLACE FUNCTION public.calculate_twaater_organic_followers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  player_account RECORD;
  target_followers INTEGER;
  current_followers INTEGER;
  bot_accounts UUID[];
  followers_to_add INTEGER;
  random_bot_id UUID;
  i INTEGER;
BEGIN
  -- Get all active bot account IDs
  SELECT array_agg(account_id) INTO bot_accounts
  FROM twaater_bot_accounts
  WHERE is_active = true;

  IF bot_accounts IS NULL OR array_length(bot_accounts, 1) = 0 THEN
    RAISE NOTICE 'No active bot accounts found';
    RETURN;
  END IF;

  -- Process each player account (persona or band type)
  FOR player_account IN 
    SELECT ta.id, ta.owner_type, ta.fame_score,
           COALESCE(p.fame, 0) as profile_fame,
           COALESCE(b.fame, 0) as band_fame,
           COALESCE(b.total_fans, 0) as fans
    FROM twaater_accounts ta
    LEFT JOIN profiles p ON ta.persona_id = p.id AND ta.owner_type = 'persona'
    LEFT JOIN bands b ON ta.band_id = b.id AND ta.owner_type = 'band'
    WHERE ta.deleted_at IS NULL
      AND ta.id != ALL(bot_accounts)
  LOOP
    -- Calculate target followers based on fame and fans
    -- Formula: base from fame + bonus from fans
    target_followers := GREATEST(1,
      (COALESCE(player_account.profile_fame, 0) + COALESCE(player_account.band_fame, 0)) / 20
      + COALESCE(player_account.fans, 0) / 10
    );

    -- Get current follower count from bots
    SELECT COUNT(*) INTO current_followers
    FROM twaater_follows tf
    WHERE tf.followed_account_id = player_account.id
      AND tf.follower_account_id = ANY(bot_accounts);

    -- If we need more followers, add some
    followers_to_add := LEAST(5, target_followers - current_followers); -- Max 5 new followers per run

    IF followers_to_add > 0 THEN
      FOR i IN 1..followers_to_add LOOP
        -- Pick a random bot that isn't already following
        SELECT ba.account_id INTO random_bot_id
        FROM twaater_bot_accounts ba
        WHERE ba.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM twaater_follows tf
            WHERE tf.follower_account_id = ba.account_id
              AND tf.followed_account_id = player_account.id
          )
        ORDER BY random()
        LIMIT 1;

        IF random_bot_id IS NOT NULL THEN
          -- Create the follow
          INSERT INTO twaater_follows (follower_account_id, followed_account_id)
          VALUES (random_bot_id, player_account.id)
          ON CONFLICT DO NOTHING;

          -- Create notification
          INSERT INTO twaater_notifications (account_id, type, actor_account_id, message)
          SELECT player_account.id, 'follow', random_bot_id,
                 '@' || ta.handle || ' started following you'
          FROM twaater_accounts ta
          WHERE ta.id = random_bot_id;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RAISE NOTICE 'Completed organic follower calculation';
END;
$$;

-- 3. Create function to force minimum bot twaats if feed is empty
CREATE OR REPLACE FUNCTION public.get_recent_twaat_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  twaat_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO twaat_count
  FROM twaats
  WHERE deleted_at IS NULL
    AND created_at > now() - interval '6 hours';
  
  RETURN twaat_count;
END;
$$;

-- 4. Ensure pg_cron and pg_net extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage on cron to postgres (required for scheduling)
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;