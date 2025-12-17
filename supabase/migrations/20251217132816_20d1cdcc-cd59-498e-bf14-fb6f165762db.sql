-- Add sound_description to bands table
ALTER TABLE bands 
ADD COLUMN IF NOT EXISTS sound_description TEXT;

COMMENT ON COLUMN bands.sound_description IS 
'A paragraph describing the band''s sound/style, used in AI song generation prompts';

-- Create function to get weighted vote score for a song
CREATE OR REPLACE FUNCTION get_song_vote_score(p_song_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_score INTEGER;
BEGIN
  SELECT COALESCE(
    SUM(CASE 
      WHEN sv.vote_type = 'up' THEN 
        CASE WHEN EXISTS (
          SELECT 1 FROM vip_subscriptions 
          WHERE user_id = sv.user_id AND status = 'active' AND expires_at > NOW()
        ) THEN 2 ELSE 1 END
      ELSE 
        CASE WHEN EXISTS (
          SELECT 1 FROM vip_subscriptions 
          WHERE user_id = sv.user_id AND status = 'active' AND expires_at > NOW()
        ) THEN -2 ELSE -1 END
    END), 0
  )
  INTO v_score
  FROM song_votes sv
  WHERE sv.song_id = p_song_id;
  
  RETURN v_score;
END;
$$;

-- Create trigger function to boost band fame on upvote
CREATE OR REPLACE FUNCTION process_song_vote_fame()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When a song gets upvoted, give small fame boost to band
  IF NEW.vote_type = 'up' THEN
    UPDATE bands b
    SET fame = COALESCE(fame, 0) + 1
    FROM songs s
    WHERE s.id = NEW.song_id AND s.band_id = b.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on song_votes
DROP TRIGGER IF EXISTS on_song_vote_fame ON song_votes;
CREATE TRIGGER on_song_vote_fame
AFTER INSERT ON song_votes
FOR EACH ROW EXECUTE FUNCTION process_song_vote_fame();