-- Create tables to support community charity campaigns and donation tracking
CREATE TABLE IF NOT EXISTS public.community_charity_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  beneficiary TEXT NOT NULL,
  goal_amount NUMERIC(12,2) NOT NULL CHECK (goal_amount >= 0),
  impact_focus TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_charity_impact_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.community_charity_campaigns(id) ON DELETE CASCADE,
  metric_label TEXT NOT NULL,
  metric_value NUMERIC(12,2) NOT NULL,
  metric_unit TEXT,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_charity_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.community_charity_campaigns(id) ON DELETE CASCADE,
  donor_name TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  donated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  message TEXT
);

CREATE INDEX IF NOT EXISTS community_charity_campaigns_slug_idx ON public.community_charity_campaigns (slug);
CREATE INDEX IF NOT EXISTS community_charity_campaigns_status_idx ON public.community_charity_campaigns (status);
CREATE INDEX IF NOT EXISTS community_charity_impact_metrics_campaign_id_idx ON public.community_charity_impact_metrics (campaign_id);
CREATE INDEX IF NOT EXISTS community_charity_donations_campaign_id_idx ON public.community_charity_donations (campaign_id);
CREATE INDEX IF NOT EXISTS community_charity_donations_donated_at_idx ON public.community_charity_donations (donated_at);

ALTER TABLE public.community_charity_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_charity_impact_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_charity_donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access to charity campaigns" ON public.community_charity_campaigns;
CREATE POLICY "Public access to charity campaigns"
  ON public.community_charity_campaigns
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public access to charity metrics" ON public.community_charity_impact_metrics;
CREATE POLICY "Public access to charity metrics"
  ON public.community_charity_impact_metrics
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public access to charity donations" ON public.community_charity_donations;
CREATE POLICY "Public access to charity donations"
  ON public.community_charity_donations
  FOR SELECT
  USING (true);
