-- Add coordinate columns to cities table
ALTER TABLE cities 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(9,6),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,6),
ADD COLUMN IF NOT EXISTS region VARCHAR(50),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);

-- Update existing cities with coordinates (by name matching)
UPDATE cities SET latitude = 51.5074, longitude = -0.1278, region = 'Europe', timezone = 'Europe/London' WHERE name = 'London';
UPDATE cities SET latitude = 53.4808, longitude = -2.2426, region = 'Europe', timezone = 'Europe/London' WHERE name = 'Manchester';
UPDATE cities SET latitude = 40.7128, longitude = -74.0060, region = 'North America', timezone = 'America/New_York' WHERE name = 'New York';
UPDATE cities SET latitude = 34.0522, longitude = -118.2437, region = 'North America', timezone = 'America/Los_Angeles' WHERE name = 'Los Angeles';
UPDATE cities SET latitude = 48.8566, longitude = 2.3522, region = 'Europe', timezone = 'Europe/Paris' WHERE name = 'Paris';
UPDATE cities SET latitude = 52.5200, longitude = 13.4050, region = 'Europe', timezone = 'Europe/Berlin' WHERE name = 'Berlin';
UPDATE cities SET latitude = 35.6762, longitude = 139.6503, region = 'Asia', timezone = 'Asia/Tokyo' WHERE name = 'Tokyo';

-- Insert new cities (using ON CONFLICT to skip existing)
INSERT INTO cities (name, country, region, latitude, longitude, music_scene, population, cost_of_living, dominant_genre, venues, timezone) VALUES
-- EUROPE
('Liverpool', 'United Kingdom', 'Europe', 53.4084, -2.9916, 85, 500000, 55, 'Rock', 60, 'Europe/London'),
('Glasgow', 'United Kingdom', 'Europe', 55.8642, -4.2518, 80, 635000, 55, 'Indie', 50, 'Europe/London'),
('Birmingham', 'United Kingdom', 'Europe', 52.4862, -1.8904, 75, 1150000, 60, 'Metal', 45, 'Europe/London'),
('Munich', 'Germany', 'Europe', 48.1351, 11.5820, 78, 1500000, 80, 'Classical', 60, 'Europe/Berlin'),
('Hamburg', 'Germany', 'Europe', 53.5511, 9.9937, 82, 1900000, 72, 'Rock', 70, 'Europe/Berlin'),
('Cologne', 'Germany', 'Europe', 50.9375, 6.9603, 75, 1100000, 68, 'Electronic', 55, 'Europe/Berlin'),
('Lyon', 'France', 'Europe', 45.7640, 4.8357, 72, 520000, 65, 'Electronic', 40, 'Europe/Paris'),
('Marseille', 'France', 'Europe', 43.2965, 5.3698, 70, 870000, 62, 'Hip-Hop', 35, 'Europe/Paris'),
('Amsterdam', 'Netherlands', 'Europe', 52.3676, 4.9041, 88, 870000, 82, 'Electronic', 85, 'Europe/Amsterdam'),
('Rotterdam', 'Netherlands', 'Europe', 51.9244, 4.4777, 75, 650000, 70, 'Electronic', 45, 'Europe/Amsterdam'),
('Brussels', 'Belgium', 'Europe', 50.8503, 4.3517, 72, 1200000, 72, 'Electronic', 50, 'Europe/Brussels'),
('Vienna', 'Austria', 'Europe', 48.2082, 16.3738, 85, 1900000, 75, 'Classical', 70, 'Europe/Vienna'),
('Zurich', 'Switzerland', 'Europe', 47.3769, 8.5417, 70, 435000, 95, 'Electronic', 40, 'Europe/Zurich'),
('Stockholm', 'Sweden', 'Europe', 59.3293, 18.0686, 85, 980000, 78, 'Pop', 65, 'Europe/Stockholm'),
('Copenhagen', 'Denmark', 'Europe', 55.6761, 12.5683, 80, 630000, 80, 'Pop', 55, 'Europe/Copenhagen'),
('Oslo', 'Norway', 'Europe', 59.9139, 10.7522, 75, 700000, 90, 'Electronic', 45, 'Europe/Oslo'),
('Helsinki', 'Finland', 'Europe', 60.1699, 24.9384, 78, 650000, 75, 'Metal', 50, 'Europe/Helsinki'),
('Barcelona', 'Spain', 'Europe', 41.3851, 2.1734, 88, 1620000, 68, 'Electronic', 90, 'Europe/Madrid'),
('Madrid', 'Spain', 'Europe', 40.4168, -3.7038, 82, 3300000, 65, 'Rock', 80, 'Europe/Madrid'),
('Ibiza', 'Spain', 'Europe', 38.9067, 1.4206, 95, 50000, 85, 'Electronic', 40, 'Europe/Madrid'),
('Lisbon', 'Portugal', 'Europe', 38.7223, -9.1393, 78, 550000, 55, 'Electronic', 55, 'Europe/Lisbon'),
('Rome', 'Italy', 'Europe', 41.9028, 12.4964, 75, 2870000, 70, 'Pop', 60, 'Europe/Rome'),
('Milan', 'Italy', 'Europe', 45.4642, 9.1900, 80, 1400000, 78, 'Electronic', 70, 'Europe/Rome'),
('Prague', 'Czech Republic', 'Europe', 50.0755, 14.4378, 78, 1300000, 50, 'Electronic', 65, 'Europe/Prague'),
('Dublin', 'Ireland', 'Europe', 53.3498, -6.2603, 85, 550000, 78, 'Rock', 70, 'Europe/Dublin'),
('Warsaw', 'Poland', 'Europe', 52.2297, 21.0122, 72, 1800000, 45, 'Electronic', 55, 'Europe/Warsaw'),
('Krakow', 'Poland', 'Europe', 50.0647, 19.9450, 70, 780000, 40, 'Jazz', 40, 'Europe/Warsaw'),
('Budapest', 'Hungary', 'Europe', 47.4979, 19.0402, 75, 1750000, 45, 'Electronic', 60, 'Europe/Budapest'),
('Athens', 'Greece', 'Europe', 37.9838, 23.7275, 70, 660000, 55, 'Rock', 45, 'Europe/Athens'),
('Moscow', 'Russia', 'Europe', 55.7558, 37.6173, 78, 12500000, 60, 'Electronic', 80, 'Europe/Moscow'),
('Reykjavik', 'Iceland', 'Europe', 64.1466, -21.9426, 80, 135000, 85, 'Indie', 30, 'Atlantic/Reykjavik'),
('Edinburgh', 'United Kingdom', 'Europe', 55.9533, -3.1883, 80, 540000, 68, 'Indie', 55, 'Europe/London'),
('Bristol', 'United Kingdom', 'Europe', 51.4545, -2.5879, 82, 460000, 62, 'Electronic', 50, 'Europe/London'),
-- NORTH AMERICA
('Chicago', 'USA', 'North America', 41.8781, -87.6298, 88, 2700000, 75, 'Blues', 120, 'America/Chicago'),
('Nashville', 'USA', 'North America', 36.1627, -86.7816, 92, 700000, 65, 'Country', 150, 'America/Chicago'),
('Austin', 'USA', 'North America', 30.2672, -97.7431, 90, 980000, 70, 'Indie', 130, 'America/Chicago'),
('Miami', 'USA', 'North America', 25.7617, -80.1918, 85, 470000, 78, 'Latin', 90, 'America/New_York'),
('Atlanta', 'USA', 'North America', 33.7490, -84.3880, 88, 500000, 68, 'Hip-Hop', 100, 'America/New_York'),
('Detroit', 'USA', 'North America', 42.3314, -83.0458, 82, 640000, 55, 'Electronic', 70, 'America/Detroit'),
('Seattle', 'USA', 'North America', 47.6062, -122.3321, 85, 750000, 80, 'Grunge', 85, 'America/Los_Angeles'),
('Portland', 'USA', 'North America', 45.5155, -122.6789, 80, 660000, 72, 'Indie', 75, 'America/Los_Angeles'),
('San Francisco', 'USA', 'North America', 37.7749, -122.4194, 85, 880000, 95, 'Rock', 90, 'America/Los_Angeles'),
('Las Vegas', 'USA', 'North America', 36.1699, -115.1398, 78, 650000, 70, 'Pop', 80, 'America/Los_Angeles'),
('New Orleans', 'USA', 'North America', 29.9511, -90.0715, 90, 390000, 60, 'Jazz', 110, 'America/Chicago'),
('Toronto', 'Canada', 'North America', 43.6532, -79.3832, 88, 2930000, 78, 'Hip-Hop', 100, 'America/Toronto'),
('Vancouver', 'Canada', 'North America', 49.2827, -123.1207, 82, 675000, 82, 'Electronic', 70, 'America/Vancouver'),
('Montreal', 'Canada', 'North America', 45.5017, -73.5673, 85, 1780000, 65, 'Indie', 90, 'America/Montreal'),
('Mexico City', 'Mexico', 'North America', 19.4326, -99.1332, 82, 9200000, 45, 'Latin', 100, 'America/Mexico_City'),
-- SOUTH AMERICA
('São Paulo', 'Brazil', 'South America', -23.5505, -46.6333, 88, 12300000, 50, 'Electronic', 120, 'America/Sao_Paulo'),
('Rio de Janeiro', 'Brazil', 'South America', -22.9068, -43.1729, 85, 6750000, 55, 'Latin', 100, 'America/Sao_Paulo'),
('Buenos Aires', 'Argentina', 'South America', -34.6037, -58.3816, 85, 3000000, 45, 'Latin', 90, 'America/Argentina/Buenos_Aires'),
('Bogotá', 'Colombia', 'South America', 4.7110, -74.0721, 78, 7400000, 40, 'Latin', 70, 'America/Bogota'),
('Lima', 'Peru', 'South America', -12.0464, -77.0428, 72, 10000000, 42, 'Latin', 55, 'America/Lima'),
('Santiago', 'Chile', 'South America', -33.4489, -70.6693, 75, 6700000, 55, 'Rock', 60, 'America/Santiago'),
-- ASIA
('Osaka', 'Japan', 'Asia', 34.6937, 135.5023, 82, 2750000, 75, 'Rock', 80, 'Asia/Tokyo'),
('Seoul', 'South Korea', 'Asia', 37.5665, 126.9780, 92, 9700000, 78, 'K-Pop', 140, 'Asia/Seoul'),
('Beijing', 'China', 'Asia', 39.9042, 116.4074, 80, 21500000, 60, 'Pop', 90, 'Asia/Shanghai'),
('Shanghai', 'China', 'Asia', 31.2304, 121.4737, 85, 24900000, 68, 'Electronic', 110, 'Asia/Shanghai'),
('Hong Kong', 'China', 'Asia', 22.3193, 114.1694, 82, 7500000, 85, 'Pop', 75, 'Asia/Hong_Kong'),
('Singapore', 'Singapore', 'Asia', 1.3521, 103.8198, 80, 5700000, 88, 'Electronic', 70, 'Asia/Singapore'),
('Bangkok', 'Thailand', 'Asia', 13.7563, 100.5018, 78, 10700000, 45, 'Electronic', 80, 'Asia/Bangkok'),
('Mumbai', 'India', 'Asia', 19.0760, 72.8777, 82, 20700000, 42, 'Bollywood', 90, 'Asia/Kolkata'),
('Delhi', 'India', 'Asia', 28.6139, 77.2090, 78, 32900000, 38, 'Bollywood', 75, 'Asia/Kolkata'),
('Taipei', 'Taiwan', 'Asia', 25.0330, 121.5654, 78, 2600000, 65, 'Pop', 60, 'Asia/Taipei'),
('Manila', 'Philippines', 'Asia', 14.5995, 120.9842, 75, 1780000, 40, 'Pop', 55, 'Asia/Manila'),
('Jakarta', 'Indonesia', 'Asia', -6.2088, 106.8456, 72, 10560000, 38, 'Pop', 60, 'Asia/Jakarta'),
-- MIDDLE EAST
('Dubai', 'UAE', 'Middle East', 25.2048, 55.2708, 78, 3400000, 82, 'Electronic', 60, 'Asia/Dubai'),
('Tel Aviv', 'Israel', 'Middle East', 32.0853, 34.7818, 85, 460000, 82, 'Electronic', 70, 'Asia/Jerusalem'),
('Istanbul', 'Turkey', 'Middle East', 41.0082, 28.9784, 80, 15500000, 50, 'Pop', 85, 'Europe/Istanbul'),
-- AFRICA
('Lagos', 'Nigeria', 'Africa', 6.5244, 3.3792, 82, 15400000, 35, 'Afrobeats', 80, 'Africa/Lagos'),
('Johannesburg', 'South Africa', 'Africa', -26.2041, 28.0473, 80, 5800000, 45, 'House', 70, 'Africa/Johannesburg'),
('Cape Town', 'South Africa', 'Africa', -33.9249, 18.4241, 78, 4700000, 50, 'Electronic', 60, 'Africa/Johannesburg'),
('Cairo', 'Egypt', 'Africa', 30.0444, 31.2357, 72, 21300000, 35, 'Pop', 55, 'Africa/Cairo'),
('Nairobi', 'Kenya', 'Africa', -1.2921, 36.8219, 70, 4400000, 40, 'Afrobeats', 45, 'Africa/Nairobi'),
-- OCEANIA
('Sydney', 'Australia', 'Oceania', -33.8688, 151.2093, 88, 5300000, 82, 'Pop', 100, 'Australia/Sydney'),
('Melbourne', 'Australia', 'Oceania', -37.8136, 144.9631, 90, 5100000, 78, 'Indie', 110, 'Australia/Melbourne'),
('Auckland', 'New Zealand', 'Oceania', -36.8509, 174.7645, 78, 1660000, 75, 'Indie', 50, 'Pacific/Auckland')
ON CONFLICT DO NOTHING;