
-- Tattoo Parlours table
CREATE TABLE public.tattoo_parlours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quality_tier INTEGER NOT NULL DEFAULT 3 CHECK (quality_tier >= 1 AND quality_tier <= 5),
  price_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  infection_risk NUMERIC NOT NULL DEFAULT 0.05,
  specialties TEXT[] DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tattoo Designs table
CREATE TABLE public.tattoo_designs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'tribal',
  body_slot TEXT NOT NULL DEFAULT 'left_upper_arm',
  base_price INTEGER NOT NULL DEFAULT 100,
  ink_color_primary TEXT NOT NULL DEFAULT '#1a1a1a',
  ink_color_secondary TEXT,
  description TEXT,
  genre_affinity JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Player Tattoos table
CREATE TABLE public.player_tattoos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tattoo_design_id UUID REFERENCES public.tattoo_designs(id) ON DELETE CASCADE NOT NULL,
  parlour_id UUID REFERENCES public.tattoo_parlours(id),
  body_slot TEXT NOT NULL,
  quality_score INTEGER NOT NULL DEFAULT 50,
  ink_color TEXT NOT NULL DEFAULT '#1a1a1a',
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_infected BOOLEAN NOT NULL DEFAULT false,
  infection_cleared_at TIMESTAMP WITH TIME ZONE,
  price_paid INTEGER NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE public.tattoo_parlours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tattoo_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_tattoos ENABLE ROW LEVEL SECURITY;

-- Parlours: all authenticated can read
CREATE POLICY "Anyone can view tattoo parlours" ON public.tattoo_parlours
  FOR SELECT TO authenticated USING (true);

-- Designs: all authenticated can read
CREATE POLICY "Anyone can view tattoo designs" ON public.tattoo_designs
  FOR SELECT TO authenticated USING (true);

-- Player tattoos: own data
CREATE POLICY "Users can view own tattoos" ON public.player_tattoos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tattoos" ON public.player_tattoos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tattoos" ON public.player_tattoos
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tattoos" ON public.player_tattoos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Seed tattoo designs
INSERT INTO public.tattoo_designs (name, category, body_slot, base_price, ink_color_primary, ink_color_secondary, description, genre_affinity) VALUES
('Skull & Crossbones', 'skull', 'left_upper_arm', 150, '#1a1a1a', '#8b0000', 'Classic skull design with crossed bones', '{"Rock": 0.06, "Heavy Metal": 0.08, "Punk Rock": 0.06, "Hip Hop": 0.02, "Pop": -0.05, "Classical": -0.08, "Jazz": -0.04}'),
('Tribal Wave', 'tribal', 'right_upper_arm', 120, '#1a1a1a', NULL, 'Bold tribal pattern with flowing curves', '{"Rock": 0.05, "Heavy Metal": 0.04, "Punk Rock": 0.04, "Hip Hop": 0.03, "Pop": -0.03, "Classical": -0.06, "Jazz": -0.02}'),
('Dragon Sleeve', 'japanese', 'left_forearm', 300, '#1a3a4a', '#8b0000', 'Traditional Japanese dragon wrapping the forearm', '{"Rock": 0.04, "Heavy Metal": 0.05, "Punk Rock": 0.03, "Hip Hop": 0.01, "Pop": -0.02, "Classical": -0.03, "Jazz": 0.01}'),
('Music Notes', 'musical', 'right_forearm', 100, '#1a1a1a', NULL, 'Treble clef with flowing music notes', '{"Rock": 0.03, "Heavy Metal": 0.02, "Punk Rock": 0.02, "Hip Hop": 0.02, "Pop": 0.01, "Classical": 0.03, "Jazz": 0.03}'),
('Rose & Thorns', 'sleeve', 'left_upper_arm', 180, '#8b0000', '#2d5a1a', 'Detailed rose with thorny stems', '{"Rock": 0.04, "Heavy Metal": 0.03, "Punk Rock": 0.05, "Hip Hop": 0.01, "Pop": -0.01, "Classical": -0.02, "Jazz": 0.01}'),
('Geometric Mandala', 'geometric', 'chest', 250, '#1a1a1a', '#4a4a4a', 'Intricate geometric mandala pattern', '{"Rock": 0.02, "Heavy Metal": 0.01, "Punk Rock": 0.02, "Hip Hop": 0.03, "Pop": -0.01, "Classical": -0.02, "Jazz": 0.02}'),
('Gothic Script', 'text', 'neck', 200, '#1a1a1a', NULL, 'Bold gothic lettering across the neck', '{"Rock": 0.03, "Heavy Metal": 0.05, "Punk Rock": 0.04, "Hip Hop": 0.05, "Pop": -0.04, "Classical": -0.07, "Jazz": -0.03}'),
('Koi Fish', 'japanese', 'right_upper_arm', 280, '#c44a00', '#1a3a4a', 'Traditional koi fish swimming upstream', '{"Rock": 0.03, "Heavy Metal": 0.02, "Punk Rock": 0.02, "Hip Hop": 0.01, "Pop": -0.01, "Classical": -0.01, "Jazz": 0.02}'),
('Barbed Wire Band', 'sleeve', 'left_forearm', 80, '#1a1a1a', NULL, 'Barbed wire wrapping around the arm', '{"Rock": 0.05, "Heavy Metal": 0.06, "Punk Rock": 0.07, "Hip Hop": 0.02, "Pop": -0.04, "Classical": -0.06, "Jazz": -0.03}'),
('Abstract Splatter', 'abstract', 'back', 350, '#1a3a4a', '#8b0000', 'Modern abstract paint splatter design', '{"Rock": 0.03, "Heavy Metal": 0.02, "Punk Rock": 0.03, "Hip Hop": 0.04, "Pop": 0.00, "Classical": -0.03, "Jazz": 0.02}'),
('Flaming Skull', 'skull', 'right_forearm', 200, '#1a1a1a', '#ff4500', 'Skull engulfed in flames', '{"Rock": 0.07, "Heavy Metal": 0.09, "Punk Rock": 0.06, "Hip Hop": 0.02, "Pop": -0.06, "Classical": -0.09, "Jazz": -0.05}'),
('Sacred Heart', 'portrait', 'chest', 220, '#8b0000', '#ffd700', 'Traditional sacred heart with flames and thorns', '{"Rock": 0.04, "Heavy Metal": 0.03, "Punk Rock": 0.04, "Hip Hop": 0.01, "Pop": -0.02, "Classical": -0.01, "Jazz": 0.01}'),
('Snake Wrap', 'sleeve', 'right_forearm', 160, '#2d5a1a', '#1a1a1a', 'Coiled snake wrapping around the forearm', '{"Rock": 0.05, "Heavy Metal": 0.06, "Punk Rock": 0.05, "Hip Hop": 0.03, "Pop": -0.04, "Classical": -0.05, "Jazz": -0.02}'),
('Anchor & Rope', 'tribal', 'left_forearm', 130, '#1a3a4a', '#8b4513', 'Nautical anchor with rope detail', '{"Rock": 0.03, "Heavy Metal": 0.02, "Punk Rock": 0.04, "Hip Hop": 0.01, "Pop": -0.02, "Classical": -0.03, "Jazz": 0.00}'),
('Tiger Portrait', 'portrait', 'right_upper_arm', 320, '#c44a00', '#1a1a1a', 'Realistic tiger face portrait', '{"Rock": 0.04, "Heavy Metal": 0.05, "Punk Rock": 0.03, "Hip Hop": 0.03, "Pop": -0.02, "Classical": -0.04, "Jazz": -0.01}'),
('Lightning Bolt', 'geometric', 'left_forearm', 90, '#ffd700', '#1a1a1a', 'Sharp lightning bolt design', '{"Rock": 0.06, "Heavy Metal": 0.05, "Punk Rock": 0.06, "Hip Hop": 0.02, "Pop": -0.02, "Classical": -0.05, "Jazz": -0.02}'),
('Cherry Blossom Branch', 'japanese', 'back', 400, '#ff69b4', '#2d5a1a', 'Elegant cherry blossom branch across the back', '{"Rock": 0.01, "Heavy Metal": 0.00, "Punk Rock": 0.01, "Hip Hop": 0.01, "Pop": 0.01, "Classical": 0.01, "Jazz": 0.03}'),
('Dagger & Banner', 'sleeve', 'right_upper_arm', 170, '#1a1a1a', '#8b0000', 'Classic dagger through a banner scroll', '{"Rock": 0.05, "Heavy Metal": 0.04, "Punk Rock": 0.05, "Hip Hop": 0.02, "Pop": -0.03, "Classical": -0.05, "Jazz": -0.02}'),
('Wrist Band Tribal', 'tribal', 'left_wrist', 70, '#1a1a1a', NULL, 'Thin tribal band around the wrist', '{"Rock": 0.03, "Heavy Metal": 0.02, "Punk Rock": 0.03, "Hip Hop": 0.02, "Pop": -0.01, "Classical": -0.03, "Jazz": -0.01}'),
('Shoulder Cap Armor', 'geometric', 'left_shoulder', 200, '#1a1a1a', '#4a4a4a', 'Geometric armor pattern covering the shoulder', '{"Rock": 0.04, "Heavy Metal": 0.06, "Punk Rock": 0.04, "Hip Hop": 0.02, "Pop": -0.03, "Classical": -0.05, "Jazz": -0.02}');
