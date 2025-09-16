-- Create promotion_campaigns table to track streaming promotions and playlist submissions
CREATE TABLE public.promotion_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  platform_id uuid REFERENCES public.streaming_platforms(id) ON DELETE SET NULL,
  platform_name text,
  campaign_type text NOT NULL,
  budget integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  playlist_name text,
  playlists_targeted integer DEFAULT 0,
  new_placements integer DEFAULT 0,
  stream_increase integer DEFAULT 0,
  revenue_generated integer DEFAULT 0,
  listeners_generated integer DEFAULT 0,
  message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Helpful indexes for querying by user and song
CREATE INDEX IF NOT EXISTS idx_promotion_campaigns_user_id ON public.promotion_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_promotion_campaigns_song_id ON public.promotion_campaigns(song_id);

-- Enable row level security
ALTER TABLE public.promotion_campaigns ENABLE ROW LEVEL SECURITY;

-- Policies to allow players to manage their own campaigns
CREATE POLICY "Users can view their promotion campaigns" ON public.promotion_campaigns
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their promotion campaigns" ON public.promotion_campaigns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their promotion campaigns" ON public.promotion_campaigns
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Keep updated_at current when records change
CREATE OR REPLACE FUNCTION public.set_promotion_campaigns_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_promotion_campaigns_updated_at
  BEFORE UPDATE ON public.promotion_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.set_promotion_campaigns_updated_at();
