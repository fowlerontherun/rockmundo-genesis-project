
-- Add recruiting column to bands
ALTER TABLE public.bands ADD COLUMN is_recruiting boolean NOT NULL DEFAULT false;

-- Create band_applications table
CREATE TABLE public.band_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  applicant_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instrument_role text NOT NULL DEFAULT 'Guitar',
  vocal_role text,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (band_id, applicant_profile_id)
);

ALTER TABLE public.band_applications ENABLE ROW LEVEL SECURITY;

-- Applicants can view their own applications
CREATE POLICY "Users can view own applications"
  ON public.band_applications FOR SELECT TO authenticated
  USING (applicant_profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Anyone authenticated can insert applications
CREATE POLICY "Users can apply to bands"
  ON public.band_applications FOR INSERT TO authenticated
  WITH CHECK (applicant_profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Band leaders can view applications to their band
CREATE POLICY "Leaders can view band applications"
  ON public.band_applications FOR SELECT TO authenticated
  USING (band_id IN (
    SELECT band_id FROM public.band_members WHERE user_id = auth.uid() AND role IN ('leader', 'Founder')
  ));

-- Band leaders can update application status
CREATE POLICY "Leaders can respond to applications"
  ON public.band_applications FOR UPDATE TO authenticated
  USING (band_id IN (
    SELECT band_id FROM public.band_members WHERE user_id = auth.uid() AND role IN ('leader', 'Founder')
  ));
