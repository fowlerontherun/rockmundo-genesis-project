-- Demo submissions table
CREATE TABLE IF NOT EXISTS public.demo_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  band_id UUID REFERENCES bands(id) ON DELETE SET NULL,
  artist_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'accepted', 'rejected')),
  rejection_reason TEXT,
  reviewer_notes TEXT,
  contract_offer_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demo_submissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for demo_submissions
CREATE POLICY "Users can view their own demo submissions" 
  ON public.demo_submissions FOR SELECT 
  USING (
    artist_profile_id = auth.uid() 
    OR band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create demo submissions" 
  ON public.demo_submissions FOR INSERT 
  WITH CHECK (
    artist_profile_id = auth.uid() 
    OR band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'leader')
  );

CREATE POLICY "Users can update their own pending demos" 
  ON public.demo_submissions FOR UPDATE 
  USING (
    status = 'pending' AND (
      artist_profile_id = auth.uid() 
      OR band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'leader')
    )
  );

-- Add new columns to artist_label_contracts for quotas and termination
ALTER TABLE public.artist_label_contracts
  ADD COLUMN IF NOT EXISTS single_quota INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS album_quota INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS singles_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS albums_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS termination_fee_pct INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS manufacturing_covered BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS demo_submission_id UUID REFERENCES demo_submissions(id),
  ADD COLUMN IF NOT EXISTS contract_value NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS termination_fee_paid NUMERIC(12,2) DEFAULT 0;

-- Add contract reference and label share to releases table
ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS label_contract_id UUID REFERENCES artist_label_contracts(id),
  ADD COLUMN IF NOT EXISTS manufacturing_paid_by_label BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS label_revenue_share_pct INTEGER DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_demo_submissions_label ON demo_submissions(label_id);
CREATE INDEX IF NOT EXISTS idx_demo_submissions_song ON demo_submissions(song_id);
CREATE INDEX IF NOT EXISTS idx_demo_submissions_status ON demo_submissions(status);
CREATE INDEX IF NOT EXISTS idx_contracts_demo ON artist_label_contracts(demo_submission_id);
CREATE INDEX IF NOT EXISTS idx_releases_label_contract ON releases(label_contract_id);

-- Add foreign key for contract_offer_id after table exists
ALTER TABLE public.demo_submissions 
  ADD CONSTRAINT demo_submissions_contract_offer_fk 
  FOREIGN KEY (contract_offer_id) REFERENCES artist_label_contracts(id) ON DELETE SET NULL;