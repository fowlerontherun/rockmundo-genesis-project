-- Seed venues for all cities (5 tiers per city)
INSERT INTO public.venues (name, city_id, location, venue_type, capacity, base_payment, prestige_level, requirements, description)
SELECT 
  c.name || ' ' || venue_data.venue_name,
  c.id,
  c.name,
  venue_data.venue_type,
  venue_data.capacity,
  venue_data.base_payment,
  venue_data.prestige_level,
  venue_data.requirements::jsonb,
  venue_data.description
FROM cities c
CROSS JOIN (VALUES
  ('Coffee Corner', 'cafe', 50, 200, 1, '{}', 'Intimate acoustic venue perfect for solo acts'),
  ('The Underground', 'club', 300, 1000, 2, '{"fame": 100}', 'Popular club with a dedicated local following'),
  ('Grand Theater', 'theater', 1200, 3500, 3, '{"fame": 500}', 'Historic theater with excellent acoustics'),
  ('City Arena', 'arena', 5000, 12000, 4, '{"fame": 2000}', 'Major arena hosting touring acts'),
  ('Stadium', 'stadium', 25000, 50000, 5, '{"fame": 8000}', 'Massive stadium for legendary performances')
) AS venue_data(venue_name, venue_type, capacity, base_payment, prestige_level, requirements, description)
ON CONFLICT DO NOTHING;

-- Seed recording studios for all cities (4 tiers per city)
INSERT INTO public.city_studios (name, city_id, hourly_rate, quality_rating, equipment_rating, specialties, available_slots)
SELECT 
  c.name || ' ' || studio_data.studio_name,
  c.id,
  studio_data.hourly_rate,
  studio_data.quality_rating,
  studio_data.equipment_rating,
  studio_data.specialties::text[],
  studio_data.available_slots
FROM cities c
CROSS JOIN (VALUES
  ('Budget Recording', 100, 30, 25, ARRAY['demos', 'podcasts'], 8),
  ('Pro Sound Studio', 250, 60, 55, ARRAY['rock', 'pop', 'indie'], 6),
  ('Elite Audio Labs', 500, 85, 80, ARRAY['mixing', 'mastering', 'live'], 4),
  ('Platinum Studios', 1000, 98, 95, ARRAY['all genres', 'film scoring', 'orchestral'], 2)
) AS studio_data(studio_name, hourly_rate, quality_rating, equipment_rating, specialties, available_slots)
ON CONFLICT DO NOTHING;

-- Seed rehearsal rooms for all cities (4 tiers per city)
INSERT INTO public.rehearsal_rooms (name, city_id, location, hourly_rate, quality_rating, capacity, equipment_quality, description)
SELECT 
  c.name || ' ' || room_data.room_name,
  c.id,
  c.name,
  room_data.hourly_rate,
  room_data.quality_rating,
  room_data.capacity,
  room_data.equipment_quality,
  room_data.description
FROM cities c
CROSS JOIN (VALUES
  ('Garage Space', 25, 20, 4, 15, 'Basic garage conversion with minimal equipment'),
  ('Practice Room', 50, 50, 6, 45, 'Standard rehearsal space with decent PA'),
  ('Pro Rehearsal Studio', 100, 75, 8, 70, 'Professional space with quality backline'),
  ('Elite Rehearsal Complex', 200, 95, 12, 90, 'Premium facility with recording capability')
) AS room_data(room_name, hourly_rate, quality_rating, capacity, equipment_quality, description)
ON CONFLICT DO NOTHING;