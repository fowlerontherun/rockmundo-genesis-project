-- Seed additional record labels for more diversity
INSERT INTO labels (name, description, headquarters_city, genre_focus, reputation_score, roster_slot_capacity, marketing_budget, market_share) VALUES
-- North America
('Detroit Motor City Records', 'Legendary label bringing Motown soul and modern R&B from the Motor City.', 'Detroit', ARRAY['Soul', 'R&B', 'Motown'], 74, 16, 2200000, 5.5),
('Chicago Blues Vault', 'Preserving and evolving the Chicago blues tradition since the 60s.', 'Chicago', ARRAY['Blues', 'Jazz', 'Soul'], 76, 14, 1800000, 4.2),
('Miami Bass Coalition', 'The home of Latin-infused dance music and reggaeton.', 'Miami', ARRAY['Reggaeton', 'Latin Pop', 'EDM'], 71, 18, 2500000, 6.1),
('Seattle Grunge Revival', 'Keeping the grunge spirit alive with new alternative acts.', 'Seattle', ARRAY['Grunge', 'Alternative', 'Rock'], 66, 12, 1500000, 3.8),
('Austin Outlaw Records', 'Outlaw country and Americana from the live music capital.', 'Austin', ARRAY['Country', 'Americana', 'Folk'], 68, 14, 1600000, 4.0),
('New Orleans Crescent', 'Jazz, funk, and brass band traditions meet modern production.', 'New Orleans', ARRAY['Jazz', 'Funk', 'Brass Band'], 72, 12, 1400000, 3.5),
('Brooklyn Indie Collective', 'The epicenter of independent and experimental music.', 'New York', ARRAY['Indie', 'Experimental', 'Art Rock'], 78, 20, 3000000, 7.2),
('Montreal Francophone', 'French-Canadian pop and indie with international appeal.', 'Montreal', ARRAY['Pop', 'Indie', 'Francophone'], 64, 12, 1200000, 2.8),
-- Europe
('Glasgow Celtic Records', 'Scottish folk meets indie rock from the heart of Glasgow.', 'Glasgow', ARRAY['Folk', 'Indie', 'Celtic'], 63, 10, 900000, 2.1),
('Barcelona Flamenco Fusion', 'Modern flamenco meets electronic and pop.', 'Barcelona', ARRAY['Flamenco', 'Pop', 'Electronic'], 67, 14, 1500000, 3.6),
('Vienna Classical Modern', 'Where classical tradition meets contemporary composition.', 'Vienna', ARRAY['Classical', 'Contemporary', 'Orchestral'], 80, 16, 3500000, 4.8),
('Milan Fashion Beats', 'Stylish Italian pop and fashion-forward dance music.', 'Milan', ARRAY['Pop', 'Dance', 'House'], 69, 12, 2000000, 3.2),
('Dublin Celtic Indie', 'Irish indie and folk-rock with global crossover appeal.', 'Dublin', ARRAY['Indie', 'Folk Rock', 'Celtic'], 65, 12, 1300000, 2.9),
('Reykjavik Nordic Sound', 'Atmospheric and ethereal sounds from Iceland.', 'Reykjavik', ARRAY['Ambient', 'Electronic', 'Indie'], 70, 8, 800000, 1.8),
('Lisbon Fado House', 'Traditional fado reimagined for modern audiences.', 'Lisbon', ARRAY['Fado', 'World', 'Pop'], 62, 10, 900000, 1.9),
('Athens Mediterranean', 'Greek and Mediterranean sounds with contemporary flair.', 'Athens', ARRAY['Mediterranean', 'Pop', 'Folk'], 58, 10, 800000, 1.5),
-- Asia-Pacific
('Singapore Pan-Asian', 'The gateway label for pan-Asian pop and dance music.', 'Singapore', ARRAY['Pop', 'Dance', 'K-Pop'], 73, 18, 2800000, 5.8),
('Hong Kong Cantopop', 'Legendary Cantopop and modern Asian fusion.', 'Hong Kong', ARRAY['Cantopop', 'Pop', 'R&B'], 71, 16, 2400000, 4.6),
('Bangkok Thai Pop', 'Thai pop and Southeast Asian music with international production.', 'Bangkok', ARRAY['Thai Pop', 'Dance', 'R&B'], 60, 14, 1200000, 2.2),
('Manila OPM Records', 'Original Pilipino Music and Filipino pop excellence.', 'Manila', ARRAY['OPM', 'Pop', 'R&B'], 59, 14, 1100000, 2.0),
('Jakarta Indo Music', 'Indonesian pop and dangdut with massive regional reach.', 'Jakarta', ARRAY['Pop', 'Dangdut', 'R&B'], 61, 16, 1500000, 2.8),
('Auckland Pacific Sounds', 'Pacific Island and New Zealand indie fusion.', 'Auckland', ARRAY['Indie', 'Reggae', 'Pop'], 58, 10, 900000, 1.6),
('Osaka J-Rock House', 'Japanese rock and visual kei from Osaka underground.', 'Osaka', ARRAY['J-Rock', 'Visual Kei', 'Metal'], 68, 14, 1800000, 3.4),
-- Latin America
('Mexico City Norteño', 'Regional Mexican music meets modern production.', 'Mexico City', ARRAY['Norteño', 'Regional Mexican', 'Latin Pop'], 70, 18, 2200000, 5.2),
('Buenos Aires Tango', 'Tango traditions and Argentine rock nuevo.', 'Buenos Aires', ARRAY['Tango', 'Rock', 'Folk'], 66, 12, 1400000, 2.6),
('Bogotá Cumbia Records', 'Colombian cumbia, vallenato, and Latin urban.', 'Bogota', ARRAY['Cumbia', 'Vallenato', 'Reggaeton'], 64, 14, 1300000, 2.4),
('Santiago Chile Wave', 'Chilean indie and nueva canción for new generations.', 'Santiago', ARRAY['Indie', 'Rock', 'Folk'], 62, 10, 1000000, 1.8),
('Havana Salsa Records', 'Cuban salsa, son, and tropical rhythms.', 'Havana', ARRAY['Salsa', 'Son', 'Latin Jazz'], 69, 12, 800000, 1.4),
-- Africa & Middle East
('Cairo Arab Music', 'Egyptian and Arabic pop with traditional influences.', 'Cairo', ARRAY['Arabic Pop', 'Shaabi', 'Classical Arabic'], 63, 14, 1400000, 2.2),
('Johannesburg Kwaito', 'South African kwaito, amapiano, and house music.', 'Johannesburg', ARRAY['Amapiano', 'Kwaito', 'House'], 74, 16, 1800000, 3.8),
('Nairobi Afro Fusion', 'Kenyan and East African sounds with global fusion.', 'Nairobi', ARRAY['Afrobeats', 'Bongo Flava', 'R&B'], 61, 12, 1000000, 1.8),
('Tel Aviv Electronic', 'Israeli electronic, psytrance, and pop innovation.', 'Tel Aviv', ARRAY['Electronic', 'Psytrance', 'Pop'], 70, 12, 1600000, 2.8),
('Accra Highlife Records', 'Ghanaian highlife and Afrobeats excellence.', 'Accra', ARRAY['Highlife', 'Afrobeats', 'Gospel'], 66, 14, 1200000, 2.0),
-- Specialty/Niche Labels
('Nashville Underground', 'Alt-country and Americana with indie sensibilities.', 'Nashville', ARRAY['Alt-Country', 'Americana', 'Indie Folk'], 64, 10, 1100000, 2.0),
('LA Hip Hop Empire', 'West Coast hip hop and R&B from the streets of LA.', 'Los Angeles', ARRAY['Hip Hop', 'Rap', 'R&B'], 82, 22, 5500000, 11.0),
('New York Jazz Revival', 'Contemporary jazz and neo-soul from NYC.', 'New York', ARRAY['Jazz', 'Neo-Soul', 'R&B'], 77, 14, 2800000, 4.4),
('Vegas Entertainment', 'Pop, dance, and entertainment music for the strip.', 'Las Vegas', ARRAY['Pop', 'Dance', 'EDM'], 72, 16, 3200000, 5.0),
('Phoenix Desert Rock', 'Desert rock and stoner metal from the Southwest.', 'Phoenix', ARRAY['Stoner Rock', 'Metal', 'Alternative'], 58, 8, 600000, 0.8),
('Portland Weird Wave', 'Experimental and weird pop from the Pacific Northwest.', 'Portland', ARRAY['Experimental', 'Indie Pop', 'Electronic'], 60, 10, 800000, 1.2);