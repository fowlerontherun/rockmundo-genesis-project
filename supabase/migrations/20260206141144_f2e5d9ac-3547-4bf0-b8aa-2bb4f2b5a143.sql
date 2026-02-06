-- =============================================
-- AWARDS SYSTEM TABLES
-- =============================================

-- Award shows (game-world ceremonies)
CREATE TABLE IF NOT EXISTS public.award_shows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  show_name TEXT NOT NULL,
  year INTEGER NOT NULL DEFAULT 2026,
  city_id UUID REFERENCES public.cities(id),
  venue TEXT,
  district TEXT,
  overview TEXT,
  ceremony_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'nominations_open', 'voting_open', 'live', 'completed')),
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  voting_breakdown JSONB DEFAULT '{}'::jsonb,
  rewards JSONB DEFAULT '{}'::jsonb,
  performance_slots JSONB DEFAULT '[]'::jsonb,
  broadcast_partners TEXT[] DEFAULT '{}',
  prestige_level INTEGER NOT NULL DEFAULT 1,
  attendance_fame_boost INTEGER NOT NULL DEFAULT 200,
  winner_fame_boost INTEGER NOT NULL DEFAULT 1000,
  winner_prize_money INTEGER NOT NULL DEFAULT 5000,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.award_shows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Award shows are viewable by everyone" ON public.award_shows FOR SELECT USING (true);

-- Award nominations
CREATE TABLE IF NOT EXISTS public.award_nominations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  award_show_id UUID NOT NULL REFERENCES public.award_shows(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  nominee_type TEXT NOT NULL DEFAULT 'band' CHECK (nominee_type IN ('band', 'player', 'song', 'album')),
  nominee_id TEXT NOT NULL,
  nominee_name TEXT NOT NULL,
  band_id UUID REFERENCES public.bands(id),
  user_id UUID NOT NULL,
  submission_data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shortlisted', 'winner', 'runner_up', 'rejected')),
  vote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(award_show_id, category_name, nominee_id)
);

ALTER TABLE public.award_nominations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Nominations are viewable by everyone" ON public.award_nominations FOR SELECT USING (true);
CREATE POLICY "Users can submit nominations" ON public.award_nominations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Award votes
CREATE TABLE IF NOT EXISTS public.award_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nomination_id UUID NOT NULL REFERENCES public.award_nominations(id) ON DELETE CASCADE,
  voter_type TEXT NOT NULL DEFAULT 'player' CHECK (voter_type IN ('player', 'npc', 'jury')),
  voter_id UUID NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(nomination_id, voter_id)
);

ALTER TABLE public.award_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Votes are viewable by everyone" ON public.award_votes FOR SELECT USING (true);
CREATE POLICY "Users can cast votes" ON public.award_votes FOR INSERT WITH CHECK (auth.uid() = voter_id);

-- Trigger to update vote count
CREATE OR REPLACE FUNCTION update_nomination_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.award_nominations 
  SET vote_count = (SELECT COALESCE(SUM(weight), 0) FROM public.award_votes WHERE nomination_id = NEW.nomination_id)
  WHERE id = NEW.nomination_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_vote_count
  AFTER INSERT ON public.award_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_nomination_vote_count();

-- Award wins (permanent record)
CREATE TABLE IF NOT EXISTS public.award_wins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  award_show_id UUID NOT NULL REFERENCES public.award_shows(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  winner_name TEXT NOT NULL,
  band_id UUID REFERENCES public.bands(id),
  user_id UUID NOT NULL,
  fame_boost INTEGER NOT NULL DEFAULT 0,
  prize_money INTEGER NOT NULL DEFAULT 0,
  won_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(award_show_id, category_name)
);

ALTER TABLE public.award_wins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Wins are viewable by everyone" ON public.award_wins FOR SELECT USING (true);

-- Red carpet events
CREATE TABLE IF NOT EXISTS public.award_red_carpet_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  award_show_id UUID NOT NULL REFERENCES public.award_shows(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL,
  participant_type TEXT NOT NULL DEFAULT 'user' CHECK (participant_type IN ('user', 'band')),
  outfit_choice TEXT NOT NULL DEFAULT 'standard',
  fame_gain INTEGER NOT NULL DEFAULT 0,
  media_interactions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(award_show_id, participant_id)
);

ALTER TABLE public.award_red_carpet_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Red carpet events viewable by everyone" ON public.award_red_carpet_events FOR SELECT USING (true);
CREATE POLICY "Users can attend red carpet" ON public.award_red_carpet_events FOR INSERT WITH CHECK (auth.uid() = participant_id);

-- Performance bookings
CREATE TABLE IF NOT EXISTS public.award_performance_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  award_show_id UUID NOT NULL REFERENCES public.award_shows(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES public.bands(id),
  user_id UUID NOT NULL,
  slot_label TEXT NOT NULL,
  stage TEXT NOT NULL,
  song_ids UUID[] DEFAULT '{}',
  rehearsal_scheduled TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'rehearsed', 'performed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(award_show_id, slot_label)
);

ALTER TABLE public.award_performance_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Performance bookings viewable by everyone" ON public.award_performance_bookings FOR SELECT USING (true);
CREATE POLICY "Users can book performances" ON public.award_performance_bookings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- SEED AWARD SHOWS (global ceremonies)
-- =============================================
INSERT INTO public.award_shows (show_name, year, venue, district, ceremony_date, status, prestige_level, attendance_fame_boost, winner_fame_boost, winner_prize_money, overview, categories, broadcast_partners) VALUES
('Rockmundo Music Awards', 2026, 'Madison Square Garden', 'New York, USA', '2026-04-15 20:00:00+00', 'nominations_open', 5, 500, 2500, 25000, 
 'The premier global music ceremony celebrating the best across all genres. Performing here is a career-defining moment.',
 '[{"name":"Song of the Year","focus":"song","description":"The most impactful single released this year"},{"name":"Album of the Year","focus":"album","description":"The most critically acclaimed and commercially successful album"},{"name":"Best Live Act","focus":"live_show","description":"The band delivering the most electrifying live performances"},{"name":"Best New Artist","focus":"innovation","description":"The most promising breakthrough act of the year"},{"name":"Best Rock Performance","focus":"song","description":"Outstanding achievement in rock music"},{"name":"Best Pop Performance","focus":"song","description":"Outstanding achievement in pop music"}]'::jsonb,
 ARRAY['MTV', 'Rockmundo Live', 'Spotify']),
 
('BRIT Awards', 2026, 'The O2 Arena', 'London, UK', '2026-03-20 19:30:00+00', 'nominations_open', 5, 450, 2000, 20000,
 'The UK''s most prestigious music awards, celebrating British and international talent at the iconic O2 Arena.',
 '[{"name":"British Album of the Year","focus":"album","description":"Best album by a British act"},{"name":"British Single","focus":"song","description":"The biggest British single of the year"},{"name":"International Group","focus":"live_show","description":"Best international group"},{"name":"Rising Star","focus":"innovation","description":"The BRITs Critics'' Choice for breakthrough talent"},{"name":"Best British Group","focus":"live_show","description":"Outstanding British group"}]'::jsonb,
 ARRAY['ITV', 'BBC Radio', 'Rockmundo Live']),

('Grammy Awards', 2026, 'Crypto.com Arena', 'Los Angeles, USA', '2026-02-08 20:00:00+00', 'voting_open', 5, 600, 3000, 30000,
 'The most prestigious music awards in the world. A Grammy win transforms careers and cements legacies.',
 '[{"name":"Record of the Year","focus":"song","description":"Best overall production of a single"},{"name":"Album of the Year","focus":"album","description":"Best album in any genre"},{"name":"Song of the Year","focus":"song","description":"Best songwriting achievement"},{"name":"Best New Artist","focus":"innovation","description":"Most promising new talent"},{"name":"Best Rock Album","focus":"album","description":"Outstanding rock album"},{"name":"Best Pop Vocal Album","focus":"album","description":"Outstanding pop album"}]'::jsonb,
 ARRAY['CBS', 'Grammy.com', 'Rockmundo Live']),

('MTV Europe Music Awards', 2026, 'Ziggo Dome', 'Amsterdam, Netherlands', '2026-11-10 20:00:00+00', 'upcoming', 4, 350, 1500, 15000,
 'Europe''s biggest music event celebrating the hottest artists from around the world with spectacular performances.',
 '[{"name":"Best Song","focus":"song","description":"The biggest song across European charts"},{"name":"Best Artist","focus":"live_show","description":"Most outstanding artist of the year"},{"name":"Best Rock","focus":"song","description":"Best rock act"},{"name":"Best Pop","focus":"song","description":"Best pop act"},{"name":"Best New","focus":"innovation","description":"Most exciting new artist"}]'::jsonb,
 ARRAY['MTV Europe', 'Rockmundo Live']),

('ARIA Awards', 2026, 'Hordern Pavilion', 'Sydney, Australia', '2026-11-25 19:00:00+10', 'upcoming', 4, 300, 1200, 12000,
 'Australia''s premier music awards honouring the best in Australian music across all genres.',
 '[{"name":"Album of the Year","focus":"album","description":"Best Australian album"},{"name":"Best Group","focus":"live_show","description":"Best Australian group"},{"name":"Breakthrough Artist","focus":"innovation","description":"Most promising new Australian act"},{"name":"Best Rock Album","focus":"album","description":"Outstanding Australian rock album"}]'::jsonb,
 ARRAY['ABC Australia', 'Rockmundo Live']),

('NME Awards', 2026, 'Brixton Academy', 'London, UK', '2026-05-14 19:30:00+00', 'upcoming', 3, 250, 1000, 8000,
 'The edgier, more alternative music awards celebrating indie, rock, and cutting-edge artists.',
 '[{"name":"Best Album","focus":"album","description":"Best album as voted by NME readers"},{"name":"Best Track","focus":"song","description":"Track of the year"},{"name":"Best Live Act","focus":"live_show","description":"The year''s most exciting live performer"},{"name":"Best New Act","focus":"innovation","description":"Most exciting new band"}]'::jsonb,
 ARRAY['NME', 'BBC Radio 6', 'Rockmundo Live']),

('Latin Music Awards', 2026, 'AmericanAirlines Arena', 'Miami, USA', '2026-06-20 20:00:00-04', 'upcoming', 4, 350, 1500, 15000,
 'Celebrating the best in Latin music across reggaeton, bachata, salsa, and Latin pop.',
 '[{"name":"Song of the Year","focus":"song","description":"Best Latin song"},{"name":"Album of the Year","focus":"album","description":"Best Latin album"},{"name":"Best New Artist","focus":"innovation","description":"Best new Latin artist"},{"name":"Best Live Performance","focus":"live_show","description":"Best Latin live act"}]'::jsonb,
 ARRAY['Telemundo', 'Rockmundo Live']),

('Japan Music Awards', 2026, 'Tokyo Dome', 'Tokyo, Japan', '2026-12-30 18:00:00+09', 'upcoming', 4, 300, 1200, 12000,
 'Japan''s biggest end-of-year music celebration bringing together J-Pop, J-Rock, and international artists.',
 '[{"name":"Grand Prix","focus":"album","description":"Best overall musical achievement"},{"name":"Best Song","focus":"song","description":"Most popular song of the year"},{"name":"Best New Artist","focus":"innovation","description":"Most promising newcomer"},{"name":"Best Rock Act","focus":"live_show","description":"Best rock performance"}]'::jsonb,
 ARRAY['NHK', 'Rockmundo Live']);

-- =============================================
-- SEED MODELING GIGS (40+ gigs across all types)
-- =============================================
INSERT INTO public.modeling_gigs (agency_id, gig_type, title, description, min_looks_required, min_fame_required, compensation_min, compensation_max, fame_boost, looks_boost, duration_hours, is_available) VALUES
-- Local tier gigs (low requirements)
((SELECT id FROM modeling_agencies WHERE name = 'Independent Talent Group'), 'photo_shoot', 'Local Magazine Cover', 'Feature spread for an indie music magazine', 35, 500, 500, 2000, 50, 1, 4, true),
((SELECT id FROM modeling_agencies WHERE name = 'Independent Talent Group'), 'commercial', 'Energy Drink Commercial', 'TV commercial for an up-and-coming energy drink brand', 35, 1000, 1000, 3000, 80, 0, 6, true),
((SELECT id FROM modeling_agencies WHERE name = 'Independent Talent Group'), 'photo_shoot', 'Festival Promo Shoot', 'Promotional photos for a summer festival lineup', 40, 2000, 800, 2500, 60, 1, 3, true),
((SELECT id FROM modeling_agencies WHERE name = 'Independent Talent Group'), 'music_video_cameo', 'Indie Music Video Cameo', 'Brief appearance in a fellow artist''s music video', 35, 1500, 1500, 4000, 100, 0, 8, true),
((SELECT id FROM modeling_agencies WHERE name = 'Independent Talent Group'), 'photo_shoot', 'Street Style Feature', 'Featured in a street style photography series', 40, 500, 300, 1200, 30, 2, 2, true),

-- International tier gigs  
((SELECT id FROM modeling_agencies WHERE name = 'Next Model Management'), 'runway', 'Fashion Week Backstage Pass', 'Walk in an emerging designer''s collection', 60, 10000, 5000, 15000, 200, 3, 6, true),
((SELECT id FROM modeling_agencies WHERE name = 'Next Model Management'), 'brand_ambassador', 'Streetwear Brand Ambassador', 'Season-long partnership with a streetwear label', 60, 15000, 10000, 30000, 300, 2, 12, true),
((SELECT id FROM modeling_agencies WHERE name = 'Next Model Management'), 'cover_shoot', 'Rolling Stone Feature', 'Multi-page feature and cover option for Rolling Stone', 65, 20000, 8000, 25000, 400, 2, 8, true),
((SELECT id FROM modeling_agencies WHERE name = 'Next Model Management'), 'commercial', 'Luxury Watch Commercial', 'High-end TV commercial for a luxury watch brand', 65, 25000, 15000, 40000, 350, 1, 10, true),
((SELECT id FROM modeling_agencies WHERE name = 'Next Model Management'), 'photo_shoot', 'Vogue Online Editorial', 'Digital editorial feature for Vogue online', 65, 20000, 6000, 18000, 250, 3, 6, true),

-- Ford Models (International)
((SELECT id FROM modeling_agencies WHERE name = 'Ford Models'), 'runway', 'New York Runway Show', 'Walk for a mid-tier designer during NYFW', 70, 30000, 10000, 35000, 400, 3, 8, true),
((SELECT id FROM modeling_agencies WHERE name = 'Ford Models'), 'brand_ambassador', 'Denim Brand Campaign', 'Year-long face of a premium denim brand', 70, 35000, 25000, 75000, 500, 2, 16, true),
((SELECT id FROM modeling_agencies WHERE name = 'Ford Models'), 'cover_shoot', 'GQ Cover Shoot', 'Cover and feature for GQ magazine', 72, 40000, 15000, 45000, 600, 3, 10, true),
((SELECT id FROM modeling_agencies WHERE name = 'Ford Models'), 'commercial', 'Fragrance Campaign', 'TV and print campaign for a designer fragrance', 72, 45000, 30000, 80000, 500, 2, 12, true),
((SELECT id FROM modeling_agencies WHERE name = 'Ford Models'), 'photo_shoot', 'Sports Brand Lookbook', 'Athletic wear lookbook for a major sports brand', 70, 25000, 8000, 25000, 300, 2, 6, true),

-- Storm Model Management (International)
((SELECT id FROM modeling_agencies WHERE name = 'Storm Model Management'), 'runway', 'London Fashion Week Show', 'Walk for a designer during London Fashion Week', 75, 40000, 15000, 50000, 500, 4, 8, true),
((SELECT id FROM modeling_agencies WHERE name = 'Storm Model Management'), 'cover_shoot', 'Vogue UK Cover', 'Cover shoot for British Vogue', 78, 50000, 25000, 70000, 800, 4, 12, true),
((SELECT id FROM modeling_agencies WHERE name = 'Storm Model Management'), 'brand_ambassador', 'Luxury Fashion House Ambassador', 'Multi-season ambassador for a luxury fashion house', 78, 60000, 50000, 150000, 700, 3, 24, true),
((SELECT id FROM modeling_agencies WHERE name = 'Storm Model Management'), 'commercial', 'Luxury Car Commercial', 'Global TV campaign for a luxury automotive brand', 75, 50000, 40000, 100000, 600, 2, 14, true),
((SELECT id FROM modeling_agencies WHERE name = 'Storm Model Management'), 'photo_shoot', 'Harper''s Bazaar Editorial', 'Editorial spread for Harper''s Bazaar', 76, 45000, 12000, 35000, 450, 3, 8, true),

-- Elite tier gigs (highest requirements)
((SELECT id FROM modeling_agencies WHERE name = 'Elite Model Management'), 'runway', 'Paris Fashion Week Headliner', 'Close a major designer show at Paris Fashion Week', 85, 80000, 30000, 100000, 1000, 5, 10, true),
((SELECT id FROM modeling_agencies WHERE name = 'Elite Model Management'), 'cover_shoot', 'Vogue Paris Cover', 'The most coveted cover in fashion', 88, 100000, 50000, 150000, 1500, 5, 14, true),
((SELECT id FROM modeling_agencies WHERE name = 'Elite Model Management'), 'brand_ambassador', 'Global Luxury Brand Face', 'Become the face of a top-5 global luxury brand', 90, 150000, 200000, 500000, 2000, 5, 48, true),
((SELECT id FROM modeling_agencies WHERE name = 'Elite Model Management'), 'commercial', 'Super Bowl Commercial', 'Appear in a high-profile Super Bowl advertisement', 85, 120000, 100000, 300000, 1500, 3, 16, true),

-- IMG Models (Elite)
((SELECT id FROM modeling_agencies WHERE name = 'IMG Models'), 'runway', 'Met Gala Entrance Walk', 'Make a grand entrance at the Met Gala', 80, 150000, 0, 0, 3000, 5, 6, true),
((SELECT id FROM modeling_agencies WHERE name = 'IMG Models'), 'cover_shoot', 'Vanity Fair Hollywood Issue', 'Featured in the Vanity Fair Hollywood Issue', 82, 100000, 30000, 80000, 1200, 4, 12, true),
((SELECT id FROM modeling_agencies WHERE name = 'IMG Models'), 'brand_ambassador', 'Sportswear Giant Campaign', 'Global campaign for Nike/Adidas level brand', 80, 80000, 75000, 250000, 1000, 4, 24, true),
((SELECT id FROM modeling_agencies WHERE name = 'IMG Models'), 'photo_shoot', 'Sports Illustrated Feature', 'Multi-page feature in Sports Illustrated', 82, 60000, 20000, 60000, 800, 4, 10, true),
((SELECT id FROM modeling_agencies WHERE name = 'IMG Models'), 'commercial', 'Streaming Platform Campaign', 'Star in a campaign for a major streaming service', 80, 70000, 40000, 120000, 700, 3, 12, true),

-- Fashion Week specific gigs (linked to events)
((SELECT id FROM modeling_agencies WHERE name = 'Elite Model Management'), 'runway', 'Paris Haute Couture Finale', 'Close the haute couture show in Paris', 90, 100000, 40000, 120000, 1500, 5, 8, true),
((SELECT id FROM modeling_agencies WHERE name = 'Storm Model Management'), 'runway', 'Milan Ready-to-Wear Show', 'Walk in Milan''s ready-to-wear collections', 78, 60000, 20000, 60000, 600, 4, 8, true),
((SELECT id FROM modeling_agencies WHERE name = 'Ford Models'), 'runway', 'NYFW Opening Show', 'Open a designer''s show at New York Fashion Week', 72, 35000, 12000, 40000, 450, 3, 6, true),
((SELECT id FROM modeling_agencies WHERE name = 'Storm Model Management'), 'runway', 'Tokyo Fashion Week Guest', 'Special guest appearance at Tokyo Fashion Week', 75, 40000, 15000, 45000, 400, 3, 8, true),

-- Music crossover gigs
((SELECT id FROM modeling_agencies WHERE name = 'Next Model Management'), 'music_video_cameo', 'Major Label Music Video', 'Lead cameo in a chart-topping artist''s video', 60, 30000, 10000, 30000, 500, 1, 12, true),
((SELECT id FROM modeling_agencies WHERE name = 'Ford Models'), 'music_video_cameo', 'Award Show Performance Look', 'Styled appearance during a televised award show', 70, 50000, 5000, 15000, 600, 2, 4, true),
((SELECT id FROM modeling_agencies WHERE name = 'IMG Models'), 'music_video_cameo', 'Concert Tour Visuals', 'Featured in tour visuals and merchandise imagery', 80, 60000, 20000, 50000, 400, 2, 8, true);

-- Add more modeling agencies
INSERT INTO public.modeling_agencies (name, tier, prestige_level, min_looks_required, region, is_active, description) VALUES
('Wilhelmina Models', 'international', 4, 70, 'North America', true, 'One of the oldest and most prestigious modeling agencies in the world'),
('Select Model Management', 'international', 3, 65, 'Europe', true, 'London-based agency known for discovering unique talent'),
('The Society Management', 'elite', 5, 85, 'global', true, 'Elite New York-based agency representing the world''s top models'),
('DNA Model Management', 'international', 4, 72, 'North America', true, 'Boutique agency known for editorial and high-fashion talent'),
('Women Management', 'international', 4, 75, 'Europe', true, 'Paris-based agency with a strong presence in European fashion'),
('Marilyn Agency', 'international', 3, 65, 'Europe', true, 'Parisian agency with a knack for discovering fresh faces'),
('Premier Model Management', 'international', 4, 72, 'Europe', true, 'London''s leading model agency'),
('Mega Model Agency', 'national', 2, 50, 'South America', true, 'Brazil''s top agency, gateway to Latin American fashion'),
('Satoru Japan', 'national', 2, 55, 'Asia', true, 'Tokyo-based agency bridging Eastern and Western fashion worlds');