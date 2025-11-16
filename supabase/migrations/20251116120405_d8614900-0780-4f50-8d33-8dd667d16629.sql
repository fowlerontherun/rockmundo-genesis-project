-- Create crypto tokens table for Underworld
CREATE TABLE IF NOT EXISTS public.crypto_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  current_price NUMERIC(12, 2) NOT NULL DEFAULT 100.00,
  price_history JSONB DEFAULT '[]'::jsonb,
  volume_24h NUMERIC(12, 2) DEFAULT 0,
  market_cap NUMERIC(15, 2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create player token holdings
CREATE TABLE IF NOT EXISTS public.player_token_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_id UUID NOT NULL REFERENCES public.crypto_tokens(id) ON DELETE CASCADE,
  quantity NUMERIC(18, 8) NOT NULL DEFAULT 0,
  average_buy_price NUMERIC(12, 2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token_id)
);

-- Create token transactions
CREATE TABLE IF NOT EXISTS public.token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_id UUID NOT NULL REFERENCES public.crypto_tokens(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
  quantity NUMERIC(18, 8) NOT NULL,
  price_per_token NUMERIC(12, 2) NOT NULL,
  total_amount NUMERIC(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create media facilities table
CREATE TABLE IF NOT EXISTS public.media_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  facility_type TEXT NOT NULL CHECK (facility_type IN ('tv', 'podcast', 'radio')),
  city_id UUID REFERENCES public.cities(id),
  specialization TEXT,
  reputation INTEGER DEFAULT 50,
  sponsor_tier TEXT DEFAULT 'bronze' CHECK (sponsor_tier IN ('bronze', 'silver', 'gold', 'platinum')),
  weekly_cost NUMERIC(10, 2) DEFAULT 5000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create media shows table
CREATE TABLE IF NOT EXISTS public.media_shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.media_facilities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  show_name TEXT NOT NULL,
  show_format TEXT,
  target_audience TEXT,
  viewership INTEGER DEFAULT 0,
  rating NUMERIC(3, 2) DEFAULT 0,
  episodes_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create player skill books inventory
CREATE TABLE IF NOT EXISTS public.player_skill_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL,
  book_title TEXT NOT NULL,
  skill_focus TEXT NOT NULL,
  xp_reward INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  progress_percentage INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.crypto_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_token_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_skill_books ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crypto_tokens (public read, admin write)
CREATE POLICY "Anyone can view tokens"
  ON public.crypto_tokens FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage tokens"
  ON public.crypto_tokens FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- RLS Policies for player_token_holdings
CREATE POLICY "Users can view their own holdings"
  ON public.player_token_holdings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own holdings"
  ON public.player_token_holdings FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for token_transactions
CREATE POLICY "Users can view their own transactions"
  ON public.token_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions"
  ON public.token_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for media_facilities
CREATE POLICY "Anyone can view facilities"
  ON public.media_facilities FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own facilities"
  ON public.media_facilities FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for media_shows
CREATE POLICY "Anyone can view shows"
  ON public.media_shows FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own shows"
  ON public.media_shows FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for player_skill_books
CREATE POLICY "Users can view their own books"
  ON public.player_skill_books FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own books"
  ON public.player_skill_books FOR ALL
  USING (auth.uid() = user_id);

-- Insert initial crypto tokens
INSERT INTO public.crypto_tokens (symbol, name, current_price, volume_24h) VALUES
  ('SCL', 'SoulCoin Ledger', 1248.92, 2450000),
  ('GEM', 'Gloom Emerald', 482.17, 780000),
  ('OBL', 'Obsidian Link', 96.34, 195000),
  ('ASH', 'Ashen Token', 12.58, 3880000),
  ('WSP', 'Whisper Credit', 2.09, 665000)
ON CONFLICT (symbol) DO NOTHING;

-- Triggers for updated_at
CREATE TRIGGER update_crypto_tokens_updated_at
  BEFORE UPDATE ON public.crypto_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_player_token_holdings_updated_at
  BEFORE UPDATE ON public.player_token_holdings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_media_facilities_updated_at
  BEFORE UPDATE ON public.media_facilities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_media_shows_updated_at
  BEFORE UPDATE ON public.media_shows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();