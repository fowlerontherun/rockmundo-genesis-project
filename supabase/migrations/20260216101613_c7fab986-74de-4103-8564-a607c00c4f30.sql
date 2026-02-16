
-- v1.0.737: Seed TV shows for all countries

INSERT INTO tv_shows (network_id, show_name, show_type, host_name, time_slot, viewer_reach, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max, min_fame_required, description, days_of_week) VALUES

-- AUSTRALIA
('f61b7070-26d8-4f53-94e1-ed4c2a5ef6f2', 'ABC Breakfast', 'morning_show', 'Lisa Millar', 'morning', 320000, 80, 300, 150, 800, 400, 2500, 5, 'Australia''s trusted morning news and entertainment program', ARRAY[1,2,3,4,5]),
('f61b7070-26d8-4f53-94e1-ed4c2a5ef6f2', 'Rage', 'music_special', NULL, 'late_night', 180000, 120, 500, 200, 1200, 300, 2000, 10, 'Iconic Australian music video show running since 1987', ARRAY[5,6,7]),
('f61b7070-26d8-4f53-94e1-ed4c2a5ef6f2', 'The Sound', 'entertainment', 'Lachlan Bryan', 'prime_time', 250000, 150, 600, 300, 1500, 500, 3500, 15, 'Live music performance showcase', ARRAY[6]),
('56a02cad-172b-471a-8913-8879ec558eac', 'Sunrise', 'morning_show', 'Natalie Barr', 'morning', 450000, 100, 400, 200, 1000, 500, 3000, 8, 'Australia''s number one breakfast show', ARRAY[1,2,3,4,5]),
('56a02cad-172b-471a-8913-8879ec558eac', 'The Morning Show', 'talk_show', 'Larry Emdur', 'morning', 280000, 80, 350, 150, 900, 400, 2500, 5, 'Lifestyle and entertainment talk show', ARRAY[1,2,3,4,5]),
('e184283b-07c9-4625-bbf1-dbd0f59b5d2d', 'The Project', 'talk_show', 'Waleed Aly', 'prime_time', 380000, 120, 500, 250, 1200, 600, 4000, 12, 'Current affairs meets entertainment panel show', ARRAY[1,2,3,4,5]),
('e184283b-07c9-4625-bbf1-dbd0f59b5d2d', 'Studio 10', 'morning_show', 'Sarah Harris', 'morning', 200000, 60, 250, 100, 600, 300, 1800, 3, 'Morning panel show covering news and pop culture', ARRAY[1,2,3,4,5]),
('ce51109b-0988-4abd-a1c0-1fc02ced1a0d', 'Weekend Sunrise', 'morning_show', 'Matt Doran', 'morning', 300000, 80, 350, 150, 800, 400, 2200, 5, 'Weekend edition of Australia''s favourite breakfast show', ARRAY[6,7]),
('ce51109b-0988-4abd-a1c0-1fc02ced1a0d', 'Music Hour Live', 'music_special', 'Ricki-Lee Coulter', 'prime_time', 350000, 150, 600, 300, 1400, 600, 4000, 15, 'Live music performances and artist interviews', ARRAY[6]),

-- BRAZIL
('f76b7058-d85e-4ce1-b003-96bbafac6d22', 'Fantástico', 'variety', 'Poliana Abritta', 'prime_time', 800000, 200, 800, 400, 2000, 800, 6000, 20, 'Brazil''s biggest Sunday night variety show', ARRAY[7]),
('f76b7058-d85e-4ce1-b003-96bbafac6d22', 'Altas Horas', 'late_night', 'Serginho Groisman', 'late_night', 500000, 150, 600, 300, 1500, 600, 4500, 15, 'Late night music and interview show with live performances', ARRAY[6]),
('f76b7058-d85e-4ce1-b003-96bbafac6d22', 'Encontro', 'morning_show', 'Patrícia Poeta', 'morning', 600000, 100, 450, 200, 1000, 500, 3000, 8, 'Brazil''s top morning show with celebrity guests', ARRAY[1,2,3,4,5]),
('4ffc1c3e-410a-4669-a2da-0cbcca7c9e94', 'Programa do Ratinho', 'variety', 'Ratinho', 'prime_time', 400000, 100, 400, 200, 1000, 400, 3000, 10, 'Popular entertainment and variety show', ARRAY[1,2,3,4]),
('4ffc1c3e-410a-4669-a2da-0cbcca7c9e94', 'The Noite', 'late_night', 'Danilo Gentili', 'late_night', 350000, 120, 500, 250, 1200, 500, 3500, 12, 'Brazil''s edgy late night talk show', ARRAY[1,2,3,4]),

-- CANADA
('67f753e2-f8ff-40b7-b6fc-f616a50365a3', 'Q with Tom Power', 'talk_show', 'Tom Power', 'afternoon', 280000, 100, 450, 200, 1000, 500, 3500, 10, 'Canada''s premier arts and culture interview show', ARRAY[1,2,3,4,5]),
('67f753e2-f8ff-40b7-b6fc-f616a50365a3', 'CBC Music Festival', 'music_special', NULL, 'prime_time', 350000, 150, 600, 300, 1500, 600, 4000, 15, 'Live music festival broadcast featuring Canadian talent', ARRAY[6]),
('4fa069e8-51c8-47a4-86a7-6030692d0254', 'Your Morning', 'morning_show', 'Ben Mulroney', 'morning', 400000, 80, 350, 150, 800, 400, 2500, 5, 'Canada''s number one morning show', ARRAY[1,2,3,4,5]),
('4fa069e8-51c8-47a4-86a7-6030692d0254', 'The Social', 'talk_show', 'Lainey Lui', 'afternoon', 250000, 80, 300, 150, 700, 350, 2000, 5, 'Daytime panel talk show covering pop culture', ARRAY[1,2,3,4,5]),

-- FRANCE
('d786e428-315c-4ace-82d0-a6e102c81afb', 'Quotidien', 'talk_show', 'Yann Barthès', 'prime_time', 500000, 150, 600, 300, 1500, 600, 5000, 15, 'France''s sharpest daily entertainment and news show', ARRAY[1,2,3,4,5]),
('d786e428-315c-4ace-82d0-a6e102c81afb', 'Clique', 'late_night', 'Mouloud Achour', 'late_night', 300000, 120, 500, 250, 1200, 500, 3500, 12, 'Late night culture and music talk show', ARRAY[1,2,3,4]),
('d0bd6b74-66c2-421b-a2b1-89f3ec00d33a', 'Taratata', 'music_special', 'Nagui', 'prime_time', 450000, 180, 700, 350, 1800, 700, 5000, 18, 'Legendary French music performance show', ARRAY[5]),
('d0bd6b74-66c2-421b-a2b1-89f3ec00d33a', 'Télématin', 'morning_show', 'Thomas Sotto', 'morning', 500000, 80, 350, 150, 800, 400, 2500, 5, 'France''s flagship morning news and culture show', ARRAY[1,2,3,4,5]),
('84ebe922-05ed-43e2-9f97-4e4ee8fffd8e', 'The Voice France', 'entertainment', 'Nikos Aliagas', 'prime_time', 700000, 200, 800, 400, 2000, 800, 6000, 20, 'France''s biggest music talent competition', ARRAY[6]),
('84ebe922-05ed-43e2-9f97-4e4ee8fffd8e', 'Star Academy', 'entertainment', 'Nikos Aliagas', 'prime_time', 600000, 180, 700, 350, 1800, 700, 5500, 18, 'Iconic music reality competition show', ARRAY[6]),
('84ebe922-05ed-43e2-9f97-4e4ee8fffd8e', 'Sept à Huit', 'variety', 'Harry Roselmack', 'prime_time', 550000, 120, 500, 250, 1200, 500, 3500, 10, 'Sunday evening magazine show', ARRAY[7]),

-- GERMANY
('1e7420d6-3e80-44c3-9fc4-bf3778460d62', 'Morgenmagazin', 'morning_show', 'Dunja Hayali', 'morning', 400000, 80, 350, 150, 800, 400, 2500, 5, 'Germany''s top morning news magazine', ARRAY[1,2,3,4,5]),
('1e7420d6-3e80-44c3-9fc4-bf3778460d62', 'Inas Nacht', 'late_night', 'Ina Müller', 'late_night', 350000, 150, 600, 300, 1500, 600, 4000, 15, 'Late night music and interview show in a bar setting', ARRAY[5]),
('def983c9-bc44-4762-9002-6ec22ee7ddcf', 'TV total', 'late_night', 'Sebastian Pufpaff', 'late_night', 500000, 150, 600, 300, 1500, 600, 4500, 12, 'Germany''s biggest late night entertainment show', ARRAY[3]),
('def983c9-bc44-4762-9002-6ec22ee7ddcf', 'Schlag den Star', 'entertainment', 'Elton', 'prime_time', 450000, 120, 500, 250, 1200, 500, 3500, 10, 'Prime time entertainment challenge show', ARRAY[6]),
('82ac424c-6164-4bec-a865-78396aff611f', 'Guten Morgen Deutschland', 'morning_show', 'Jan Hahn', 'morning', 350000, 80, 300, 150, 700, 350, 2000, 3, 'RTL''s morning show with news and entertainment', ARRAY[1,2,3,4,5]),
('82ac424c-6164-4bec-a865-78396aff611f', 'stern TV', 'talk_show', 'Steffen Hallaschka', 'prime_time', 400000, 120, 500, 250, 1200, 500, 4000, 12, 'Investigative magazine and interview show', ARRAY[3]),
('39345947-63b0-4aa5-b6fc-3691c0353b62', 'Wetten, dass..?', 'entertainment', 'Thomas Gottschalk', 'prime_time', 800000, 250, 1000, 500, 2500, 1000, 8000, 25, 'Germany''s legendary prime time entertainment spectacular', ARRAY[6]),
('39345947-63b0-4aa5-b6fc-3691c0353b62', 'ZDF Morgenmagazin', 'morning_show', 'Dunja Hayali', 'morning', 400000, 80, 350, 150, 800, 400, 2500, 5, 'Germany''s public broadcaster morning show', ARRAY[1,2,3,4,5]),
('39345947-63b0-4aa5-b6fc-3691c0353b62', 'Markus Lanz', 'talk_show', 'Markus Lanz', 'late_night', 500000, 150, 600, 300, 1500, 600, 4500, 15, 'Germany''s most influential late night interview show', ARRAY[2,3,4]),

-- IRELAND
('a5a67637-663b-4918-911b-7f5c5cf4fc94', 'The Late Late Show', 'late_night', 'Patrick Kielty', 'late_night', 500000, 200, 800, 400, 2000, 800, 6000, 18, 'Ireland''s longest-running and most-watched chat show', ARRAY[5]),
('a5a67637-663b-4918-911b-7f5c5cf4fc94', 'The Tommy Tiernan Show', 'talk_show', 'Tommy Tiernan', 'prime_time', 350000, 150, 600, 300, 1500, 600, 4000, 12, 'Unscripted interviews with surprise guests', ARRAY[6]),
('a5a67637-663b-4918-911b-7f5c5cf4fc94', 'Other Voices', 'music_special', NULL, 'prime_time', 200000, 180, 700, 350, 1800, 500, 3500, 15, 'Intimate live music sessions from Dingle, Ireland', ARRAY[7]),

-- ITALY
('6c8b681b-2501-4ec8-a369-c477e7a037ea', 'Che Tempo Che Fa', 'talk_show', 'Fabio Fazio', 'prime_time', 600000, 200, 800, 400, 2000, 800, 6000, 20, 'Italy''s biggest Sunday night talk show', ARRAY[7]),
('6c8b681b-2501-4ec8-a369-c477e7a037ea', 'Unomattina', 'morning_show', 'Massimiliano Ossini', 'morning', 400000, 80, 350, 150, 800, 400, 2500, 5, 'Rai''s flagship morning show', ARRAY[1,2,3,4,5]),
('b6812dd6-ef42-4dff-872a-984ff7ecb426', 'Amici', 'entertainment', 'Maria De Filippi', 'prime_time', 700000, 200, 800, 400, 2000, 800, 6000, 20, 'Italy''s biggest music and dance talent show', ARRAY[6]),
('b6812dd6-ef42-4dff-872a-984ff7ecb426', 'Verissimo', 'talk_show', 'Silvia Toffanin', 'afternoon', 450000, 120, 500, 250, 1200, 500, 4000, 10, 'Celebrity interview show on Canale 5', ARRAY[6,7]),
('3af33cfb-7a99-435e-a7cd-0e76c4e94786', 'Le Iene', 'entertainment', 'Nicola Savino', 'prime_time', 500000, 150, 600, 300, 1500, 600, 4500, 12, 'Investigative entertainment show with celebrity segments', ARRAY[2]),
('3af33cfb-7a99-435e-a7cd-0e76c4e94786', 'Mattino Cinque', 'morning_show', 'Francesco Vecchi', 'morning', 350000, 80, 300, 150, 700, 350, 2000, 3, 'Morning news and entertainment show', ARRAY[1,2,3,4,5]),

-- JAPAN
('8caa92f2-749b-41db-aa87-0354e4fcbb14', 'Hey! Hey! Hey! Music Champ', 'music_special', 'Downtown', 'prime_time', 600000, 200, 800, 400, 2000, 800, 6000, 20, 'Legendary Japanese music performance and talk show', ARRAY[1]),
('8caa92f2-749b-41db-aa87-0354e4fcbb14', 'Love Music', 'music_special', 'Naoto Inti Raymi', 'prime_time', 350000, 150, 600, 300, 1500, 600, 4000, 12, 'Music variety show with live performances', ARRAY[7]),
('8caa92f2-749b-41db-aa87-0354e4fcbb14', 'Mezamashi TV', 'morning_show', 'Keisuke Miyake', 'morning', 500000, 80, 350, 150, 800, 400, 2500, 5, 'Fuji TV''s popular morning show', ARRAY[1,2,3,4,5]),
('49abecfa-3220-49a5-91ec-6729cbd267a4', 'Kohaku Uta Gassen', 'music_special', NULL, 'prime_time', 1000000, 300, 1200, 600, 3000, 1200, 10000, 30, 'Japan''s legendary New Year''s Eve music battle', ARRAY[7]),
('49abecfa-3220-49a5-91ec-6729cbd267a4', 'Songs', 'music_special', NULL, 'prime_time', 300000, 120, 500, 250, 1200, 500, 3500, 10, 'NHK''s weekly music performance showcase', ARRAY[6]),

-- NETHERLANDS
('72e968c4-02e2-44bf-bfb3-8f4315511e18', 'RTL Late Night', 'late_night', 'Humberto Tan', 'late_night', 300000, 120, 500, 250, 1200, 500, 3500, 10, 'Netherlands'' premier late night talk show', ARRAY[1,2,3,4]),
('72e968c4-02e2-44bf-bfb3-8f4315511e18', 'The Voice of Holland', 'entertainment', 'Martijn Krabbé', 'prime_time', 500000, 180, 700, 350, 1800, 700, 5000, 18, 'The original Voice format - Dutch music talent show', ARRAY[5]),
('72e968c4-02e2-44bf-bfb3-8f4315511e18', 'RTL Boulevard', 'entertainment', 'Luuk Ikink', 'prime_time', 400000, 80, 350, 150, 800, 400, 2500, 5, 'Daily entertainment news and celebrity gossip', ARRAY[1,2,3,4,5]),

-- NORWAY
('c6b9d359-6197-4d53-932e-6b5450021be6', 'God Morgen Norge', 'morning_show', 'Petter Schjerven', 'morning', 250000, 80, 300, 150, 700, 350, 2000, 3, 'Norway''s favourite morning show', ARRAY[1,2,3,4,5]),
('c6b9d359-6197-4d53-932e-6b5450021be6', 'Senkveld', 'late_night', 'Stian Blipp', 'late_night', 350000, 150, 600, 300, 1500, 600, 4000, 12, 'Norway''s biggest late night entertainment show', ARRAY[5]),
('c6b9d359-6197-4d53-932e-6b5450021be6', 'Hver Gang Vi Møtes', 'music_special', NULL, 'prime_time', 400000, 180, 700, 350, 1800, 700, 5000, 15, 'Artists swap and perform each other''s songs', ARRAY[7]),

-- SOUTH KOREA
('fc4729e2-4aad-4d6b-ba82-01509605396d', 'Music Bank', 'music_special', NULL, 'prime_time', 600000, 200, 800, 400, 2000, 800, 6000, 18, 'Korea''s premier weekly music chart show', ARRAY[5]),
('fc4729e2-4aad-4d6b-ba82-01509605396d', 'Happy Together', 'variety', 'Yoo Jae-suk', 'prime_time', 500000, 150, 600, 300, 1500, 600, 4500, 15, 'Celebrity variety and talk show', ARRAY[4]),
('fc4729e2-4aad-4d6b-ba82-01509605396d', 'Entertainment Weekly', 'entertainment', NULL, 'afternoon', 350000, 100, 400, 200, 1000, 400, 3000, 8, 'Weekly entertainment news and celebrity interviews', ARRAY[6]),
('c2184e83-0faa-4912-b450-eb04c2757b70', 'Show! Music Core', 'music_special', NULL, 'afternoon', 550000, 180, 700, 350, 1800, 700, 5500, 18, 'Weekly K-pop live performance chart show', ARRAY[6]),
('c2184e83-0faa-4912-b450-eb04c2757b70', 'Radio Star', 'talk_show', 'Kim Gura', 'prime_time', 450000, 150, 600, 300, 1500, 600, 4500, 12, 'Celebrity talk show with candid conversations', ARRAY[3]),
('c2184e83-0faa-4912-b450-eb04c2757b70', 'Hangout with Yoo', 'variety', 'Yoo Jae-suk', 'prime_time', 500000, 150, 600, 300, 1500, 600, 4500, 15, 'Variety show where host takes on different personas', ARRAY[6]),

-- SPAIN
('8d2a59e0-8a24-42dd-9a9a-db5688fc0b4b', 'El Hormiguero', 'talk_show', 'Pablo Motos', 'prime_time', 600000, 200, 800, 400, 2000, 800, 6000, 18, 'Spain''s biggest entertainment talk show', ARRAY[1,2,3,4]),
('8d2a59e0-8a24-42dd-9a9a-db5688fc0b4b', 'Tu Cara Me Suena', 'entertainment', 'Manel Fuentes', 'prime_time', 500000, 150, 600, 300, 1500, 600, 4500, 15, 'Celebrity impressions music show', ARRAY[5]),
('9e8ec2b4-2733-4d46-a268-7649ac829a2a', 'La Resistencia', 'late_night', 'David Broncano', 'late_night', 450000, 150, 600, 300, 1500, 600, 4500, 12, 'Spain''s most talked-about late night show', ARRAY[1,2,3,4]),
('9e8ec2b4-2733-4d46-a268-7649ac829a2a', 'Operación Triunfo', 'entertainment', NULL, 'prime_time', 700000, 200, 800, 400, 2000, 800, 6000, 20, 'Spain''s iconic music talent competition', ARRAY[7]),
('9e8ec2b4-2733-4d46-a268-7649ac829a2a', 'La Hora de La 1', 'morning_show', 'Silvia Intxaurrondo', 'morning', 350000, 80, 300, 150, 700, 350, 2000, 3, 'TVE''s morning news and entertainment show', ARRAY[1,2,3,4,5]),

-- SWEDEN
('68e04c68-f490-4b96-a206-332439988951', 'Skavlan', 'talk_show', 'Fredrik Skavlan', 'prime_time', 400000, 150, 600, 300, 1500, 600, 4500, 15, 'Scandinavia''s biggest talk show', ARRAY[5]),
('68e04c68-f490-4b96-a206-332439988951', 'Melodifestivalen', 'music_special', 'Petra Mede', 'prime_time', 600000, 250, 1000, 500, 2500, 1000, 8000, 20, 'Sweden''s massive Eurovision selection show', ARRAY[6]),
('68e04c68-f490-4b96-a206-332439988951', 'Go''kväll', 'entertainment', NULL, 'prime_time', 250000, 80, 300, 150, 700, 350, 2000, 5, 'SVT''s daily evening magazine show', ARRAY[1,2,3,4,5]),
('94862658-861c-4f3f-91c7-bf9e921e99b1', 'Idol Sverige', 'entertainment', 'Kattis Ahlström', 'prime_time', 450000, 180, 700, 350, 1800, 700, 5500, 15, 'Sweden''s music talent competition', ARRAY[5]),
('94862658-861c-4f3f-91c7-bf9e921e99b1', 'Bingolotto', 'variety', 'Rickard Olsson', 'prime_time', 350000, 100, 400, 200, 1000, 400, 3000, 8, 'Sweden''s beloved variety and game show with musical guests', ARRAY[6]),

-- GLOBAL STREAMING
('c4b47507-669b-4ca6-82f0-c7d1b12669e4', 'Song Exploder', 'music_special', 'Hrishikesh Hirway', 'prime_time', 800000, 200, 800, 400, 2000, 800, 7000, 20, 'Artists break down how their hit songs were made', ARRAY[1,2,3,4,5,6,7]),
('c4b47507-669b-4ca6-82f0-c7d1b12669e4', 'Rhythm + Flow', 'entertainment', NULL, 'prime_time', 900000, 250, 1000, 500, 2500, 1000, 8000, 25, 'Hip-hop music competition show', ARRAY[1,2,3,4,5,6,7]),
('3748596a-064e-4baf-bf6b-d18b28ceb079', 'The Tiny Desk Concert', 'music_special', 'Bob Boilen', 'afternoon', 700000, 200, 800, 400, 2000, 700, 5500, 18, 'Intimate stripped-back performances at a desk', ARRAY[1,2,3,4,5]),
('3748596a-064e-4baf-bf6b-d18b28ceb079', 'Remastered', 'entertainment', NULL, 'prime_time', 500000, 150, 600, 300, 1500, 600, 4500, 15, 'Documentary series exploring iconic music moments', ARRAY[1,2,3,4,5,6,7]),
('44ae33f8-d1fe-48f7-b8c6-e3e7e90485b8', 'Carpool Karaoke', 'entertainment', NULL, 'prime_time', 600000, 180, 700, 350, 1800, 700, 5500, 15, 'Celebrities sing their hits while driving', ARRAY[1,2,3,4,5,6,7]),
('44ae33f8-d1fe-48f7-b8c6-e3e7e90485b8', 'The Sessions', 'music_special', NULL, 'prime_time', 400000, 150, 600, 300, 1500, 600, 4500, 12, 'Exclusive live music sessions with top artists', ARRAY[1,2,3,4,5,6,7]),
('77b5e2de-b007-49d0-88ef-3c6a603b1094', 'Disney Music Showcase', 'music_special', NULL, 'prime_time', 500000, 150, 600, 300, 1500, 600, 5000, 15, 'Special music performances and artist features', ARRAY[1,2,3,4,5,6,7]),
('77b5e2de-b007-49d0-88ef-3c6a603b1094', 'Soundstage Live', 'entertainment', NULL, 'prime_time', 400000, 120, 500, 250, 1200, 500, 4000, 10, 'Behind the scenes with top recording artists', ARRAY[1,2,3,4,5,6,7]),
('e7054e6f-09db-491b-8c90-84053f1f573d', 'Behind the Music', 'entertainment', NULL, 'prime_time', 450000, 150, 600, 300, 1500, 600, 4500, 12, 'Classic documentary series on music legends', ARRAY[1,2,3,4,5,6,7]),
('e7054e6f-09db-491b-8c90-84053f1f573d', 'MTV Unplugged Revival', 'music_special', NULL, 'prime_time', 600000, 200, 800, 400, 2000, 800, 6000, 18, 'Acoustic performances by top artists', ARRAY[1,2,3,4,5,6,7]),

-- UK NETWORKS WITHOUT SHOWS
('7b67690a-db61-4c55-9ae0-1f4c5ef963b0', 'The Sport & Music Hour', 'entertainment', 'Mark Sheridan', 'prime_time', 200000, 80, 300, 150, 700, 350, 2000, 5, 'Where sport meets music culture', ARRAY[5]),
('e5ddd3a9-7e1f-415b-a324-2a5455f64c6b', 'Soundtrack Sessions', 'music_special', NULL, 'prime_time', 180000, 100, 400, 200, 1000, 400, 3000, 8, 'Exploring the music behind iconic films', ARRAY[6]),
('b9aeb781-3b3d-4fd5-afbd-d6bfdafa091b', 'Musical Theatres', 'entertainment', NULL, 'prime_time', 150000, 80, 300, 150, 700, 350, 2000, 5, 'Musical theatre performances and interviews', ARRAY[7]),
('fe5a4c93-7ffd-4d58-b56e-ea0a648c78f5', 'The Wright Stuff', 'morning_show', 'Jeremy Vine', 'morning', 250000, 60, 250, 100, 600, 300, 1800, 3, 'Morning debate and entertainment show', ARRAY[1,2,3,4,5]),
('fe5a4c93-7ffd-4d58-b56e-ea0a648c78f5', 'Live Music Night', 'music_special', NULL, 'prime_time', 200000, 100, 400, 200, 1000, 400, 3000, 8, 'Weekly live music performances', ARRAY[6]),

-- MORE US SHOWS
('ff67467b-9bdb-4d71-a8f0-d96282651a65', 'Austin City Limits', 'music_special', NULL, 'prime_time', 400000, 180, 700, 350, 1800, 700, 5500, 15, 'Legendary live music showcase from Austin, Texas', ARRAY[6]),
('48a5523d-f03a-42bc-8ebe-bceec1681b74', 'The Masked Singer', 'entertainment', 'Nick Cannon', 'prime_time', 800000, 200, 800, 400, 2000, 800, 7000, 20, 'Costumed celebrity singing competition', ARRAY[3]),
('af4f13ae-49e0-436e-99cd-a5dc94b916f6', 'Sonic Highways', 'music_special', 'Dave Grohl', 'prime_time', 500000, 200, 800, 400, 2000, 800, 6000, 18, 'Documentary music series exploring American music cities', ARRAY[7]);
