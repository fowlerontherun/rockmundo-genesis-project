-- 1. Create trigger to sync profiles.is_vip with vip_subscriptions
CREATE OR REPLACE FUNCTION public.sync_vip_status_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.profiles
    SET is_vip = EXISTS (
      SELECT 1 FROM public.vip_subscriptions
      WHERE user_id = NEW.user_id
        AND status = 'active'
        AND expires_at > NOW()
    )
    WHERE user_id = NEW.user_id;
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
    SET is_vip = EXISTS (
      SELECT 1 FROM public.vip_subscriptions
      WHERE user_id = OLD.user_id
        AND status = 'active'
        AND expires_at > NOW()
    )
    WHERE user_id = OLD.user_id;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_vip_status_trigger ON public.vip_subscriptions;
CREATE TRIGGER sync_vip_status_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.vip_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.sync_vip_status_to_profile();

-- 2. Sync existing VIP subscriptions to profiles NOW
UPDATE public.profiles p
SET is_vip = EXISTS (
  SELECT 1 FROM public.vip_subscriptions v
  WHERE v.user_id = p.user_id
    AND v.status = 'active'
    AND v.expires_at > NOW()
);

-- 3. Add missing columns to sponsorship_brands
ALTER TABLE public.sponsorship_brands 
ADD COLUMN IF NOT EXISTS cooldown_until timestamptz DEFAULT NULL;

ALTER TABLE public.sponsorship_brands 
ADD COLUMN IF NOT EXISTS available_budget numeric DEFAULT 100000;

ALTER TABLE public.sponsorship_brands 
ADD COLUMN IF NOT EXISTS wealth_score integer DEFAULT 50;

ALTER TABLE public.sponsorship_brands 
ADD COLUMN IF NOT EXISTS targeting_flags text[] DEFAULT ARRAY[]::text[];

ALTER TABLE public.sponsorship_brands 
ADD COLUMN IF NOT EXISTS min_fame_threshold integer DEFAULT 0;

ALTER TABLE public.sponsorship_brands 
ADD COLUMN IF NOT EXISTS exclusivity_pref boolean DEFAULT false;

-- 4. Add chart achievements for #1 positions (using DO block to check existence)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE name = 'Chart Topper') THEN
    INSERT INTO public.achievements (name, description, category, icon, rarity, requirements, rewards)
    VALUES ('Chart Topper', 'Reach #1 on any chart', 'chart', 'trophy', 'rare', '{"chart_position": 1, "duration": "day"}', '{"fame": 500, "cash": 1000}');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE name = 'Week at the Top') THEN
    INSERT INTO public.achievements (name, description, category, icon, rarity, requirements, rewards)
    VALUES ('Week at the Top', 'Hold #1 position for a full week', 'chart', 'crown', 'epic', '{"chart_position": 1, "duration": "week"}', '{"fame": 2000, "cash": 5000}');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE name = 'Month of Glory') THEN
    INSERT INTO public.achievements (name, description, category, icon, rarity, requirements, rewards)
    VALUES ('Month of Glory', 'Hold #1 position for a full month', 'chart', 'star', 'legendary', '{"chart_position": 1, "duration": "month"}', '{"fame": 10000, "cash": 25000}');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE name = 'Year of Dominance') THEN
    INSERT INTO public.achievements (name, description, category, icon, rarity, requirements, rewards)
    VALUES ('Year of Dominance', 'Hold #1 position for a full year', 'chart', 'gem', 'mythic', '{"chart_position": 1, "duration": "year"}', '{"fame": 100000, "cash": 250000}');
  END IF;
END $$;

-- 5. Add chart_number_one_streaks table
CREATE TABLE IF NOT EXISTS public.chart_number_one_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid REFERENCES public.songs(id) ON DELETE CASCADE,
  band_id uuid REFERENCES public.bands(id) ON DELETE CASCADE,
  chart_type text NOT NULL,
  started_at date NOT NULL,
  ended_at date,
  streak_days integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chart_streaks_song ON public.chart_number_one_streaks(song_id);
CREATE INDEX IF NOT EXISTS idx_chart_streaks_active ON public.chart_number_one_streaks(is_active) WHERE is_active = true;

ALTER TABLE public.chart_number_one_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view chart streaks" ON public.chart_number_one_streaks;
CREATE POLICY "Anyone can view chart streaks" ON public.chart_number_one_streaks FOR SELECT USING (true);