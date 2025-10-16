-- Create releases table
CREATE TABLE public.releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  release_type VARCHAR NOT NULL CHECK (release_type IN ('single', 'ep', 'album')),
  title VARCHAR NOT NULL,
  artist_name VARCHAR NOT NULL,
  artwork_url TEXT,
  catalog_number VARCHAR,
  release_status VARCHAR NOT NULL DEFAULT 'draft' CHECK (release_status IN ('draft', 'manufacturing', 'released', 'cancelled')),
  total_cost INTEGER DEFAULT 0,
  total_revenue INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create release_songs junction table
CREATE TABLE public.release_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  track_number INTEGER NOT NULL,
  is_b_side BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(release_id, song_id)
);

-- Create release_formats table
CREATE TABLE public.release_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  format_type VARCHAR NOT NULL CHECK (format_type IN ('digital', 'cd', 'vinyl', 'streaming')),
  release_date TIMESTAMPTZ NOT NULL,
  quantity INTEGER DEFAULT 0,
  manufacturing_cost INTEGER DEFAULT 0,
  retail_price INTEGER DEFAULT 0,
  distribution_fee_percentage INTEGER DEFAULT 0,
  manufacturing_status VARCHAR DEFAULT 'pending' CHECK (manufacturing_status IN ('pending', 'in_progress', 'completed')),
  manufacturing_completion_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create release_sales table
CREATE TABLE public.release_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_format_id UUID NOT NULL REFERENCES release_formats(id) ON DELETE CASCADE,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  quantity_sold INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  platform VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create manufacturing_costs table for bulk pricing tiers
CREATE TABLE public.manufacturing_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format_type VARCHAR NOT NULL CHECK (format_type IN ('cd', 'vinyl')),
  min_quantity INTEGER NOT NULL,
  max_quantity INTEGER,
  cost_per_unit INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default manufacturing cost tiers
INSERT INTO manufacturing_costs (format_type, min_quantity, max_quantity, cost_per_unit) VALUES
-- CD pricing tiers
('cd', 1, 99, 500),
('cd', 100, 499, 350),
('cd', 500, 999, 250),
('cd', 1000, NULL, 150),
-- Vinyl pricing tiers  
('vinyl', 1, 99, 1500),
('vinyl', 100, 499, 1200),
('vinyl', 500, 999, 900),
('vinyl', 1000, NULL, 700);

-- Enable RLS
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_costs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for releases
CREATE POLICY "Users can view their own releases"
ON public.releases FOR SELECT
USING (
  auth.uid() = user_id OR
  band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can create their own releases"
ON public.releases FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR
  band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their own releases"
ON public.releases FOR UPDATE
USING (
  auth.uid() = user_id OR
  band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete their own releases"
ON public.releases FOR DELETE
USING (
  auth.uid() = user_id OR
  band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
);

-- RLS Policies for release_songs
CREATE POLICY "Users can view release songs"
ON public.release_songs FOR SELECT
USING (
  release_id IN (
    SELECT id FROM releases WHERE 
    user_id = auth.uid() OR 
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Users can manage release songs"
ON public.release_songs FOR ALL
USING (
  release_id IN (
    SELECT id FROM releases WHERE 
    user_id = auth.uid() OR 
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  )
);

-- RLS Policies for release_formats
CREATE POLICY "Users can view release formats"
ON public.release_formats FOR SELECT
USING (
  release_id IN (
    SELECT id FROM releases WHERE 
    user_id = auth.uid() OR 
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Users can manage release formats"
ON public.release_formats FOR ALL
USING (
  release_id IN (
    SELECT id FROM releases WHERE 
    user_id = auth.uid() OR 
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  )
);

-- RLS Policies for release_sales
CREATE POLICY "Users can view their release sales"
ON public.release_sales FOR SELECT
USING (
  release_format_id IN (
    SELECT rf.id FROM release_formats rf
    JOIN releases r ON r.id = rf.release_id
    WHERE r.user_id = auth.uid() OR 
    r.band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  )
);

CREATE POLICY "System can insert sales"
ON public.release_sales FOR INSERT
WITH CHECK (true);

-- RLS Policies for manufacturing_costs
CREATE POLICY "Manufacturing costs are viewable by everyone"
ON public.manufacturing_costs FOR SELECT
USING (true);

CREATE POLICY "Admins can manage manufacturing costs"
ON public.manufacturing_costs FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_releases_updated_at
BEFORE UPDATE ON public.releases
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_release_formats_updated_at
BEFORE UPDATE ON public.release_formats
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();