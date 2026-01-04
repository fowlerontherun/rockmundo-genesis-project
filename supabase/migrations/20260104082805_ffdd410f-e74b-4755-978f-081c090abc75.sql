-- Add public SELECT policy for songs so charts can show all bands' released songs
CREATE POLICY "Anyone can view released songs" 
ON public.songs 
FOR SELECT 
USING (status IN ('released', 'recorded'));

-- Ensure bands are readable by all authenticated users (if not already)
-- This should already exist but adding for safety
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'bands' 
    AND policyname = 'Authenticated users can view all bands'
  ) THEN
    CREATE POLICY "Authenticated users can view all bands"
    ON public.bands
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;