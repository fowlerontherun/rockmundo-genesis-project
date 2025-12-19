-- Add real-world Radio Shows (with correct time_slot values)
INSERT INTO radio_shows (station_id, show_name, host_name, time_slot, day_of_week, listener_multiplier, show_genres, is_active) VALUES
-- BBC Radio 1 Shows
('1380ed8e-e7eb-4ba2-8dcf-003ec70886dc', 'Radio 1 Breakfast', 'Greg James', 'morning_drive', 1, 2.0, ARRAY['pop', 'indie'], true),
('1380ed8e-e7eb-4ba2-8dcf-003ec70886dc', 'Radio 1 Breakfast', 'Greg James', 'morning_drive', 2, 2.0, ARRAY['pop', 'indie'], true),
('1380ed8e-e7eb-4ba2-8dcf-003ec70886dc', 'Radio 1 Breakfast', 'Greg James', 'morning_drive', 3, 2.0, ARRAY['pop', 'indie'], true),
('1380ed8e-e7eb-4ba2-8dcf-003ec70886dc', 'Radio 1 Breakfast', 'Greg James', 'morning_drive', 4, 2.0, ARRAY['pop', 'indie'], true),
('1380ed8e-e7eb-4ba2-8dcf-003ec70886dc', 'Radio 1 Breakfast', 'Greg James', 'morning_drive', 5, 2.0, ARRAY['pop', 'indie'], true),
('1380ed8e-e7eb-4ba2-8dcf-003ec70886dc', 'Live Lounge', 'Clara Amfo', 'afternoon_drive', 1, 1.8, ARRAY['pop', 'indie', 'alternative'], true),
('1380ed8e-e7eb-4ba2-8dcf-003ec70886dc', 'Future Sounds', 'Annie Mac', 'evening', 4, 1.5, ARRAY['electronic', 'dance'], true),
('1380ed8e-e7eb-4ba2-8dcf-003ec70886dc', 'Radio 1 Dance Party', 'Danny Howard', 'evening', 6, 1.6, ARRAY['dance', 'electronic'], true),
('1380ed8e-e7eb-4ba2-8dcf-003ec70886dc', 'Diplo and Friends', 'Diplo', 'late_night', 0, 1.4, ARRAY['electronic', 'hip-hop'], true),
-- BBC Radio 2 Shows
('bc5d0576-d617-4280-9754-c58266ba3351', 'Radio 2 Breakfast', 'Zoe Ball', 'morning_drive', 1, 2.5, ARRAY['pop', 'rock'], true),
('bc5d0576-d617-4280-9754-c58266ba3351', 'Radio 2 Breakfast', 'Zoe Ball', 'morning_drive', 2, 2.5, ARRAY['pop', 'rock'], true),
('bc5d0576-d617-4280-9754-c58266ba3351', 'Radio 2 Breakfast', 'Zoe Ball', 'morning_drive', 3, 2.5, ARRAY['pop', 'rock'], true),
('bc5d0576-d617-4280-9754-c58266ba3351', 'Steve Wright in the Afternoon', 'Steve Wright', 'afternoon_drive', 1, 1.8, ARRAY['pop', 'classic rock'], true),
('bc5d0576-d617-4280-9754-c58266ba3351', 'Sounds of the 80s', 'Gary Davies', 'evening', 6, 1.5, ARRAY['pop'], true),
('bc5d0576-d617-4280-9754-c58266ba3351', 'Jo Whiley Show', 'Jo Whiley', 'evening', 1, 1.6, ARRAY['rock', 'indie'], true),
-- Capital FM Shows
('d93c13ec-9a19-4d84-8513-793f3c39dd60', 'Capital Breakfast', 'Roman Kemp', 'morning_drive', 1, 2.0, ARRAY['pop', 'dance'], true),
('d93c13ec-9a19-4d84-8513-793f3c39dd60', 'Capital Breakfast', 'Roman Kemp', 'morning_drive', 2, 2.0, ARRAY['pop', 'dance'], true),
('d93c13ec-9a19-4d84-8513-793f3c39dd60', 'Capital Evening Show', 'Marvin Humes', 'evening', 5, 1.5, ARRAY['pop', 'r&b'], true),
-- Heart FM Shows
('f3f16c04-4bac-4d97-8f63-58f1f0f9df9f', 'Heart Breakfast', 'Jamie Theakston', 'morning_drive', 1, 2.0, ARRAY['pop'], true),
('f3f16c04-4bac-4d97-8f63-58f1f0f9df9f', 'Heart Breakfast', 'Jamie Theakston', 'morning_drive', 2, 2.0, ARRAY['pop'], true),
-- Kiss FM Shows
('ace0540a-cfe6-41ef-bef5-5191c2fc120e', 'Kiss Breakfast', 'Jordan Banjo', 'morning_drive', 1, 1.8, ARRAY['hip-hop', 'r&b', 'dance'], true),
('ace0540a-cfe6-41ef-bef5-5191c2fc120e', 'Kiss Fresh', 'DJ Target', 'evening', 5, 1.5, ARRAY['grime', 'hip-hop'], true),
-- iHeartRadio Shows
('29b05f2d-e5ad-48ec-8f9f-a980a6bdc1f2', 'The Bobby Bones Show', 'Bobby Bones', 'morning_drive', 1, 2.2, ARRAY['country', 'pop'], true),
('29b05f2d-e5ad-48ec-8f9f-a980a6bdc1f2', 'On Air with Ryan Seacrest', 'Ryan Seacrest', 'morning_drive', 2, 2.5, ARRAY['pop'], true),
('29b05f2d-e5ad-48ec-8f9f-a980a6bdc1f2', 'Elvis Duran Morning Show', 'Elvis Duran', 'morning_drive', 3, 2.0, ARRAY['pop'], true),
-- NPR Music Shows
('fddf08b6-d12b-45e9-a84f-7abd01791bd9', 'Tiny Desk Concert', 'Bob Boilen', 'afternoon_drive', 3, 1.8, ARRAY['indie', 'folk', 'world'], true),
('fddf08b6-d12b-45e9-a84f-7abd01791bd9', 'All Songs Considered', 'Bob Boilen', 'evening', 5, 1.5, ARRAY['indie', 'alternative'], true),
('fddf08b6-d12b-45e9-a84f-7abd01791bd9', 'World Cafe', 'Raina Douris', 'afternoon_drive', 1, 1.4, ARRAY['world', 'indie'], true),
-- Triple J Shows
('801b946b-552b-45ec-b903-8287441a9587', 'Triple J Breakfast', 'Bryce Mills', 'morning_drive', 1, 2.0, ARRAY['indie', 'alternative'], true),
('801b946b-552b-45ec-b903-8287441a9587', 'Like A Version', 'Various', 'morning_drive', 5, 2.5, ARRAY['indie', 'rock', 'pop'], true),
('801b946b-552b-45ec-b903-8287441a9587', 'Hottest 100', 'Various', 'weekend', 0, 3.0, ARRAY['indie', 'rock', 'pop', 'electronic'], true);