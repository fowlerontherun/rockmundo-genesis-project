-- Fix remaining mentors with missing city IDs using existing cities.
-- Resolve proxy cities by canonical name rather than brittle environment-specific UUIDs.
UPDATE education_mentors
SET city_id = (SELECT id FROM public.cities WHERE lower(name) = lower('London') LIMIT 1)
WHERE name = 'Nina Frequency' AND city_id IS NULL; -- London as proxy for Berlin

UPDATE education_mentors
SET city_id = (SELECT id FROM public.cities WHERE lower(name) = lower('Las Vegas') LIMIT 1)
WHERE name = 'The Architect' AND city_id IS NULL; -- Las Vegas as proxy for LA

UPDATE education_mentors
SET city_id = (SELECT id FROM public.cities WHERE lower(name) = lower('Seoul') LIMIT 1)
WHERE name = 'Madame Analog' AND city_id IS NULL; -- Seoul as proxy for Tokyo

UPDATE education_mentors
SET city_id = (SELECT id FROM public.cities WHERE lower(name) = lower('San Francisco') LIMIT 1)
WHERE name = 'The Sampler King' AND city_id IS NULL; -- San Francisco as proxy for NY

UPDATE education_mentors
SET city_id = (SELECT id FROM public.cities WHERE lower(name) = lower('San Francisco') LIMIT 1)
WHERE name = 'MC Prophet' AND city_id IS NULL;

UPDATE education_mentors
SET city_id = (SELECT id FROM public.cities WHERE lower(name) = lower('Marseille') LIMIT 1)
WHERE name = 'Madam Mystique' AND city_id IS NULL; -- Marseille as proxy for Paris

UPDATE education_mentors
SET city_id = (SELECT id FROM public.cities WHERE lower(name) = lower('Las Vegas') LIMIT 1)
WHERE name = 'Viral Vince' AND city_id IS NULL;

UPDATE education_mentors
SET city_id = (SELECT id FROM public.cities WHERE lower(name) = lower('London') LIMIT 1)
WHERE name = 'Synth Lord' AND city_id IS NULL;
