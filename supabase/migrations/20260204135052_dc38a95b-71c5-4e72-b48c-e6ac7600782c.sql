-- Fix mentors with missing city IDs

-- Nina Frequency -> Berlin
UPDATE education_mentors 
SET city_id = (SELECT id FROM cities WHERE name = 'Berlin' LIMIT 1)
WHERE name = 'Nina Frequency' AND city_id IS NULL;

-- The Architect -> Los Angeles
UPDATE education_mentors 
SET city_id = (SELECT id FROM cities WHERE name = 'Los Angeles' LIMIT 1)
WHERE name = 'The Architect' AND city_id IS NULL;

-- Madame Analog -> Tokyo
UPDATE education_mentors 
SET city_id = (SELECT id FROM cities WHERE name = 'Tokyo' LIMIT 1)
WHERE name = 'Madame Analog' AND city_id IS NULL;

-- The Sampler King -> New York
UPDATE education_mentors 
SET city_id = (SELECT id FROM cities WHERE name = 'New York' LIMIT 1)
WHERE name = 'The Sampler King' AND city_id IS NULL;

-- MC Prophet -> New York  
UPDATE education_mentors 
SET city_id = (SELECT id FROM cities WHERE name = 'New York' LIMIT 1)
WHERE name = 'MC Prophet' AND city_id IS NULL;

-- Madam Mystique -> Paris
UPDATE education_mentors 
SET city_id = (SELECT id FROM cities WHERE name = 'Paris' LIMIT 1)
WHERE name = 'Madam Mystique' AND city_id IS NULL;

-- Viral Vince -> Los Angeles
UPDATE education_mentors 
SET city_id = (SELECT id FROM cities WHERE name = 'Los Angeles' LIMIT 1)
WHERE name = 'Viral Vince' AND city_id IS NULL;

-- Synth Lord -> Berlin
UPDATE education_mentors 
SET city_id = (SELECT id FROM cities WHERE name = 'Berlin' LIMIT 1)
WHERE name = 'Synth Lord' AND city_id IS NULL;

-- Link Synth Lord to Berlin venue
UPDATE education_mentors 
SET discovery_venue_id = (
  SELECT id FROM venues WHERE city_id = (SELECT id FROM cities WHERE name = 'Berlin' LIMIT 1) 
  ORDER BY capacity DESC LIMIT 1
)
WHERE name = 'Synth Lord' AND discovery_venue_id IS NULL;