-- Create social_campaigns table to manage social media marketing efforts
CREATE TABLE IF NOT EXISTS public.social_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  engagement NUMERIC(5,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_campaigns_user_id_idx ON public.social_campaigns (user_id);

ALTER TABLE public.social_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their campaigns" ON public.social_campaigns;
CREATE POLICY "Users can view their campaigns"
  ON public.social_campaigns
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their campaigns" ON public.social_campaigns;
CREATE POLICY "Users can create their campaigns"
  ON public.social_campaigns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their campaigns" ON public.social_campaigns;
CREATE POLICY "Users can update their campaigns"
  ON public.social_campaigns
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their campaigns" ON public.social_campaigns;
CREATE POLICY "Users can delete their campaigns"
  ON public.social_campaigns
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_social_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_social_campaigns_updated_at ON public.social_campaigns;
CREATE TRIGGER update_social_campaigns_updated_at
  BEFORE UPDATE ON public.social_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_social_campaigns_updated_at();
