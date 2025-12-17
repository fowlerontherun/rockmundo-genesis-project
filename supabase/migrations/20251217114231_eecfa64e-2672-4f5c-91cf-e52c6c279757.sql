-- Create song generation attempts table for tracking and limits
CREATE TABLE public.song_generation_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  timeout_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed', 'timeout')),
  error_message TEXT,
  prompt_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.song_generation_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view their own attempts
CREATE POLICY "Users can view their own generation attempts"
  ON public.song_generation_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all attempts
CREATE POLICY "Service role can manage generation attempts"
  ON public.song_generation_attempts FOR ALL
  USING (true);

-- Index for weekly limit queries
CREATE INDEX idx_song_generation_user_date ON public.song_generation_attempts(user_id, started_at);
CREATE INDEX idx_song_generation_timeout ON public.song_generation_attempts(status, timeout_at) WHERE status = 'generating';

-- Add audio_generation_timeout_at to songs table
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS audio_generation_started_at TIMESTAMP WITH TIME ZONE;

-- Function to check weekly generation limit
CREATE OR REPLACE FUNCTION public.check_song_generation_limit(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
  v_is_admin BOOLEAN;
  v_limit INTEGER := 5;
BEGIN
  -- Check if user is admin
  SELECT EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;
  
  -- Admins have unlimited generations
  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'can_generate', true,
      'is_admin', true,
      'used', 0,
      'limit', -1,
      'remaining', -1
    );
  END IF;
  
  -- Count generations in last 7 days (only completed or generating)
  SELECT COUNT(*) INTO v_count
  FROM song_generation_attempts
  WHERE user_id = p_user_id
    AND started_at > NOW() - INTERVAL '7 days'
    AND status IN ('completed', 'generating');
  
  RETURN jsonb_build_object(
    'can_generate', v_count < v_limit,
    'is_admin', false,
    'used', v_count,
    'limit', v_limit,
    'remaining', GREATEST(0, v_limit - v_count)
  );
END;
$$;

-- Function to cleanup timed out generations
CREATE OR REPLACE FUNCTION public.cleanup_timed_out_generations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Mark timed out attempts
  WITH timed_out AS (
    UPDATE song_generation_attempts
    SET status = 'timeout',
        completed_at = NOW(),
        error_message = 'Generation timed out after 10 minutes'
    WHERE status = 'generating'
      AND timeout_at < NOW()
    RETURNING song_id
  )
  UPDATE songs s
  SET audio_generation_status = 'failed'
  FROM timed_out t
  WHERE s.id = t.song_id;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;