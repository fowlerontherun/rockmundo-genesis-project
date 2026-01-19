-- Create merch_orders table for tracking merchandise sales
CREATE TABLE IF NOT EXISTS public.merch_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  merchandise_id UUID REFERENCES public.player_merchandise(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  order_type TEXT NOT NULL DEFAULT 'online', -- gig, online, store
  customer_type TEXT NOT NULL DEFAULT 'fan', -- fan, collector, superfan
  country TEXT,
  city TEXT,
  gig_id UUID REFERENCES public.gigs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merch_orders ENABLE ROW LEVEL SECURITY;

-- RLS policies: band members can view their band's orders
CREATE POLICY "Band members can view their orders"
ON public.merch_orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.band_members
    WHERE band_members.band_id = merch_orders.band_id
    AND band_members.user_id = auth.uid()
  )
);

-- Band members can insert orders for their bands
CREATE POLICY "Band members can insert orders"
ON public.merch_orders FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.band_members
    WHERE band_members.band_id = merch_orders.band_id
    AND band_members.user_id = auth.uid()
  )
);

-- Service role can do anything (for cron jobs)
CREATE POLICY "Service role full access"
ON public.merch_orders FOR ALL
USING (auth.role() = 'service_role');

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_merch_orders_band_id ON public.merch_orders(band_id);
CREATE INDEX IF NOT EXISTS idx_merch_orders_created_at ON public.merch_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_merch_orders_country ON public.merch_orders(country);