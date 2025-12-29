-- Add total_users and monthly_active_users to streaming_platforms
ALTER TABLE public.streaming_platforms 
ADD COLUMN IF NOT EXISTS total_users BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_active_users BIGINT DEFAULT 0;

-- Populate with realistic user counts based on platform
UPDATE public.streaming_platforms SET 
  total_users = CASE platform_name
    WHEN 'Spotify' THEN 600000000
    WHEN 'Apple Music' THEN 100000000
    WHEN 'YouTube Music' THEN 80000000
    WHEN 'Amazon Music' THEN 55000000
    WHEN 'Tidal' THEN 5000000
    WHEN 'Deezer' THEN 16000000
    WHEN 'SoundCloud' THEN 200000000
    WHEN 'Pandora' THEN 55000000
    ELSE 10000000
  END,
  monthly_active_users = CASE platform_name
    WHEN 'Spotify' THEN 300000000
    WHEN 'Apple Music' THEN 50000000
    WHEN 'YouTube Music' THEN 50000000
    WHEN 'Amazon Music' THEN 30000000
    WHEN 'Tidal' THEN 3000000
    WHEN 'Deezer' THEN 10000000
    WHEN 'SoundCloud' THEN 100000000
    WHEN 'Pandora' THEN 30000000
    ELSE 5000000
  END
WHERE total_users IS NULL OR total_users = 0;

-- Fix hype decay: song hype should decay by 1 per day for unreleased songs
-- and grow through PR activities. Create a function that properly handles pre-release hype
CREATE OR REPLACE FUNCTION public.update_song_hype_for_pr(
  p_song_id UUID,
  p_hype_boost INTEGER
)
RETURNS void AS $$
BEGIN
  UPDATE public.songs
  SET 
    hype = LEAST(100, COALESCE(hype, 0) + p_hype_boost),
    updated_at = now()
  WHERE id = p_song_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to decay hype for unreleased songs (called daily)
CREATE OR REPLACE FUNCTION public.decay_unreleased_song_hype()
RETURNS void AS $$
BEGIN
  -- Decay hype by 1 for songs that haven't been released yet
  UPDATE public.songs
  SET 
    hype = GREATEST(0, COALESCE(hype, 0) - 1),
    updated_at = now()
  WHERE status IN ('written', 'recorded', 'mixing', 'mastering')
    AND COALESCE(hype, 0) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;