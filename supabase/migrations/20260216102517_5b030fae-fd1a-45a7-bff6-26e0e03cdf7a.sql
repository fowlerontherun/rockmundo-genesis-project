
-- =============================================
-- v1.0.739: Global City Expansion & Small Venue Seeding
-- =============================================

-- PART 1: Insert ~80 new cities
INSERT INTO cities (name, country, latitude, longitude, population, region, timezone, music_scene, dominant_genre, cost_of_living, is_coastal, has_train_network)
VALUES
-- AFRICA
('Dakar', 'Senegal', 14.6928, -17.4467, 1200000, 'africa', 'Africa/Dakar', 45, 'Afrobeat', 55, true, false),
('Dar es Salaam', 'Tanzania', -6.7924, 39.2083, 5400000, 'africa', 'Africa/Dar_es_Salaam', 40, 'Bongo Flava', 45, true, false),
('Kinshasa', 'DR Congo', -4.4419, 15.2663, 14000000, 'africa', 'Africa/Kinshasa', 50, 'Rumba', 40, false, false),
('Luanda', 'Angola', -8.8390, 13.2894, 8000000, 'africa', 'Africa/Luanda', 35, 'Kizomba', 70, true, false),
('Maputo', 'Mozambique', -25.9692, 32.5732, 1100000, 'africa', 'Africa/Maputo', 35, 'Marrabenta', 45, true, false),
('Tunis', 'Tunisia', 36.8065, 10.1815, 2700000, 'africa', 'Africa/Tunis', 40, 'Folk', 50, true, true),
('Algiers', 'Algeria', 36.7538, 3.0588, 3900000, 'africa', 'Africa/Algiers', 40, 'Rai', 55, true, true),
('Kampala', 'Uganda', 0.3476, 32.5825, 1700000, 'africa', 'Africa/Kampala', 35, 'Afrobeat', 40, false, false),
-- ASIA & MIDDLE EAST
('Hanoi', 'Vietnam', 21.0278, 105.8342, 8000000, 'asia', 'Asia/Ho_Chi_Minh', 45, 'Pop', 40, false, true),
('Chiang Mai', 'Thailand', 18.7883, 98.9853, 1200000, 'asia', 'Asia/Bangkok', 50, 'Indie', 35, false, true),
('Osaka', 'Japan', 34.6937, 135.5023, 2700000, 'asia', 'Asia/Tokyo', 75, 'J-Pop', 90, true, true),
('Pune', 'India', 18.5204, 73.8567, 7400000, 'asia', 'Asia/Kolkata', 45, 'Bollywood', 40, false, true),
('Chennai', 'India', 13.0827, 80.2707, 10000000, 'asia', 'Asia/Kolkata', 50, 'Carnatic', 45, true, true),
('Karachi', 'Pakistan', 24.8607, 67.0011, 16000000, 'asia', 'Asia/Karachi', 40, 'Pop', 35, true, false),
('Lahore', 'Pakistan', 31.5204, 74.3587, 13000000, 'asia', 'Asia/Karachi', 45, 'Qawwali', 35, false, true),
('Dhaka', 'Bangladesh', 23.8103, 90.4125, 22000000, 'asia', 'Asia/Dhaka', 35, 'Folk', 30, false, false),
('Colombo', 'Sri Lanka', 6.9271, 79.8612, 750000, 'asia', 'Asia/Colombo', 40, 'Pop', 50, true, true),
('Beirut', 'Lebanon', 33.8938, 35.5018, 2400000, 'middle_east', 'Asia/Beirut', 55, 'Pop', 70, true, false),
('Amman', 'Jordan', 31.9454, 35.9284, 4000000, 'middle_east', 'Asia/Amman', 40, 'Pop', 55, false, false),
('Doha', 'Qatar', 25.2854, 51.5310, 2400000, 'middle_east', 'Asia/Qatar', 45, 'Pop', 95, true, false),
('Riyadh', 'Saudi Arabia', 24.7136, 46.6753, 7600000, 'middle_east', 'Asia/Riyadh', 40, 'Pop', 65, false, true),
('Almaty', 'Kazakhstan', 43.2380, 76.9458, 2000000, 'asia', 'Asia/Almaty', 40, 'Rock', 45, false, true),
-- SOUTH/CENTRAL AMERICA & CARIBBEAN
('Quito', 'Ecuador', -0.1807, -78.4678, 2800000, 'south_america', 'America/Guayaquil', 40, 'Latin', 45, false, false),
('La Paz', 'Bolivia', -16.4897, -68.1193, 900000, 'south_america', 'America/La_Paz', 35, 'Folk', 35, false, false),
('Asuncion', 'Paraguay', -25.2637, -57.5759, 550000, 'south_america', 'America/Asuncion', 35, 'Folk', 35, false, false),
('Caracas', 'Venezuela', 10.4806, -66.9036, 2900000, 'south_america', 'America/Caracas', 40, 'Salsa', 40, true, true),
('Panama City', 'Panama', 8.9824, -79.5199, 1800000, 'central_america', 'America/Panama', 45, 'Reggaeton', 60, true, false),
('San Jose', 'Costa Rica', 9.9281, -84.0907, 340000, 'central_america', 'America/Costa_Rica', 40, 'Latin', 55, false, false),
('Tegucigalpa', 'Honduras', 14.0723, -87.1921, 1200000, 'central_america', 'America/Tegucigalpa', 30, 'Latin', 35, false, false),
('Santo Domingo', 'Dominican Republic', 18.4861, -69.9312, 3600000, 'caribbean', 'America/Santo_Domingo', 50, 'Bachata', 45, true, false),
('Port-au-Prince', 'Haiti', 18.5944, -72.3074, 2800000, 'caribbean', 'America/Port-au-Prince', 30, 'Kompa', 30, true, false),
('San Juan', 'Puerto Rico', 18.4655, -66.1057, 340000, 'caribbean', 'America/Puerto_Rico', 55, 'Reggaeton', 70, true, false),
('Guatemala City', 'Guatemala', 14.6349, -90.5069, 3000000, 'central_america', 'America/Guatemala', 35, 'Latin', 40, false, false),
-- EASTERN EUROPE
('Minsk', 'Belarus', 53.9045, 27.5615, 2000000, 'europe', 'Europe/Minsk', 40, 'Rock', 40, false, true),
('Kyiv', 'Ukraine', 50.4501, 30.5234, 3000000, 'europe', 'Europe/Kyiv', 55, 'Rock', 45, false, true),
('Skopje', 'North Macedonia', 41.9973, 21.4280, 600000, 'europe', 'Europe/Skopje', 35, 'Pop', 40, false, false),
('Tirana', 'Albania', 41.3275, 19.8187, 800000, 'europe', 'Europe/Tirane', 35, 'Pop', 40, false, false),
('Sarajevo', 'Bosnia and Herzegovina', 43.8563, 18.4131, 280000, 'europe', 'Europe/Sarajevo', 40, 'Rock', 40, false, true),
('Tbilisi', 'Georgia', 41.7151, 44.8271, 1200000, 'europe', 'Asia/Tbilisi', 50, 'Folk', 40, false, true),
('Yerevan', 'Armenia', 40.1792, 44.4991, 1100000, 'europe', 'Asia/Yerevan', 40, 'Folk', 40, false, true),
('Chisinau', 'Moldova', 47.0105, 28.8638, 700000, 'europe', 'Europe/Chisinau', 30, 'Pop', 35, false, false),
-- WESTERN EUROPE GAPS
('Luxembourg City', 'Luxembourg', 49.6117, 6.1319, 130000, 'europe', 'Europe/Luxembourg', 40, 'Pop', 100, false, true),
('Edinburgh', 'United Kingdom', 55.9533, -3.1883, 530000, 'europe', 'Europe/London', 65, 'Indie', 80, true, true),
('Cork', 'Ireland', 51.8969, -8.4863, 210000, 'europe', 'Europe/Dublin', 50, 'Folk', 75, true, true),
('Malaga', 'Spain', 36.7213, -4.4214, 580000, 'europe', 'Europe/Madrid', 45, 'Flamenco', 60, true, true),
('Lyon', 'France', 45.7640, 4.8357, 520000, 'europe', 'Europe/Paris', 55, 'Electronic', 70, false, true),
('Stuttgart', 'Germany', 48.7758, 9.1829, 635000, 'europe', 'Europe/Berlin', 50, 'Electronic', 75, false, true),
('Zurich', 'Switzerland', 47.3769, 8.5417, 430000, 'europe', 'Europe/Zurich', 55, 'Electronic', 110, false, true),
-- OCEANIA
('Auckland', 'New Zealand', -36.8485, 174.7633, 1660000, 'oceania', 'Pacific/Auckland', 55, 'Indie', 75, true, true),
('Gold Coast', 'Australia', -28.0167, 153.4000, 700000, 'oceania', 'Australia/Brisbane', 40, 'Pop', 70, true, true),
('Wellington', 'New Zealand', -41.2865, 174.7762, 215000, 'oceania', 'Pacific/Auckland', 50, 'Indie', 75, true, true)
ON CONFLICT (name, country) DO NOTHING;

-- PART 2: Seed 2-3 small venues for ALL cities without venues
-- This covers: 55 existing empty cities + ~50 new cities = ~105 cities x 2-3 venues each

-- Helper: using a CTE approach with city lookups

-- EXISTING EMPTY CITIES - venues
-- Australia
INSERT INTO venues (name, city_id, capacity, venue_type, prestige_level, base_payment, requirements, slots_per_day, venue_cut, band_revenue_share, equipment_quality, sound_system_rating, lighting_rating, backstage_quality, security_required, alcohol_license, description, daily_operating_cost, staff_count, minimum_guarantee, reputation)
VALUES
-- Brisbane
('The Foundry', (SELECT id FROM cities WHERE name='Brisbane' AND country='Australia'), 120, 'indie_venue', 1, 150, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Underground live music den in Fortitude Valley', 200, 3, 100, 40),
('Strings & Stories', (SELECT id FROM cities WHERE name='Brisbane' AND country='Australia'), 60, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Acoustic cafe with open mic nights', 100, 2, 50, 30),
-- Perth
('The Vinyl Room', (SELECT id FROM cities WHERE name='Perth' AND country='Australia'), 100, 'indie_venue', 1, 120, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Cozy indie spot in Northbridge', 180, 3, 80, 35),
('Sunset Sessions Cafe', (SELECT id FROM cities WHERE name='Perth' AND country='Australia'), 50, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Beach-side acoustic venue', 80, 2, 40, 30),
-- Belgium
('De Kelder', (SELECT id FROM cities WHERE name='Antwerp' AND country='Belgium'), 90, 'club', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Underground club in the old quarter', 150, 3, 70, 35),
('Jazz Hoek', (SELECT id FROM cities WHERE name='Antwerp' AND country='Belgium'), 60, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Intimate jazz corner cafe', 100, 2, 50, 30),
-- Bulgaria
('Undergrounder', (SELECT id FROM cities WHERE name='Sofia' AND country='Bulgaria'), 100, 'club', 1, 90, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Underground rock club near Vitosha Blvd', 130, 3, 60, 35),
('Balkan Beats Cafe', (SELECT id FROM cities WHERE name='Sofia' AND country='Bulgaria'), 60, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Folk and world music cafe', 80, 2, 40, 30),
-- Colombia
('La Cueva Rock', (SELECT id FROM cities WHERE name='Medellín' AND country='Colombia'), 120, 'indie_venue', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Rock cave in El Poblado', 150, 3, 70, 35),
('Café del Son', (SELECT id FROM cities WHERE name='Medellín' AND country='Colombia'), 70, 'cafe', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Salsa and cumbia acoustic cafe', 90, 2, 50, 30),
-- Croatia
('Vinyl District', (SELECT id FROM cities WHERE name='Zagreb' AND country='Croatia'), 100, 'indie_venue', 1, 90, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Indie venue in the art district', 140, 3, 60, 35),
('Kavana Zvuk', (SELECT id FROM cities WHERE name='Zagreb' AND country='Croatia'), 50, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Quiet acoustic cafe', 80, 2, 40, 30),
-- Cuba
('Son de la Noche', (SELECT id FROM cities WHERE name='Havana' AND country='Cuba'), 100, 'club', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 3, 1, false, true, 'Late-night son cubano club', 100, 2, 50, 35),
('La Bodeguita del Ritmo', (SELECT id FROM cities WHERE name='Havana' AND country='Cuba'), 60, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Classic Cuban music cafe', 80, 2, 40, 30),
-- Estonia
('Kellari Live', (SELECT id FROM cities WHERE name='Tallinn' AND country='Estonia'), 80, 'indie_venue', 1, 90, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Cellar venue in Old Town', 120, 2, 60, 35),
('Nordic Note', (SELECT id FROM cities WHERE name='Tallinn' AND country='Estonia'), 50, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Minimalist Nordic music cafe', 80, 2, 40, 30),
-- Ethiopia
('Jazzamba', (SELECT id FROM cities WHERE name='Addis Ababa' AND country='Ethiopia'), 100, 'club', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Ethio-jazz club', 100, 2, 50, 35),
('Tej Beats', (SELECT id FROM cities WHERE name='Addis Ababa' AND country='Ethiopia'), 60, 'cafe', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Traditional music cafe with honey wine', 70, 2, 30, 25),
-- France
('Le Petit Garage', (SELECT id FROM cities WHERE name='Bordeaux' AND country='France'), 80, 'indie_venue', 1, 120, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Garage rock venue near the river', 150, 3, 80, 35),
('Café Chanson', (SELECT id FROM cities WHERE name='Bordeaux' AND country='France'), 50, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'French chanson acoustic cafe', 90, 2, 50, 30),
('Le Noctambule', (SELECT id FROM cities WHERE name='Nice' AND country='France'), 100, 'club', 1, 130, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Riviera nightclub with live acts', 170, 3, 80, 40),
('Promenade Sessions', (SELECT id FROM cities WHERE name='Nice' AND country='France'), 60, 'cafe', 1, 90, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Seaside acoustic cafe', 100, 2, 60, 30),
('Le Caveau Parisien', (SELECT id FROM cities WHERE name='Paris' AND country='France'), 150, 'indie_venue', 1, 200, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Basement venue in the Latin Quarter', 250, 4, 120, 45),
('Café des Artistes', (SELECT id FROM cities WHERE name='Paris' AND country='France'), 70, 'cafe', 1, 120, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Bohemian artist cafe in Montmartre', 120, 2, 70, 35),
('La Rose des Vents', (SELECT id FROM cities WHERE name='Toulouse' AND country='France'), 90, 'indie_venue', 1, 110, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Warm indie venue in the Pink City', 140, 3, 70, 35),
('Occitan Groove', (SELECT id FROM cities WHERE name='Toulouse' AND country='France'), 60, 'cafe', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Regional music cafe', 90, 2, 50, 30),
-- Germany - Berlin
('Keller Klub', (SELECT id FROM cities WHERE name='Berlin' AND country='Germany'), 200, 'club', 1, 180, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 4, 3, 2, false, true, 'Underground techno and live music cellar', 250, 4, 100, 45),
('Kreuzberg Sessions', (SELECT id FROM cities WHERE name='Berlin' AND country='Germany'), 80, 'cafe', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 3, 2, 1, false, true, 'Punk and indie cafe in Kreuzberg', 120, 2, 60, 35),
-- Ghana
('Highlife Den', (SELECT id FROM cities WHERE name='Accra' AND country='Ghana'), 100, 'club', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Highlife and afrobeats club', 90, 2, 40, 30),
('Osu Groove Spot', (SELECT id FROM cities WHERE name='Accra' AND country='Ghana'), 60, 'indie_venue', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Open-air music spot in Osu', 70, 2, 30, 25),
-- Italy
('Il Sottopalco', (SELECT id FROM cities WHERE name='Florence' AND country='Italy'), 80, 'indie_venue', 1, 110, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Underground stage near Santa Croce', 140, 3, 70, 35),
('Caffè Melodia', (SELECT id FROM cities WHERE name='Florence' AND country='Italy'), 50, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Classical and jazz cafe', 90, 2, 50, 30),
('Napoli Underground', (SELECT id FROM cities WHERE name='Naples' AND country='Italy'), 120, 'club', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Neapolitan underground club', 140, 3, 70, 35),
('Cantina del Blues', (SELECT id FROM cities WHERE name='Naples' AND country='Italy'), 60, 'cafe', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Blues and soul cafe in Spaccanapoli', 90, 2, 40, 30),
-- Jamaica
('Yard Vibes', (SELECT id FROM cities WHERE name='Kingston' AND country='Jamaica'), 100, 'club', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 3, 2, 1, false, true, 'Reggae and dancehall yard club', 100, 2, 50, 35),
('Trench Town Acoustic', (SELECT id FROM cities WHERE name='Kingston' AND country='Jamaica'), 60, 'cafe', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Roots music open-air cafe', 70, 2, 30, 25),
-- Japan - Tokyo
('Shimokitazawa Basement', (SELECT id FROM cities WHERE name='Tokyo' AND country='Japan'), 80, 'indie_venue', 1, 200, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 4, 3, 2, false, false, 'Tiny live house in Shimokita', 200, 3, 120, 45),
('Golden Gai Sessions', (SELECT id FROM cities WHERE name='Tokyo' AND country='Japan'), 30, 'cafe', 1, 150, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Micro bar with live acoustic sets', 100, 1, 80, 40),
-- Latvia
('Riga Cellar', (SELECT id FROM cities WHERE name='Riga' AND country='Latvia'), 80, 'indie_venue', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Old Town cellar venue', 110, 2, 50, 30),
('Baltic Brew & Beats', (SELECT id FROM cities WHERE name='Riga' AND country='Latvia'), 50, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Craft beer cafe with live music', 80, 2, 40, 25),
-- Lithuania
('Vilnius Vault', (SELECT id FROM cities WHERE name='Vilnius' AND country='Lithuania'), 90, 'club', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Underground club in Uzupis', 120, 2, 50, 30),
('Acoustic Republic', (SELECT id FROM cities WHERE name='Vilnius' AND country='Lithuania'), 50, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Singer-songwriter cafe', 80, 2, 40, 25),
-- Malaysia
('KL Live Loft', (SELECT id FROM cities WHERE name='Kuala Lumpur' AND country='Malaysia'), 120, 'indie_venue', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, false, 'Indie loft venue in Bukit Bintang', 130, 3, 60, 35),
('Kopitiam Groove', (SELECT id FROM cities WHERE name='Kuala Lumpur' AND country='Malaysia'), 60, 'cafe', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Traditional coffeeshop with live sets', 80, 2, 40, 30),
-- Morocco
('Riad Rhythms', (SELECT id FROM cities WHERE name='Casablanca' AND country='Morocco'), 80, 'indie_venue', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Gnawa and fusion venue in a riad', 100, 2, 50, 30),
('Medina Beats', (SELECT id FROM cities WHERE name='Casablanca' AND country='Morocco'), 50, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Traditional music cafe in the medina', 70, 2, 30, 25),
('Jemaa Sessions', (SELECT id FROM cities WHERE name='Marrakech' AND country='Morocco'), 100, 'indie_venue', 1, 90, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 3, 1, false, false, 'Open-air music venue near the square', 110, 2, 50, 30),
('Souk Soundscape', (SELECT id FROM cities WHERE name='Marrakech' AND country='Morocco'), 50, 'cafe', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Hidden cafe in the souk', 70, 2, 30, 25),
-- Poland
('Gdansk Dockside', (SELECT id FROM cities WHERE name='Gdansk' AND country='Poland'), 100, 'indie_venue', 1, 90, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Warehouse venue by the docks', 130, 3, 60, 35),
('Amber Acoustic', (SELECT id FROM cities WHERE name='Gdansk' AND country='Poland'), 50, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Cozy acoustic cafe in Old Town', 80, 2, 40, 25),
-- Portugal
('Porto Cellar Stage', (SELECT id FROM cities WHERE name='Porto' AND country='Portugal'), 90, 'indie_venue', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Wine cellar turned music venue', 130, 3, 60, 35),
('Fado & Folk', (SELECT id FROM cities WHERE name='Porto' AND country='Portugal'), 50, 'cafe', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Traditional fado cafe', 80, 2, 40, 30),
-- Romania
('The Bunker', (SELECT id FROM cities WHERE name='Bucharest' AND country='Romania'), 120, 'club', 1, 90, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Underground electronic and rock club', 130, 3, 60, 35),
('Lipscani Lounge', (SELECT id FROM cities WHERE name='Bucharest' AND country='Romania'), 60, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Jazz lounge in Old Town', 80, 2, 40, 30),
-- Serbia
('Raft Stage', (SELECT id FROM cities WHERE name='Belgrade' AND country='Serbia'), 100, 'club', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'River raft club on the Sava', 120, 3, 50, 35),
('Skadarlija Acoustic', (SELECT id FROM cities WHERE name='Belgrade' AND country='Serbia'), 60, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Bohemian quarter acoustic cafe', 80, 2, 40, 25),
-- Slovakia
('Bratislava Basement', (SELECT id FROM cities WHERE name='Bratislava' AND country='Slovakia'), 80, 'indie_venue', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Cellar stage in Old Town', 110, 2, 50, 30),
('Danube Drift Cafe', (SELECT id FROM cities WHERE name='Bratislava' AND country='Slovakia'), 50, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Riverside cafe with weekend gigs', 80, 2, 40, 25),
-- Slovenia
('Metelkova Stage', (SELECT id FROM cities WHERE name='Ljubljana' AND country='Slovenia'), 100, 'indie_venue', 1, 90, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Alternative venue in the art squat district', 120, 3, 60, 35),
('Dragon Bridge Cafe', (SELECT id FROM cities WHERE name='Ljubljana' AND country='Slovenia'), 50, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Acoustic cafe by the river', 80, 2, 40, 25),
-- Spain
('Triana Sound', (SELECT id FROM cities WHERE name='Seville' AND country='Spain'), 100, 'indie_venue', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Flamenco-rock fusion venue in Triana', 130, 3, 60, 35),
('Tablao Secreto', (SELECT id FROM cities WHERE name='Seville' AND country='Spain'), 60, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 3, 1, false, true, 'Intimate flamenco cafe', 90, 2, 50, 30),
-- Sweden
('Gothenburg Garage', (SELECT id FROM cities WHERE name='Gothenburg' AND country='Sweden'), 100, 'indie_venue', 1, 110, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Melodic death metal birthplace tribute venue', 140, 3, 70, 40),
('Fika & Frequencies', (SELECT id FROM cities WHERE name='Gothenburg' AND country='Sweden'), 50, 'cafe', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Swedish fika cafe with indie sets', 90, 2, 50, 30),
-- UK empty cities
('The Shipyard', (SELECT id FROM cities WHERE name='Belfast' AND country='United Kingdom'), 100, 'indie_venue', 1, 110, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Industrial chic venue in the Titanic Quarter', 140, 3, 70, 35),
('Cathedral Quarter Sessions', (SELECT id FROM cities WHERE name='Belfast' AND country='United Kingdom'), 60, 'cafe', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Folk and trad cafe', 90, 2, 50, 30),
('The Lanes Live', (SELECT id FROM cities WHERE name='Brighton' AND country='United Kingdom'), 120, 'indie_venue', 1, 130, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Indie venue in The Lanes', 160, 3, 80, 40),
('Seagull & Sound', (SELECT id FROM cities WHERE name='Brighton' AND country='United Kingdom'), 60, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Beachfront acoustic cafe', 100, 2, 50, 30),
('The Coal Exchange', (SELECT id FROM cities WHERE name='Cardiff' AND country='United Kingdom'), 100, 'indie_venue', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Historic venue in Cardiff Bay', 140, 3, 60, 35),
('Womanby Street Sessions', (SELECT id FROM cities WHERE name='Cardiff' AND country='United Kingdom'), 60, 'cafe', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Music street acoustic spot', 90, 2, 50, 30),
('The Brudenell Social', (SELECT id FROM cities WHERE name='Leeds' AND country='United Kingdom'), 120, 'indie_venue', 1, 120, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Legendary indie social club', 150, 3, 70, 40),
('Headrow Hideout', (SELECT id FROM cities WHERE name='Leeds' AND country='United Kingdom'), 60, 'cafe', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Hidden basement cafe', 90, 2, 50, 30),
('The Cluny', (SELECT id FROM cities WHERE name='Newcastle' AND country='United Kingdom'), 100, 'indie_venue', 1, 110, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Ouseburn Valley indie institution', 140, 3, 70, 35),
('Quayside Notes', (SELECT id FROM cities WHERE name='Newcastle' AND country='United Kingdom'), 50, 'cafe', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Riverside acoustic cafe', 80, 2, 40, 30),
('Bodega Social', (SELECT id FROM cities WHERE name='Nottingham' AND country='United Kingdom'), 100, 'indie_venue', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Iconic underground indie stage', 130, 3, 60, 35),
('Hockley Arts Cafe', (SELECT id FROM cities WHERE name='Nottingham' AND country='United Kingdom'), 50, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Creative quarter cafe', 80, 2, 40, 25),
('The Wedgewood Rooms', (SELECT id FROM cities WHERE name='Portsmouth' AND country='United Kingdom'), 100, 'indie_venue', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Seaside town indie institution', 130, 3, 60, 35),
('Harbour Sounds', (SELECT id FROM cities WHERE name='Portsmouth' AND country='United Kingdom'), 50, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Harbour-front acoustic cafe', 80, 2, 40, 25),
('The Leadmill Jr', (SELECT id FROM cities WHERE name='Sheffield' AND country='United Kingdom'), 120, 'indie_venue', 1, 110, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Small stage in the Steel City', 140, 3, 70, 35),
('Kelham Acoustic', (SELECT id FROM cities WHERE name='Sheffield' AND country='United Kingdom'), 50, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Industrial quarter cafe', 80, 2, 40, 25),
-- Uruguay
('Candombe Corner', (SELECT id FROM cities WHERE name='Montevideo' AND country='Uruguay'), 100, 'club', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Candombe and milonga club', 100, 2, 50, 30),
('El Boliche del Angel', (SELECT id FROM cities WHERE name='Montevideo' AND country='Uruguay'), 60, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Tango and folk cafe in Ciudad Vieja', 80, 2, 40, 25),
-- USA empty cities
('The Rat Cellar', (SELECT id FROM cities WHERE name='Boston' AND country='USA'), 120, 'indie_venue', 1, 150, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Punk and indie cellar in Allston', 180, 3, 90, 40),
('Beacon Hill Acoustic', (SELECT id FROM cities WHERE name='Boston' AND country='USA'), 60, 'cafe', 1, 90, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Folk cafe on the hill', 110, 2, 60, 30),
('Deep Ellum Den', (SELECT id FROM cities WHERE name='Dallas' AND country='USA'), 120, 'indie_venue', 1, 130, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Blues and rock den in Deep Ellum', 160, 3, 80, 35),
('Lone Star Lounge', (SELECT id FROM cities WHERE name='Dallas' AND country='USA'), 70, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Country and Americana cafe', 100, 2, 50, 30),
('The Hi-Dive', (SELECT id FROM cities WHERE name='Denver' AND country='USA'), 100, 'indie_venue', 1, 120, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'DIY venue on Broadway', 150, 3, 70, 35),
('Mile High Acoustic', (SELECT id FROM cities WHERE name='Denver' AND country='USA'), 60, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Mountain town acoustic cafe', 100, 2, 50, 30),
('Waikiki Wavelength', (SELECT id FROM cities WHERE name='Honolulu' AND country='USA'), 80, 'indie_venue', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Island vibes music venue', 120, 2, 60, 30),
('Ukulele Junction', (SELECT id FROM cities WHERE name='Honolulu' AND country='USA'), 40, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Beachside acoustic cafe', 70, 2, 30, 25),
('Montrose Underground', (SELECT id FROM cities WHERE name='Houston' AND country='USA'), 120, 'indie_venue', 1, 130, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Art district indie venue', 160, 3, 80, 35),
('Bayou Blues Shack', (SELECT id FROM cities WHERE name='Houston' AND country='USA'), 70, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Zydeco and blues cafe', 100, 2, 50, 30),
('Echo Park Hideaway', (SELECT id FROM cities WHERE name='Los Angeles' AND country='USA'), 100, 'indie_venue', 1, 150, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Eastside indie hideaway', 180, 3, 90, 40),
('Silver Lake Sessions', (SELECT id FROM cities WHERE name='Los Angeles' AND country='USA'), 60, 'cafe', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Hipster acoustic cafe', 120, 2, 60, 35),
('Beale Street Basement', (SELECT id FROM cities WHERE name='Memphis' AND country='USA'), 100, 'club', 1, 120, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Blues cellar on Beale Street', 150, 3, 70, 40),
('Soul Kitchen Memphis', (SELECT id FROM cities WHERE name='Memphis' AND country='USA'), 60, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Soul food and soul music cafe', 100, 2, 50, 30),
('7th Street Entry', (SELECT id FROM cities WHERE name='Minneapolis' AND country='USA'), 120, 'indie_venue', 1, 140, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Small room next to First Avenue', 170, 3, 80, 40),
('Uptown Unplugged', (SELECT id FROM cities WHERE name='Minneapolis' AND country='USA'), 60, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Acoustic cafe in Uptown', 100, 2, 50, 30),
('Alphabet City Dive', (SELECT id FROM cities WHERE name='New York' AND country='USA'), 100, 'indie_venue', 1, 180, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'East Village dive bar with live music', 220, 3, 100, 45),
('Bushwick Sound Lab', (SELECT id FROM cities WHERE name='New York' AND country='USA'), 80, 'club', 1, 150, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'DIY experimental music space', 180, 3, 80, 40),
('Fishtown Foundry', (SELECT id FROM cities WHERE name='Philadelphia' AND country='USA'), 120, 'indie_venue', 1, 130, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Converted warehouse venue', 160, 3, 80, 35),
('South Street Sessions', (SELECT id FROM cities WHERE name='Philadelphia' AND country='USA'), 60, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Eclectic cafe on South Street', 100, 2, 50, 30),
('Desert Bloom', (SELECT id FROM cities WHERE name='Phoenix' AND country='USA'), 100, 'indie_venue', 1, 110, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Southwest desert rock venue', 140, 3, 70, 35),
('Cactus Acoustic', (SELECT id FROM cities WHERE name='Phoenix' AND country='USA'), 60, 'cafe', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Desert acoustic cafe', 90, 2, 50, 25),
('Ocean Beach Sessions', (SELECT id FROM cities WHERE name='San Diego' AND country='USA'), 80, 'indie_venue', 1, 110, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Beachside indie venue', 140, 3, 70, 35),
('Gaslamp Groove', (SELECT id FROM cities WHERE name='San Diego' AND country='USA'), 60, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Downtown jazz and soul cafe', 100, 2, 50, 30),
('U Street Cellar', (SELECT id FROM cities WHERE name='Washington DC' AND country='USA'), 100, 'club', 1, 140, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Go-go and indie club on U Street', 170, 3, 80, 40),
('Georgetown Unplugged', (SELECT id FROM cities WHERE name='Washington DC' AND country='USA'), 60, 'cafe', 1, 90, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Acoustic cafe in Georgetown', 110, 2, 60, 30),
-- Vietnam
('Saigon Sound Cellar', (SELECT id FROM cities WHERE name='Ho Chi Minh City' AND country='Vietnam'), 100, 'indie_venue', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Underground indie venue in District 1', 100, 2, 50, 30),
('Pho & Phonics', (SELECT id FROM cities WHERE name='Ho Chi Minh City' AND country='Vietnam'), 50, 'cafe', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Street food cafe with live acoustic sets', 60, 2, 30, 25),

-- NEW CITIES - venues
-- Africa new
('Institut Français', (SELECT id FROM cities WHERE name='Dakar' AND country='Senegal'), 120, 'indie_venue', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Cultural center with live mbalax nights', 100, 2, 50, 30),
('Thiossane Club', (SELECT id FROM cities WHERE name='Dakar' AND country='Senegal'), 150, 'club', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 3, 3, 1, false, true, 'Famous Youssou-inspired live club', 120, 3, 60, 35),
('Bongo Star', (SELECT id FROM cities WHERE name='Dar es Salaam' AND country='Tanzania'), 100, 'club', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Bongo flava and taarab club', 90, 2, 40, 30),
('Oyster Bay Acoustic', (SELECT id FROM cities WHERE name='Dar es Salaam' AND country='Tanzania'), 60, 'cafe', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Beachside acoustic spot', 70, 2, 30, 25),
('Kin Rumba Palace', (SELECT id FROM cities WHERE name='Kinshasa' AND country='DR Congo'), 150, 'club', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 3, 1, false, true, 'Congolese rumba dance club', 100, 3, 50, 35),
('Matonge Sessions', (SELECT id FROM cities WHERE name='Kinshasa' AND country='DR Congo'), 80, 'indie_venue', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Live music in the Matonge district', 80, 2, 40, 25),
('Kizomba Nights', (SELECT id FROM cities WHERE name='Luanda' AND country='Angola'), 120, 'club', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 3, 1, false, true, 'Kizomba and semba club', 90, 2, 40, 30),
('Marginal Acoustic', (SELECT id FROM cities WHERE name='Luanda' AND country='Angola'), 60, 'cafe', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Waterfront acoustic cafe', 70, 2, 30, 25),
('Xiquelene Live', (SELECT id FROM cities WHERE name='Maputo' AND country='Mozambique'), 100, 'indie_venue', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Marrabenta and jazz venue', 80, 2, 40, 30),
('Baixa Beats', (SELECT id FROM cities WHERE name='Maputo' AND country='Mozambique'), 60, 'cafe', 1, 40, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Downtown music cafe', 60, 2, 25, 25),
('Café Culturel', (SELECT id FROM cities WHERE name='Tunis' AND country='Tunisia'), 80, 'cafe', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Medina cultural cafe with live rai', 90, 2, 40, 30),
('La Marsa Sound', (SELECT id FROM cities WHERE name='Tunis' AND country='Tunisia'), 100, 'indie_venue', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Coastal indie venue', 100, 2, 50, 30),
('Casbah Rock', (SELECT id FROM cities WHERE name='Algiers' AND country='Algeria'), 100, 'indie_venue', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Rai and rock venue in the Casbah', 90, 2, 40, 30),
('Bab El Oued Cafe', (SELECT id FROM cities WHERE name='Algiers' AND country='Algeria'), 60, 'cafe', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Chaabi music cafe', 70, 2, 30, 25),
('Ndere Centre', (SELECT id FROM cities WHERE name='Kampala' AND country='Uganda'), 120, 'indie_venue', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Cultural music and dance center', 80, 2, 40, 30),
('Rolex Joint', (SELECT id FROM cities WHERE name='Kampala' AND country='Uganda'), 60, 'cafe', 1, 40, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Street food and afrobeats cafe', 60, 2, 25, 20),

-- Asia & Middle East new
('Ta Hien Tavern', (SELECT id FROM cities WHERE name='Hanoi' AND country='Vietnam'), 80, 'indie_venue', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Old Quarter live music tavern', 80, 2, 40, 30),
('Hanoi Rock City Jr', (SELECT id FROM cities WHERE name='Hanoi' AND country='Vietnam'), 100, 'club', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Indie rock club', 100, 2, 50, 35),
('Tha Phae Sessions', (SELECT id FROM cities WHERE name='Chiang Mai' AND country='Thailand'), 80, 'indie_venue', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Acoustic venue near the old city', 80, 2, 40, 30),
('Night Bazaar Beats', (SELECT id FROM cities WHERE name='Chiang Mai' AND country='Thailand'), 100, 'club', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 3, 1, false, true, 'Live music at the night market', 90, 2, 40, 30),
('Dotonbori Live', (SELECT id FROM cities WHERE name='Osaka' AND country='Japan'), 80, 'indie_venue', 1, 180, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 4, 3, 2, false, false, 'Neon-lit live house', 180, 3, 100, 45),
('Shinsaibashi Cafe Stage', (SELECT id FROM cities WHERE name='Osaka' AND country='Japan'), 40, 'cafe', 1, 130, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 3, 2, 1, false, true, 'Intimate acoustic cafe', 100, 2, 70, 35),
('Koregaon Park Live', (SELECT id FROM cities WHERE name='Pune' AND country='India'), 100, 'indie_venue', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Indie venue in the hip district', 80, 2, 40, 30),
('Chai & Chords', (SELECT id FROM cities WHERE name='Pune' AND country='India'), 60, 'cafe', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Acoustic cafe with chai service', 60, 2, 30, 25),
('Mylapore Music Room', (SELECT id FROM cities WHERE name='Chennai' AND country='India'), 100, 'indie_venue', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 3, 2, 1, false, false, 'Carnatic and fusion music room', 80, 2, 40, 30),
('Marina Cafe Live', (SELECT id FROM cities WHERE name='Chennai' AND country='India'), 60, 'cafe', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Beachside cafe with live sets', 60, 2, 30, 25),
('Saddar Sessions', (SELECT id FROM cities WHERE name='Karachi' AND country='Pakistan'), 100, 'indie_venue', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Downtown indie venue', 80, 2, 40, 30),
('Chai Khana Live', (SELECT id FROM cities WHERE name='Karachi' AND country='Pakistan'), 60, 'cafe', 1, 40, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Traditional chai house with qawwali nights', 60, 2, 25, 25),
('Anarkali Groove', (SELECT id FROM cities WHERE name='Lahore' AND country='Pakistan'), 100, 'club', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 3, 1, false, false, 'Sufi rock club in old Lahore', 80, 2, 40, 30),
('Walled City Acoustic', (SELECT id FROM cities WHERE name='Lahore' AND country='Pakistan'), 60, 'cafe', 1, 40, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Acoustic sessions in the old quarter', 60, 2, 25, 25),
('Dhanmondi Den', (SELECT id FROM cities WHERE name='Dhaka' AND country='Bangladesh'), 80, 'indie_venue', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Underground indie den', 70, 2, 30, 25),
('Rickshaw Radio Cafe', (SELECT id FROM cities WHERE name='Dhaka' AND country='Bangladesh'), 50, 'cafe', 1, 30, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Baul and folk cafe', 50, 2, 20, 20),
('Pettah Live', (SELECT id FROM cities WHERE name='Colombo' AND country='Sri Lanka'), 80, 'indie_venue', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Market district live venue', 80, 2, 40, 30),
('Galle Face Acoustic', (SELECT id FROM cities WHERE name='Colombo' AND country='Sri Lanka'), 50, 'cafe', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Oceanside acoustic spot', 60, 2, 30, 25),
('Hamra Underground', (SELECT id FROM cities WHERE name='Beirut' AND country='Lebanon'), 100, 'club', 1, 120, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Indie rock club in Hamra', 140, 3, 70, 40),
('Gemmayzeh Sessions', (SELECT id FROM cities WHERE name='Beirut' AND country='Lebanon'), 60, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Bohemian cafe with oud nights', 100, 2, 50, 30),
('Rainbow Street Live', (SELECT id FROM cities WHERE name='Amman' AND country='Jordan'), 80, 'indie_venue', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Indie venue on Rainbow Street', 90, 2, 40, 30),
('Books@Cafe Stage', (SELECT id FROM cities WHERE name='Amman' AND country='Jordan'), 50, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Literary cafe with acoustic nights', 70, 2, 30, 25),
('Katara Lounge', (SELECT id FROM cities WHERE name='Doha' AND country='Qatar'), 100, 'indie_venue', 1, 150, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, false, 'Cultural village music lounge', 180, 3, 80, 40),
('Souq Sessions', (SELECT id FROM cities WHERE name='Doha' AND country='Qatar'), 60, 'cafe', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Traditional market cafe with live oud', 120, 2, 60, 30),
('Boulevard Beat', (SELECT id FROM cities WHERE name='Riyadh' AND country='Saudi Arabia'), 120, 'indie_venue', 1, 130, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, false, 'Modern live music venue on Riyadh Boulevard', 160, 3, 70, 35),
('Dirah Acoustic', (SELECT id FROM cities WHERE name='Riyadh' AND country='Saudi Arabia'), 60, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Old town acoustic cafe', 100, 2, 50, 30),
('Almaty Rock Bunker', (SELECT id FROM cities WHERE name='Almaty' AND country='Kazakhstan'), 100, 'club', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Soviet-era bunker turned rock club', 100, 2, 50, 35),
('Green Bazaar Groove', (SELECT id FROM cities WHERE name='Almaty' AND country='Kazakhstan'), 60, 'cafe', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Traditional music cafe near the bazaar', 70, 2, 30, 25),

-- South/Central America & Caribbean new
('La Ronda Live', (SELECT id FROM cities WHERE name='Quito' AND country='Ecuador'), 100, 'indie_venue', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Colonial street music venue', 90, 2, 40, 30),
('Andes Acoustic', (SELECT id FROM cities WHERE name='Quito' AND country='Ecuador'), 60, 'cafe', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Highland folk cafe', 70, 2, 30, 25),
('Peña del Altiplano', (SELECT id FROM cities WHERE name='La Paz' AND country='Bolivia'), 80, 'indie_venue', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Traditional peña folk venue', 60, 2, 30, 25),
('El Prado Cafe', (SELECT id FROM cities WHERE name='La Paz' AND country='Bolivia'), 50, 'cafe', 1, 40, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Bohemian cafe on the main avenue', 50, 2, 25, 20),
('Barrio Loma Pub', (SELECT id FROM cities WHERE name='Asuncion' AND country='Paraguay'), 80, 'indie_venue', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Guarania and polka venue', 60, 2, 30, 25),
('Arpa y Guitarra Cafe', (SELECT id FROM cities WHERE name='Asuncion' AND country='Paraguay'), 50, 'cafe', 1, 40, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Paraguayan harp and guitar cafe', 50, 2, 25, 20),
('Sabana Grande Live', (SELECT id FROM cities WHERE name='Caracas' AND country='Venezuela'), 100, 'indie_venue', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Salsa and rock venue', 80, 2, 40, 30),
('El Hatillo Acoustic', (SELECT id FROM cities WHERE name='Caracas' AND country='Venezuela'), 60, 'cafe', 1, 40, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Mountain village acoustic cafe', 60, 2, 25, 25),
('Casco Viejo Sound', (SELECT id FROM cities WHERE name='Panama City' AND country='Panama'), 100, 'club', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Historic quarter reggaeton club', 120, 3, 60, 35),
('Causeway Cafe', (SELECT id FROM cities WHERE name='Panama City' AND country='Panama'), 60, 'cafe', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Oceanfront cafe with Latin jazz', 90, 2, 40, 30),
('Barrio Amón Live', (SELECT id FROM cities WHERE name='San Jose' AND country='Costa Rica'), 80, 'indie_venue', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Historic barrio indie spot', 80, 2, 40, 30),
('Pura Vida Acoustic', (SELECT id FROM cities WHERE name='San Jose' AND country='Costa Rica'), 50, 'cafe', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Eco-friendly acoustic cafe', 60, 2, 30, 25),
('Centro Historico Live', (SELECT id FROM cities WHERE name='Tegucigalpa' AND country='Honduras'), 70, 'indie_venue', 1, 40, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Downtown live music spot', 60, 2, 25, 20),
('Café Guancasco', (SELECT id FROM cities WHERE name='Tegucigalpa' AND country='Honduras'), 50, 'cafe', 1, 30, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Traditional folk cafe', 50, 2, 20, 20),
('Zona Colonial Stage', (SELECT id FROM cities WHERE name='Santo Domingo' AND country='Dominican Republic'), 120, 'club', 1, 90, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Bachata and merengue club', 110, 3, 50, 35),
('Malecón Acoustic', (SELECT id FROM cities WHERE name='Santo Domingo' AND country='Dominican Republic'), 60, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Seaside acoustic cafe', 80, 2, 30, 25),
('Kompa Corner', (SELECT id FROM cities WHERE name='Port-au-Prince' AND country='Haiti'), 80, 'club', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Kompa and rara club', 60, 2, 30, 25),
('Tanbou Cafe', (SELECT id FROM cities WHERE name='Port-au-Prince' AND country='Haiti'), 50, 'cafe', 1, 30, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Roots music drum cafe', 40, 2, 20, 20),
('La Placita Sessions', (SELECT id FROM cities WHERE name='San Juan' AND country='Puerto Rico'), 120, 'club', 1, 120, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Reggaeton and salsa club in La Placita', 140, 3, 70, 40),
('Viejo San Juan Acoustic', (SELECT id FROM cities WHERE name='San Juan' AND country='Puerto Rico'), 60, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Colonial quarter acoustic cafe', 100, 2, 50, 30),
('Zona Viva Live', (SELECT id FROM cities WHERE name='Guatemala City' AND country='Guatemala'), 80, 'indie_venue', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Nightlife district venue', 70, 2, 30, 25),
('Café Antigua', (SELECT id FROM cities WHERE name='Guatemala City' AND country='Guatemala'), 50, 'cafe', 1, 40, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Colonial-style folk cafe', 50, 2, 25, 20),

-- Eastern Europe new
('Minsk Molotov', (SELECT id FROM cities WHERE name='Minsk' AND country='Belarus'), 100, 'club', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Underground rock club', 90, 2, 40, 30),
('Soviet Cafe Sessions', (SELECT id FROM cities WHERE name='Minsk' AND country='Belarus'), 60, 'cafe', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Retro cafe with live music', 70, 2, 30, 25),
('Podil Underground', (SELECT id FROM cities WHERE name='Kyiv' AND country='Ukraine'), 120, 'club', 1, 90, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Indie and electronic club in Podil', 110, 3, 50, 35),
('Khreschatyk Acoustic', (SELECT id FROM cities WHERE name='Kyiv' AND country='Ukraine'), 70, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Downtown acoustic cafe', 80, 2, 40, 30),
('Old Bazaar Stage', (SELECT id FROM cities WHERE name='Skopje' AND country='North Macedonia'), 80, 'indie_venue', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Live venue in the Old Bazaar', 70, 2, 30, 25),
('Vardar Cafe', (SELECT id FROM cities WHERE name='Skopje' AND country='North Macedonia'), 50, 'cafe', 1, 40, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, false, 'Riverside music cafe', 60, 2, 25, 20),
('Blloku Beat', (SELECT id FROM cities WHERE name='Tirana' AND country='Albania'), 80, 'club', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 3, 1, false, true, 'Nightlife district club', 80, 2, 30, 30),
('Bunker Cafe', (SELECT id FROM cities WHERE name='Tirana' AND country='Albania'), 50, 'cafe', 1, 40, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Communist bunker themed cafe', 60, 2, 25, 25),
('Baščaršija Blues', (SELECT id FROM cities WHERE name='Sarajevo' AND country='Bosnia and Herzegovina'), 80, 'indie_venue', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Old town blues and sevdah venue', 80, 2, 40, 30),
('Miljacka Cafe', (SELECT id FROM cities WHERE name='Sarajevo' AND country='Bosnia and Herzegovina'), 50, 'cafe', 1, 40, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Riverside acoustic cafe', 60, 2, 25, 25),
('Fabrika Underground', (SELECT id FROM cities WHERE name='Tbilisi' AND country='Georgia'), 120, 'club', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Converted factory techno and live club', 100, 3, 50, 40),
('Wine Cellar Sessions', (SELECT id FROM cities WHERE name='Tbilisi' AND country='Georgia'), 60, 'cafe', 1, 60, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Wine bar with Georgian polyphonic singing', 80, 2, 40, 30),
('Cascade Live', (SELECT id FROM cities WHERE name='Yerevan' AND country='Armenia'), 100, 'indie_venue', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Open-air venue by the Cascade', 90, 2, 40, 30),
('Vernissage Cafe', (SELECT id FROM cities WHERE name='Yerevan' AND country='Armenia'), 60, 'cafe', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Art market cafe with duduk sessions', 70, 2, 30, 25),
('Stefan cel Mare Stage', (SELECT id FROM cities WHERE name='Chisinau' AND country='Moldova'), 80, 'indie_venue', 1, 50, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Downtown indie venue', 70, 2, 30, 25),
('Wine Route Cafe', (SELECT id FROM cities WHERE name='Chisinau' AND country='Moldova'), 50, 'cafe', 1, 40, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Wine country folk cafe', 60, 2, 25, 20),

-- Western Europe new
('Grund Live', (SELECT id FROM cities WHERE name='Luxembourg City' AND country='Luxembourg'), 80, 'indie_venue', 1, 130, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Valley quarter indie venue', 150, 3, 80, 35),
('Clausen Cafe Stage', (SELECT id FROM cities WHERE name='Luxembourg City' AND country='Luxembourg'), 50, 'cafe', 1, 90, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Old brewery district cafe', 110, 2, 60, 30),
('Cowgate Cavern', (SELECT id FROM cities WHERE name='Edinburgh' AND country='United Kingdom'), 120, 'indie_venue', 1, 130, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Underground venue on the Cowgate', 160, 3, 80, 40),
('Royal Mile Sessions', (SELECT id FROM cities WHERE name='Edinburgh' AND country='United Kingdom'), 60, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Folk and trad cafe on the Royal Mile', 100, 2, 50, 30),
('Franciscan Well Stage', (SELECT id FROM cities WHERE name='Cork' AND country='Ireland'), 100, 'indie_venue', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Brewery venue with live trad', 130, 3, 60, 35),
('Oliver Plunkett Sessions', (SELECT id FROM cities WHERE name='Cork' AND country='Ireland'), 60, 'cafe', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Irish trad session cafe', 90, 2, 50, 30),
('Soho Malagueño', (SELECT id FROM cities WHERE name='Malaga' AND country='Spain'), 100, 'indie_venue', 1, 90, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Art district indie venue', 120, 3, 60, 35),
('Chiringuito Beats', (SELECT id FROM cities WHERE name='Malaga' AND country='Spain'), 60, 'cafe', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Beach bar with live flamenco', 80, 2, 40, 30),
('Croix-Rousse Live', (SELECT id FROM cities WHERE name='Lyon' AND country='France'), 100, 'indie_venue', 1, 110, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Hill district indie venue', 140, 3, 70, 35),
('Bouchon Beats', (SELECT id FROM cities WHERE name='Lyon' AND country='France'), 60, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Traditional bouchon with chanson', 100, 2, 50, 30),
('Kessel Live', (SELECT id FROM cities WHERE name='Stuttgart' AND country='Germany'), 100, 'indie_venue', 1, 110, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Valley basin indie venue', 140, 3, 70, 35),
('Weinberg Cafe', (SELECT id FROM cities WHERE name='Stuttgart' AND country='Germany'), 60, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Vineyard hill acoustic cafe', 100, 2, 50, 30),
('Langstrasse Live', (SELECT id FROM cities WHERE name='Zurich' AND country='Switzerland'), 100, 'club', 1, 150, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Nightlife district club', 180, 3, 90, 40),
('Niederdorf Acoustic', (SELECT id FROM cities WHERE name='Zurich' AND country='Switzerland'), 50, 'cafe', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Old town acoustic cafe', 120, 2, 60, 30),

-- Oceania new
('K Road Live', (SELECT id FROM cities WHERE name='Auckland' AND country='New Zealand'), 120, 'indie_venue', 1, 110, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Karangahape Road indie venue', 140, 3, 70, 40),
('Ponsonby Acoustic', (SELECT id FROM cities WHERE name='Auckland' AND country='New Zealand'), 60, 'cafe', 1, 80, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Trendy suburb acoustic cafe', 100, 2, 50, 30),
('Surfers Sound', (SELECT id FROM cities WHERE name='Gold Coast' AND country='Australia'), 100, 'club', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 3, 2, false, true, 'Beach party club', 130, 3, 60, 35),
('Burleigh Beats Cafe', (SELECT id FROM cities WHERE name='Gold Coast' AND country='Australia'), 60, 'cafe', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Headland acoustic cafe', 90, 2, 40, 30),
('Cuba Street Sessions', (SELECT id FROM cities WHERE name='Wellington' AND country='New Zealand'), 100, 'indie_venue', 1, 100, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 3, 3, 2, 2, false, true, 'Bohemian quarter live venue', 130, 3, 60, 35),
('Courtenay Cafe Stage', (SELECT id FROM cities WHERE name='Wellington' AND country='New Zealand'), 60, 'cafe', 1, 70, '{"min_fame":0,"min_fans":0}'::jsonb, 4, 0.20, 0.50, 2, 2, 2, 1, false, true, 'Entertainment district cafe', 90, 2, 40, 30);
