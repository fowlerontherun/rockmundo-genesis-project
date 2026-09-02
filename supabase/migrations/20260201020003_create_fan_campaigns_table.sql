-- Create fan_campaigns table to track engagement campaign performance
CREATE TABLE IF NOT EXISTS public.fan_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  cost NUMERIC(12,2) NOT NULL CHECK (cost >= 0),
  duration INTEGER NOT NULL CHECK (duration > 0),
  expected_growth INTEGER NOT NULL CHECK (expected_growth >= 0),
  target_demo TEXT NOT NULL,
  actual_growth INTEGER CHECK (actual_growth >= 0),
  roi NUMERIC(6,2),
  results JSONB,
  launched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fan_campaigns_user_id_idx ON public.fan_campaigns (user_id);

ALTER TABLE public.fan_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their fan campaigns" ON public.fan_campaigns;
CREATE POLICY "Users can view their fan campaigns"
  ON public.fan_campaigns
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their fan campaigns" ON public.fan_campaigns;
CREATE POLICY "Users can insert their fan campaigns"
  ON public.fan_campaigns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their fan campaigns" ON public.fan_campaigns;
CREATE POLICY "Users can update their fan campaigns"
  ON public.fan_campaigns
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their fan campaigns" ON public.fan_campaigns;
CREATE POLICY "Users can delete their fan campaigns"
  ON public.fan_campaigns
  FOR DELETE
  USING (auth.uid() = user_id);
