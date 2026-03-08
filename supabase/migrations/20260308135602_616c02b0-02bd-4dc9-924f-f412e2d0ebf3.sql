
-- Player Clothing Brands
CREATE TABLE public.player_clothing_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  brand_name text NOT NULL,
  brand_description text,
  logo_url text,
  genre_focus text NOT NULL DEFAULT 'rock',
  quality_rating numeric NOT NULL DEFAULT 0,
  style_rating numeric NOT NULL DEFAULT 0,
  reputation integer NOT NULL DEFAULT 0,
  total_sales integer NOT NULL DEFAULT 0,
  total_revenue numeric NOT NULL DEFAULT 0,
  city_id uuid REFERENCES public.cities(id),
  is_open boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Player Clothing Items
CREATE TABLE public.player_clothing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES public.player_clothing_brands(id) ON DELETE CASCADE NOT NULL,
  creator_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('tops', 'bottoms', 'outerwear', 'shoes', 'accessories', 'hats')),
  genre_style text NOT NULL DEFAULT 'rock',
  quality_score integer NOT NULL DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
  style_score integer NOT NULL DEFAULT 0 CHECK (style_score >= 0 AND style_score <= 100),
  production_cost numeric NOT NULL DEFAULT 0,
  sale_price numeric NOT NULL DEFAULT 0,
  stock_quantity integer NOT NULL DEFAULT 0,
  total_sold integer NOT NULL DEFAULT 0,
  is_listed boolean NOT NULL DEFAULT true,
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Player Clothing Purchases
CREATE TABLE public.player_clothing_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES public.player_clothing_items(id) ON DELETE CASCADE NOT NULL,
  seller_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  price_paid numeric NOT NULL,
  purchased_at timestamptz NOT NULL DEFAULT now()
);

-- Updated_at trigger for brands
CREATE TRIGGER update_player_clothing_brands_updated_at
  BEFORE UPDATE ON public.player_clothing_brands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_clothing_items_brand ON public.player_clothing_items(brand_id);
CREATE INDEX idx_clothing_items_genre ON public.player_clothing_items(genre_style);
CREATE INDEX idx_clothing_items_listed ON public.player_clothing_items(is_listed) WHERE is_listed = true;
CREATE INDEX idx_clothing_purchases_buyer ON public.player_clothing_purchases(buyer_user_id);
CREATE INDEX idx_clothing_purchases_seller ON public.player_clothing_purchases(seller_user_id);

-- RLS
ALTER TABLE public.player_clothing_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_clothing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_clothing_purchases ENABLE ROW LEVEL SECURITY;

-- Brands: read all, CRUD own
CREATE POLICY "Anyone can read brands" ON public.player_clothing_brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create own brand" ON public.player_clothing_brands FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own brand" ON public.player_clothing_brands FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own brand" ON public.player_clothing_brands FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Items: read all listed, CRUD own
CREATE POLICY "Anyone can read listed items" ON public.player_clothing_items FOR SELECT TO authenticated USING (is_listed = true OR creator_user_id = auth.uid());
CREATE POLICY "Users can create own items" ON public.player_clothing_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_user_id);
CREATE POLICY "Users can update own items" ON public.player_clothing_items FOR UPDATE TO authenticated USING (auth.uid() = creator_user_id);
CREATE POLICY "Users can delete own items" ON public.player_clothing_items FOR DELETE TO authenticated USING (auth.uid() = creator_user_id);

-- Purchases: read own, insert own
CREATE POLICY "Users can read own purchases" ON public.player_clothing_purchases FOR SELECT TO authenticated USING (buyer_user_id = auth.uid() OR seller_user_id = auth.uid());
CREATE POLICY "Users can create purchases" ON public.player_clothing_purchases FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_user_id);
