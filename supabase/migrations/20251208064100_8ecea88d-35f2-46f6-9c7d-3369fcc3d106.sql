-- =============================================
-- BAND RIDER SYSTEM - Complete Database Schema
-- =============================================

-- 1. Rider Item Catalog (master list of all available rider items)
CREATE TABLE public.rider_item_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('technical', 'hospitality', 'backstage')),
  subcategory TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  base_cost INTEGER NOT NULL DEFAULT 0,
  performance_impact NUMERIC(3,2) NOT NULL DEFAULT 0,
  morale_impact NUMERIC(3,2) NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'optional' CHECK (priority IN ('essential', 'important', 'nice_to_have', 'optional')),
  min_fame_required INTEGER NOT NULL DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Band Riders (saved rider templates/presets per band)
CREATE TABLE public.band_riders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  tier TEXT NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'standard', 'professional', 'star', 'legendary')),
  is_default BOOLEAN DEFAULT false,
  total_cost_estimate INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Band Rider Items (items included in a rider)
CREATE TABLE public.band_rider_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rider_id UUID NOT NULL REFERENCES public.band_riders(id) ON DELETE CASCADE,
  catalog_item_id UUID NOT NULL REFERENCES public.rider_item_catalog(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  priority TEXT NOT NULL DEFAULT 'optional' CHECK (priority IN ('essential', 'important', 'nice_to_have', 'optional')),
  custom_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Venue Rider Capabilities (what each venue can provide)
CREATE TABLE public.venue_rider_capabilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  catalog_item_id UUID NOT NULL REFERENCES public.rider_item_catalog(id) ON DELETE CASCADE,
  is_available BOOLEAN DEFAULT true,
  quality_level INTEGER DEFAULT 50 CHECK (quality_level >= 0 AND quality_level <= 100),
  cost_modifier NUMERIC(3,2) DEFAULT 1.0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(venue_id, catalog_item_id)
);

-- 5. Gig Rider Fulfillment (tracking rider fulfillment per gig)
CREATE TABLE public.gig_rider_fulfillment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES public.band_riders(id) ON DELETE SET NULL,
  fulfillment_percentage INTEGER DEFAULT 0 CHECK (fulfillment_percentage >= 0 AND fulfillment_percentage <= 100),
  technical_fulfillment INTEGER DEFAULT 0,
  hospitality_fulfillment INTEGER DEFAULT 0,
  backstage_fulfillment INTEGER DEFAULT 0,
  performance_modifier NUMERIC(4,2) DEFAULT 1.0,
  morale_modifier NUMERIC(4,2) DEFAULT 1.0,
  total_rider_cost INTEGER DEFAULT 0,
  negotiation_notes TEXT,
  items_fulfilled JSONB DEFAULT '[]',
  items_missing JSONB DEFAULT '[]',
  items_substituted JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(gig_id)
);

-- 6. Add rider_id column to gigs table
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS rider_id UUID REFERENCES public.band_riders(id) ON DELETE SET NULL;

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

ALTER TABLE public.rider_item_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_rider_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_rider_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_rider_fulfillment ENABLE ROW LEVEL SECURITY;

-- Rider Item Catalog: Everyone can view
CREATE POLICY "Rider catalog is viewable by everyone" ON public.rider_item_catalog FOR SELECT USING (true);

-- Band Riders: Band members can manage
CREATE POLICY "Band members can view their riders" ON public.band_riders FOR SELECT
  USING (band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()));

CREATE POLICY "Band members can create riders" ON public.band_riders FOR INSERT
  WITH CHECK (band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()));

CREATE POLICY "Band members can update their riders" ON public.band_riders FOR UPDATE
  USING (band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()));

CREATE POLICY "Band members can delete their riders" ON public.band_riders FOR DELETE
  USING (band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()));

-- Band Rider Items: Follow parent rider permissions
CREATE POLICY "Band members can view their rider items" ON public.band_rider_items FOR SELECT
  USING (rider_id IN (SELECT id FROM band_riders WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())));

CREATE POLICY "Band members can manage their rider items" ON public.band_rider_items FOR ALL
  USING (rider_id IN (SELECT id FROM band_riders WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())));

-- Venue Rider Capabilities: Everyone can view
CREATE POLICY "Venue capabilities are viewable by everyone" ON public.venue_rider_capabilities FOR SELECT USING (true);

-- Gig Rider Fulfillment: Band members can view and manage
CREATE POLICY "Band members can view gig rider fulfillment" ON public.gig_rider_fulfillment FOR SELECT
  USING (gig_id IN (SELECT id FROM gigs WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())));

CREATE POLICY "Band members can manage gig rider fulfillment" ON public.gig_rider_fulfillment FOR ALL
  USING (gig_id IN (SELECT id FROM gigs WHERE band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())));

-- =============================================
-- SEED DATA: Rider Item Catalog (100+ items)
-- =============================================

-- TECHNICAL ITEMS: Sound Equipment
INSERT INTO public.rider_item_catalog (category, subcategory, name, description, base_cost, performance_impact, morale_impact, priority, min_fame_required, icon) VALUES
('technical', 'sound', 'Professional PA System', 'High-quality main speakers with subs', 500, 0.15, 0.05, 'essential', 0, 'speaker'),
('technical', 'sound', 'Monitor Wedges (Per Member)', 'Individual stage monitors for each performer', 100, 0.10, 0.08, 'essential', 0, 'speaker'),
('technical', 'sound', 'In-Ear Monitor System', 'Wireless in-ear monitoring for precision', 300, 0.12, 0.10, 'important', 500, 'headphones'),
('technical', 'sound', 'Digital Mixing Console', '32-channel digital mixer with effects', 400, 0.08, 0.03, 'important', 200, 'sliders'),
('technical', 'sound', 'Subwoofer Array', 'Extended low-frequency support', 350, 0.06, 0.04, 'nice_to_have', 300, 'speaker'),
('technical', 'sound', 'Wireless Microphone System', 'Professional wireless mics for vocals', 250, 0.08, 0.05, 'essential', 100, 'mic'),
('technical', 'sound', 'DI Boxes (Set of 8)', 'Direct injection boxes for instruments', 80, 0.04, 0.02, 'essential', 0, 'box'),
('technical', 'sound', 'Drum Microphone Kit', 'Complete drum mic setup', 200, 0.06, 0.04, 'important', 100, 'mic'),
('technical', 'sound', 'Guitar/Bass Amp Mics', 'Specialized amplifier microphones', 120, 0.05, 0.03, 'important', 50, 'mic'),
('technical', 'sound', 'Sound Engineer', 'Professional front-of-house engineer', 500, 0.20, 0.10, 'essential', 300, 'user');

-- TECHNICAL ITEMS: Lighting
INSERT INTO public.rider_item_catalog (category, subcategory, name, description, base_cost, performance_impact, morale_impact, priority, min_fame_required, icon) VALUES
('technical', 'lighting', 'Basic Stage Lighting', 'Front wash and back lighting', 200, 0.05, 0.03, 'essential', 0, 'lightbulb'),
('technical', 'lighting', 'Moving Head Spots (x4)', 'Automated moving spotlights', 400, 0.08, 0.06, 'important', 200, 'lightbulb'),
('technical', 'lighting', 'LED Par Cans (x8)', 'Color-changing stage lighting', 250, 0.06, 0.04, 'important', 100, 'lightbulb'),
('technical', 'lighting', 'Strobe Lights', 'High-intensity strobe effects', 150, 0.04, 0.05, 'nice_to_have', 150, 'zap'),
('technical', 'lighting', 'Laser Show System', 'Professional laser effects', 600, 0.10, 0.08, 'nice_to_have', 500, 'star'),
('technical', 'lighting', 'Haze/Fog Machine', 'Atmospheric effects machine', 100, 0.04, 0.03, 'important', 50, 'cloud'),
('technical', 'lighting', 'Follow Spots (x2)', 'Manual follow spotlights with operators', 350, 0.07, 0.05, 'nice_to_have', 400, 'lightbulb'),
('technical', 'lighting', 'LED Video Wall', 'Large format LED display backdrop', 1000, 0.12, 0.10, 'optional', 1000, 'monitor'),
('technical', 'lighting', 'Lighting Designer', 'Professional lighting operator', 400, 0.15, 0.08, 'important', 400, 'user'),
('technical', 'lighting', 'CO2 Jets (x4)', 'Cryogenic special effects', 500, 0.08, 0.10, 'optional', 800, 'wind');

-- TECHNICAL ITEMS: Stage & Backline
INSERT INTO public.rider_item_catalog (category, subcategory, name, description, base_cost, performance_impact, morale_impact, priority, min_fame_required, icon) VALUES
('technical', 'backline', 'Drum Kit (Professional)', 'Full professional drum kit', 300, 0.08, 0.05, 'essential', 0, 'drum'),
('technical', 'backline', 'Guitar Amplifier (Tube)', 'Professional tube guitar amp', 200, 0.06, 0.04, 'essential', 0, 'speaker'),
('technical', 'backline', 'Bass Amplifier', 'Professional bass rig', 180, 0.05, 0.04, 'essential', 0, 'speaker'),
('technical', 'backline', 'Keyboard/Piano', 'Stage keyboard or piano', 250, 0.06, 0.04, 'important', 100, 'piano'),
('technical', 'backline', 'Guitar Stands (x6)', 'Secure guitar/bass stands', 40, 0.02, 0.02, 'essential', 0, 'guitar'),
('technical', 'backline', 'Pedalboard Power Supply', 'Clean power for effects pedals', 60, 0.03, 0.02, 'important', 50, 'zap'),
('technical', 'backline', 'Drum Riser', 'Elevated drum platform', 150, 0.04, 0.03, 'nice_to_have', 200, 'layers'),
('technical', 'backline', 'Stage Risers (Modular)', 'Modular stage extension', 300, 0.05, 0.04, 'nice_to_have', 300, 'layers'),
('technical', 'backline', 'Backup Instruments', 'Spare guitars/bass on standby', 200, 0.08, 0.05, 'important', 200, 'guitar'),
('technical', 'backline', 'Stage Tech', 'On-stage technical support', 300, 0.12, 0.08, 'important', 300, 'user');

-- HOSPITALITY ITEMS: Catering
INSERT INTO public.rider_item_catalog (category, subcategory, name, description, base_cost, performance_impact, morale_impact, priority, min_fame_required, icon) VALUES
('hospitality', 'catering', 'Hot Meal (Per Person)', 'Full hot meal before show', 25, 0.02, 0.08, 'important', 0, 'utensils'),
('hospitality', 'catering', 'Sandwich Platter', 'Assorted sandwiches and wraps', 80, 0.01, 0.05, 'nice_to_have', 0, 'sandwich'),
('hospitality', 'catering', 'Fresh Fruit Platter', 'Seasonal fresh fruits', 50, 0.02, 0.04, 'nice_to_have', 0, 'apple'),
('hospitality', 'catering', 'Cheese & Charcuterie', 'Premium cheese and meat board', 120, 0.02, 0.06, 'optional', 200, 'cheese'),
('hospitality', 'catering', 'Vegetarian Options', 'Dedicated vegetarian menu items', 30, 0.01, 0.05, 'important', 0, 'leaf'),
('hospitality', 'catering', 'Vegan Options', 'Fully vegan menu items', 35, 0.01, 0.05, 'nice_to_have', 0, 'leaf'),
('hospitality', 'catering', 'Gluten-Free Options', 'Gluten-free alternatives', 30, 0.01, 0.04, 'nice_to_have', 0, 'wheat'),
('hospitality', 'catering', 'Premium Catering', 'High-end chef-prepared meals', 200, 0.03, 0.12, 'optional', 500, 'chef-hat'),
('hospitality', 'catering', 'Late Night Snacks', 'Post-show food available', 60, 0.01, 0.06, 'nice_to_have', 100, 'cookie'),
('hospitality', 'catering', 'Breakfast (Next Day)', 'Morning-after breakfast service', 40, 0.01, 0.05, 'optional', 300, 'coffee');

-- HOSPITALITY ITEMS: Beverages
INSERT INTO public.rider_item_catalog (category, subcategory, name, description, base_cost, performance_impact, morale_impact, priority, min_fame_required, icon) VALUES
('hospitality', 'beverages', 'Bottled Water (Case)', 'Still and sparkling water', 20, 0.02, 0.03, 'essential', 0, 'droplet'),
('hospitality', 'beverages', 'Soft Drinks Assortment', 'Variety of sodas and juices', 30, 0.01, 0.03, 'important', 0, 'cup-soda'),
('hospitality', 'beverages', 'Energy Drinks', 'Performance energy beverages', 40, 0.03, 0.04, 'nice_to_have', 50, 'zap'),
('hospitality', 'beverages', 'Premium Coffee Service', 'Espresso machine and barista', 100, 0.02, 0.08, 'nice_to_have', 200, 'coffee'),
('hospitality', 'beverages', 'Tea Selection', 'Variety of premium teas', 25, 0.01, 0.04, 'nice_to_have', 0, 'cup-soda'),
('hospitality', 'beverages', 'Fresh Juice Bar', 'Made-to-order fresh juices', 80, 0.02, 0.06, 'optional', 300, 'citrus'),
('hospitality', 'beverages', 'Coconut Water', 'Natural hydration', 30, 0.02, 0.04, 'nice_to_have', 100, 'droplet'),
('hospitality', 'beverages', 'Protein Shakes', 'Post-show recovery drinks', 50, 0.02, 0.05, 'optional', 200, 'flask'),
('hospitality', 'beverages', 'Champagne (Celebration)', 'Premium champagne for special shows', 200, 0.01, 0.15, 'optional', 500, 'wine'),
('hospitality', 'beverages', 'Craft Beer Selection', 'Local and premium craft beers', 80, 0.00, 0.08, 'optional', 200, 'beer');

-- HOSPITALITY ITEMS: Comfort
INSERT INTO public.rider_item_catalog (category, subcategory, name, description, base_cost, performance_impact, morale_impact, priority, min_fame_required, icon) VALUES
('hospitality', 'comfort', 'Clean Towels (Per Person)', 'Fresh towels for performers', 10, 0.01, 0.04, 'essential', 0, 'shirt'),
('hospitality', 'comfort', 'Robes/Comfortable Clothing', 'Post-show comfort wear', 30, 0.00, 0.05, 'nice_to_have', 200, 'shirt'),
('hospitality', 'comfort', 'Toiletries Kit', 'Basic personal care items', 20, 0.00, 0.03, 'important', 0, 'sparkles'),
('hospitality', 'comfort', 'Premium Toiletries', 'High-end personal care products', 50, 0.00, 0.06, 'optional', 300, 'sparkles'),
('hospitality', 'comfort', 'Massage Therapist', 'On-site massage service', 200, 0.05, 0.15, 'optional', 800, 'hand'),
('hospitality', 'comfort', 'Yoga/Stretch Area', 'Pre-show stretching space', 50, 0.03, 0.08, 'optional', 400, 'activity'),
('hospitality', 'comfort', 'Aromatherapy Diffuser', 'Calming scents backstage', 30, 0.01, 0.05, 'optional', 200, 'flower'),
('hospitality', 'comfort', 'Humidifier', 'Air quality for vocalists', 40, 0.03, 0.04, 'important', 100, 'cloud'),
('hospitality', 'comfort', 'White Noise Machine', 'Focus and relaxation aid', 25, 0.01, 0.04, 'optional', 150, 'volume-2'),
('hospitality', 'comfort', 'Heated Blankets', 'Comfort items for cold venues', 40, 0.00, 0.05, 'optional', 100, 'thermometer');

-- BACKSTAGE ITEMS: Dressing Rooms
INSERT INTO public.rider_item_catalog (category, subcategory, name, description, base_cost, performance_impact, morale_impact, priority, min_fame_required, icon) VALUES
('backstage', 'dressing_room', 'Private Dressing Room', 'Exclusive private space for band', 150, 0.05, 0.10, 'important', 100, 'door-closed'),
('backstage', 'dressing_room', 'Star Dressing Room', 'Premium suite with amenities', 400, 0.08, 0.15, 'nice_to_have', 500, 'star'),
('backstage', 'dressing_room', 'Hair/Makeup Station', 'Vanity with professional lighting', 80, 0.02, 0.08, 'nice_to_have', 200, 'scissors'),
('backstage', 'dressing_room', 'Full-Length Mirrors', 'Multiple large mirrors', 40, 0.01, 0.04, 'important', 50, 'maximize'),
('backstage', 'dressing_room', 'Clothing Racks', 'Space for wardrobe and costumes', 30, 0.01, 0.03, 'important', 50, 'shirt'),
('backstage', 'dressing_room', 'Iron/Steamer', 'Garment care equipment', 25, 0.01, 0.03, 'nice_to_have', 100, 'thermometer'),
('backstage', 'dressing_room', 'Private Bathroom', 'Ensuite bathroom facility', 100, 0.02, 0.08, 'important', 200, 'bath'),
('backstage', 'dressing_room', 'Shower Facilities', 'Post-show shower access', 80, 0.02, 0.10, 'important', 150, 'droplet'),
('backstage', 'dressing_room', 'Lockable Storage', 'Secure storage for valuables', 50, 0.01, 0.05, 'important', 100, 'lock'),
('backstage', 'dressing_room', 'Climate Control', 'Individual temperature control', 60, 0.02, 0.06, 'nice_to_have', 150, 'thermometer');

-- BACKSTAGE ITEMS: Green Room
INSERT INTO public.rider_item_catalog (category, subcategory, name, description, base_cost, performance_impact, morale_impact, priority, min_fame_required, icon) VALUES
('backstage', 'green_room', 'Green Room Access', 'Shared relaxation space', 100, 0.03, 0.08, 'important', 0, 'sofa'),
('backstage', 'green_room', 'Private Green Room', 'Exclusive green room for band', 250, 0.05, 0.12, 'nice_to_have', 300, 'sofa'),
('backstage', 'green_room', 'Comfortable Seating', 'Quality sofas and chairs', 80, 0.01, 0.06, 'important', 100, 'armchair'),
('backstage', 'green_room', 'Entertainment System', 'TV, gaming, and music', 120, 0.01, 0.08, 'nice_to_have', 200, 'tv'),
('backstage', 'green_room', 'WiFi Access', 'High-speed internet', 50, 0.01, 0.05, 'important', 0, 'wifi'),
('backstage', 'green_room', 'Phone Charging Station', 'Multiple device charging', 20, 0.00, 0.03, 'essential', 0, 'battery-charging'),
('backstage', 'green_room', 'Quiet Zone', 'Designated quiet relaxation area', 60, 0.02, 0.08, 'nice_to_have', 200, 'volume-x'),
('backstage', 'green_room', 'Plants/Greenery', 'Live plants for ambiance', 40, 0.01, 0.04, 'optional', 150, 'leaf'),
('backstage', 'green_room', 'Reading Materials', 'Books and magazines', 20, 0.00, 0.02, 'optional', 0, 'book-open'),
('backstage', 'green_room', 'Games/Entertainment', 'Board games, cards, etc.', 30, 0.00, 0.04, 'optional', 50, 'gamepad-2');

-- BACKSTAGE ITEMS: Security & Access
INSERT INTO public.rider_item_catalog (category, subcategory, name, description, base_cost, performance_impact, morale_impact, priority, min_fame_required, icon) VALUES
('backstage', 'security', 'Security Personnel', 'Dedicated backstage security', 300, 0.05, 0.10, 'important', 300, 'shield'),
('backstage', 'security', 'VIP Area Security', 'Security for VIP/meet-greet areas', 200, 0.03, 0.06, 'nice_to_have', 400, 'shield'),
('backstage', 'security', 'Guest List Management', 'Professional guest list handling', 100, 0.02, 0.05, 'important', 200, 'clipboard-list'),
('backstage', 'security', 'All Access Passes', 'Laminated passes for crew', 30, 0.01, 0.03, 'important', 100, 'ticket'),
('backstage', 'security', 'Secure Parking', 'Reserved secure parking', 80, 0.01, 0.05, 'important', 150, 'car'),
('backstage', 'security', 'Equipment Security', 'Overnight equipment security', 150, 0.04, 0.06, 'important', 200, 'lock'),
('backstage', 'security', 'Personal Security', 'Individual bodyguard service', 500, 0.05, 0.12, 'optional', 1000, 'user-check'),
('backstage', 'security', 'Crowd Control', 'Professional crowd management', 250, 0.06, 0.08, 'important', 400, 'users'),
('backstage', 'security', 'Emergency Medical', 'On-site medical personnel', 200, 0.08, 0.10, 'important', 300, 'heart-pulse'),
('backstage', 'security', 'Fire Safety Officer', 'Pyrotechnic safety supervision', 150, 0.05, 0.05, 'nice_to_have', 500, 'flame');

-- BACKSTAGE ITEMS: Production Support
INSERT INTO public.rider_item_catalog (category, subcategory, name, description, base_cost, performance_impact, morale_impact, priority, min_fame_required, icon) VALUES
('backstage', 'production', 'Production Manager', 'Professional show coordinator', 400, 0.15, 0.10, 'important', 400, 'user'),
('backstage', 'production', 'Stage Manager', 'On-stage coordination', 300, 0.12, 0.08, 'important', 300, 'user'),
('backstage', 'production', 'Runner/PA', 'Personal assistant for errands', 150, 0.03, 0.08, 'nice_to_have', 200, 'user'),
('backstage', 'production', 'Merchandise Team', 'Dedicated merch sales staff', 200, 0.02, 0.05, 'nice_to_have', 200, 'shopping-bag'),
('backstage', 'production', 'Photography', 'Professional event photographer', 250, 0.02, 0.06, 'optional', 300, 'camera'),
('backstage', 'production', 'Videography', 'Professional video recording', 400, 0.03, 0.07, 'optional', 400, 'video'),
('backstage', 'production', 'Setlist Printing', 'Professional setlist preparation', 20, 0.01, 0.02, 'important', 0, 'file-text'),
('backstage', 'production', 'Catering Coordinator', 'Dedicated hospitality manager', 150, 0.02, 0.08, 'nice_to_have', 300, 'utensils'),
('backstage', 'production', 'Tour Manager On-Site', 'Professional tour management', 500, 0.10, 0.12, 'optional', 600, 'briefcase'),
('backstage', 'production', 'Artist Liaison', 'Venue point of contact', 100, 0.03, 0.06, 'important', 200, 'user');

-- Create indexes for performance
CREATE INDEX idx_rider_catalog_category ON public.rider_item_catalog(category);
CREATE INDEX idx_rider_catalog_subcategory ON public.rider_item_catalog(subcategory);
CREATE INDEX idx_band_riders_band_id ON public.band_riders(band_id);
CREATE INDEX idx_band_rider_items_rider_id ON public.band_rider_items(rider_id);
CREATE INDEX idx_venue_rider_capabilities_venue_id ON public.venue_rider_capabilities(venue_id);
CREATE INDEX idx_gig_rider_fulfillment_gig_id ON public.gig_rider_fulfillment(gig_id);