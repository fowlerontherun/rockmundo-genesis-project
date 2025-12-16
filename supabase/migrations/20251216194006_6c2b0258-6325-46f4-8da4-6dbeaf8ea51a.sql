-- Create promotional_campaigns table for release marketing
CREATE TABLE public.promotional_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  release_id UUID REFERENCES public.releases(id) ON DELETE CASCADE,
  band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE,
  campaign_type TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  budget NUMERIC NOT NULL DEFAULT 0,
  spent NUMERIC NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  effects JSONB DEFAULT '{}',
  results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promotional_campaigns ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own campaigns" 
ON public.promotional_campaigns 
FOR SELECT 
USING (
  release_id IN (SELECT id FROM releases WHERE user_id = auth.uid())
  OR band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can create campaigns for their releases" 
ON public.promotional_campaigns 
FOR INSERT 
WITH CHECK (
  release_id IN (SELECT id FROM releases WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their own campaigns" 
ON public.promotional_campaigns 
FOR UPDATE 
USING (
  release_id IN (SELECT id FROM releases WHERE user_id = auth.uid())
);

-- Create index for performance
CREATE INDEX idx_promotional_campaigns_release ON public.promotional_campaigns(release_id);
CREATE INDEX idx_promotional_campaigns_status ON public.promotional_campaigns(status);

-- Create trigger for updated_at
CREATE TRIGGER update_promotional_campaigns_updated_at
BEFORE UPDATE ON public.promotional_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();