-- Add 'bot' to twaater_owner_type enum
ALTER TYPE twaater_owner_type ADD VALUE IF NOT EXISTS 'bot';

-- Add AI bot accounts table
CREATE TABLE IF NOT EXISTS public.twaater_bot_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.twaater_accounts(id) ON DELETE CASCADE,
  bot_type TEXT NOT NULL,
  personality_traits JSONB DEFAULT '[]',
  posting_frequency TEXT DEFAULT 'medium',
  last_posted_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.twaater_bot_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bot accounts viewable by everyone"
  ON public.twaater_bot_accounts FOR SELECT USING (true);

-- Add profile view tracking
CREATE TABLE IF NOT EXISTS public.twaater_profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_account_id UUID NOT NULL REFERENCES public.twaater_accounts(id) ON DELETE CASCADE,
  viewed_account_id UUID NOT NULL REFERENCES public.twaater_accounts(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.twaater_profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see who viewed profile"
  ON public.twaater_profile_views FOR SELECT
  USING (viewed_account_id IN (SELECT id FROM twaater_accounts WHERE owner_id = auth.uid()));

CREATE POLICY "Users track their views"
  ON public.twaater_profile_views FOR INSERT
  WITH CHECK (viewer_account_id IN (SELECT id FROM twaater_accounts WHERE owner_id = auth.uid()));

-- Add profile customization columns
ALTER TABLE public.twaater_accounts 
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT,
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS profile_views INTEGER DEFAULT 0;