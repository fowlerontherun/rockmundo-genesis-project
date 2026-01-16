-- Create underworld_products table for store items
CREATE TABLE public.underworld_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  lore TEXT, -- Flavor text for dark theme
  category TEXT NOT NULL CHECK (category IN ('consumable', 'booster', 'skill_book', 'collectible')),
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  
  -- Pricing (can use cash OR crypto)
  price_cash INTEGER,
  price_token_id UUID REFERENCES public.crypto_tokens(id),
  price_token_amount NUMERIC(18, 8),
  
  -- Effects (JSONB for flexibility)
  effects JSONB DEFAULT '{}',
  -- Example: {"health": 25, "energy": 50, "xp": 100, "fame": 10, "skill_slug": "vocals", "skill_xp": 50}
  
  -- Duration for temporary boosts (null = instant/permanent)
  duration_hours INTEGER,
  
  -- Availability
  is_available BOOLEAN DEFAULT true,
  stock_limit INTEGER,
  current_stock INTEGER,
  restock_at TIMESTAMPTZ,
  
  -- Metadata
  icon_name TEXT DEFAULT 'Package',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create underworld_purchases table for tracking purchases
CREATE TABLE public.underworld_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.underworld_products(id),
  
  -- Payment info
  paid_with TEXT NOT NULL CHECK (paid_with IN ('cash', 'crypto')),
  cash_amount INTEGER,
  token_id UUID REFERENCES public.crypto_tokens(id),
  token_amount NUMERIC(18, 8),
  
  -- Effect tracking
  effects_applied JSONB,
  applied_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create player_active_boosts table for timed effects
CREATE TABLE public.player_active_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.underworld_products(id),
  boost_type TEXT NOT NULL,
  boost_value NUMERIC(5, 2) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_underworld_products_category ON public.underworld_products(category);
CREATE INDEX idx_underworld_products_available ON public.underworld_products(is_available);
CREATE INDEX idx_underworld_purchases_user ON public.underworld_purchases(user_id);
CREATE INDEX idx_player_active_boosts_user ON public.player_active_boosts(user_id);
CREATE INDEX idx_player_active_boosts_active ON public.player_active_boosts(is_active, expires_at);

-- Enable RLS
ALTER TABLE public.underworld_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.underworld_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_active_boosts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for underworld_products (public read, admin write)
CREATE POLICY "Anyone can view available products"
  ON public.underworld_products FOR SELECT
  USING (is_available = true);

CREATE POLICY "Admins can manage products"
  ON public.underworld_products FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for underworld_purchases (users own their purchases)
CREATE POLICY "Users can view their own purchases"
  ON public.underworld_purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own purchases"
  ON public.underworld_purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for player_active_boosts
CREATE POLICY "Users can view their own boosts"
  ON public.player_active_boosts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own boosts"
  ON public.player_active_boosts FOR ALL
  USING (auth.uid() = user_id);

-- Update trigger for products
CREATE TRIGGER update_underworld_products_updated_at
  BEFORE UPDATE ON public.underworld_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial products
INSERT INTO public.underworld_products (name, description, lore, category, rarity, price_cash, effects, icon_name) VALUES
-- Consumables
('Shadow Elixir', 'Restores 30 energy instantly', 'Brewed in the depths where light never reaches. One sip and you''ll feel the darkness fuel your soul.', 'consumable', 'common', 500, '{"energy": 30}', 'Zap'),
('Vitality Draught', 'Restores 25 health', 'A crimson liquid that pulses with stolen life force. Don''t ask where it came from.', 'consumable', 'common', 750, '{"health": 25}', 'Heart'),
('Fame Serum', 'Grants 50 fame instantly', 'Distilled from the whispers of a thousand forgotten names. Drink deep and be remembered.', 'consumable', 'rare', 2500, '{"fame": 50}', 'Star'),
('XP Injection', 'Grants 200 XP instantly', 'Neural accelerant harvested from failed experiments. Side effects include sudden enlightenment.', 'consumable', 'uncommon', 1200, '{"xp": 200}', 'Brain'),
('Midnight Tonic', 'Restores 50 energy and 20 health', 'The bartender''s special. No questions asked.', 'consumable', 'rare', 1800, '{"energy": 50, "health": 20}', 'Wine'),
('Pure Adrenaline', 'Restores full energy', 'Extracted from the hearts of thrill-seekers. Handle with extreme care.', 'consumable', 'epic', 5000, '{"energy": 100}', 'Flame'),

-- Boosters (timed effects)
('Echo Amplifier', '25% bonus XP for 24 hours', 'A device that makes every lesson resonate twice. Your growth will be... accelerated.', 'booster', 'rare', 3500, '{"xp_multiplier": 1.25}', 'Volume2'),
('Shadow Network Access', '20% bonus fame for 12 hours', 'Temporary access to the underground''s whisper network. Everyone will know your name.', 'booster', 'rare', 2800, '{"fame_multiplier": 1.20}', 'Network'),
('Stim Pack', '50% faster energy regen for 6 hours', 'Military-grade stimulants. Legal in most shadow markets.', 'booster', 'uncommon', 1500, '{"energy_regen": 1.50}', 'Battery'),
('Lucky Charm', '10% bonus to all gains for 48 hours', 'A cursed rabbit''s foot. The previous owner had... an accident.', 'booster', 'legendary', 10000, '{"all_multiplier": 1.10}', 'Sparkles'),

-- Skill Books
('Dark Arts Manual', 'Adds 100 XP to Vocals skill', 'Forbidden techniques passed down through generations of shadow performers.', 'skill_book', 'uncommon', 2000, '{"skill_slug": "vocals", "skill_xp": 100}', 'BookOpen'),
('Underground Guitar Techniques', 'Adds 100 XP to Guitar skill', 'Riffs so dark they were banned from the charts.', 'skill_book', 'uncommon', 2000, '{"skill_slug": "guitar", "skill_xp": 100}', 'BookOpen'),
('Rhythm of the Void', 'Adds 100 XP to Drums skill', 'The beat that drives the underground scene.', 'skill_book', 'uncommon', 2000, '{"skill_slug": "drums", "skill_xp": 100}', 'BookOpen'),
('Bassline from Below', 'Adds 100 XP to Bass skill', 'Frequencies that shake the foundations of reality.', 'skill_book', 'uncommon', 2000, '{"skill_slug": "bass", "skill_xp": 100}', 'BookOpen'),
('Songwriter''s Shadow', 'Adds 150 XP to Songwriting skill', 'Techniques for writing hits that haunt the soul.', 'skill_book', 'rare', 3500, '{"skill_slug": "songwriting", "skill_xp": 150}', 'PenTool'),
('Performance Secrets', 'Adds 150 XP to Performance skill', 'Stage presence that commands the darkness.', 'skill_book', 'rare', 3500, '{"skill_slug": "performance", "skill_xp": 150}', 'Mic');

-- Set duration for boosters
UPDATE public.underworld_products SET duration_hours = 24 WHERE name = 'Echo Amplifier';
UPDATE public.underworld_products SET duration_hours = 12 WHERE name = 'Shadow Network Access';
UPDATE public.underworld_products SET duration_hours = 6 WHERE name = 'Stim Pack';
UPDATE public.underworld_products SET duration_hours = 48 WHERE name = 'Lucky Charm';