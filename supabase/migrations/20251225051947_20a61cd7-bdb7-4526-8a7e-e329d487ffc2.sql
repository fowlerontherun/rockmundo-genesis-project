-- Add fame column to songs table
ALTER TABLE public.songs 
ADD COLUMN IF NOT EXISTS fame integer DEFAULT 0;

-- Add comment explaining the column
COMMENT ON COLUMN public.songs.fame IS 'Song fame rating that grows with sales, streams, radio plays and PR activities';

-- Create index for fame queries
CREATE INDEX IF NOT EXISTS idx_songs_fame ON public.songs(fame);

-- Create function to update song fame based on activity
CREATE OR REPLACE FUNCTION public.update_song_fame(
  p_song_id uuid,
  p_fame_amount integer,
  p_source text
)
RETURNS void AS $$
BEGIN
  UPDATE public.songs
  SET 
    fame = COALESCE(fame, 0) + p_fame_amount,
    updated_at = now()
  WHERE id = p_song_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to update song hype (decay and boost)
CREATE OR REPLACE FUNCTION public.update_song_hype(
  p_song_id uuid,
  p_hype_change integer
)
RETURNS void AS $$
BEGIN
  UPDATE public.songs
  SET 
    hype = GREATEST(0, LEAST(100, COALESCE(hype, 0) + p_hype_change)),
    updated_at = now()
  WHERE id = p_song_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;