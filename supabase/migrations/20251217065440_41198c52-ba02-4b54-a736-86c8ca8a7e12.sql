-- Create skin_collections table for themed/monthly releases
CREATE TABLE public.skin_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  theme TEXT CHECK (theme IN ('monthly', 'holiday', 'artist_collab', 'vip', 'limited', 'seasonal', 'event')),
  banner_image_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ, -- NULL = permanent collection
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add new columns to avatar_clothing_items for collection support
ALTER TABLE public.avatar_clothing_items
ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES public.skin_collections(id),
ADD COLUMN IF NOT EXISTS release_date DATE,
ADD COLUMN IF NOT EXISTS expiry_date DATE,
ADD COLUMN IF NOT EXISTS is_limited_edition BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS rpm_asset_id TEXT;

-- Enable RLS on skin_collections
ALTER TABLE public.skin_collections ENABLE ROW LEVEL SECURITY;

-- Everyone can view active collections
CREATE POLICY "Anyone can view active collections"
ON public.skin_collections FOR SELECT
USING (is_active = true);

-- Admins can manage collections
CREATE POLICY "Admins can manage collections"
ON public.skin_collections FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_skin_collections_active ON public.skin_collections(is_active, starts_at, ends_at);
CREATE INDEX idx_clothing_items_collection ON public.avatar_clothing_items(collection_id);
CREATE INDEX idx_clothing_items_featured ON public.avatar_clothing_items(featured) WHERE featured = true;

-- Seed some initial collections
INSERT INTO public.skin_collections (name, description, theme, starts_at, ends_at, is_active, sort_order) VALUES
('Winter Rockers 2024', 'Cozy winter gear for the coldest gigs', 'seasonal', '2024-12-01', '2025-02-28', true, 1),
('Holiday Jam', 'Festive outfits for the holiday season', 'holiday', '2024-12-15', '2025-01-05', true, 2),
('VIP Exclusives', 'Premium items only available for VIP members', 'vip', now(), NULL, true, 0),
('Classic Collection', 'Timeless pieces that never go out of style', 'monthly', now(), NULL, true, 10);