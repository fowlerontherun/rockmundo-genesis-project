-- Forward reconciliation for databases where only one file from the historical
-- 20250916150000 collision was recorded by Supabase.

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('gig_invite', 'band_request', 'fan_milestone', 'achievement', 'system')),
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx
  ON public.notifications (user_id, read);
CREATE INDEX IF NOT EXISTS notifications_timestamp_idx
  ON public.notifications ("timestamp" DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
CREATE POLICY "Users can view their notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their notifications" ON public.notifications;
CREATE POLICY "Users can insert their notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
CREATE POLICY "Users can update their notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.record_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  prestige INTEGER NOT NULL CHECK (prestige BETWEEN 1 AND 5),
  advance_payment INTEGER NOT NULL DEFAULT 0 CHECK (advance_payment >= 0),
  royalty_rate NUMERIC(6,4) NOT NULL DEFAULT 0 CHECK (royalty_rate >= 0 AND royalty_rate <= 1),
  description TEXT NOT NULL,
  requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  benefits TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.record_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Record labels are viewable by everyone" ON public.record_labels;
CREATE POLICY "Record labels are viewable by everyone"
  ON public.record_labels
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage record labels" ON public.record_labels;
CREATE POLICY "Admins can manage record labels"
  ON public.record_labels
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_record_labels_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_record_labels_updated_at ON public.record_labels;
CREATE TRIGGER update_record_labels_updated_at
  BEFORE UPDATE ON public.record_labels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_record_labels_updated_at();

INSERT INTO public.record_labels (
  name,
  prestige,
  advance_payment,
  royalty_rate,
  description,
  requirements,
  benefits
)
VALUES
  (
    'Indie Underground Records',
    1,
    5000,
    0.15,
    'A small independent label focusing on emerging artists.',
    '{"fame": 500, "songs": 3}'::jsonb,
    ARRAY['Studio access', 'Basic promotion', 'Digital distribution']
  ),
  (
    'City Sounds Music',
    2,
    15000,
    0.12,
    'Regional label with good distribution network.',
    '{"fame": 2000, "songs": 5, "performance": 60}'::jsonb,
    ARRAY['Professional recording', 'Radio promotion', 'Regional touring support']
  ),
  (
    'Thunder Records',
    3,
    50000,
    0.10,
    'Major label with national reach and big budgets.',
    '{"fame": 10000, "songs": 8, "performance": 80, "chart_position": 50}'::jsonb,
    ARRAY['Top-tier studios', 'National radio', 'Music videos', 'Tour support']
  ),
  (
    'Global Megacorp Music',
    4,
    200000,
    0.08,
    'International mega-label for superstar artists only.',
    '{"fame": 50000, "songs": 12, "performance": 95, "chart_position": 10}'::jsonb,
    ARRAY['World-class production', 'Global promotion', 'International tours', 'Award campaigns']
  )
ON CONFLICT (name) DO NOTHING;

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

CREATE INDEX IF NOT EXISTS streaming_campaigns_user_id_idx
  ON public.streaming_campaigns (user_id);

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
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_streaming_campaigns_updated_at ON public.streaming_campaigns;
CREATE TRIGGER update_streaming_campaigns_updated_at
  BEFORE UPDATE ON public.streaming_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_streaming_campaigns_updated_at();

ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS mix_quality INTEGER,
  ADD COLUMN IF NOT EXISTS master_quality INTEGER,
  ADD COLUMN IF NOT EXISTS production_cost INTEGER DEFAULT 0;

-- No application consumer exists for the legacy view, and its historical
-- definition mixed auth user IDs with band IDs while relying on songs.user_id.
DROP VIEW IF EXISTS public.weekly_stats;
