
-- Normalize region values to capitalized format
UPDATE cities SET region = 'Africa' WHERE region = 'africa';
UPDATE cities SET region = 'Asia' WHERE region = 'asia';
UPDATE cities SET region = 'Europe' WHERE region = 'europe';
UPDATE cities SET region = 'Oceania' WHERE region = 'oceania';
UPDATE cities SET region = 'South America' WHERE region = 'south_america';
UPDATE cities SET region = 'Caribbean' WHERE region = 'caribbean';
UPDATE cities SET region = 'Central America' WHERE region = 'central_america';
UPDATE cities SET region = 'Middle East' WHERE region = 'middle_east';
