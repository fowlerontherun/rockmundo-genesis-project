
-- Table for paid member recruitment advertisements
CREATE TABLE public.band_member_ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  posted_by_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instrument_role TEXT NOT NULL,
  vocal_role TEXT,
  description TEXT,
  budget_spent NUMERIC NOT NULL DEFAULT 0,
  visibility_boost NUMERIC NOT NULL DEFAULT 1.0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.band_member_ads ENABLE ROW LEVEL SECURITY;

-- Anyone can view active ads
CREATE POLICY "Anyone can view active band member ads"
  ON public.band_member_ads FOR SELECT
  USING (status = 'active');

-- Band members can manage their own ads
CREATE POLICY "Band members can create ads"
  ON public.band_member_ads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.band_members bm
      JOIN public.profiles p ON p.id = bm.profile_id
      WHERE bm.band_id = band_member_ads.band_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Ad creators can update their ads"
  ON public.band_member_ads FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = posted_by_profile_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Ad creators can delete their ads"
  ON public.band_member_ads FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = posted_by_profile_id AND p.user_id = auth.uid()
    )
  );

CREATE INDEX idx_band_member_ads_band ON public.band_member_ads(band_id);
CREATE INDEX idx_band_member_ads_status ON public.band_member_ads(status);
