-- Create fan engagement tables
CREATE TABLE IF NOT EXISTS public.fan_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE,
  campaign_name TEXT NOT NULL,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('social_media', 'email', 'event', 'contest')),
  target_audience TEXT,
  budget NUMERIC(10, 2) DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'paused', 'completed', 'cancelled')),
  reach INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5, 2) DEFAULT 0,
  new_fans INTEGER DEFAULT 0,
  cost_per_fan NUMERIC(8, 2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create fan segments table
CREATE TABLE IF NOT EXISTS public.fan_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  segment_name TEXT NOT NULL,
  segment_criteria JSONB NOT NULL,
  fan_count INTEGER DEFAULT 0,
  avg_engagement NUMERIC(5, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create fan interactions table
CREATE TABLE IF NOT EXISTS public.fan_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  fan_id UUID,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('message', 'comment', 'like', 'share', 'meet_greet', 'purchase')),
  interaction_data JSONB,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create equipment catalog improvements
CREATE TABLE IF NOT EXISTS public.equipment_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('instrument', 'amplifier', 'effects', 'recording', 'stage', 'transport')),
  subcategory TEXT,
  brand TEXT,
  model TEXT,
  description TEXT,
  base_price NUMERIC(10, 2) NOT NULL,
  quality_rating INTEGER DEFAULT 50 CHECK (quality_rating >= 1 AND quality_rating <= 100),
  durability INTEGER DEFAULT 100,
  stat_boosts JSONB,
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  required_level INTEGER DEFAULT 1,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create player equipment inventory
CREATE TABLE IF NOT EXISTS public.player_equipment_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES public.equipment_catalog(id),
  condition INTEGER DEFAULT 100 CHECK (condition >= 0 AND condition <= 100),
  purchased_at TIMESTAMPTZ DEFAULT now(),
  last_maintained TIMESTAMPTZ,
  maintenance_cost NUMERIC(8, 2) DEFAULT 0,
  is_equipped BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fan_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_equipment_inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fan_campaigns
CREATE POLICY "Users can view their own campaigns"
  ON public.fan_campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own campaigns"
  ON public.fan_campaigns FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for fan_segments
CREATE POLICY "Users can view their own segments"
  ON public.fan_segments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own segments"
  ON public.fan_segments FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for fan_interactions
CREATE POLICY "Users can view their own interactions"
  ON public.fan_interactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create interactions"
  ON public.fan_interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for equipment_catalog (public read)
CREATE POLICY "Anyone can view equipment catalog"
  ON public.equipment_catalog FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage equipment catalog"
  ON public.equipment_catalog FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- RLS Policies for player_equipment_inventory
CREATE POLICY "Users can view their own inventory"
  ON public.player_equipment_inventory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own inventory"
  ON public.player_equipment_inventory FOR ALL
  USING (auth.uid() = user_id);

-- Insert sample equipment
INSERT INTO public.equipment_catalog (name, category, subcategory, brand, description, base_price, quality_rating, rarity) VALUES
  ('Stratocaster Electric Guitar', 'instrument', 'guitar', 'Fender', 'Iconic versatile electric guitar', 1200.00, 85, 'rare'),
  ('Les Paul Standard', 'instrument', 'guitar', 'Gibson', 'Legendary rock guitar with rich tone', 2500.00, 90, 'epic'),
  ('Jazz Bass', 'instrument', 'bass', 'Fender', 'Classic bass guitar with smooth tone', 1400.00, 80, 'rare'),
  ('DW Collectors Series', 'instrument', 'drums', 'DW', 'Professional drum kit', 5000.00, 95, 'legendary'),
  ('Marshall JCM800', 'amplifier', 'guitar_amp', 'Marshall', 'Classic rock amplifier', 1800.00, 88, 'epic'),
  ('Ampeg SVT', 'amplifier', 'bass_amp', 'Ampeg', 'Industry standard bass amp', 2200.00, 90, 'epic'),
  ('Tube Screamer', 'effects', 'overdrive', 'Ibanez', 'Legendary overdrive pedal', 180.00, 75, 'uncommon'),
  ('Big Muff Pi', 'effects', 'fuzz', 'Electro-Harmonix', 'Classic fuzz distortion', 150.00, 70, 'uncommon'),
  ('Neumann U87', 'recording', 'microphone', 'Neumann', 'Studio standard condenser mic', 3200.00, 95, 'legendary'),
  ('SM58', 'recording', 'microphone', 'Shure', 'Industry standard vocal mic', 100.00, 85, 'common'),
  ('Stage Monitor', 'stage', 'monitor', 'QSC', 'Professional stage monitor', 800.00, 75, 'uncommon'),
  ('Tour Bus', 'transport', 'vehicle', 'Prevost', 'Luxury tour bus', 450000.00, 90, 'legendary')
ON CONFLICT DO NOTHING;

-- Triggers
CREATE TRIGGER update_fan_campaigns_updated_at
  BEFORE UPDATE ON public.fan_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fan_segments_updated_at
  BEFORE UPDATE ON public.fan_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_equipment_catalog_updated_at
  BEFORE UPDATE ON public.equipment_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_player_equipment_inventory_updated_at
  BEFORE UPDATE ON public.player_equipment_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();