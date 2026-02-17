
-- Step 1: Add climate_type column to cities
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS climate_type text;

-- Step 2: Populate climate_type for all cities based on real-world geography
UPDATE public.cities SET climate_type = CASE name
  -- Tropical
  WHEN 'Bangkok' THEN 'tropical'
  WHEN 'Kingston' THEN 'tropical'
  WHEN 'Manila' THEN 'tropical'
  WHEN 'Ho Chi Minh City' THEN 'tropical'
  WHEN 'Havana' THEN 'tropical'
  WHEN 'Lagos' THEN 'tropical'
  WHEN 'Accra' THEN 'tropical'
  WHEN 'Kinshasa' THEN 'tropical'
  WHEN 'Dar es Salaam' THEN 'tropical'
  WHEN 'Kampala' THEN 'tropical'
  WHEN 'Colombo' THEN 'tropical'
  WHEN 'Chennai' THEN 'tropical'
  WHEN 'Dhaka' THEN 'tropical'
  WHEN 'Chiang Mai' THEN 'tropical'
  WHEN 'Hanoi' THEN 'tropical'
  WHEN 'Honolulu' THEN 'tropical'
  WHEN 'Medellín' THEN 'tropical'
  WHEN 'San Juan' THEN 'tropical'
  WHEN 'Port of Spain' THEN 'tropical'
  WHEN 'Caracas' THEN 'tropical'
  WHEN 'Guatemala City' THEN 'tropical'
  WHEN 'Panama City' THEN 'tropical'
  WHEN 'Santo Domingo' THEN 'tropical'
  -- Equatorial
  WHEN 'Singapore' THEN 'equatorial'
  WHEN 'Jakarta' THEN 'equatorial'
  WHEN 'Kuala Lumpur' THEN 'equatorial'
  WHEN 'Bogotá' THEN 'equatorial'
  WHEN 'Nairobi' THEN 'equatorial'
  WHEN 'Dakar' THEN 'equatorial'
  -- Arid
  WHEN 'Dubai' THEN 'arid'
  WHEN 'Cairo' THEN 'arid'
  WHEN 'Las Vegas' THEN 'arid'
  WHEN 'Doha' THEN 'arid'
  WHEN 'Riyadh' THEN 'arid'
  WHEN 'Karachi' THEN 'arid'
  WHEN 'Lahore' THEN 'arid'
  WHEN 'Phoenix' THEN 'arid'
  WHEN 'Marrakech' THEN 'arid'
  WHEN 'Algiers' THEN 'arid'
  WHEN 'Amman' THEN 'arid'
  WHEN 'Tel Aviv' THEN 'arid'
  -- Mediterranean
  WHEN 'Barcelona' THEN 'mediterranean'
  WHEN 'Rome' THEN 'mediterranean'
  WHEN 'Los Angeles' THEN 'mediterranean'
  WHEN 'Lisbon' THEN 'mediterranean'
  WHEN 'Athens' THEN 'mediterranean'
  WHEN 'Florence' THEN 'mediterranean'
  WHEN 'Madrid' THEN 'mediterranean'
  WHEN 'Marseille' THEN 'mediterranean'
  WHEN 'Milan' THEN 'mediterranean'
  WHEN 'Naples' THEN 'mediterranean'
  WHEN 'Valencia' THEN 'mediterranean'
  WHEN 'Ibiza' THEN 'mediterranean'
  WHEN 'Casablanca' THEN 'mediterranean'
  WHEN 'Beirut' THEN 'mediterranean'
  WHEN 'San Francisco' THEN 'mediterranean'
  WHEN 'Perth' THEN 'mediterranean'
  WHEN 'Santiago' THEN 'mediterranean'
  WHEN 'Cape Town' THEN 'mediterranean'
  WHEN 'Tunis' THEN 'mediterranean'
  -- Oceanic
  WHEN 'London' THEN 'oceanic'
  WHEN 'Dublin' THEN 'oceanic'
  WHEN 'Seattle' THEN 'oceanic'
  WHEN 'Manchester' THEN 'oceanic'
  WHEN 'Liverpool' THEN 'oceanic'
  WHEN 'Birmingham' THEN 'oceanic'
  WHEN 'Bristol' THEN 'oceanic'
  WHEN 'Leeds' THEN 'oceanic'
  WHEN 'Glasgow' THEN 'oceanic'
  WHEN 'Edinburgh' THEN 'oceanic'
  WHEN 'Belfast' THEN 'oceanic'
  WHEN 'Cardiff' THEN 'oceanic'
  WHEN 'Brighton' THEN 'oceanic'
  WHEN 'Amsterdam' THEN 'oceanic'
  WHEN 'Brussels' THEN 'oceanic'
  WHEN 'Antwerp' THEN 'oceanic'
  WHEN 'Paris' THEN 'oceanic'
  WHEN 'Bordeaux' THEN 'oceanic'
  WHEN 'Cork' THEN 'oceanic'
  WHEN 'Nottingham' THEN 'oceanic'
  WHEN 'Portland' THEN 'oceanic'
  WHEN 'Vancouver' THEN 'oceanic'
  WHEN 'Melbourne' THEN 'oceanic'
  WHEN 'Auckland' THEN 'oceanic'
  WHEN 'Wellington' THEN 'oceanic'
  WHEN 'Luxembourg City' THEN 'oceanic'
  WHEN 'Cologne' THEN 'oceanic'
  WHEN 'Hamburg' THEN 'oceanic'
  -- Continental
  WHEN 'Moscow' THEN 'continental'
  WHEN 'Chicago' THEN 'continental'
  WHEN 'Berlin' THEN 'continental'
  WHEN 'Vienna' THEN 'continental'
  WHEN 'Prague' THEN 'continental'
  WHEN 'Warsaw' THEN 'continental'
  WHEN 'Budapest' THEN 'continental'
  WHEN 'Krakow' THEN 'continental'
  WHEN 'Bucharest' THEN 'continental'
  WHEN 'Belgrade' THEN 'continental'
  WHEN 'Bratislava' THEN 'continental'
  WHEN 'Ljubljana' THEN 'continental'
  WHEN 'Kyiv' THEN 'continental'
  WHEN 'Chisinau' THEN 'continental'
  WHEN 'Detroit' THEN 'continental'
  WHEN 'Minneapolis' THEN 'continental'
  WHEN 'Munich' THEN 'continental'
  WHEN 'Zurich' THEN 'continental'
  WHEN 'Denver' THEN 'continental'
  WHEN 'Montreal' THEN 'continental'
  WHEN 'Toronto' THEN 'continental'
  WHEN 'Beijing' THEN 'continental'
  WHEN 'Almaty' THEN 'continental'
  WHEN 'Gdansk' THEN 'continental'
  -- Subtropical
  WHEN 'Tokyo' THEN 'subtropical'
  WHEN 'Sydney' THEN 'subtropical'
  WHEN 'Buenos Aires' THEN 'subtropical'
  WHEN 'Shanghai' THEN 'subtropical'
  WHEN 'Osaka' THEN 'subtropical'
  WHEN 'Seoul' THEN 'subtropical'
  WHEN 'Mumbai' THEN 'subtropical'
  WHEN 'Delhi' THEN 'subtropical'
  WHEN 'Taipei' THEN 'subtropical'
  WHEN 'Hong Kong' THEN 'subtropical'
  WHEN 'São Paulo' THEN 'subtropical'
  WHEN 'Rio de Janeiro' THEN 'subtropical'
  WHEN 'Mexico City' THEN 'subtropical'
  WHEN 'Monterrey' THEN 'subtropical'
  WHEN 'Johannesburg' THEN 'subtropical'
  WHEN 'Atlanta' THEN 'subtropical'
  WHEN 'Houston' THEN 'subtropical'
  WHEN 'Dallas' THEN 'subtropical'
  WHEN 'Austin' THEN 'subtropical'
  WHEN 'Nashville' THEN 'subtropical'
  WHEN 'New Orleans' THEN 'subtropical'
  WHEN 'Miami' THEN 'subtropical'
  WHEN 'Gold Coast' THEN 'subtropical'
  WHEN 'Brisbane' THEN 'subtropical'
  WHEN 'Lima' THEN 'subtropical'
  WHEN 'Montevideo' THEN 'subtropical'
  WHEN 'Asuncion' THEN 'subtropical'
  WHEN 'La Paz' THEN 'subtropical'
  WHEN 'Istanbul' THEN 'subtropical'
  -- Subarctic
  WHEN 'Helsinki' THEN 'subarctic'
  WHEN 'Reykjavik' THEN 'subarctic'
  WHEN 'Oslo' THEN 'subarctic'
  WHEN 'Stockholm' THEN 'subarctic'
  WHEN 'Gothenburg' THEN 'subarctic'
  WHEN 'St. Petersburg' THEN 'subarctic'
  WHEN 'Tallinn' THEN 'subarctic'
  WHEN 'Riga' THEN 'subarctic'
  WHEN 'Vilnius' THEN 'subarctic'
  ELSE CASE
    WHEN latitude BETWEEN -10 AND 10 THEN 'equatorial'
    WHEN latitude BETWEEN -23.5 AND -10 OR latitude BETWEEN 10 AND 23.5 THEN 'tropical'
    WHEN latitude BETWEEN -35 AND -23.5 OR latitude BETWEEN 23.5 AND 35 THEN 'subtropical'
    WHEN latitude BETWEEN -45 AND -35 OR latitude BETWEEN 35 AND 45 THEN 'mediterranean'
    WHEN latitude BETWEEN -55 AND -45 OR latitude BETWEEN 45 AND 55 THEN 'oceanic'
    WHEN latitude < -55 OR latitude > 55 THEN 'subarctic'
    ELSE 'oceanic'
  END
END;

-- Also handle remaining US cities
UPDATE public.cities SET climate_type = 'subtropical' WHERE name IN ('New York', 'Philadelphia', 'Washington D.C.', 'Boston') AND climate_type IS NULL;
UPDATE public.cities SET climate_type = 'oceanic' WHERE climate_type IS NULL;

-- Step 3: Seed seasonal_weather_patterns for all cities x 4 seasons
-- First clear any existing data
DELETE FROM public.seasonal_weather_patterns;

-- Insert weather patterns based on climate_type
INSERT INTO public.seasonal_weather_patterns (city_id, season, weather_conditions, avg_temperature_celsius, travel_disruption_chance)
SELECT 
  c.id,
  s.season,
  CASE c.climate_type
    WHEN 'tropical' THEN CASE s.season
      WHEN 'spring' THEN '{"sunny":0.35,"cloudy":0.25,"rainy":0.30,"stormy":0.10,"snowy":0}'::jsonb
      WHEN 'summer' THEN '{"sunny":0.30,"cloudy":0.25,"rainy":0.30,"stormy":0.15,"snowy":0}'::jsonb
      WHEN 'autumn' THEN '{"sunny":0.30,"cloudy":0.30,"rainy":0.30,"stormy":0.10,"snowy":0}'::jsonb
      WHEN 'winter' THEN '{"sunny":0.40,"cloudy":0.25,"rainy":0.25,"stormy":0.10,"snowy":0}'::jsonb
    END
    WHEN 'equatorial' THEN CASE s.season
      WHEN 'spring' THEN '{"sunny":0.25,"cloudy":0.30,"rainy":0.30,"stormy":0.15,"snowy":0}'::jsonb
      WHEN 'summer' THEN '{"sunny":0.25,"cloudy":0.25,"rainy":0.35,"stormy":0.15,"snowy":0}'::jsonb
      WHEN 'autumn' THEN '{"sunny":0.25,"cloudy":0.30,"rainy":0.30,"stormy":0.15,"snowy":0}'::jsonb
      WHEN 'winter' THEN '{"sunny":0.25,"cloudy":0.30,"rainy":0.30,"stormy":0.15,"snowy":0}'::jsonb
    END
    WHEN 'arid' THEN CASE s.season
      WHEN 'spring' THEN '{"sunny":0.60,"cloudy":0.25,"rainy":0.10,"stormy":0.05,"snowy":0}'::jsonb
      WHEN 'summer' THEN '{"sunny":0.75,"cloudy":0.15,"rainy":0.05,"stormy":0.05,"snowy":0}'::jsonb
      WHEN 'autumn' THEN '{"sunny":0.60,"cloudy":0.25,"rainy":0.10,"stormy":0.05,"snowy":0}'::jsonb
      WHEN 'winter' THEN '{"sunny":0.50,"cloudy":0.30,"rainy":0.15,"stormy":0.05,"snowy":0}'::jsonb
    END
    WHEN 'mediterranean' THEN CASE s.season
      WHEN 'spring' THEN '{"sunny":0.45,"cloudy":0.30,"rainy":0.20,"stormy":0.05,"snowy":0}'::jsonb
      WHEN 'summer' THEN '{"sunny":0.65,"cloudy":0.20,"rainy":0.10,"stormy":0.05,"snowy":0}'::jsonb
      WHEN 'autumn' THEN '{"sunny":0.35,"cloudy":0.30,"rainy":0.25,"stormy":0.10,"snowy":0}'::jsonb
      WHEN 'winter' THEN '{"sunny":0.30,"cloudy":0.30,"rainy":0.30,"stormy":0.08,"snowy":0.02}'::jsonb
    END
    WHEN 'oceanic' THEN CASE s.season
      WHEN 'spring' THEN '{"sunny":0.30,"cloudy":0.35,"rainy":0.25,"stormy":0.08,"snowy":0.02}'::jsonb
      WHEN 'summer' THEN '{"sunny":0.35,"cloudy":0.35,"rainy":0.20,"stormy":0.08,"snowy":0.02}'::jsonb
      WHEN 'autumn' THEN '{"sunny":0.20,"cloudy":0.35,"rainy":0.30,"stormy":0.12,"snowy":0.03}'::jsonb
      WHEN 'winter' THEN '{"sunny":0.15,"cloudy":0.30,"rainy":0.30,"stormy":0.10,"snowy":0.15}'::jsonb
    END
    WHEN 'continental' THEN CASE s.season
      WHEN 'spring' THEN '{"sunny":0.35,"cloudy":0.30,"rainy":0.25,"stormy":0.08,"snowy":0.02}'::jsonb
      WHEN 'summer' THEN '{"sunny":0.45,"cloudy":0.25,"rainy":0.15,"stormy":0.12,"snowy":0.03}'::jsonb
      WHEN 'autumn' THEN '{"sunny":0.25,"cloudy":0.35,"rainy":0.25,"stormy":0.10,"snowy":0.05}'::jsonb
      WHEN 'winter' THEN '{"sunny":0.10,"cloudy":0.25,"rainy":0.15,"stormy":0.10,"snowy":0.40}'::jsonb
    END
    WHEN 'subtropical' THEN CASE s.season
      WHEN 'spring' THEN '{"sunny":0.40,"cloudy":0.30,"rainy":0.20,"stormy":0.08,"snowy":0.02}'::jsonb
      WHEN 'summer' THEN '{"sunny":0.40,"cloudy":0.25,"rainy":0.20,"stormy":0.15,"snowy":0}'::jsonb
      WHEN 'autumn' THEN '{"sunny":0.35,"cloudy":0.30,"rainy":0.25,"stormy":0.08,"snowy":0.02}'::jsonb
      WHEN 'winter' THEN '{"sunny":0.30,"cloudy":0.30,"rainy":0.20,"stormy":0.05,"snowy":0.15}'::jsonb
    END
    WHEN 'subarctic' THEN CASE s.season
      WHEN 'spring' THEN '{"sunny":0.25,"cloudy":0.35,"rainy":0.20,"stormy":0.05,"snowy":0.15}'::jsonb
      WHEN 'summer' THEN '{"sunny":0.35,"cloudy":0.35,"rainy":0.20,"stormy":0.08,"snowy":0.02}'::jsonb
      WHEN 'autumn' THEN '{"sunny":0.15,"cloudy":0.30,"rainy":0.25,"stormy":0.10,"snowy":0.20}'::jsonb
      WHEN 'winter' THEN '{"sunny":0.10,"cloudy":0.20,"rainy":0.10,"stormy":0.10,"snowy":0.50}'::jsonb
    END
  END,
  CASE c.climate_type
    WHEN 'tropical' THEN CASE s.season WHEN 'spring' THEN 30 WHEN 'summer' THEN 32 WHEN 'autumn' THEN 29 WHEN 'winter' THEN 27 END
    WHEN 'equatorial' THEN CASE s.season WHEN 'spring' THEN 28 WHEN 'summer' THEN 28 WHEN 'autumn' THEN 28 WHEN 'winter' THEN 27 END
    WHEN 'arid' THEN CASE s.season WHEN 'spring' THEN 28 WHEN 'summer' THEN 40 WHEN 'autumn' THEN 28 WHEN 'winter' THEN 18 END
    WHEN 'mediterranean' THEN CASE s.season WHEN 'spring' THEN 18 WHEN 'summer' THEN 28 WHEN 'autumn' THEN 18 WHEN 'winter' THEN 10 END
    WHEN 'oceanic' THEN CASE s.season WHEN 'spring' THEN 12 WHEN 'summer' THEN 18 WHEN 'autumn' THEN 10 WHEN 'winter' THEN 5 END
    WHEN 'continental' THEN CASE s.season WHEN 'spring' THEN 12 WHEN 'summer' THEN 25 WHEN 'autumn' THEN 8 WHEN 'winter' THEN -5 END
    WHEN 'subtropical' THEN CASE s.season WHEN 'spring' THEN 18 WHEN 'summer' THEN 28 WHEN 'autumn' THEN 16 WHEN 'winter' THEN 8 END
    WHEN 'subarctic' THEN CASE s.season WHEN 'spring' THEN 5 WHEN 'summer' THEN 15 WHEN 'autumn' THEN 2 WHEN 'winter' THEN -12 END
  END,
  CASE c.climate_type
    WHEN 'tropical' THEN CASE s.season WHEN 'spring' THEN 0.10 WHEN 'summer' THEN 0.20 WHEN 'autumn' THEN 0.15 WHEN 'winter' THEN 0.05 END
    WHEN 'equatorial' THEN CASE s.season WHEN 'spring' THEN 0.15 WHEN 'summer' THEN 0.20 WHEN 'autumn' THEN 0.15 WHEN 'winter' THEN 0.15 END
    WHEN 'arid' THEN CASE s.season WHEN 'spring' THEN 0.05 WHEN 'summer' THEN 0.10 WHEN 'autumn' THEN 0.05 WHEN 'winter' THEN 0.05 END
    WHEN 'mediterranean' THEN CASE s.season WHEN 'spring' THEN 0.05 WHEN 'summer' THEN 0.05 WHEN 'autumn' THEN 0.10 WHEN 'winter' THEN 0.15 END
    WHEN 'oceanic' THEN CASE s.season WHEN 'spring' THEN 0.10 WHEN 'summer' THEN 0.05 WHEN 'autumn' THEN 0.15 WHEN 'winter' THEN 0.20 END
    WHEN 'continental' THEN CASE s.season WHEN 'spring' THEN 0.10 WHEN 'summer' THEN 0.10 WHEN 'autumn' THEN 0.10 WHEN 'winter' THEN 0.35 END
    WHEN 'subtropical' THEN CASE s.season WHEN 'spring' THEN 0.08 WHEN 'summer' THEN 0.15 WHEN 'autumn' THEN 0.10 WHEN 'winter' THEN 0.15 END
    WHEN 'subarctic' THEN CASE s.season WHEN 'spring' THEN 0.15 WHEN 'summer' THEN 0.05 WHEN 'autumn' THEN 0.20 WHEN 'winter' THEN 0.40 END
  END
FROM public.cities c
CROSS JOIN (VALUES ('spring'), ('summer'), ('autumn'), ('winter')) AS s(season);
