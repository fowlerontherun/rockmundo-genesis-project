-- Update existing producers to use valid skill tree genres
UPDATE recording_producers SET specialty_genre = 'Rock' WHERE specialty_genre = 'Alternative';
UPDATE recording_producers SET specialty_genre = 'Heavy Metal' WHERE specialty_genre = 'Metal';
UPDATE recording_producers SET specialty_genre = 'Electronica' WHERE specialty_genre = 'Electronic';
UPDATE recording_producers SET specialty_genre = 'Indie/Bedroom Pop' WHERE specialty_genre = 'Indie';

-- Add more producers covering skill tree genres
INSERT INTO recording_producers (name, tier, specialty_genre, cost_per_hour, quality_bonus, mixing_skill, arrangement_skill, bio, past_works) VALUES
-- Budget tier (more diverse genres)
('Marcus Bell', 'budget', 'Jazz', 75, 8, 55, 50, 'Young jazz producer with fresh takes on classic sounds.', ARRAY['Local jazz sessions', 'College band recordings']),
('Sofia Reyes', 'budget', 'Latin', 80, 9, 58, 55, 'Brings authentic Latin rhythms to any production.', ARRAY['Regional Latin hits', 'Local salsa bands']),
('Tony Blues', 'budget', 'Blues', 65, 7, 52, 48, 'Old-school blues producer keeping traditions alive.', ARRAY['Delta blues recordings', 'Chicago blues sessions']),
('Island Sounds', 'budget', 'Reggae', 70, 8, 54, 52, 'Caribbean vibes specialist with laid-back approach.', ARRAY['Reggae compilations', 'Dub sessions']),
('Chen Wei', 'budget', 'World Music', 85, 10, 60, 58, 'Blends global sounds with modern production.', ARRAY['World fusion projects', 'Traditional recordings']),
('DJ Voltage', 'budget', 'EDM', 90, 11, 65, 60, 'Club-ready productions with energetic drops.', ARRAY['Local club tracks', 'Festival demos']),
('Sarah Punk', 'budget', 'Punk Rock', 55, 6, 48, 45, 'Raw, unpolished punk sound specialist.', ARRAY['Garage recordings', 'DIY punk albums']),

-- Mid tier (expanding coverage)
('Maestro Giovanni', 'mid', 'Classical', 1200, 22, 85, 90, 'Classically trained with decades of orchestral experience.', ARRAY['Symphony recordings', 'Film scores']),
('Flamenco Fire', 'mid', 'Flamenco', 950, 19, 75, 78, 'Authentic flamenco producer from Seville.', ARRAY['Flamenco albums', 'Dance productions']),
('Kofi Beats', 'mid', 'African Music', 900, 18, 72, 70, 'Afrobeats pioneer with global reach.', ARRAY['Afrobeats hits', 'Pan-African collaborations']),
('Modern Mike', 'mid', 'Modern Rock', 1000, 20, 78, 75, 'Contemporary rock sound architect.', ARRAY['Alt-rock albums', 'Rock radio hits']),
('Synth Master', 'mid', 'Synthwave', 1050, 21, 80, 77, 'Retro-futuristic soundscapes specialist.', ARRAY['Synthwave albums', 'Game soundtracks']),
('Lo-Fi Larry', 'mid', 'Lo-Fi Hip Hop', 850, 17, 70, 72, 'Chill beats and nostalgic vibes.', ARRAY['Study playlists', 'Chill hop collections']),
('Trap King', 'mid', 'Trap', 1100, 21, 82, 78, 'Hard-hitting 808s and modern trap sound.', ARRAY['Trap mixtapes', 'Street anthems']),

-- Premium tier (specialized experts)  
('K-Pop Queen', 'premium', 'K-Pop/J-Pop', 1900, 26, 92, 95, 'Former K-pop idol now producing chart-toppers.', ARRAY['K-pop group albums', 'J-pop singles']),
('Amapiano Alex', 'premium', 'Afrobeats/Amapiano', 1750, 25, 88, 85, 'South African dance music innovator.', ARRAY['Amapiano hits', 'Afrobeats crossovers']),
('Indie Dreams', 'premium', 'Indie/Bedroom Pop', 1550, 23, 85, 88, 'Captures intimate, dreamy bedroom pop aesthetic.', ARRAY['Indie darling albums', 'Viral bedroom pop tracks']),
('HyperProd', 'premium', 'Hyperpop', 1650, 24, 90, 87, 'Experimental, genre-bending hyperpop architect.', ARRAY['Hyperpop albums', 'Experimental pop tracks']),
('Metal Core', 'premium', 'Metalcore/Djent', 1700, 25, 92, 88, 'Technical metal production specialist.', ARRAY['Metalcore albums', 'Djent productions']),
('Neo Soul Sam', 'premium', 'Alt R&B/Neo-Soul', 1600, 24, 88, 90, 'Smooth, soulful R&B with modern edge.', ARRAY['Neo-soul albums', 'Alt R&B hits']),
('Drill Commander', 'premium', 'Drill', 1800, 26, 90, 85, 'UK and NY drill sound pioneer.', ARRAY['Drill mixtapes', 'Chart drill singles']),

-- Legendary tier (genre masters)
('Carlos Santana Jr.', 'legendary', 'Latin', 2600, 28, 95, 98, 'Latin music royalty with decades of hits.', ARRAY['Grammy-winning Latin albums', 'Cross-genre collaborations']),
('Herbie Legacy', 'legendary', 'Jazz', 2900, 29, 98, 99, 'Jazz legend producing the next generation.', ARRAY['Jazz masterpieces', 'Fusion landmarks']),
('Classical Master', 'legendary', 'Classical', 3200, 30, 99, 100, 'World-renowned classical producer and conductor.', ARRAY['Award-winning symphonies', 'Opera productions']),
('Reggae Legend', 'legendary', 'Reggae', 2400, 27, 94, 92, 'Jamaican roots and modern reggae fusion.', ARRAY['Reggae classics', 'Dancehall hits']);
