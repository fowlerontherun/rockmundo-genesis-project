-- Create website_submissions table for tracking band submissions to websites
CREATE TABLE IF NOT EXISTS public.website_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid REFERENCES public.bands(id) ON DELETE CASCADE NOT NULL,
  website_id uuid REFERENCES public.websites(id) ON DELETE CASCADE NOT NULL,
  song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'scheduled', 'completed')),
  pitch_message text,
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  rejection_reason text,
  compensation_earned integer,
  fame_gained integer,
  fans_gained integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(band_id, website_id)
);

-- Enable RLS
ALTER TABLE public.website_submissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their band website submissions" 
  ON public.website_submissions 
  FOR SELECT 
  USING (
    band_id IN (
      SELECT bm.band_id FROM band_members bm WHERE bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create submissions for their band" 
  ON public.website_submissions 
  FOR INSERT 
  WITH CHECK (
    band_id IN (
      SELECT bm.band_id FROM band_members bm WHERE bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their band submissions" 
  ON public.website_submissions 
  FOR UPDATE 
  USING (
    band_id IN (
      SELECT bm.band_id FROM band_members bm WHERE bm.user_id = auth.uid()
    )
  );

-- Add website type to MediaSubmissionDialog config by extending media type support
-- Also add genres column to websites table for consistency with other media types
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS genres text[] DEFAULT '{}';

-- Update existing websites with reasonable genre assignments
UPDATE public.websites SET genres = ARRAY['rock', 'indie', 'alternative'] WHERE name IN ('Pitchfork', 'Stereogum', 'Consequence');
UPDATE public.websites SET genres = ARRAY['rock', 'indie', 'pop'] WHERE name IN ('NME', 'DIY Magazine', 'The Line of Best Fit');
UPDATE public.websites SET genres = ARRAY['rock', 'indie', 'punk'] WHERE name = 'Brooklyn Vegan';
UPDATE public.websites SET genres = ARRAY['pop', 'hip-hop', 'r&b', 'rock'] WHERE name IN ('Billboard', 'Rolling Stone');
UPDATE public.websites SET genres = ARRAY['alternative', 'rock', 'indie'] WHERE name IN ('SPIN', 'Paste Magazine', 'Clash Magazine');
UPDATE public.websites SET genres = ARRAY['experimental', 'electronic', 'indie'] WHERE name = 'The Quietus';
UPDATE public.websites SET genres = ARRAY['rock', 'indie', 'folk', 'electronic'] WHERE name = 'Exclaim!';
UPDATE public.websites SET genres = ARRAY['indie', 'alternative'] WHERE name = 'Under the Radar';