-- Insert legendary venues
INSERT INTO venues (name, city_id, location, venue_type, capacity, prestige_level, base_payment, requirements, description, amenities, is_legendary)
SELECT 'United Center', c.id, 'West Madison Street, Chicago', 'arena', 23000, 10, 150000,
  '{"min_fame": 500000, "min_fans": 50000}'::jsonb,
  'The legendary home of the Bulls and Blackhawks.', '["VIP lounges", "Premium catering"]'::jsonb, true
FROM cities c WHERE c.name = 'Chicago' AND NOT EXISTS (SELECT 1 FROM venues WHERE name = 'United Center');

INSERT INTO venues (name, city_id, location, venue_type, capacity, prestige_level, base_payment, requirements, description, amenities, is_legendary)
SELECT 'Ryman Auditorium', c.id, '116 5th Avenue North, Nashville', 'theater', 2362, 10, 80000,
  '{"min_fame": 300000, "min_fans": 30000}'::jsonb,
  'The Mother Church of Country Music since 1892.', '["Historic dressing rooms", "Premium acoustics"]'::jsonb, true
FROM cities c WHERE c.name = 'Nashville' AND NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Ryman Auditorium');

INSERT INTO venues (name, city_id, location, venue_type, capacity, prestige_level, base_payment, requirements, description, amenities, is_legendary)
SELECT 'Austin City Limits Live', c.id, '310 Willie Nelson Boulevard', 'concert_hall', 2750, 10, 90000,
  '{"min_fame": 350000, "min_fans": 35000}'::jsonb,
  'Home of the legendary ACL TV show.', '["TV-quality lighting", "Recording facility"]'::jsonb, true
FROM cities c WHERE c.name = 'Austin' AND NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Austin City Limits Live');

INSERT INTO venues (name, city_id, location, venue_type, capacity, prestige_level, base_payment, requirements, description, amenities, is_legendary)
SELECT 'Caesars Superdome', c.id, '1500 Sugar Bowl Drive', 'stadium', 73000, 10, 500000,
  '{"min_fame": 1000000, "min_fans": 100000}'::jsonb,
  'The iconic Superdome - Super Bowls and mega concerts.', '["Massive stage", "VIP suites"]'::jsonb, true
FROM cities c WHERE c.name = 'New Orleans' AND NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Caesars Superdome');

INSERT INTO venues (name, city_id, location, venue_type, capacity, prestige_level, base_payment, requirements, description, amenities, is_legendary)
SELECT 'T-Mobile Arena', c.id, '3780 Las Vegas Boulevard South', 'arena', 20000, 10, 200000,
  '{"min_fame": 600000, "min_fans": 60000}'::jsonb,
  'Vegas premier Strip arena for residencies.', '["Celebrity VIP", "Casino integration"]'::jsonb, true
FROM cities c WHERE c.name = 'Las Vegas' AND NOT EXISTS (SELECT 1 FROM venues WHERE name = 'T-Mobile Arena');

INSERT INTO venues (name, city_id, location, venue_type, capacity, prestige_level, base_payment, requirements, description, amenities, is_legendary)
SELECT 'The Fillmore', c.id, '1805 Geary Boulevard', 'concert_hall', 1315, 10, 60000,
  '{"min_fame": 250000, "min_fans": 25000}'::jsonb,
  'Legendary psychedelic rock venue.', '["Historic chandeliers", "Concert posters"]'::jsonb, true
FROM cities c WHERE c.name = 'San Francisco' AND NOT EXISTS (SELECT 1 FROM venues WHERE name = 'The Fillmore');

INSERT INTO venues (name, city_id, location, venue_type, capacity, prestige_level, base_payment, requirements, description, amenities, is_legendary)
SELECT 'State Farm Arena', c.id, '1 State Farm Drive', 'arena', 21000, 10, 140000,
  '{"min_fame": 500000, "min_fans": 50000}'::jsonb,
  'Atlanta hub for hip-hop royalty.', '["Hip-hop heritage", "VIP experience"]'::jsonb, true
FROM cities c WHERE c.name = 'Atlanta' AND NOT EXISTS (SELECT 1 FROM venues WHERE name = 'State Farm Arena');

INSERT INTO venues (name, city_id, location, venue_type, capacity, prestige_level, base_payment, requirements, description, amenities, is_legendary)
SELECT 'Allianz Parque', c.id, 'Rua Palestra Italia', 'stadium', 55000, 10, 300000,
  '{"min_fame": 800000, "min_fans": 80000}'::jsonb,
  'South America modern stadium.', '["Retractable roof", "Premium suites"]'::jsonb, true
FROM cities c WHERE c.name = 'São Paulo' AND NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Allianz Parque');