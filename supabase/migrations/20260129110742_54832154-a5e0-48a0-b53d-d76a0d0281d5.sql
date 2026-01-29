-- Gear Trading Marketplace Schema
-- Version: 1.0.577

-- Table for gear marketplace listings
CREATE TABLE public.gear_marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_equipment_id uuid NOT NULL REFERENCES player_equipment_inventory(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES equipment_catalog(id),
  
  -- Listing details
  listing_status text NOT NULL DEFAULT 'active' CHECK (listing_status IN ('active', 'sold', 'cancelled', 'expired')),
  asking_price numeric NOT NULL CHECK (asking_price > 0),
  min_acceptable_price numeric CHECK (min_acceptable_price IS NULL OR min_acceptable_price > 0),
  allow_negotiation boolean DEFAULT true,
  
  -- Condition affects value
  condition_at_listing integer NOT NULL DEFAULT 100 CHECK (condition_at_listing BETWEEN 0 AND 100),
  condition_description text,
  
  -- Optional extras
  description text,
  featured boolean DEFAULT false,
  view_count integer DEFAULT 0,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  sold_at timestamptz,
  
  -- Ensure one active listing per equipment
  CONSTRAINT unique_active_equipment_listing UNIQUE (player_equipment_id) DEFERRABLE INITIALLY DEFERRED
);

-- Table for gear marketplace transactions
CREATE TABLE public.gear_marketplace_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES gear_marketplace_listings(id),
  buyer_user_id uuid NOT NULL REFERENCES auth.users(id),
  seller_user_id uuid NOT NULL REFERENCES auth.users(id),
  
  -- Transaction details
  sale_price numeric NOT NULL,
  platform_fee numeric DEFAULT 0,
  seller_received numeric NOT NULL,
  
  -- Condition at sale
  condition_at_sale integer NOT NULL,
  
  -- Equipment transferred
  equipment_id uuid NOT NULL REFERENCES equipment_catalog(id),
  new_equipment_inventory_id uuid REFERENCES player_equipment_inventory(id),
  
  transaction_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Table for price offers/negotiations
CREATE TABLE public.gear_marketplace_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES gear_marketplace_listings(id) ON DELETE CASCADE,
  buyer_user_id uuid NOT NULL REFERENCES auth.users(id),
  
  offer_amount numeric NOT NULL CHECK (offer_amount > 0),
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'countered', 'expired', 'withdrawn')),
  
  counter_amount numeric,
  counter_message text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  responded_at timestamptz
);

-- Add indexes for performance
CREATE INDEX idx_gear_listings_status ON gear_marketplace_listings(listing_status);
CREATE INDEX idx_gear_listings_seller ON gear_marketplace_listings(seller_user_id);
CREATE INDEX idx_gear_listings_equipment ON gear_marketplace_listings(equipment_id);
CREATE INDEX idx_gear_listings_price ON gear_marketplace_listings(asking_price);
CREATE INDEX idx_gear_listings_condition ON gear_marketplace_listings(condition_at_listing);
CREATE INDEX idx_gear_transactions_buyer ON gear_marketplace_transactions(buyer_user_id);
CREATE INDEX idx_gear_transactions_seller ON gear_marketplace_transactions(seller_user_id);
CREATE INDEX idx_gear_offers_listing ON gear_marketplace_offers(listing_id);
CREATE INDEX idx_gear_offers_buyer ON gear_marketplace_offers(buyer_user_id);

-- Enable RLS
ALTER TABLE gear_marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gear_marketplace_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gear_marketplace_offers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for listings
CREATE POLICY "Anyone can view active listings" 
  ON gear_marketplace_listings FOR SELECT 
  USING (listing_status = 'active' OR seller_user_id = auth.uid());

CREATE POLICY "Users can create their own listings" 
  ON gear_marketplace_listings FOR INSERT 
  WITH CHECK (auth.uid() = seller_user_id);

CREATE POLICY "Sellers can update their own listings" 
  ON gear_marketplace_listings FOR UPDATE 
  USING (auth.uid() = seller_user_id);

CREATE POLICY "Sellers can delete their own listings" 
  ON gear_marketplace_listings FOR DELETE 
  USING (auth.uid() = seller_user_id);

-- RLS Policies for transactions
CREATE POLICY "Users can view their own transactions" 
  ON gear_marketplace_transactions FOR SELECT 
  USING (auth.uid() = buyer_user_id OR auth.uid() = seller_user_id);

CREATE POLICY "System can insert transactions" 
  ON gear_marketplace_transactions FOR INSERT 
  WITH CHECK (auth.uid() = buyer_user_id);

-- RLS Policies for offers
CREATE POLICY "Users can view offers on their listings or their own offers" 
  ON gear_marketplace_offers FOR SELECT 
  USING (
    auth.uid() = buyer_user_id OR 
    auth.uid() IN (SELECT seller_user_id FROM gear_marketplace_listings WHERE id = listing_id)
  );

CREATE POLICY "Users can create offers" 
  ON gear_marketplace_offers FOR INSERT 
  WITH CHECK (auth.uid() = buyer_user_id);

CREATE POLICY "Buyers can update their own offers" 
  ON gear_marketplace_offers FOR UPDATE 
  USING (auth.uid() = buyer_user_id);

CREATE POLICY "Sellers can update offers on their listings" 
  ON gear_marketplace_offers FOR UPDATE 
  USING (auth.uid() IN (SELECT seller_user_id FROM gear_marketplace_listings WHERE id = listing_id));

-- Function to calculate suggested price based on condition
CREATE OR REPLACE FUNCTION calculate_gear_market_value(
  p_base_price numeric,
  p_condition integer,
  p_rarity text
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  condition_multiplier numeric;
  rarity_multiplier numeric;
BEGIN
  -- Condition affects price (100% condition = 70% of new, lower condition = less)
  condition_multiplier := 0.30 + (p_condition * 0.007);
  
  -- Rarity affects resale value retention
  rarity_multiplier := CASE p_rarity
    WHEN 'legendary' THEN 1.2
    WHEN 'epic' THEN 1.1
    WHEN 'rare' THEN 1.0
    WHEN 'uncommon' THEN 0.95
    ELSE 0.9
  END;
  
  RETURN ROUND(p_base_price * condition_multiplier * rarity_multiplier, 2);
END;
$$;

-- Function to process gear sale
CREATE OR REPLACE FUNCTION process_gear_sale(
  p_listing_id uuid,
  p_buyer_user_id uuid,
  p_sale_price numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing gear_marketplace_listings;
  v_equipment player_equipment_inventory;
  v_platform_fee numeric;
  v_seller_received numeric;
  v_new_inventory_id uuid;
  v_transaction_id uuid;
BEGIN
  -- Get and lock the listing
  SELECT * INTO v_listing FROM gear_marketplace_listings 
  WHERE id = p_listing_id AND listing_status = 'active'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found or no longer active';
  END IF;
  
  IF v_listing.seller_user_id = p_buyer_user_id THEN
    RAISE EXCEPTION 'Cannot buy your own listing';
  END IF;
  
  -- Get the equipment
  SELECT * INTO v_equipment FROM player_equipment_inventory 
  WHERE id = v_listing.player_equipment_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found';
  END IF;
  
  -- Calculate fees (5% platform fee)
  v_platform_fee := ROUND(p_sale_price * 0.05, 2);
  v_seller_received := p_sale_price - v_platform_fee;
  
  -- Check buyer has funds
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = p_buyer_user_id AND cash >= p_sale_price
  ) THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;
  
  -- Deduct from buyer
  UPDATE profiles SET cash = cash - p_sale_price 
  WHERE user_id = p_buyer_user_id;
  
  -- Add to seller
  UPDATE profiles SET cash = cash + v_seller_received 
  WHERE user_id = v_listing.seller_user_id;
  
  -- Transfer equipment: delete from seller's inventory
  DELETE FROM player_equipment_inventory WHERE id = v_listing.player_equipment_id;
  
  -- Create in buyer's inventory
  INSERT INTO player_equipment_inventory (user_id, equipment_id, condition, is_equipped)
  VALUES (p_buyer_user_id, v_listing.equipment_id, v_equipment.condition, false)
  RETURNING id INTO v_new_inventory_id;
  
  -- Update listing status
  UPDATE gear_marketplace_listings 
  SET listing_status = 'sold', sold_at = now(), updated_at = now()
  WHERE id = p_listing_id;
  
  -- Create transaction record
  INSERT INTO gear_marketplace_transactions (
    listing_id, buyer_user_id, seller_user_id, sale_price, 
    platform_fee, seller_received, condition_at_sale, 
    equipment_id, new_equipment_inventory_id
  )
  VALUES (
    p_listing_id, p_buyer_user_id, v_listing.seller_user_id, p_sale_price,
    v_platform_fee, v_seller_received, v_equipment.condition,
    v_listing.equipment_id, v_new_inventory_id
  )
  RETURNING id INTO v_transaction_id;
  
  -- Cancel any pending offers
  UPDATE gear_marketplace_offers 
  SET status = 'expired', updated_at = now()
  WHERE listing_id = p_listing_id AND status = 'pending';
  
  RETURN v_transaction_id;
END;
$$;