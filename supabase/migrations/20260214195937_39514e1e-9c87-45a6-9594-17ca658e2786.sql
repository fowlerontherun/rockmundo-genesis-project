
-- Reassign education_mentors from duplicate city IDs to the real ones
-- Atlanta: duplicate cd99667e -> real 872150e0
UPDATE education_mentors SET city_id = '872150e0-6fa6-4150-b622-b0f8e60ea6fb' 
WHERE city_id = 'cd99667e-d8e7-4780-bd2a-98d83c9b33aa';

-- Detroit: duplicate 48e4f25a -> real 0f6c3eea
UPDATE education_mentors SET city_id = '0f6c3eea-29c4-443b-b505-171a6d97c3f5' 
WHERE city_id = '48e4f25a-604b-41f7-a446-06f163d7eef8';

-- Nashville: duplicate b74d5b73 -> real 2a518758
UPDATE education_mentors SET city_id = '2a518758-067c-4d34-8ff6-666a31169fe7' 
WHERE city_id = 'b74d5b73-28e7-4a15-926b-c2d4551fa98b';

-- Now delete the empty duplicate cities
DELETE FROM cities WHERE id IN (
  'cd99667e-d8e7-4780-bd2a-98d83c9b33aa',
  '48e4f25a-604b-41f7-a446-06f163d7eef8',
  'b74d5b73-28e7-4a15-926b-c2d4551fa98b'
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE cities ADD CONSTRAINT cities_name_country_unique UNIQUE (name, country);
