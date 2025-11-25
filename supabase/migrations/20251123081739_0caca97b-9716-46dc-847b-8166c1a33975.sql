-- Create table for managing page graphics/images
CREATE TABLE IF NOT EXISTS public.page_graphics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL UNIQUE,
  page_name TEXT NOT NULL,
  hero_image_url TEXT,
  background_image_url TEXT,
  accent_image_url TEXT,
  icon_image_url TEXT,
  banner_image_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.page_graphics ENABLE ROW LEVEL SECURITY;

-- Anyone can view active page graphics
CREATE POLICY "Anyone can view active page graphics"
  ON public.page_graphics
  FOR SELECT
  USING (is_active = true);

-- Authenticated users can manage page graphics (will add admin check in application layer)
CREATE POLICY "Authenticated users can insert page graphics"
  ON public.page_graphics
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update page graphics"
  ON public.page_graphics
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete page graphics"
  ON public.page_graphics
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Insert default page graphics entries
INSERT INTO public.page_graphics (page_key, page_name, metadata) VALUES
  ('dashboard', 'Dashboard', '{"description": "Main dashboard hero and background"}'::jsonb),
  ('my-character', 'My Character', '{"description": "Character profile page graphics"}'::jsonb),
  ('songwriting', 'Songwriting', '{"description": "Songwriting studio page graphics"}'::jsonb),
  ('gig-manager', 'Gig Manager', '{"description": "Gig booking and management page graphics"}'::jsonb),
  ('rehearsals', 'Rehearsals', '{"description": "Band rehearsal page graphics"}'::jsonb),
  ('recording', 'Recording Studio', '{"description": "Recording session page graphics"}'::jsonb),
  ('todays-news', 'Todays News', '{"description": "Daily news feed page graphics"}'::jsonb),
  ('wellness', 'Wellness', '{"description": "Health and wellness page graphics"}'::jsonb),
  ('busking', 'Busking', '{"description": "Street performance page graphics"}'::jsonb),
  ('venue-directory', 'Venue Directory', '{"description": "Venue listing page graphics"}'::jsonb)
ON CONFLICT (page_key) DO NOTHING;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_page_graphics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER page_graphics_updated_at
  BEFORE UPDATE ON public.page_graphics
  FOR EACH ROW
  EXECUTE FUNCTION update_page_graphics_timestamp();