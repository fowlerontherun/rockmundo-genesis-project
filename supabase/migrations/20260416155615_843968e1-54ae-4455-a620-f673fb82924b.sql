
-- Item marketplace for trading gear, books, underworld items, and clothes
CREATE TABLE public.item_market_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  seller_profile_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('gear', 'book', 'underworld', 'clothing')),
  item_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  item_description TEXT,
  item_category TEXT,
  item_rarity TEXT,
  item_image_url TEXT,
  item_metadata JSONB DEFAULT '{}'::jsonb,
  asking_price INTEGER NOT NULL CHECK (asking_price > 0),
  is_negotiable BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled', 'expired')),
  buyer_user_id UUID REFERENCES auth.users(id),
  buyer_profile_id UUID,
  sold_at TIMESTAMP WITH TIME ZONE,
  sold_price INTEGER,
  listed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_item_market_status ON public.item_market_listings(status);
CREATE INDEX idx_item_market_type ON public.item_market_listings(item_type);
CREATE INDEX idx_item_market_seller ON public.item_market_listings(seller_user_id);
CREATE INDEX idx_item_market_price ON public.item_market_listings(asking_price);

CREATE TABLE public.item_market_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES public.item_market_listings(id) ON DELETE CASCADE NOT NULL,
  buyer_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  buyer_profile_id UUID NOT NULL,
  offer_amount INTEGER NOT NULL CHECK (offer_amount > 0),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_item_offers_listing ON public.item_market_offers(listing_id);

CREATE TABLE public.item_market_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES public.item_market_listings(id) NOT NULL,
  seller_user_id UUID REFERENCES auth.users(id) NOT NULL,
  buyer_user_id UUID REFERENCES auth.users(id) NOT NULL,
  seller_profile_id UUID NOT NULL,
  buyer_profile_id UUID NOT NULL,
  item_type TEXT NOT NULL,
  item_name TEXT NOT NULL,
  sale_price INTEGER NOT NULL,
  marketplace_fee INTEGER NOT NULL DEFAULT 0,
  seller_proceeds INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_item_tx_seller ON public.item_market_transactions(seller_user_id);
CREATE INDEX idx_item_tx_buyer ON public.item_market_transactions(buyer_user_id);

ALTER TABLE public.item_market_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_market_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_market_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active item listings"
  ON public.item_market_listings FOR SELECT TO authenticated
  USING (status = 'active' OR seller_user_id = auth.uid() OR buyer_user_id = auth.uid());

CREATE POLICY "Users can create own item listings"
  ON public.item_market_listings FOR INSERT TO authenticated
  WITH CHECK (seller_user_id = auth.uid());

CREATE POLICY "Sellers can update own item listings"
  ON public.item_market_listings FOR UPDATE TO authenticated
  USING (seller_user_id = auth.uid());

-- Also allow buyer update (for completing purchase)
CREATE POLICY "Buyers can update purchased listings"
  ON public.item_market_listings FOR UPDATE TO authenticated
  USING (buyer_user_id = auth.uid());

CREATE POLICY "Users can view relevant item offers"
  ON public.item_market_offers FOR SELECT TO authenticated
  USING (
    buyer_user_id = auth.uid() OR 
    listing_id IN (SELECT id FROM public.item_market_listings WHERE seller_user_id = auth.uid())
  );

CREATE POLICY "Users can create item offers"
  ON public.item_market_offers FOR INSERT TO authenticated
  WITH CHECK (buyer_user_id = auth.uid());

CREATE POLICY "Users can update relevant item offers"
  ON public.item_market_offers FOR UPDATE TO authenticated
  USING (
    buyer_user_id = auth.uid() OR 
    listing_id IN (SELECT id FROM public.item_market_listings WHERE seller_user_id = auth.uid())
  );

CREATE POLICY "Users can view own item transactions"
  ON public.item_market_transactions FOR SELECT TO authenticated
  USING (seller_user_id = auth.uid() OR buyer_user_id = auth.uid());

CREATE POLICY "Users can create item transactions"
  ON public.item_market_transactions FOR INSERT TO authenticated
  WITH CHECK (buyer_user_id = auth.uid());
