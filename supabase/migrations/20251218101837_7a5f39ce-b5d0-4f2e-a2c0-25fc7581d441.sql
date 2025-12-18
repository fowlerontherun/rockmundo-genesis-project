-- Seed 5 districts for all 79 cities
-- Each district has: name, vibe, music_scene_rating, safety_rating, rent_cost, description

-- First, let's create a function to generate districts for cities that don't have 5 yet
DO $$
DECLARE
  city_rec RECORD;
  district_count INT;
  base_rent INT;
  i INT;
  district_names TEXT[][] := ARRAY[
    ARRAY['Downtown', 'City Center', 'Central District', 'Main Street', 'The Core'],
    ARRAY['Arts Quarter', 'Cultural District', 'Creative Village', 'Gallery Row', 'Artisan Alley'],
    ARRAY['University District', 'Student Quarter', 'College Town', 'Campus Area', 'Academic Village'],
    ARRAY['Music Row', 'Sound District', 'Melody Lane', 'Rhythm Quarter', 'Harmony Heights'],
    ARRAY['Old Town', 'Historic Quarter', 'Heritage District', 'Vintage Village', 'Classic Corner']
  ];
  district_vibes TEXT[][] := ARRAY[
    ARRAY['Commercial', 'Busy', 'Professional', 'Metropolitan', 'Urban'],
    ARRAY['Artistic', 'Bohemian', 'Creative', 'Trendy', 'Alternative'],
    ARRAY['Indie', 'Alternative', 'Youthful', 'Budget-Friendly', 'Energetic'],
    ARRAY['Rock', 'Jazz', 'Electronic', 'Hip-Hop', 'Pop'],
    ARRAY['Classic', 'Blues', 'Folk', 'Traditional', 'Retro']
  ];
  district_descriptions TEXT[][] := ARRAY[
    ARRAY['The bustling commercial heart of the city with major venues and corporate offices.', 'A vibrant central hub where business meets entertainment.', 'The city''s main district featuring flagship stores and premier venues.', 'Where the action happens - top restaurants, clubs, and concert halls.', 'The metropolitan core with high-rise venues and executive nightlife.'],
    ARRAY['Home to galleries, independent theaters, and experimental music venues.', 'Where artists live and work, filled with studios and intimate performance spaces.', 'A creative enclave known for its underground music scene.', 'Trendy cafes, vinyl shops, and avant-garde venues define this area.', 'The beating heart of the city''s alternative culture.'],
    ARRAY['Affordable housing and dive bars popular with students and young musicians.', 'Budget-friendly area with open mics and emerging talent nights.', 'Where tomorrow''s stars hone their craft in basement venues.', 'Cheap rent and cheaper beer attract struggling artists.', 'The launching pad for countless music careers.'],
    ARRAY['Legendary venues, recording studios, and music industry offices cluster here.', 'Where record deals are signed and hits are recorded.', 'The professional music industry''s home base in the city.', 'Historic stages and modern studios side by side.', 'Every aspiring musician dreams of playing here.'],
    ARRAY['Historic architecture houses jazz clubs and blues bars.', 'Preserved buildings contain venues with decades of music history.', 'Where tradition meets new talent in atmospheric settings.', 'Cobblestone streets lead to legendary music halls.', 'The soul of the city''s musical heritage lives here.']
  ];
  selected_name TEXT;
  selected_vibe TEXT;
  selected_desc TEXT;
  music_rating INT;
  safety INT;
  rent INT;
  random_idx INT;
BEGIN
  FOR city_rec IN SELECT id, name, cost_of_living, music_scene FROM cities LOOP
    -- Count existing districts
    SELECT COUNT(*) INTO district_count FROM city_districts WHERE city_id = city_rec.id;
    
    -- Calculate base rent from city's cost of living
    base_rent := 500 + COALESCE(city_rec.cost_of_living, 50) * 25;
    
    -- Add districts until we have 5
    FOR i IN (district_count + 1)..5 LOOP
      -- Select random variant within each district type
      random_idx := floor(random() * 5) + 1;
      
      CASE i
        WHEN 1 THEN -- Downtown
          selected_name := district_names[1][random_idx];
          selected_vibe := district_vibes[1][random_idx];
          selected_desc := district_descriptions[1][random_idx];
          music_rating := 60 + floor(random() * 30); -- 60-89
          safety := 70 + floor(random() * 25); -- 70-94
          rent := base_rent * 1.5;
        WHEN 2 THEN -- Arts Quarter
          selected_name := district_names[2][random_idx];
          selected_vibe := district_vibes[2][random_idx];
          selected_desc := district_descriptions[2][random_idx];
          music_rating := 70 + floor(random() * 25); -- 70-94
          safety := 60 + floor(random() * 25); -- 60-84
          rent := base_rent * 1.2;
        WHEN 3 THEN -- University District
          selected_name := district_names[3][random_idx];
          selected_vibe := district_vibes[3][random_idx];
          selected_desc := district_descriptions[3][random_idx];
          music_rating := 50 + floor(random() * 35); -- 50-84
          safety := 65 + floor(random() * 20); -- 65-84
          rent := base_rent * 0.7;
        WHEN 4 THEN -- Music Row
          selected_name := district_names[4][random_idx];
          selected_vibe := district_vibes[4][random_idx];
          selected_desc := district_descriptions[4][random_idx];
          music_rating := 80 + floor(random() * 20); -- 80-99
          safety := 55 + floor(random() * 30); -- 55-84
          rent := base_rent * 1.3;
        WHEN 5 THEN -- Old Town
          selected_name := district_names[5][random_idx];
          selected_vibe := district_vibes[5][random_idx];
          selected_desc := district_descriptions[5][random_idx];
          music_rating := 65 + floor(random() * 25); -- 65-89
          safety := 60 + floor(random() * 25); -- 60-84
          rent := base_rent * 1.1;
      END CASE;
      
      -- Check if a district with similar name already exists
      IF NOT EXISTS (
        SELECT 1 FROM city_districts 
        WHERE city_id = city_rec.id 
        AND (name ILIKE '%' || split_part(selected_name, ' ', 1) || '%')
      ) THEN
        INSERT INTO city_districts (city_id, name, vibe, music_scene_rating, safety_rating, rent_cost, description)
        VALUES (
          city_rec.id,
          selected_name,
          selected_vibe,
          LEAST(music_rating, 100),
          LEAST(safety, 100),
          GREATEST(rent, 300),
          selected_desc
        );
      ELSE
        -- Use alternate name with city suffix
        INSERT INTO city_districts (city_id, name, vibe, music_scene_rating, safety_rating, rent_cost, description)
        VALUES (
          city_rec.id,
          selected_name || ' ' || substring(city_rec.name from 1 for 1),
          selected_vibe,
          LEAST(music_rating, 100),
          LEAST(safety, 100),
          GREATEST(rent, 300),
          selected_desc
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Verify all cities have at least 5 districts
SELECT c.name as city_name, COUNT(cd.id) as district_count 
FROM cities c 
LEFT JOIN city_districts cd ON c.id = cd.city_id 
GROUP BY c.id, c.name 
HAVING COUNT(cd.id) < 5;