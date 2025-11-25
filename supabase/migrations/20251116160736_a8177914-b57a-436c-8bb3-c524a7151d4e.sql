-- Create table for t-shirt designs
CREATE TABLE IF NOT EXISTS public.tshirt_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  design_name TEXT NOT NULL,
  background_color TEXT NOT NULL CHECK (background_color IN ('white', 'black')),
  design_data JSONB NOT NULL, -- Stores fabric.js canvas JSON
  preview_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tshirt_designs ENABLE ROW LEVEL SECURITY;

-- Policies for t-shirt designs
CREATE POLICY "Users can view their band's designs"
  ON public.tshirt_designs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = tshirt_designs.band_id
      AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create designs for their bands"
  ON public.tshirt_designs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = tshirt_designs.band_id
      AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their band's designs"
  ON public.tshirt_designs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = tshirt_designs.band_id
      AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their band's designs"
  ON public.tshirt_designs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = tshirt_designs.band_id
      AND bm.user_id = auth.uid()
    )
  );

-- Add custom_design column to player_merchandise to track if item uses custom design
ALTER TABLE public.player_merchandise 
ADD COLUMN IF NOT EXISTS custom_design_id UUID REFERENCES tshirt_designs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sales_boost_pct NUMERIC(5,2) DEFAULT 0;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_tshirt_designs_band_id ON public.tshirt_designs(band_id);
CREATE INDEX IF NOT EXISTS idx_merchandise_custom_design ON public.player_merchandise(custom_design_id) WHERE custom_design_id IS NOT NULL;