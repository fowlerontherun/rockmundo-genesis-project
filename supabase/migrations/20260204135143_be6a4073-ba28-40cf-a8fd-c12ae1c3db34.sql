-- Fix remaining mentors with missing city IDs using existing cities
UPDATE education_mentors SET city_id = '9f26ad86-51ed-4477-856d-610f14979310' WHERE name = 'Nina Frequency' AND city_id IS NULL; -- London as proxy for Berlin
UPDATE education_mentors SET city_id = '4efac643-c3bf-40b6-adcb-c3d5242c7b23' WHERE name = 'The Architect' AND city_id IS NULL; -- Las Vegas as proxy for LA  
UPDATE education_mentors SET city_id = '65b3346d-0fc9-4319-b711-84a3d553d22b' WHERE name = 'Madame Analog' AND city_id IS NULL; -- Seoul as proxy for Tokyo
UPDATE education_mentors SET city_id = '73fae343-9a12-4ecb-867f-ad6ec3699364' WHERE name = 'The Sampler King' AND city_id IS NULL; -- San Francisco as proxy for NY
UPDATE education_mentors SET city_id = '73fae343-9a12-4ecb-867f-ad6ec3699364' WHERE name = 'MC Prophet' AND city_id IS NULL;
UPDATE education_mentors SET city_id = 'ba81819b-45d4-49f3-86da-d625ad6b95d9' WHERE name = 'Madam Mystique' AND city_id IS NULL; -- Marseille as proxy for Paris
UPDATE education_mentors SET city_id = '4efac643-c3bf-40b6-adcb-c3d5242c7b23' WHERE name = 'Viral Vince' AND city_id IS NULL;
UPDATE education_mentors SET city_id = '9f26ad86-51ed-4477-856d-610f14979310' WHERE name = 'Synth Lord' AND city_id IS NULL;