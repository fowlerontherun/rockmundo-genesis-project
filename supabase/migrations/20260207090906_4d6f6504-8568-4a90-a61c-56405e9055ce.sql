
-- =============================================
-- v1.0.622 World Expansion: Cities, Districts, Transport Routes
-- =============================================

-- 2. INSERT NEW CITIES

-- UK cities (8 new)
INSERT INTO cities (name, country, region, latitude, longitude, population, music_scene, cost_of_living, dominant_genre, venues, is_coastal, has_train_network, timezone)
VALUES
('Leeds', 'United Kingdom', 'Europe', 53.8008, -1.5491, 793000, 72, 42, 'Indie', 45, false, true, 'Europe/London'),
('Cardiff', 'United Kingdom', 'Europe', 51.4816, -3.1791, 362000, 65, 38, 'Alternative', 30, true, true, 'Europe/London'),
('Brighton', 'United Kingdom', 'Europe', 50.8225, -0.1372, 290000, 78, 55, 'Electronic', 50, true, true, 'Europe/London'),
('Nottingham', 'United Kingdom', 'Europe', 52.9548, -1.1581, 332000, 68, 36, 'Rock', 35, false, true, 'Europe/London'),
('Newcastle', 'United Kingdom', 'Europe', 54.9783, -1.6178, 302000, 66, 35, 'Indie', 32, true, true, 'Europe/London'),
('Belfast', 'United Kingdom', 'Europe', 54.5973, -5.9301, 343000, 64, 34, 'Folk Rock', 28, true, true, 'Europe/London'),
('Portsmouth', 'United Kingdom', 'Europe', 50.8198, -1.0880, 238000, 55, 40, 'Punk', 22, true, true, 'Europe/London'),
('Sheffield', 'United Kingdom', 'Europe', 53.3811, -1.4701, 585000, 74, 35, 'Electronic', 40, false, true, 'Europe/London');

-- USA cities (10 new)
INSERT INTO cities (name, country, region, latitude, longitude, population, music_scene, cost_of_living, dominant_genre, venues, is_coastal, has_train_network, timezone)
VALUES
('Boston', 'USA', 'North America', 42.3601, -71.0589, 693000, 72, 65, 'Rock', 55, true, true, 'America/New_York'),
('Philadelphia', 'USA', 'North America', 39.9526, -75.1652, 1580000, 70, 50, 'Hip Hop', 60, false, true, 'America/New_York'),
('Denver', 'USA', 'North America', 39.7392, -104.9903, 715000, 68, 52, 'Folk Rock', 45, false, false, 'America/Denver'),
('Minneapolis', 'USA', 'North America', 44.9778, -93.2650, 430000, 74, 45, 'Pop', 42, false, false, 'America/Chicago'),
('Dallas', 'USA', 'North America', 32.7767, -96.7970, 1340000, 62, 42, 'Country', 50, false, false, 'America/Chicago'),
('Houston', 'USA', 'North America', 29.7604, -95.3698, 2300000, 66, 40, 'Hip Hop', 55, true, false, 'America/Chicago'),
('San Diego', 'USA', 'North America', 32.7157, -117.1611, 1420000, 65, 60, 'Indie', 40, true, false, 'America/Los_Angeles'),
('Phoenix', 'USA', 'North America', 33.4484, -112.0740, 1680000, 55, 42, 'Rock', 35, false, false, 'America/Phoenix'),
('Washington DC', 'USA', 'North America', 38.9072, -77.0369, 690000, 68, 62, 'Go-Go', 48, false, true, 'America/New_York'),
('Honolulu', 'USA', 'North America', 21.3069, -157.8583, 350000, 50, 70, 'Reggae', 20, true, false, 'Pacific/Honolulu');

-- Europe cities (20 new)
INSERT INTO cities (name, country, region, latitude, longitude, population, music_scene, cost_of_living, dominant_genre, venues, is_coastal, has_train_network, timezone)
VALUES
('Gothenburg', 'Sweden', 'Europe', 57.7089, 11.9746, 580000, 72, 55, 'Metal', 38, true, true, 'Europe/Stockholm'),
('Antwerp', 'Belgium', 'Europe', 51.2194, 4.4025, 530000, 68, 48, 'Electronic', 35, true, true, 'Europe/Brussels'),
('Seville', 'Spain', 'Europe', 37.3891, -5.9845, 690000, 70, 35, 'Flamenco', 32, false, true, 'Europe/Madrid'),
('Porto', 'Portugal', 'Europe', 41.1579, -8.6291, 250000, 65, 32, 'Fado', 28, true, true, 'Europe/Lisbon'),
('Naples', 'Italy', 'Europe', 40.8518, 14.2681, 960000, 66, 33, 'Folk', 30, true, true, 'Europe/Rome'),
('Florence', 'Italy', 'Europe', 43.7696, 11.2558, 380000, 60, 48, 'Classical', 25, false, true, 'Europe/Rome'),
('Gdansk', 'Poland', 'Europe', 54.3520, 18.6466, 470000, 62, 28, 'Electronic', 25, true, true, 'Europe/Warsaw'),
('Tallinn', 'Estonia', 'Europe', 59.4370, 24.7536, 450000, 60, 30, 'Electronic', 22, true, true, 'Europe/Tallinn'),
('Riga', 'Latvia', 'Europe', 56.9496, 24.1052, 630000, 58, 28, 'Classical', 20, true, true, 'Europe/Riga'),
('Vilnius', 'Lithuania', 'Europe', 54.6872, 25.2797, 590000, 56, 26, 'Alternative', 18, false, true, 'Europe/Vilnius'),
('Bucharest', 'Romania', 'Europe', 44.4268, 26.1025, 1800000, 64, 25, 'Electronic', 30, false, true, 'Europe/Bucharest'),
('Sofia', 'Bulgaria', 'Europe', 42.6977, 23.3219, 1240000, 58, 22, 'Folk Rock', 22, false, true, 'Europe/Sofia'),
('Belgrade', 'Serbia', 'Europe', 44.7866, 20.4489, 1400000, 68, 24, 'Turbo-folk', 28, false, true, 'Europe/Belgrade'),
('Zagreb', 'Croatia', 'Europe', 45.8150, 15.9819, 810000, 60, 30, 'Rock', 24, false, true, 'Europe/Zagreb'),
('Ljubljana', 'Slovenia', 'Europe', 46.0569, 14.5058, 290000, 55, 35, 'Alternative', 18, false, true, 'Europe/Ljubljana'),
('Bratislava', 'Slovakia', 'Europe', 48.1486, 17.1077, 475000, 54, 30, 'Electronic', 20, false, true, 'Europe/Bratislava'),
('Nice', 'France', 'Europe', 43.7102, 7.2620, 340000, 58, 55, 'Jazz', 22, true, true, 'Europe/Paris'),
('Bordeaux', 'France', 'Europe', 44.8378, -0.5792, 260000, 60, 45, 'Indie', 24, true, true, 'Europe/Paris'),
('Toulouse', 'France', 'Europe', 43.6047, 1.4442, 490000, 62, 40, 'Electronic', 28, false, true, 'Europe/Paris'),
('Paris', 'France', 'Europe', 48.8566, 2.3522, 2160000, 85, 72, 'Electronic', 120, false, true, 'Europe/Paris');

-- Rest of World (10 new)
INSERT INTO cities (name, country, region, latitude, longitude, population, music_scene, cost_of_living, dominant_genre, venues, is_coastal, has_train_network, timezone)
VALUES
('Kuala Lumpur', 'Malaysia', 'Asia', 3.1390, 101.6869, 1800000, 60, 30, 'Pop', 30, false, true, 'Asia/Kuala_Lumpur'),
('Ho Chi Minh City', 'Vietnam', 'Asia', 10.8231, 106.6297, 9000000, 55, 20, 'Pop', 25, true, false, 'Asia/Ho_Chi_Minh'),
('Accra', 'Ghana', 'Africa', 5.6037, -0.1870, 2270000, 62, 22, 'Afrobeats', 20, true, false, 'Africa/Accra'),
('Marrakech', 'Morocco', 'Africa', 31.6295, -7.9811, 930000, 55, 20, 'Gnawa', 15, false, false, 'Africa/Casablanca'),
('Casablanca', 'Morocco', 'Africa', 33.5731, -7.5898, 3360000, 58, 24, 'Raï', 22, true, false, 'Africa/Casablanca'),
('Addis Ababa', 'Ethiopia', 'Africa', 9.0250, 38.7469, 3400000, 60, 18, 'Ethio-jazz', 18, false, false, 'Africa/Addis_Ababa'),
('Medellín', 'Colombia', 'South America', 6.2476, -75.5658, 2500000, 68, 22, 'Reggaeton', 30, false, false, 'America/Bogota'),
('Montevideo', 'Uruguay', 'South America', -34.9011, -56.1645, 1380000, 60, 30, 'Candombe', 22, true, false, 'America/Montevideo'),
('Perth', 'Australia', 'Oceania', -31.9505, 115.8605, 2100000, 62, 52, 'Indie', 30, true, false, 'Australia/Perth'),
('Brisbane', 'Australia', 'Oceania', -27.4698, 153.0251, 2500000, 64, 48, 'Rock', 35, true, false, 'Australia/Brisbane');

-- Ensure key cities exist (New York, Los Angeles, Berlin, Tokyo may already exist)
INSERT INTO cities (name, country, region, latitude, longitude, population, music_scene, cost_of_living, dominant_genre, venues, is_coastal, has_train_network, timezone)
SELECT 'New York', 'USA', 'North America', 40.7128, -74.0060, 8340000, 92, 80, 'Hip Hop', 200, true, true, 'America/New_York'
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'New York');

INSERT INTO cities (name, country, region, latitude, longitude, population, music_scene, cost_of_living, dominant_genre, venues, is_coastal, has_train_network, timezone)
SELECT 'Los Angeles', 'USA', 'North America', 34.0522, -118.2437, 3980000, 88, 70, 'Pop', 180, true, false, 'America/Los_Angeles'
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Los Angeles');

INSERT INTO cities (name, country, region, latitude, longitude, population, music_scene, cost_of_living, dominant_genre, venues, is_coastal, has_train_network, timezone)
SELECT 'Berlin', 'Germany', 'Europe', 52.5200, 13.4050, 3670000, 90, 45, 'Techno', 150, false, true, 'Europe/Berlin'
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Berlin');

INSERT INTO cities (name, country, region, latitude, longitude, population, music_scene, cost_of_living, dominant_genre, venues, is_coastal, has_train_network, timezone)
SELECT 'Tokyo', 'Japan', 'Asia', 35.6762, 139.6503, 13960000, 88, 65, 'J-Pop', 160, true, true, 'Asia/Tokyo'
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name = 'Tokyo');

-- 3. UPDATE coastal/train flags for existing cities
UPDATE cities SET is_coastal = true WHERE name IN ('London', 'Liverpool', 'Bristol', 'Glasgow', 'Edinburgh', 'Sydney', 'Melbourne', 'Tokyo', 'Osaka', 'Miami', 'San Francisco', 'Seattle', 'Los Angeles', 'Vancouver', 'Toronto', 'Hong Kong', 'Singapore', 'Mumbai', 'Rio de Janeiro', 'Barcelona', 'Marseille', 'Lisbon', 'Athens', 'Istanbul', 'Dubai', 'Cape Town', 'Lagos', 'Copenhagen', 'Stockholm', 'Oslo', 'Helsinki', 'Amsterdam', 'Rotterdam', 'Hamburg', 'Shanghai', 'Seoul', 'Taipei', 'Bangkok', 'Jakarta', 'Manila', 'Auckland', 'Havana', 'Tel Aviv', 'Reykjavik');

UPDATE cities SET has_train_network = true WHERE name IN ('London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow', 'Liverpool', 'Bristol', 'Paris', 'Berlin', 'Munich', 'Hamburg', 'Cologne', 'Amsterdam', 'Rotterdam', 'Brussels', 'Vienna', 'Zurich', 'Prague', 'Warsaw', 'Krakow', 'Copenhagen', 'Stockholm', 'Oslo', 'Helsinki', 'Madrid', 'Barcelona', 'Rome', 'Milan', 'Lisbon', 'Budapest', 'Athens', 'Moscow', 'Tokyo', 'Osaka', 'Seoul', 'Taipei', 'Shanghai', 'Beijing', 'Mumbai', 'Delhi', 'Toronto', 'Montreal', 'Chicago', 'New York', 'Boston', 'Washington DC', 'Philadelphia', 'Lyon', 'Marseille', 'Sydney', 'Melbourne');

-- 4. INSERT DISTRICTS FOR ALL NEW CITIES

-- Leeds
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Headingley', 'Student-heavy area with indie bars and grassroots venue crawls', 'Indie Student', 72, 78, 650),
  ('Call Lane Quarter', 'Nightlife strip with clubs, cocktail bars, and live music basements', 'Party District', 60, 85, 800),
  ('Chapel Allerton', 'Leafy suburb with jazz cafes and acoustic nights', 'Bohemian', 82, 65, 750),
  ('Meanwood', 'Creative community with DIY venues and record shops', 'DIY Creative', 75, 72, 600)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Leeds';

-- Cardiff
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Womanby Street', 'Legendary music street with iconic venues like Clwb Ifor Bach', 'Live Music Hub', 68, 90, 700),
  ('Canton', 'Diverse neighborhood with independent bars and community venues', 'Community', 74, 70, 600),
  ('Cathays', 'Student area near the uni with cheap gig nights', 'Student', 65, 72, 500),
  ('Cardiff Bay', 'Waterfront area with larger performance venues', 'Waterfront', 80, 60, 850)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Cardiff';

-- Brighton
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('North Laine', 'Quirky independent shops, buskers, and underground venues', 'Bohemian', 72, 88, 950),
  ('Kemptown', 'LGBTQ+ friendly area with cabaret bars and eclectic nightlife', 'Eclectic', 70, 80, 900),
  ('The Lanes', 'Historic quarter with intimate jazz clubs and acoustic bars', 'Historic', 78, 75, 1000),
  ('Hanover', 'Hill-top community with house parties and DIY shows', 'DIY Community', 74, 70, 750)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Brighton';

-- Nottingham
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Hockley', 'Creative quarter with craft beer bars and live music', 'Creative', 72, 82, 700),
  ('Sneinton', 'Up-and-coming area with market events and warehouse gigs', 'Emerging', 64, 75, 550),
  ('Lace Market', 'Historic area with upscale cocktail bars and jazz lounges', 'Upscale', 80, 68, 850),
  ('Arboretum', 'Diverse neighborhood with reggae sound systems and community events', 'Multicultural', 60, 72, 500)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Nottingham';

-- Newcastle
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Ouseburn Valley', 'Former industrial area turned creative hub with studios and venues', 'Creative Hub', 75, 85, 650),
  ('Bigg Market', 'Famous nightlife area with packed pubs and clubs', 'Nightlife', 55, 70, 600),
  ('Jesmond', 'Upmarket student area with acoustic cafes', 'Student Upmarket', 82, 60, 800),
  ('Quayside', 'Riverside development with bars and event spaces', 'Riverside', 78, 65, 750)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Newcastle';

-- Belfast
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Cathedral Quarter', 'Cultural heart with traditional pubs and live trad sessions', 'Traditional', 72, 82, 650),
  ('Botanic', 'University area with indie bars and open mic nights', 'Student Indie', 70, 75, 600),
  ('Titanic Quarter', 'Regenerated waterfront with large event spaces', 'Modern', 80, 55, 800),
  ('Lisburn Road', 'Trendy strip with gastropubs and acoustic evenings', 'Trendy', 78, 65, 700)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Belfast';

-- Portsmouth
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Southsea', 'Seaside suburb with punk venues and record stores', 'Punk Seaside', 68, 78, 700),
  ('Guildhall Area', 'City center with the main concert hall and clubs', 'City Center', 65, 72, 650),
  ('Old Portsmouth', 'Historic waterfront with cozy pubs and folk sessions', 'Historic', 80, 55, 800)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Portsmouth';

-- Sheffield
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Kelham Island', 'Industrial turned creative — birthplace of Arctic Monkeys vibes', 'Industrial Creative', 72, 88, 700),
  ('Division Street', 'Bar and club strip with electronic music nights', 'Nightlife', 65, 82, 750),
  ('Sharrow', 'Multicultural area with DIY music spaces and community events', 'Multicultural DIY', 62, 75, 500),
  ('Ecclesall Road', 'Student corridor with open mics and acoustic sessions', 'Student', 75, 68, 650)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Sheffield';

-- Boston
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Allston', 'Legendary DIY rock scene with house shows and dive bars', 'DIY Rock', 60, 88, 1200),
  ('Cambridge/Harvard Sq', 'Folk and acoustic heritage with Club Passim tradition', 'Folk Academic', 82, 80, 1500),
  ('Fenway/Kenmore', 'Arena rock zone near the stadiums and House of Blues', 'Arena Rock', 72, 75, 1400),
  ('Somerville', 'Hipster haven with indie venues and art spaces', 'Indie Hipster', 75, 82, 1300)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Boston';

-- Philadelphia
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Fishtown', 'Gentrified area with indie venues and craft breweries', 'Indie Gentrified', 65, 85, 1100),
  ('South Philly', 'Italian-American neighborhood with punk and hip hop roots', 'Gritty Authentic', 58, 80, 850),
  ('Old City', 'Historic district with jazz clubs and upscale lounges', 'Jazz Historic', 75, 70, 1300),
  ('West Philly', 'University area with hip hop, jazz, and DIY culture', 'Academic Hip Hop', 60, 82, 900)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Philadelphia';

-- Denver
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('RiNo', 'River North Art District with warehouses turned music venues', 'Art District', 68, 85, 1300),
  ('Capitol Hill', 'Dive bars, queer nightlife, and underground shows', 'Underground', 62, 82, 1100),
  ('LoDo', 'Downtown entertainment with larger venues and brewpubs', 'Downtown', 72, 70, 1400),
  ('Baker', 'Historic neighborhood with folk and Americana roots', 'Americana', 74, 72, 1050)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Denver';

-- Minneapolis
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('First Avenue Area', 'Home of Prince''s iconic venue, the heart of the Minneapolis sound', 'Legendary', 65, 92, 1000),
  ('Uptown', 'Trendy area with indie record shops and live music bars', 'Trendy Indie', 68, 78, 1100),
  ('Northeast', 'Arts district with DIY spaces and punk shows', 'DIY Arts', 64, 82, 900),
  ('Dinkytown', 'Student district near UMN with cheap gig nights', 'Student', 70, 68, 750)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Minneapolis';

-- Dallas
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Deep Ellum', 'Historic music district with blues, jazz, and punk roots', 'Historic Music', 58, 88, 1000),
  ('Uptown', 'Nightlife and entertainment district with clubs', 'Nightlife', 70, 65, 1300),
  ('Bishop Arts', 'Artsy neighborhood with acoustic cafes and galleries', 'Artsy', 72, 68, 1100),
  ('Denton', 'College town satellite with thriving indie scene', 'College Indie', 75, 78, 700)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Dallas';

-- Houston
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Montrose', 'Eclectic neighborhood — Houston''s counter-culture heart', 'Counter-culture', 65, 82, 1100),
  ('Third Ward', 'Historically Black neighborhood, birthplace of Houston rap', 'Hip Hop Heritage', 55, 85, 700),
  ('Heights', 'Trendy area with live music bars and honky-tonks', 'Trendy Country', 75, 72, 1200),
  ('EaDo', 'East Downtown with warehouses and electronic music events', 'Electronic', 60, 75, 950)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Houston';

-- San Diego
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('North Park', 'Hipster haven with craft beer and indie rock venues', 'Hipster', 72, 82, 1400),
  ('Gaslamp Quarter', 'Downtown entertainment with clubs and live music bars', 'Downtown', 70, 72, 1500),
  ('Ocean Beach', 'Laid-back beach community with reggae and surf rock', 'Beach Chill', 68, 68, 1300),
  ('Barrio Logan', 'Chicano arts district with lowrider culture and Latin music', 'Latin Arts', 60, 75, 900)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'San Diego';

-- Phoenix
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Roosevelt Row', 'Arts district with galleries, murals, and DIY venues', 'Arts District', 65, 78, 1000),
  ('Tempe/Mill Ave', 'College town vibe with cheap shows near ASU', 'College', 70, 72, 900),
  ('Downtown Phoenix', 'Revitalized downtown with concert halls and bars', 'Urban Revival', 68, 68, 1100)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Phoenix';

-- Washington DC
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('U Street Corridor', 'Historic Black Broadway — jazz, go-go, and punk heritage', 'Historic Music', 62, 90, 1400),
  ('Adams Morgan', 'Eclectic nightlife with world music and dive bars', 'Eclectic', 65, 78, 1300),
  ('H Street NE', 'Revitalized corridor with rock venues and dance clubs', 'Revival', 60, 80, 1100),
  ('Georgetown', 'Upscale area with jazz clubs and acoustic lounges', 'Upscale Jazz', 82, 62, 1800)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Washington DC';

-- Honolulu
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Waikiki', 'Tourist beach area with resort entertainment and beach bars', 'Tourist Beach', 78, 55, 2000),
  ('Chinatown', 'Arts and nightlife district with underground venues', 'Underground', 55, 72, 1200),
  ('Kaimuki', 'Local neighborhood with intimate acoustic cafes', 'Local Acoustic', 75, 60, 1400)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Honolulu';

-- Gothenburg
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Haga', 'Historic cobblestone district with cozy cafes and acoustic nights', 'Cozy Historic', 82, 68, 800),
  ('Linnéstaden', 'Trendy area with bars, clubs, and music festivals', 'Trendy', 78, 80, 900),
  ('Majorna', 'Working class turned hipster with DIY punk spaces', 'DIY Punk', 70, 78, 700),
  ('Järntorget', 'Central square area with metal bars and rock clubs', 'Metal Hub', 65, 85, 750)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Gothenburg';

-- Antwerp
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Het Zuid', 'Museum district with cocktail bars and electronic DJ sets', 'Sophisticated', 78, 75, 900),
  ('Het Eilandje', 'Port area with warehouse parties and techno events', 'Warehouse', 65, 82, 800),
  ('Borgerhout', 'Multicultural neighborhood with world music and hip hop', 'Multicultural', 58, 72, 600)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Antwerp';

-- Seville
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Triana', 'Birthplace of flamenco with authentic tablaos and peñas', 'Flamenco Heart', 72, 90, 650),
  ('Alameda', 'Bohemian plaza with alternative bars and live music', 'Bohemian', 65, 80, 600),
  ('Santa Cruz', 'Tourist quarter with street performers and traditional music', 'Tourist Traditional', 80, 65, 800)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Seville';

-- Porto
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Ribeira', 'UNESCO riverside with fado houses and wine bars', 'Fado Heritage', 72, 78, 700),
  ('Cedofeita', 'Creative quarter with galleries, vinyl shops, and indie bars', 'Creative Indie', 75, 80, 650),
  ('Bonfim', 'Student area with cheap concerts and cultural events', 'Student Cultural', 68, 72, 500)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Porto';

-- Naples
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Spaccanapoli', 'Historic heart with street musicians and traditional Neapolitan songs', 'Traditional', 55, 78, 550),
  ('Vomero', 'Upscale hilltop area with jazz clubs', 'Upscale Jazz', 78, 62, 750),
  ('Centro Storico', 'Ancient center with underground music venues', 'Underground', 50, 80, 500)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Naples';

-- Florence
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Santo Spirito', 'Artisan quarter with live music piazzas and bohemian bars', 'Bohemian', 70, 75, 800),
  ('San Lorenzo', 'Market district with student nightlife', 'Student Market', 62, 68, 700),
  ('Santa Croce', 'Historic area with jazz clubs and cultural venues', 'Cultural', 78, 65, 900)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Florence';

-- Gdansk
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Wrzeszcz', 'Trendy district with clubs and electronic music events', 'Electronic', 72, 78, 450),
  ('Old Town', 'Rebuilt historic center with jazz clubs and street performers', 'Historic', 80, 65, 600),
  ('Oliwa', 'Leafy suburb with cathedral organ concerts', 'Classical', 85, 50, 500)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Gdansk';

-- Tallinn
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Telliskivi', 'Creative city within a city — startups, street art, and electronic music', 'Creative Tech', 78, 82, 550),
  ('Old Town', 'Medieval walled city with intimate jazz and folk venues', 'Medieval', 80, 65, 650),
  ('Kalamaja', 'Hipster waterfront with converted warehouses and DJ events', 'Hipster Waterfront', 75, 78, 500)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Tallinn';

-- Riga
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Old Riga', 'Medieval center with opera and classical concert halls', 'Classical Heritage', 72, 68, 550),
  ('Miera iela', 'Emerging creative street with cafes and small venues', 'Emerging Creative', 68, 72, 400),
  ('Āgenskalns', 'Residential area with community music events', 'Community', 78, 55, 350)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Riga';

-- Vilnius
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Užupis', 'Self-declared republic of artists with galleries and music events', 'Artist Republic', 72, 75, 450),
  ('Old Town', 'Baroque old town with classical concerts and jazz clubs', 'Classical Baroque', 78, 68, 500),
  ('Šnipiškės', 'Modern district with electronic music clubs', 'Modern Electronic', 70, 70, 400)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Vilnius';

-- Bucharest
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Old Town', 'Ruin bar district with wall-to-wall clubs and DJ sets', 'Party District', 55, 85, 450),
  ('Floreasca', 'Upscale area with cocktail bars and live music lounges', 'Upscale', 78, 65, 600),
  ('Obor', 'Market district with underground electronic events', 'Underground', 58, 78, 350)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Bucharest';

-- Sofia
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Studentski Grad', 'University district with the cheapest nightlife in Europe', 'Student Party', 55, 75, 250),
  ('Center', 'Downtown with concert halls and jazz clubs', 'Cultural Center', 72, 70, 400),
  ('Lozenets', 'Upscale residential with wine bars and acoustic nights', 'Upscale', 80, 55, 500)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Sofia';

-- Belgrade
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Savamala', 'Riverside creative quarter with clubs on barges (splavovi)', 'River Clubs', 58, 90, 400),
  ('Stari Grad', 'Old town with kafanas and live brass bands', 'Traditional', 68, 80, 450),
  ('Dorćol', 'Hipster neighborhood with craft bars and DJ sets', 'Hipster', 72, 78, 400)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Belgrade';

-- Zagreb
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Tkalčićeva', 'Bar street with live music every night', 'Bar Street', 72, 78, 500),
  ('Medika', 'Autonomous cultural center with underground shows', 'Underground', 55, 85, 350),
  ('Jarun', 'Lake area with outdoor festival grounds and clubs', 'Outdoor Festival', 75, 72, 450)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Zagreb';

-- Ljubljana
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Metelkova', 'Autonomous zone in former barracks — punk, electronic, experimental', 'Autonomous Punk', 55, 88, 400),
  ('Center', 'Pedestrian old town with bars and live music along the river', 'Riverside', 80, 68, 550),
  ('Šiška', 'Residential with emerging alternative music scene', 'Alternative', 78, 62, 400)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Ljubljana';

-- Bratislava
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Old Town', 'Compact center with bars and live music cellars', 'Historic Cellars', 75, 70, 500),
  ('Ružinov', 'Residential area with community music events', 'Community', 80, 55, 400),
  ('Petržalka', 'Communist-era housing with underground electronic scene', 'Underground Electronic', 60, 72, 300)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Bratislava';

-- Nice
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Vieux Nice', 'Old town with jazz clubs and buskers in narrow streets', 'Jazz Old Town', 72, 72, 900),
  ('Port Area', 'Harbor district with bars and live music terraces', 'Harbor', 70, 65, 800),
  ('Libération', 'Local market area with affordable bars', 'Local', 68, 58, 700)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Nice';

-- Bordeaux
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Saint-Michel', 'Multicultural market quarter with world music and indie bars', 'World Music', 62, 78, 650),
  ('Chartrons', 'Antique dealers and wine bars with jazz nights', 'Wine Jazz', 78, 68, 800),
  ('Victoire', 'Student nightlife hub near the university', 'Student', 60, 72, 550)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Bordeaux';

-- Toulouse
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Saint-Cyprien', 'Left bank with alternative bars and live music', 'Alternative', 68, 78, 550),
  ('Capitole', 'Central square with street performers and concert halls', 'Central', 75, 68, 700),
  ('Les Carmes', 'Nightlife district with electronic music clubs', 'Electronic Nightlife', 62, 75, 600)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Toulouse';

-- Paris
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Pigalle', 'Historic red-light district turned music hub with rock clubs', 'Rock Heritage', 55, 90, 1200),
  ('Le Marais', 'Trendy district with jazz clubs, galleries, and underground bars', 'Trendy Jazz', 72, 80, 1500),
  ('Belleville', 'Multicultural hillside with world music and electronic events', 'Multicultural', 58, 82, 900),
  ('Oberkampf', 'Nightlife strip with dive bars and indie concerts', 'Indie Nightlife', 60, 85, 1000),
  ('Saint-Germain', 'Left Bank intellectual cafe culture with jazz heritage', 'Intellectual Jazz', 82, 75, 1800)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Paris';

-- Kuala Lumpur
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Bukit Bintang', 'Entertainment district with clubs and live music venues', 'Entertainment', 68, 75, 600),
  ('Bangsar', 'Expat hangout with jazz bars and acoustic nights', 'Expat Jazz', 78, 70, 700),
  ('Petaling Street', 'Chinatown with street buskers and traditional performances', 'Traditional', 60, 60, 400)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Kuala Lumpur';

-- Ho Chi Minh City
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('District 1', 'Downtown with rooftop bars and live music venues', 'Downtown', 65, 72, 500),
  ('District 2/Thao Dien', 'Expat area with jazz bars and acoustic cafes', 'Expat', 78, 68, 600),
  ('District 3', 'Local hipster area with underground music events', 'Hipster Local', 68, 75, 350)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Ho Chi Minh City';

-- Accra
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Osu', 'Oxford Street nightlife with Afrobeats clubs and live music', 'Afrobeats Hub', 60, 82, 400),
  ('Jamestown', 'Historic fishing community with highlife music heritage', 'Heritage', 50, 78, 250),
  ('East Legon', 'Upscale area with modern music studios and lounges', 'Upscale Modern', 78, 65, 600)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Accra';

-- Marrakech
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Medina', 'Ancient walled city with Gnawa musicians in Jemaa el-Fnaa', 'Traditional Gnawa', 55, 80, 300),
  ('Guéliz', 'Modern district with bars and contemporary music venues', 'Modern', 72, 62, 450),
  ('Hivernage', 'Upscale area with nightclubs and lounges', 'Upscale Nightlife', 78, 58, 550)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Marrakech';

-- Casablanca
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Corniche', 'Beachfront with nightclubs and concert venues', 'Beachfront Nightlife', 68, 72, 500),
  ('Old Medina', 'Traditional music and street performers', 'Traditional', 55, 65, 300),
  ('Maârif', 'Modern commercial district with bars and music cafes', 'Modern Commercial', 72, 60, 450)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Casablanca';

-- Addis Ababa
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Piazza', 'Historic center with legendary jazz clubs and Ethio-jazz venues', 'Ethio-jazz Heritage', 58, 82, 250),
  ('Bole', 'Modern district with clubs and contemporary music', 'Modern', 72, 70, 400),
  ('Kazanchis', 'Business district with lounges and live performances', 'Business Lounge', 68, 60, 350)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Addis Ababa';

-- Medellín
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('El Poblado', 'Upscale nightlife with reggaeton clubs and rooftop bars', 'Party Upscale', 65, 78, 500),
  ('Laureles', 'Local neighborhood with salsa bars and live music', 'Salsa Local', 72, 75, 400),
  ('Centro', 'Downtown with tango bars and street performers', 'Downtown', 50, 70, 250),
  ('Envigado', 'Suburban town with cozy bars and acoustic music', 'Suburban Cozy', 75, 62, 350)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Medellín';

-- Montevideo
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Ciudad Vieja', 'Old town with candombe drum circles and tango bars', 'Candombe Heritage', 58, 78, 400),
  ('Pocitos', 'Beach neighborhood with bars and live music', 'Beach', 78, 65, 550),
  ('Cordón', 'University area with indie venues and cultural centers', 'Student Cultural', 65, 72, 350)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Montevideo';

-- Perth
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Northbridge', 'Entertainment district with live music venues and bars', 'Entertainment', 62, 80, 800),
  ('Fremantle', 'Port city suburb with buskers, pubs, and indie rock', 'Indie Port', 72, 78, 750),
  ('Leederville', 'Trendy strip with cafes and acoustic nights', 'Trendy', 78, 65, 850)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Perth';

-- Brisbane
INSERT INTO city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
SELECT c.id, d.name, d.description, d.vibe, d.safety_rating, d.music_scene_rating, d.rent_cost
FROM cities c CROSS JOIN (VALUES
  ('Fortitude Valley', 'Premier nightlife and live music district', 'Live Music Hub', 58, 88, 850),
  ('West End', 'Bohemian neighborhood with acoustic cafes and markets', 'Bohemian', 72, 75, 800),
  ('South Bank', 'Cultural precinct with performing arts venues', 'Cultural', 82, 65, 900),
  ('Woolloongabba', 'Emerging area with DIY music spaces', 'Emerging DIY', 68, 70, 700)
) AS d(name, description, vibe, safety_rating, music_scene_rating, rent_cost)
WHERE c.name = 'Brisbane';

-- 5. INSERT TRANSPORT ROUTES

-- UK: London <-> Manchester
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 2, 80, 75, 'hourly'), ('bus', 5, 20, 30, 'every 2 hours'), ('plane', 2, 120, 55, 'daily')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'London' AND t.name = 'Manchester';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 2, 80, 75, 'hourly'), ('bus', 5, 20, 30, 'every 2 hours'), ('plane', 2, 120, 55, 'daily')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Manchester' AND t.name = 'London';

-- UK: London <-> Birmingham
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 2, 75, 75, 'every 30 min'), ('bus', 3, 15, 30, 'hourly')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'London' AND t.name = 'Birmingham';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 2, 75, 75, 'every 30 min'), ('bus', 3, 15, 30, 'hourly')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Birmingham' AND t.name = 'London';

-- UK: London <-> Edinburgh
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 5, 120, 75, 'hourly'), ('plane', 2, 100, 55, '6x daily')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'London' AND t.name = 'Edinburgh';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 5, 120, 75, 'hourly'), ('plane', 2, 100, 55, '6x daily')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Edinburgh' AND t.name = 'London';

-- UK: London <-> Brighton
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 1, 25, 75, 'every 15 min'), ('bus', 2, 10, 30, 'every 30 min')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'London' AND t.name = 'Brighton';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 1, 25, 75, 'every 15 min'), ('bus', 2, 10, 30, 'every 30 min')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Brighton' AND t.name = 'London';

-- UK: London <-> Leeds
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 2, 70, 75, 'hourly'), ('bus', 4, 18, 30, 'every 2 hours')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'London' AND t.name = 'Leeds';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 2, 70, 75, 'hourly'), ('bus', 4, 18, 30, 'every 2 hours')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Leeds' AND t.name = 'London';

-- UK: London <-> Cardiff
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 2, 60, 75, 'every 2 hours'), ('bus', 4, 15, 30, 'every 3 hours')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'London' AND t.name = 'Cardiff';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 2, 60, 75, 'every 2 hours'), ('bus', 4, 15, 30, 'every 3 hours')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Cardiff' AND t.name = 'London';

-- UK: London <-> Newcastle
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 3, 90, 75, 'hourly'), ('plane', 2, 110, 55, '4x daily')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'London' AND t.name = 'Newcastle';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 3, 90, 75, 'hourly'), ('plane', 2, 110, 55, '4x daily')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Newcastle' AND t.name = 'London';

-- US: NYC <-> Boston
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 4, 90, 75, 'hourly'), ('bus', 5, 25, 30, 'every 30 min'), ('plane', 2, 150, 55, '10x daily')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'New York' AND t.name = 'Boston';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 4, 90, 75, 'hourly'), ('bus', 5, 25, 30, 'every 30 min'), ('plane', 2, 150, 55, '10x daily')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Boston' AND t.name = 'New York';

-- US: NYC <-> Philadelphia
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 2, 50, 75, 'hourly'), ('bus', 2, 15, 30, 'every 30 min')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'New York' AND t.name = 'Philadelphia';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 2, 50, 75, 'hourly'), ('bus', 2, 15, 30, 'every 30 min')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Philadelphia' AND t.name = 'New York';

-- US: NYC <-> Washington DC
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 3, 70, 75, 'hourly'), ('bus', 5, 30, 30, 'every hour'), ('plane', 2, 160, 55, '12x daily')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'New York' AND t.name = 'Washington DC';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 3, 70, 75, 'hourly'), ('bus', 5, 30, 30, 'every hour'), ('plane', 2, 160, 55, '12x daily')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Washington DC' AND t.name = 'New York';

-- Europe: London <-> Paris (Eurostar)
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 3, 150, 85, '18x daily'), ('plane', 2, 120, 55, '10x daily')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'London' AND t.name = 'Paris';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, d.transport_type, d.duration_hours, d.base_cost, d.comfort_rating, d.frequency
FROM cities f, cities t, (VALUES ('train', 3, 150, 85, '18x daily'), ('plane', 2, 120, 55, '10x daily')) AS d(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Paris' AND t.name = 'London';

-- Europe: Paris <-> Brussels
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, v.transport_type, v.duration_hours, v.base_cost, v.comfort_rating, v.frequency
FROM cities f, cities t, (VALUES ('train', 2, 80, 85, '12x daily')) AS v(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Paris' AND t.name = 'Brussels';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, v.transport_type, v.duration_hours, v.base_cost, v.comfort_rating, v.frequency
FROM cities f, cities t, (VALUES ('train', 2, 80, 85, '12x daily')) AS v(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Brussels' AND t.name = 'Paris';

-- Europe: Paris <-> Amsterdam
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, v.transport_type, v.duration_hours, v.base_cost, v.comfort_rating, v.frequency
FROM cities f, cities t, (VALUES ('train', 3, 100, 85, '8x daily')) AS v(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Paris' AND t.name = 'Amsterdam';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, v.transport_type, v.duration_hours, v.base_cost, v.comfort_rating, v.frequency
FROM cities f, cities t, (VALUES ('train', 3, 100, 85, '8x daily')) AS v(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Amsterdam' AND t.name = 'Paris';

-- Europe: Berlin <-> Prague
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, v.transport_type, v.duration_hours, v.base_cost, v.comfort_rating, v.frequency
FROM cities f, cities t, (VALUES ('train', 5, 60, 75, '6x daily')) AS v(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Berlin' AND t.name = 'Prague';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, v.transport_type, v.duration_hours, v.base_cost, v.comfort_rating, v.frequency
FROM cities f, cities t, (VALUES ('train', 5, 60, 75, '6x daily')) AS v(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Prague' AND t.name = 'Berlin';

-- Europe: Madrid <-> Barcelona
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, v.transport_type, v.duration_hours, v.base_cost, v.comfort_rating, v.frequency
FROM cities f, cities t, (VALUES ('train', 3, 70, 85, '20x daily')) AS v(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Madrid' AND t.name = 'Barcelona';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, v.transport_type, v.duration_hours, v.base_cost, v.comfort_rating, v.frequency
FROM cities f, cities t, (VALUES ('train', 3, 70, 85, '20x daily')) AS v(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Barcelona' AND t.name = 'Madrid';

-- Europe: Rome <-> Milan
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, v.transport_type, v.duration_hours, v.base_cost, v.comfort_rating, v.frequency
FROM cities f, cities t, (VALUES ('train', 3, 55, 85, '30x daily')) AS v(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Rome' AND t.name = 'Milan';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, v.transport_type, v.duration_hours, v.base_cost, v.comfort_rating, v.frequency
FROM cities f, cities t, (VALUES ('train', 3, 55, 85, '30x daily')) AS v(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Milan' AND t.name = 'Rome';

-- Other: Sydney <-> Melbourne
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, v.transport_type, v.duration_hours, v.base_cost, v.comfort_rating, v.frequency
FROM cities f, cities t, (VALUES ('plane', 2, 100, 55, '20x daily')) AS v(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Sydney' AND t.name = 'Melbourne';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, v.transport_type, v.duration_hours, v.base_cost, v.comfort_rating, v.frequency
FROM cities f, cities t, (VALUES ('plane', 2, 100, 55, '20x daily')) AS v(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Melbourne' AND t.name = 'Sydney';

-- Other: Tokyo <-> Osaka (Shinkansen)
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, v.transport_type, v.duration_hours, v.base_cost, v.comfort_rating, v.frequency
FROM cities f, cities t, (VALUES ('train', 3, 120, 90, '16x daily')) AS v(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Tokyo' AND t.name = 'Osaka';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, v.transport_type, v.duration_hours, v.base_cost, v.comfort_rating, v.frequency
FROM cities f, cities t, (VALUES ('train', 3, 120, 90, '16x daily')) AS v(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Osaka' AND t.name = 'Tokyo';

-- Other: Toronto <-> Montreal
INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, v.transport_type, v.duration_hours, v.base_cost, v.comfort_rating, v.frequency
FROM cities f, cities t, (VALUES ('train', 5, 60, 75, '6x daily'), ('plane', 2, 120, 55, '8x daily')) AS v(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Toronto' AND t.name = 'Montreal';

INSERT INTO city_transport_routes (from_city_id, to_city_id, transport_type, duration_hours, base_cost, comfort_rating, frequency)
SELECT f.id, t.id, v.transport_type, v.duration_hours, v.base_cost, v.comfort_rating, v.frequency
FROM cities f, cities t, (VALUES ('train', 5, 60, 75, '6x daily'), ('plane', 2, 120, 55, '8x daily')) AS v(transport_type, duration_hours, base_cost, comfort_rating, frequency)
WHERE f.name = 'Montreal' AND t.name = 'Toronto';
