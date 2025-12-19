-- Seed newspapers data with valid types: local, regional, national, tabloid, broadsheet
INSERT INTO newspapers (name, newspaper_type, country, circulation, quality_level, min_fame_required, genres, description, interview_slots_per_day, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max, is_active)
VALUES
  ('Rolling Stone Daily', 'national', 'United States', 2500000, 5, 500, ARRAY['Rock', 'Pop', 'Hip Hop', 'R&B'], 'The legendary music publication covering all things rock and pop culture', 2, 50, 150, 500, 2000, 5000, 15000, true),
  ('NME News', 'tabloid', 'United Kingdom', 800000, 4, 200, ARRAY['Rock', 'Indie', 'Alternative', 'Electronic'], 'New Musical Express - The UK''s essential music and culture guide', 3, 30, 80, 200, 800, 2000, 6000, true),
  ('Pitchfork Weekly', 'national', 'United States', 500000, 4, 150, ARRAY['Indie', 'Electronic', 'Experimental', 'Hip Hop'], 'The definitive voice in indie and alternative music journalism', 4, 25, 60, 150, 600, 1500, 4000, true),
  ('Billboard Daily', 'national', 'United States', 1200000, 5, 300, ARRAY['Pop', 'Hip Hop', 'R&B', 'Country'], 'The music industry''s most trusted source for charts and news', 2, 40, 100, 300, 1000, 3000, 8000, true),
  ('Kerrang! News', 'tabloid', 'United Kingdom', 400000, 3, 100, ARRAY['Metal', 'Rock', 'Punk', 'Alternative'], 'The world''s biggest rock and metal news source', 4, 20, 50, 100, 400, 1000, 3000, true),
  ('The Guardian Music', 'broadsheet', 'United Kingdom', 3000000, 4, 250, ARRAY['Rock', 'Pop', 'Classical', 'Jazz'], 'Award-winning music journalism from The Guardian', 3, 35, 90, 250, 900, 2500, 7000, true),
  ('Variety Daily', 'national', 'United States', 1500000, 5, 400, ARRAY['Pop', 'Film', 'Broadway', 'Country'], 'Entertainment industry''s premier publication', 2, 45, 120, 400, 1500, 4000, 12000, true),
  ('Musikexpress News', 'regional', 'Germany', 300000, 3, 80, ARRAY['Rock', 'Electronic', 'Pop', 'Indie'], 'Germany''s leading music news source', 5, 15, 40, 80, 300, 800, 2500, true),
  ('Les Inrocks', 'regional', 'France', 250000, 3, 75, ARRAY['Rock', 'Electronic', 'Pop', 'World'], 'France''s premier music news outlet', 5, 15, 35, 75, 280, 750, 2200, true),
  ('Rock Sound News', 'tabloid', 'United Kingdom', 200000, 2, 50, ARRAY['Rock', 'Metal', 'Punk', 'Emo'], 'The home of new rock music news', 6, 10, 30, 50, 200, 500, 1500, true),
  ('XXL News', 'tabloid', 'United States', 600000, 4, 180, ARRAY['Hip Hop', 'Rap', 'R&B'], 'Hip-hop''s most influential news source', 3, 30, 70, 180, 700, 2000, 5500, true),
  ('Clash News', 'local', 'United Kingdom', 150000, 2, 40, ARRAY['Indie', 'Electronic', 'Pop', 'Alternative'], 'Independent music news outlet', 6, 8, 25, 40, 150, 400, 1200, true),
  ('Spin Daily', 'tabloid', 'United States', 400000, 3, 120, ARRAY['Rock', 'Pop', 'Hip Hop', 'Electronic'], 'Alternative music and culture news', 4, 20, 50, 120, 450, 1200, 3500, true),
  ('Under the Radar News', 'local', 'United States', 80000, 2, 25, ARRAY['Indie', 'Alternative', 'Folk', 'Experimental'], 'Independent music news for emerging artists', 8, 5, 20, 25, 100, 200, 800, true),
  ('El País Cultura', 'broadsheet', 'Spain', 1000000, 3, 100, ARRAY['Rock', 'Latin', 'Pop', 'Flamenco'], 'Spain''s leading newspaper culture section', 4, 20, 50, 100, 400, 1000, 3000, true);

-- Seed magazines data with valid publication_frequency: weekly, biweekly, monthly
INSERT INTO magazines (name, magazine_type, country, readership, quality_level, min_fame_required, genres, description, publication_frequency, interview_slots_per_issue, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max, is_active)
VALUES
  ('MOJO', 'music', 'United Kingdom', 600000, 4, 200, ARRAY['Rock', 'Classic Rock', 'Folk', 'Blues'], 'The music magazine for grown-ups', 'monthly', 3, 35, 90, 200, 800, 2500, 7000, true),
  ('Q Magazine', 'music', 'United Kingdom', 450000, 4, 180, ARRAY['Rock', 'Pop', 'Indie', 'Electronic'], 'Britain''s biggest music magazine', 'monthly', 4, 30, 80, 180, 700, 2200, 6500, true),
  ('Uncut', 'music', 'United Kingdom', 350000, 3, 150, ARRAY['Rock', 'Folk', 'Country', 'Americana'], 'The ultimate music guide', 'monthly', 4, 25, 65, 150, 550, 1800, 5000, true),
  ('Vogue Music Issue', 'lifestyle', 'United States', 2000000, 5, 600, ARRAY['Pop', 'R&B', 'Hip Hop'], 'Fashion meets music in Vogue''s special music issue', 'monthly', 1, 80, 200, 600, 2500, 10000, 30000, true),
  ('GQ Style', 'lifestyle', 'United States', 1500000, 4, 400, ARRAY['Pop', 'Hip Hop', 'R&B', 'Rock'], 'Men''s style magazine featuring music icons', 'monthly', 2, 50, 130, 400, 1600, 6000, 18000, true),
  ('Classic Rock Magazine', 'music', 'United Kingdom', 280000, 3, 120, ARRAY['Rock', 'Classic Rock', 'Metal', 'Blues'], 'For those about to rock', 'monthly', 5, 20, 55, 120, 450, 1500, 4500, true),
  ('Metal Hammer', 'music', 'United Kingdom', 220000, 3, 100, ARRAY['Metal', 'Rock', 'Hardcore', 'Death Metal'], 'The world''s loudest magazine', 'monthly', 5, 18, 45, 100, 380, 1200, 3800, true),
  ('Alternative Press', 'music', 'United States', 300000, 3, 130, ARRAY['Alternative', 'Punk', 'Emo', 'Pop Punk'], 'The voice of alternative music', 'monthly', 4, 22, 58, 130, 500, 1600, 4800, true),
  ('The FADER', 'music', 'United States', 250000, 4, 160, ARRAY['Hip Hop', 'R&B', 'Electronic', 'Pop'], 'Style and sound since 1999', 'biweekly', 3, 28, 72, 160, 620, 2000, 6000, true),
  ('Dazed', 'lifestyle', 'United Kingdom', 400000, 4, 220, ARRAY['Electronic', 'Pop', 'Hip Hop', 'Experimental'], 'Fashion, film, art, and music', 'monthly', 3, 32, 85, 220, 850, 2600, 7500, true),
  ('Vice Music', 'lifestyle', 'United States', 500000, 3, 140, ARRAY['Electronic', 'Hip Hop', 'Indie', 'Experimental'], 'Music coverage from Vice', 'monthly', 4, 24, 62, 140, 540, 1700, 5200, true),
  ('Loud and Quiet', 'music', 'United Kingdom', 50000, 2, 30, ARRAY['Indie', 'Alternative', 'Folk', 'Post-Punk'], 'Free indie music magazine', 'monthly', 8, 6, 18, 30, 120, 300, 900, true),
  ('DIY Magazine', 'music', 'United Kingdom', 80000, 2, 40, ARRAY['Indie', 'Alternative', 'Rock', 'Pop'], 'New music and emerging artists', 'monthly', 7, 8, 22, 40, 160, 400, 1200, true),
  ('Mixmag', 'music', 'United Kingdom', 180000, 3, 90, ARRAY['Electronic', 'House', 'Techno', 'Dance'], 'The world''s biggest dance music magazine', 'monthly', 5, 16, 42, 90, 350, 1100, 3400, true),
  ('DJ Mag', 'music', 'United Kingdom', 200000, 3, 100, ARRAY['Electronic', 'House', 'Techno', 'Trance'], 'Dance music and DJ culture', 'weekly', 5, 18, 48, 100, 400, 1300, 4000, true);