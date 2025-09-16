-- Create streaming_campaigns table to track user marketing campaigns
CREATE TABLE IF NOT EXISTS public.streaming_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  name TEXT NOT NULL,
  budget INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned',
  playlists_targeted INTEGER NOT NULL DEFAULT 0,
  new_placements INTEGER NOT NULL DEFAULT 0,
  stream_increase INTEGER NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS streaming_campaigns_user_id_idx ON public.streaming_campaigns (user_id);

ALTER TABLE public.streaming_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their streaming campaigns" ON public.streaming_campaigns;
CREATE POLICY "Users can view their streaming campaigns"
  ON public.streaming_campaigns
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their streaming campaigns" ON public.streaming_campaigns;
CREATE POLICY "Users can create their streaming campaigns"
  ON public.streaming_campaigns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their streaming campaigns" ON public.streaming_campaigns;
CREATE POLICY "Users can update their streaming campaigns"
  ON public.streaming_campaigns
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their streaming campaigns" ON public.streaming_campaigns;
CREATE POLICY "Users can delete their streaming campaigns"
  ON public.streaming_campaigns
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_streaming_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_streaming_campaigns_updated_at ON public.streaming_campaigns;
CREATE TRIGGER update_streaming_campaigns_updated_at
  BEFORE UPDATE ON public.streaming_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_streaming_campaigns_updated_at();
