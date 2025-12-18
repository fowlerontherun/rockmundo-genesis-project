-- Seed record labels across major music cities worldwide
INSERT INTO labels (name, description, headquarters_city, roster_slot_capacity, marketing_budget, genre_focus, reputation_score, market_share)
VALUES
  -- USA Labels
  ('Sonic Empire Records', 'Major label dominating the American rock and pop scene with worldwide distribution.', 'Los Angeles', 25, 5000000, ARRAY['Pop', 'Rock', 'R&B'], 85, 12.5),
  ('Brooklyn Underground', 'Indie label championing emerging artists from the NYC underground scene.', 'New York', 12, 500000, ARRAY['Indie Rock', 'Hip Hop', 'Electronic'], 45, 2.1),
  ('Nashville Sound Studios', 'Premier country and Americana label with decades of chart success.', 'Nashville', 18, 3000000, ARRAY['Country', 'Folk', 'Americana'], 78, 8.3),
  ('ATL Beats Collective', 'Hip hop and R&B powerhouse from the heart of Atlanta.', 'Atlanta', 15, 2500000, ARRAY['Hip Hop', 'R&B', 'Trap'], 72, 6.7),
  ('Windy City Records', 'Chicago-based label specializing in blues, jazz, and soul music.', 'Chicago', 10, 800000, ARRAY['Blues', 'Jazz', 'Soul'], 55, 1.8),
  
  -- UK Labels
  ('Thames Records', 'Historic London label with a roster spanning rock to electronic.', 'London', 22, 4500000, ARRAY['Rock', 'Electronic', 'Pop'], 82, 10.2),
  ('Northern Soul Music', 'Manchester label known for discovering breakthrough indie bands.', 'Manchester', 14, 1200000, ARRAY['Indie', 'Alternative', 'Post-Punk'], 62, 3.4),
  ('Celtic Sounds', 'Glasgow-based label celebrating Scottish and Celtic music traditions.', 'Glasgow', 8, 400000, ARRAY['Folk', 'Celtic', 'Traditional'], 38, 0.9),
  
  -- Europe Labels
  ('Berlin Electronic Works', 'Cutting-edge electronic and techno label from Germany.', 'Berlin', 16, 2000000, ARRAY['Techno', 'Electronic', 'House'], 75, 5.6),
  ('Parisian Melodies', 'French label known for sophisticated pop and chanson artists.', 'Paris', 12, 1800000, ARRAY['Pop', 'Chanson', 'Electronic'], 68, 4.2),
  ('Amsterdam Groove', 'Dutch label at the forefront of dance and EDM music.', 'Amsterdam', 14, 2200000, ARRAY['EDM', 'House', 'Trance'], 70, 4.8),
  ('Stockholm Sounds', 'Swedish pop factory producing international chart hits.', 'Stockholm', 18, 3500000, ARRAY['Pop', 'Synth Pop', 'Dance'], 80, 7.5),
  ('Milan Music Group', 'Italian label blending classical traditions with modern pop.', 'Milan', 10, 1500000, ARRAY['Pop', 'Classical Crossover', 'Opera Pop'], 58, 2.3),
  ('Vienna Classical Modern', 'Austrian label bridging classical and contemporary music.', 'Vienna', 8, 1000000, ARRAY['Classical', 'Neo-Classical', 'Ambient'], 52, 1.5),
  ('Barcelona Ritmos', 'Spanish label celebrating Latin, flamenco, and Mediterranean sounds.', 'Barcelona', 12, 1200000, ARRAY['Latin', 'Flamenco', 'Pop'], 55, 2.0),
  
  -- Asia Labels
  ('Tokyo Neon Records', 'Japanese label known for J-Pop and innovative electronic music.', 'Tokyo', 20, 4000000, ARRAY['J-Pop', 'Electronic', 'Rock'], 78, 6.8),
  ('Seoul Wave Entertainment', 'K-Pop powerhouse with global reach and dedicated fanbase.', 'Seoul', 25, 6000000, ARRAY['K-Pop', 'R&B', 'Hip Hop'], 88, 15.2),
  ('Mumbai Beats', 'Indias premier label for Bollywood soundtracks and indie music.', 'Mumbai', 15, 2000000, ARRAY['Bollywood', 'Indie', 'Fusion'], 65, 3.8),
  ('Shanghai Silk Road', 'Chinese label blending traditional sounds with modern production.', 'Shanghai', 12, 1800000, ARRAY['C-Pop', 'Traditional', 'Electronic'], 60, 2.9),
  ('Singapore Sound Hub', 'Southeast Asian label connecting regional artists globally.', 'Singapore', 10, 1500000, ARRAY['Pop', 'Electronic', 'R&B'], 55, 1.6),
  
  -- South America Labels
  ('Rio Carnival Records', 'Brazilian label specializing in samba, bossa nova, and funk.', 'Rio de Janeiro', 14, 1200000, ARRAY['Samba', 'Bossa Nova', 'Funk'], 62, 2.8),
  ('Buenos Aires Tango House', 'Argentine label preserving tango traditions while exploring fusion.', 'Buenos Aires', 10, 800000, ARRAY['Tango', 'Latin', 'Fusion'], 48, 1.2),
  ('Bogota Beats', 'Colombian label championing reggaeton and Latin urban music.', 'Bogotá', 12, 1000000, ARRAY['Reggaeton', 'Latin Urban', 'Pop'], 58, 2.4),
  
  -- Australia/Oceania Labels
  ('Sydney Harbour Records', 'Australias largest label with diverse pop and rock roster.', 'Sydney', 16, 2500000, ARRAY['Pop', 'Rock', 'Indie'], 72, 4.5),
  ('Melbourne Underground', 'Indie and alternative label from Australias music capital.', 'Melbourne', 10, 600000, ARRAY['Indie', 'Alternative', 'Psychedelic'], 45, 1.3),
  ('Auckland Waves', 'New Zealand label promoting Pacific sounds and local talent.', 'Auckland', 8, 400000, ARRAY['Indie', 'Folk', 'Electronic'], 35, 0.7),
  
  -- Africa Labels
  ('Lagos Afrobeats Global', 'Nigerian label at the center of the Afrobeats revolution.', 'Lagos', 18, 2000000, ARRAY['Afrobeats', 'Afropop', 'Highlife'], 75, 5.2),
  ('Cape Town Sounds', 'South African label showcasing diverse African musical traditions.', 'Cape Town', 10, 800000, ARRAY['Kwaito', 'House', 'Jazz'], 52, 1.4),
  ('Nairobi Rhythms', 'East African label promoting regional talent across genres.', 'Nairobi', 8, 500000, ARRAY['Afropop', 'Hip Hop', 'Gospel'], 42, 0.9),
  
  -- Middle East Labels
  ('Dubai Desert Records', 'Middle Eastern label blending Arabic music with global sounds.', 'Dubai', 12, 3000000, ARRAY['Arabic Pop', 'Electronic', 'Fusion'], 65, 2.5),
  ('Tel Aviv Electronic', 'Israeli label known for cutting-edge electronic and trance music.', 'Tel Aviv', 10, 1200000, ARRAY['Electronic', 'Trance', 'Psytrance'], 58, 1.8),
  
  -- Canada Labels
  ('Toronto North Star', 'Canadian label with strong hip hop and R&B roster.', 'Toronto', 14, 1800000, ARRAY['Hip Hop', 'R&B', 'Pop'], 68, 3.6),
  ('Montreal Francophone', 'Quebec label celebrating French Canadian music and culture.', 'Montreal', 10, 800000, ARRAY['Francophone', 'Indie', 'Electronic'], 48, 1.1),
  ('Vancouver Pacific Sounds', 'West coast Canadian label with indie and electronic focus.', 'Vancouver', 8, 500000, ARRAY['Indie', 'Electronic', 'Folk'], 40, 0.8),
  
  -- Scandinavia Labels
  ('Copenhagen Nordic', 'Danish label with strong electronic and pop credentials.', 'Copenhagen', 12, 1500000, ARRAY['Electronic', 'Pop', 'Indie'], 62, 2.2),
  ('Oslo Northern Lights', 'Norwegian label showcasing Nordic black metal and indie rock.', 'Oslo', 10, 1000000, ARRAY['Metal', 'Indie', 'Electronic'], 55, 1.6),
  ('Helsinki Arctic Records', 'Finnish label known for metal and innovative electronic music.', 'Helsinki', 10, 900000, ARRAY['Metal', 'Electronic', 'Classical'], 52, 1.4),
  
  -- Eastern Europe Labels
  ('Moscow Red Square Music', 'Russian label with diverse roster from classical to pop.', 'Moscow', 15, 2000000, ARRAY['Pop', 'Classical', 'Rock'], 60, 2.8),
  ('Warsaw Rising Records', 'Polish label championing Central European alternative music.', 'Warsaw', 10, 700000, ARRAY['Alternative', 'Electronic', 'Hip Hop'], 45, 1.0),
  ('Prague Bohemian Sounds', 'Czech label blending classical traditions with modern rock.', 'Prague', 8, 600000, ARRAY['Rock', 'Classical', 'Indie'], 42, 0.8)
ON CONFLICT DO NOTHING;