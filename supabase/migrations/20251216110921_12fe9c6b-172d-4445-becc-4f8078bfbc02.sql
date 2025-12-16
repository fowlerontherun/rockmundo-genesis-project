-- VIP subscription tracking
CREATE TABLE public.vip_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  subscription_type TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  stripe_subscription_id TEXT,
  gifted_by_admin_id UUID,
  gift_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.vip_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view their own VIP subscriptions"
ON public.vip_subscriptions FOR SELECT
USING (auth.uid() = user_id);

-- Admins can manage all subscriptions
CREATE POLICY "Admins can manage VIP subscriptions"
ON public.vip_subscriptions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Song voting system
CREATE TABLE public.song_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(song_id, user_id)
);

-- Enable RLS
ALTER TABLE public.song_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can view vote counts
CREATE POLICY "Anyone can view song votes"
ON public.song_votes FOR SELECT
USING (true);

-- Authenticated users can vote
CREATE POLICY "Authenticated users can vote"
ON public.song_votes FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own votes
CREATE POLICY "Users can update their own votes"
ON public.song_votes FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own votes
CREATE POLICY "Users can delete their own votes"
ON public.song_votes FOR DELETE
USING (auth.uid() = user_id);

-- Add audio columns to songs table
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS audio_generation_status TEXT DEFAULT NULL;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS audio_generated_at TIMESTAMPTZ;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS audio_prompt TEXT;

-- Create function to grant 2-month free VIP trial on signup
CREATE OR REPLACE FUNCTION public.grant_vip_trial_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.vip_subscriptions (
    user_id,
    status,
    subscription_type,
    starts_at,
    expires_at
  ) VALUES (
    NEW.id,
    'active',
    'trial',
    NOW(),
    NOW() + INTERVAL '2 months'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on profiles table (fires when new profile is created)
CREATE TRIGGER on_profile_created_grant_vip_trial
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.grant_vip_trial_on_signup();

-- Create index for faster VIP status lookups
CREATE INDEX idx_vip_subscriptions_user_status ON public.vip_subscriptions(user_id, status, expires_at);