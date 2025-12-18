-- Create table for band ratings (thumbs up/down)
CREATE TABLE public.band_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(band_id, user_id)
);

-- Enable RLS
ALTER TABLE public.band_ratings ENABLE ROW LEVEL SECURITY;

-- Users can view all ratings
CREATE POLICY "Anyone can view band ratings"
ON public.band_ratings FOR SELECT
USING (true);

-- Users can insert their own ratings
CREATE POLICY "Users can rate bands"
ON public.band_ratings FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own ratings
CREATE POLICY "Users can update their ratings"
ON public.band_ratings FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own ratings
CREATE POLICY "Users can delete their ratings"
ON public.band_ratings FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_band_ratings_updated_at
BEFORE UPDATE ON public.band_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();