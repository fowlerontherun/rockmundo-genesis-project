
-- 1. Add logo_url to radio_stations
ALTER TABLE radio_stations ADD COLUMN IF NOT EXISTS logo_url text;

-- 2. Bulk-complete stuck modeling contracts
UPDATE player_modeling_contracts 
SET status = 'completed', completed_at = now() 
WHERE status = 'accepted' AND shoot_date < CURRENT_DATE;

-- 3. Rename generic "City FM" stations
UPDATE radio_stations SET name = 'Radio Oranje 94.3' WHERE name = 'Amsterdam FM';
UPDATE radio_stations SET name = 'Helios Radio' WHERE name = 'Athens FM';
UPDATE radio_stations SET name = 'Pacific Groove 97.1' WHERE name = 'Auckland FM';
UPDATE radio_stations SET name = 'Lone Star Beats' WHERE name = 'Austin FM';
UPDATE radio_stations SET name = 'Siam Sound 101.5' WHERE name = 'Bangkok FM';
UPDATE radio_stations SET name = 'Radio Catalonia' WHERE name = 'Barcelona FM';
UPDATE radio_stations SET name = 'Dragon City Radio' WHERE name = 'Beijing FM';
UPDATE radio_stations SET name = 'Brumbeat Radio' WHERE name = 'Birmingham FM';
UPDATE radio_stations SET name = 'Radio Cumbia 99.7' WHERE name = 'Bogotá FM';
UPDATE radio_stations SET name = 'Radio Bruxelles' WHERE name = 'Brussels FM';
UPDATE radio_stations SET name = 'Radio Duna 89.7' WHERE name = 'Budapest FM';
UPDATE radio_stations SET name = 'Radio Tango 98.3' WHERE name = 'Buenos Aires FM';
UPDATE radio_stations SET name = 'Nile Beats Radio' WHERE name = 'Cairo FM';
UPDATE radio_stations SET name = 'Table Mountain Radio' WHERE name = 'Cape Town FM';
UPDATE radio_stations SET name = 'Windy City Sound' WHERE name = 'Chicago FM';
UPDATE radio_stations SET name = 'Domkölsch Radio' WHERE name = 'Cologne FM';
UPDATE radio_stations SET name = 'Nordic Waves 92.8' WHERE name = 'Copenhagen FM';
UPDATE radio_stations SET name = 'Radio Dilli' WHERE name = 'Delhi FM';
UPDATE radio_stations SET name = 'Motor City Grooves' WHERE name = 'Detroit FM';
UPDATE radio_stations SET name = 'Desert Gold Radio' WHERE name = 'Dubai FM';
UPDATE radio_stations SET name = 'Radio Éire 102.3' WHERE name = 'Dublin FM';
UPDATE radio_stations SET name = 'Castle Rock Radio' WHERE name = 'Edinburgh FM';
UPDATE radio_stations SET name = 'Celtic Sound Radio' WHERE name = 'Glasgow FM';
UPDATE radio_stations SET name = 'Hafen Radio 96.1' WHERE name = 'Hamburg FM';
UPDATE radio_stations SET name = 'Suomi Sound' WHERE name = 'Helsinki FM';
UPDATE radio_stations SET name = 'Harbour Radio 97.4' WHERE name = 'Hong Kong FM';
UPDATE radio_stations SET name = 'Bosphorus Radio' WHERE name = 'Istanbul FM';
UPDATE radio_stations SET name = 'Nusantara Radio' WHERE name = 'Jakarta FM';
UPDATE radio_stations SET name = 'Jozi Vibes 95.5' WHERE name = 'Johannesburg FM';
UPDATE radio_stations SET name = 'Wawel Radio' WHERE name = 'Krakow FM';
UPDATE radio_stations SET name = 'Afrobeat Radio Lagos' WHERE name = 'Lagos FM';
UPDATE radio_stations SET name = 'Neon City Radio' WHERE name = 'Las Vegas FM';
UPDATE radio_stations SET name = 'Radio Sol Lima' WHERE name = 'Lima FM';
UPDATE radio_stations SET name = 'Radio Fado 91.2' WHERE name = 'Lisbon FM';
UPDATE radio_stations SET name = 'Radio Rhône' WHERE name = 'Lyon FM';
UPDATE radio_stations SET name = 'Radio Flamenca 100.3' WHERE name = 'Madrid FM';
UPDATE radio_stations SET name = 'Bayside Radio' WHERE name = 'Manila FM';
UPDATE radio_stations SET name = 'Radio Méditerranée' WHERE name = 'Marseille FM';
UPDATE radio_stations SET name = 'Southern Cross Radio' WHERE name = 'Melbourne FM';
UPDATE radio_stations SET name = 'Radio Azteca 103.5' WHERE name = 'Mexico City FM';
UPDATE radio_stations SET name = 'Radio Milano' WHERE name = 'Milan FM';
UPDATE radio_stations SET name = 'Radio Montréal 96.9' WHERE name = 'Montreal FM';
UPDATE radio_stations SET name = 'Radio Moskva' WHERE name = 'Moscow FM';
UPDATE radio_stations SET name = 'Radio Bollywood' WHERE name = 'Mumbai FM';
UPDATE radio_stations SET name = 'Bayern Beats' WHERE name = 'Munich FM';
UPDATE radio_stations SET name = 'Savanna Radio' WHERE name = 'Nairobi FM';
UPDATE radio_stations SET name = 'Music Row Radio' WHERE name = 'Nashville FM';
UPDATE radio_stations SET name = 'Kansai Beats' WHERE name = 'Osaka FM';
UPDATE radio_stations SET name = 'Fjord Radio 93.6' WHERE name = 'Oslo FM';
UPDATE radio_stations SET name = 'Rose City Radio' WHERE name = 'Portland FM';
UPDATE radio_stations SET name = 'Radio Bohemia' WHERE name = 'Prague FM';
UPDATE radio_stations SET name = 'Radio Carioca' WHERE name = 'Rio de Janeiro FM';
UPDATE radio_stations SET name = 'Radio Colosseum' WHERE name = 'Rome FM';
UPDATE radio_stations SET name = 'Europoort Radio' WHERE name = 'Rotterdam FM';
UPDATE radio_stations SET name = 'Golden Gate Radio' WHERE name = 'San Francisco FM';
UPDATE radio_stations SET name = 'Radio Andina' WHERE name = 'Santiago FM';
UPDATE radio_stations SET name = 'Radio Paulista 104.7' WHERE name = 'São Paulo FM';
UPDATE radio_stations SET name = 'Emerald City Sound' WHERE name = 'Seattle FM';
UPDATE radio_stations SET name = 'K-Wave Radio' WHERE name = 'Seoul FM';
UPDATE radio_stations SET name = 'Dragon City 88.8' WHERE name = 'Shanghai FM';
UPDATE radio_stations SET name = 'Lion City Radio' WHERE name = 'Singapore FM';
UPDATE radio_stations SET name = 'Scandi Pop Radio' WHERE name = 'Stockholm FM';
UPDATE radio_stations SET name = 'Harbour City Radio' WHERE name = 'Sydney FM';
UPDATE radio_stations SET name = 'Formosa Radio' WHERE name = 'Taipei FM';
UPDATE radio_stations SET name = 'Radio Canada Sound' WHERE name = 'Toronto FM';
UPDATE radio_stations SET name = 'Pacific Sound 101.3' WHERE name = 'Vancouver FM';
UPDATE radio_stations SET name = 'Wiener Klassik Radio' WHERE name = 'Vienna FM';
UPDATE radio_stations SET name = 'Radio Chopin' WHERE name = 'Warsaw FM';

-- 4. Seed radio stations for 64 cities (ALL 'local' station_type to satisfy constraints)
INSERT INTO radio_stations (name, station_type, country, city_id, quality_level, listener_base, accepted_genres, frequency, is_active, description) VALUES
('Highlife Radio Accra','local','Ghana','3d6ec59a-ba47-40ed-8eaa-81af1d592997',3,45000,ARRAY['afrobeat','highlife','hip_hop','dancehall'],'95.3 FM',true,'Ghana''s home of highlife and afrobeat'),
('Gold Coast Beats','local','Ghana','3d6ec59a-ba47-40ed-8eaa-81af1d592997',2,28000,ARRAY['hip_hop','dancehall','pop','afrobeat'],'101.7 FM',true,'Contemporary hits from West Africa'),
('Radio Abyssinia','local','Ethiopia','8fa293ec-71be-4fee-ac43-5c3fd644bc92',3,52000,ARRAY['world','jazz','soul','folk'],'93.5 FM',true,'Ethiopian music and world sounds'),
('Addis Beats 99.1','local','Ethiopia','8fa293ec-71be-4fee-ac43-5c3fd644bc92',2,35000,ARRAY['hip_hop','pop','r_and_b','dancehall'],'99.1 FM',true,'Modern urban sounds of Addis'),
('Radio Antwerpen','local','Belgium','ddedc03d-0226-479e-b8c0-0720efce73d9',3,42000,ARRAY['electronic','indie','pop','rock'],'97.2 FM',true,'Belgium''s indie and electronic hub'),
('Diamond City Radio','local','Belgium','ddedc03d-0226-479e-b8c0-0720efce73d9',2,25000,ARRAY['hip_hop','r_and_b','pop','dance'],'103.8 FM',true,'Urban beats from the diamond district'),
('Peachtree Radio 94.1','local','United States','872150e0-6fa6-4150-b622-b0f8e60ea6fb',4,185000,ARRAY['hip_hop','r_and_b','trap','soul'],'94.1 FM',true,'Atlanta''s home of hip-hop and R&B'),
('ATL Underground','local','United States','872150e0-6fa6-4150-b622-b0f8e60ea6fb',3,65000,ARRAY['hip_hop','trap','electronic','experimental'],'88.5 FM',true,'Underground sounds from the A'),
('Belfast Sound 97.4','local','United Kingdom','96e8e64a-11af-4f9c-a018-9ff9e4c6fd13',3,48000,ARRAY['rock','indie','folk','punk'],'97.4 FM',true,'Northern Ireland''s alternative music station'),
('Radio Ulster Beats','local','United Kingdom','96e8e64a-11af-4f9c-a018-9ff9e4c6fd13',2,32000,ARRAY['pop','rock','dance','folk'],'104.1 FM',true,'The best of Belfast and beyond'),
('Radio Beograd Zvuk','local','Serbia','671b4df4-bd98-41b4-9a40-f7b8bc191556',3,55000,ARRAY['rock','electronic','pop','folk'],'96.3 FM',true,'Belgrade''s eclectic music mix'),
('Danube Beats','local','Serbia','671b4df4-bd98-41b4-9a40-f7b8bc191556',2,28000,ARRAY['electronic','techno','house','experimental'],'89.7 FM',true,'Electronic music from the Balkans'),
('Berlin Techno Puls','local','Germany','cc1fd801-c4b3-448f-ad55-f307e10e14a0',5,320000,ARRAY['electronic','techno','house','ambient'],'98.2 FM',true,'The heartbeat of Berlin''s electronic scene'),
('Kreuzberg Radio','local','Germany','cc1fd801-c4b3-448f-ad55-f307e10e14a0',3,75000,ARRAY['punk','indie','hip_hop','experimental'],'91.4 FM',true,'Underground sounds from Kreuzberg'),
('Radio Garonne','local','France','89453217-873a-4764-80d1-0003f3654c65',2,35000,ARRAY['chanson','jazz','indie','electronic'],'94.8 FM',true,'Music from Southwest France'),
('Bordeaux Beats','local','France','89453217-873a-4764-80d1-0003f3654c65',2,22000,ARRAY['hip_hop','electronic','pop','rock'],'101.2 FM',true,'Young urban sounds of Bordeaux'),
('Beantown Radio 92.9','local','United States','37e3030a-2f21-4d37-985c-4660360665ca',4,155000,ARRAY['rock','indie','alternative','punk'],'92.9 FM',true,'New England''s rock station'),
('Harbor Sound','local','United States','37e3030a-2f21-4d37-985c-4660360665ca',3,62000,ARRAY['folk','indie','jazz','classical'],'88.7 FM',true,'Boston''s eclectic mix'),
('Radio Dunaj','local','Slovakia','e349b025-36ee-48b3-8d60-4e1689f176e4',2,32000,ARRAY['pop','rock','electronic','folk'],'95.1 FM',true,'Slovakia''s modern music station'),
('Bratislava Underground','local','Slovakia','e349b025-36ee-48b3-8d60-4e1689f176e4',1,12000,ARRAY['electronic','experimental','indie','punk'],'87.3 FM',true,'Alternative sounds from the capital'),
('Pier Radio 96.3','local','United Kingdom','50a1c6e7-b9ee-44f0-95c4-8453396728ed',3,52000,ARRAY['indie','electronic','alternative','folk'],'96.3 FM',true,'Brighton''s independent music station'),
('Seaside Sounds','local','United Kingdom','50a1c6e7-b9ee-44f0-95c4-8453396728ed',2,18000,ARRAY['electronic','ambient','experimental','dance'],'89.2 FM',true,'Chilled sounds by the sea'),
('River City Radio','local','Australia','e509337e-b523-4f0b-9ce6-10bfb36646b0',3,68000,ARRAY['rock','indie','pop','alternative'],'97.3 FM',true,'Brisbane''s favourite music station'),
('Triple B 105.5','local','Australia','e509337e-b523-4f0b-9ce6-10bfb36646b0',2,42000,ARRAY['hip_hop','electronic','dance','r_and_b'],'105.5 FM',true,'Urban beats from Brisbane'),
('Radio Massive','local','United Kingdom','f3606ebd-278a-4bfc-8023-d9f9ebfedbf5',4,85000,ARRAY['electronic','trip_hop','drum_and_bass','dub'],'93.2 FM',true,'Bristol''s legendary bass music station'),
('Avon Airwaves','local','United Kingdom','f3606ebd-278a-4bfc-8023-d9f9ebfedbf5',2,35000,ARRAY['indie','rock','folk','pop'],'100.7 FM',true,'Indie and alternative from Bristol'),
('Radio București','local','Romania','576da45c-e19e-4a39-aceb-bb39c7a590dc',3,62000,ARRAY['pop','rock','electronic','folk'],'98.8 FM',true,'Bucharest''s vibrant music scene'),
('Carpathian Beats','local','Romania','576da45c-e19e-4a39-aceb-bb39c7a590dc',2,28000,ARRAY['electronic','techno','house','minimal'],'91.5 FM',true,'Romanian electronic music'),
('Dragon Radio Wales','local','United Kingdom','d66d819a-62fa-4594-a796-7e8f5ed53284',3,48000,ARRAY['rock','indie','folk','pop'],'96.8 FM',true,'Music from the Welsh capital'),
('Bay Radio Cardiff','local','United Kingdom','d66d819a-62fa-4594-a796-7e8f5ed53284',2,25000,ARRAY['pop','dance','r_and_b','hip_hop'],'103.4 FM',true,'Cardiff Bay''s hit station'),
('Radio Casablanca','local','Morocco','36271605-d7dc-403f-ab52-2a4b24be774b',3,72000,ARRAY['world','pop','hip_hop','r_and_b'],'94.5 FM',true,'Morocco''s modern music mix'),
('Medina Beats','local','Morocco','36271605-d7dc-403f-ab52-2a4b24be774b',2,35000,ARRAY['world','electronic','hip_hop','folk'],'88.9 FM',true,'Traditional meets modern'),
('Lone Star 97.1','local','United States','f7fc469f-128f-432a-a7be-648054a8e9c3',4,145000,ARRAY['country','rock','pop','blues'],'97.1 FM',true,'Texas'' biggest country and rock station'),
('DFW Urban Radio','local','United States','f7fc469f-128f-432a-a7be-648054a8e9c3',3,78000,ARRAY['hip_hop','r_and_b','pop','trap'],'105.3 FM',true,'Dallas-Fort Worth urban hits'),
('Mile High Radio','local','United States','d49e8af2-a7b2-40a8-8d6b-387dcad56ce3',3,98000,ARRAY['rock','indie','folk','alternative'],'93.3 FM',true,'Colorado''s mountain rock station'),
('Rocky Mountain Sound','local','United States','d49e8af2-a7b2-40a8-8d6b-387dcad56ce3',2,45000,ARRAY['folk','bluegrass','country','indie'],'100.1 FM',true,'Acoustic and folk from the Rockies'),
('Radio Firenze','local','Italy','5bf27728-6561-4d61-97f2-27c91f831a69',3,45000,ARRAY['classical','jazz','pop','opera'],'96.7 FM',true,'Renaissance city, timeless music'),
('Toscana Rock','local','Italy','5bf27728-6561-4d61-97f2-27c91f831a69',2,22000,ARRAY['rock','indie','alternative','punk'],'89.4 FM',true,'Rock and indie from Tuscany'),
('Baltic Radio','local','Poland','753ae437-f34f-4d1b-b108-b8a7179ec44c',2,38000,ARRAY['rock','indie','electronic','pop'],'95.8 FM',true,'Music from Poland''s Baltic coast'),
('Gdańsk Nocą','local','Poland','753ae437-f34f-4d1b-b108-b8a7179ec44c',1,12000,ARRAY['electronic','techno','ambient','experimental'],'87.6 FM',true,'Late night electronic from Gdansk'),
('Göteborgs Radio','local','Sweden','36ee962b-6566-4a81-9218-6e5ea6146d76',3,55000,ARRAY['metal','rock','indie','electronic'],'98.3 FM',true,'Home of Gothenburg metal'),
('West Coast Sound','local','Sweden','36ee962b-6566-4a81-9218-6e5ea6146d76',2,32000,ARRAY['pop','indie','electronic','hip_hop'],'103.1 FM',true,'Sweden''s west coast hits'),
('Radio Habana','local','Cuba','8578bb2c-e742-4d8b-8c5e-78a7e91a80bf',3,68000,ARRAY['latin','jazz','salsa','world'],'94.1 FM',true,'Cuban rhythms and Caribbean jazz'),
('Malecón Radio','local','Cuba','8578bb2c-e742-4d8b-8c5e-78a7e91a80bf',2,35000,ARRAY['reggaeton','hip_hop','pop','dancehall'],'100.5 FM',true,'Modern Cuban music'),
('Saigon Radio','local','Vietnam','66892720-ddd5-4746-9b41-2a29486ed439',3,72000,ARRAY['pop','electronic','hip_hop','world'],'97.6 FM',true,'Vietnam''s modern music station'),
('Mekong Beats','local','Vietnam','66892720-ddd5-4746-9b41-2a29486ed439',2,28000,ARRAY['electronic','indie','rock','folk'],'89.3 FM',true,'Alternative sounds from HCMC'),
('Island Vibes 93.1','local','United States','7a5c736b-82ff-4201-b2ac-8875bf4d78d2',3,52000,ARRAY['reggae','pop','folk','world'],'93.1 FM',true,'Hawaiian island music and reggae'),
('Aloha Radio','local','United States','7a5c736b-82ff-4201-b2ac-8875bf4d78d2',2,32000,ARRAY['rock','surf','indie','pop'],'101.1 FM',true,'Surf rock and laid-back sounds'),
('Space City Radio','local','United States','d9199a5e-b35e-43c7-872f-194aa489eb15',4,165000,ARRAY['hip_hop','r_and_b','country','pop'],'97.9 FM',true,'Houston''s #1 for hip-hop and R&B'),
('Bayou City Beats','local','United States','d9199a5e-b35e-43c7-872f-194aa489eb15',3,72000,ARRAY['country','blues','soul','rock'],'102.9 FM',true,'Southern soul and country'),
('Ibiza Global Radio','local','Spain','82ad6e5d-96a9-40a1-9cfc-b3cc256d1b4a',5,450000,ARRAY['electronic','house','techno','ambient','dance'],'97.6 FM',true,'World-famous electronic music from the White Isle'),
('Pacha Radio','local','Spain','82ad6e5d-96a9-40a1-9cfc-b3cc256d1b4a',4,180000,ARRAY['house','electronic','dance','pop'],'102.8 FM',true,'Club sounds from Ibiza'),
('Yard Radio Kingston','local','Jamaica','eac6911c-26a5-40b5-8775-6c777c0426ad',4,95000,ARRAY['reggae','dancehall','ska','dub'],'94.7 FM',true,'Jamaica''s home of reggae and dancehall'),
('Trenchtown Sound','local','Jamaica','eac6911c-26a5-40b5-8775-6c777c0426ad',3,48000,ARRAY['reggae','hip_hop','dancehall','r_and_b'],'101.3 FM',true,'Roots and culture from Kingston'),
('KL Radio','local','Malaysia','f2686242-d37f-4588-9d63-4655439746dc',3,78000,ARRAY['pop','hip_hop','electronic','r_and_b'],'98.8 FM',true,'Kuala Lumpur''s biggest hits'),
('Petronas Tower Radio','local','Malaysia','f2686242-d37f-4588-9d63-4655439746dc',2,35000,ARRAY['rock','indie','world','electronic'],'91.5 FM',true,'Alternative sounds from Malaysia'),
('Radio Leeds Beat','local','United Kingdom','ab2f6f73-8bd4-4adb-aee4-d123ce1a2cd3',3,55000,ARRAY['indie','rock','electronic','grime'],'95.3 FM',true,'Yorkshire''s best music'),
('White Rose Radio','local','United Kingdom','ab2f6f73-8bd4-4adb-aee4-d123ce1a2cd3',2,28000,ARRAY['pop','dance','r_and_b','hip_hop'],'102.6 FM',true,'Leeds'' hit music station'),
('Mersey Radio','local','United Kingdom','5030bf72-9301-4b8a-80f3-123e72bdb117',4,125000,ARRAY['rock','indie','pop','folk'],'96.7 FM',true,'Liverpool''s legendary music station'),
('Cavern Radio','local','United Kingdom','5030bf72-9301-4b8a-80f3-123e72bdb117',3,55000,ARRAY['rock','indie','alternative','punk'],'89.9 FM',true,'Sounds from the birthplace of The Beatles'),
('Radio Ljubljana','local','Slovenia','7b33e4a4-4d7b-43e8-ad2f-6bcaaba0e5fd',2,28000,ARRAY['rock','electronic','indie','pop'],'94.9 FM',true,'Slovenia''s capital music station'),
('Triple Bridge Radio','local','Slovenia','7b33e4a4-4d7b-43e8-ad2f-6bcaaba0e5fd',1,10000,ARRAY['electronic','experimental','ambient','indie'],'87.1 FM',true,'Alternative sounds from Ljubljana'),
('KROQ LA','local','United States','cb7bdfa8-5558-4ffd-9d0f-235920ac269a',5,850000,ARRAY['rock','alternative','indie','punk'],'106.7 FM',true,'LA''s world-famous rock station'),
('Power 106 LA','local','United States','cb7bdfa8-5558-4ffd-9d0f-235920ac269a',5,720000,ARRAY['hip_hop','r_and_b','trap','pop'],'105.9 FM',true,'LA''s hip-hop powerhouse'),
('KCRW Los Angeles','local','United States','cb7bdfa8-5558-4ffd-9d0f-235920ac269a',5,550000,ARRAY['indie','electronic','world','jazz'],'89.9 FM',true,'Eclectic music and cultural programming'),
('Radio Medina','local','Morocco','3fc7b2d9-2a42-4a4a-8eb6-e8a5a545f9da',2,35000,ARRAY['world','electronic','folk','ambient'],'93.2 FM',true,'Music from the Red City'),
('Jemaa Sound','local','Morocco','3fc7b2d9-2a42-4a4a-8eb6-e8a5a545f9da',1,15000,ARRAY['world','folk','jazz','electronic'],'88.4 FM',true,'Traditional and fusion from Marrakech'),
('Radio Paisa','local','Colombia','5f7fa1ed-863b-4d18-8d06-9f65e09daa6a',3,72000,ARRAY['reggaeton','latin','pop','hip_hop'],'96.5 FM',true,'Medellín''s urban music station'),
('Eternal Spring Radio','local','Colombia','5f7fa1ed-863b-4d18-8d06-9f65e09daa6a',2,38000,ARRAY['rock','indie','folk','electronic'],'100.9 FM',true,'Alternative sounds from Medellín'),
('Beale Street Radio','local','United States','b4d3f32e-d174-4b55-85e3-e37e4f29fe11',4,115000,ARRAY['blues','soul','r_and_b','gospel'],'93.1 FM',true,'Memphis'' home of blues and soul'),
('Bluff City Beats','local','United States','b4d3f32e-d174-4b55-85e3-e37e4f29fe11',3,55000,ARRAY['hip_hop','trap','r_and_b','pop'],'101.1 FM',true,'Modern Memphis sound'),
('Radio 305','local','United States','96c964de-4dbd-4bbe-80b7-6c9f68d4ba32',4,195000,ARRAY['reggaeton','latin','hip_hop','pop'],'99.7 FM',true,'Miami''s #1 Latin and urban station'),
('South Beach Radio','local','United States','96c964de-4dbd-4bbe-80b7-6c9f68d4ba32',4,135000,ARRAY['electronic','house','dance','pop'],'102.7 FM',true,'Miami''s electronic and dance music'),
('The Current MPR','local','United States','a7d3d1ef-ef7f-41c4-aaee-3f1e65be7d70',4,145000,ARRAY['indie','alternative','folk','rock'],'89.3 FM',true,'Minnesota''s legendary indie station'),
('Purple City Radio','local','United States','a7d3d1ef-ef7f-41c4-aaee-3f1e65be7d70',3,68000,ARRAY['funk','soul','r_and_b','hip_hop'],'96.3 FM',true,'Minneapolis funk and soul heritage'),
('Radio Río de la Plata','local','Uruguay','4339663c-897d-4373-99a2-f8b1331f8d44',3,52000,ARRAY['rock','folk','tango','pop'],'95.5 FM',true,'Uruguayan rock and culture'),
('Candombe Radio','local','Uruguay','4339663c-897d-4373-99a2-f8b1331f8d44',2,25000,ARRAY['world','jazz','folk','latin'],'89.1 FM',true,'Traditional and fusion from Uruguay'),
('Radio Vesuvio','local','Italy','43152272-1a25-4cb7-99a9-f3343d87eaf7',3,58000,ARRAY['pop','folk','rock','hip_hop'],'97.3 FM',true,'Neapolitan music and Italian hits'),
('Napoli Underground','local','Italy','43152272-1a25-4cb7-99a9-f3343d87eaf7',2,28000,ARRAY['hip_hop','electronic','rap','trap'],'90.8 FM',true,'Street sounds from Naples'),
('WWOZ New Orleans','local','United States','1af689bb-b396-4e60-9c71-2b788ba8e54f',5,280000,ARRAY['jazz','blues','funk','soul'],'90.7 FM',true,'New Orleans'' legendary jazz station'),
('Bourbon Street Radio','local','United States','1af689bb-b396-4e60-9c71-2b788ba8e54f',3,72000,ARRAY['jazz','blues','r_and_b','funk'],'95.7 FM',true,'Live music from the French Quarter'),
('Hot 97 NYC','local','United States','a6d76b84-df38-4efb-9fc1-4bd882e31d1a',5,1200000,ARRAY['hip_hop','r_and_b','trap','pop'],'97.1 FM',true,'Where hip-hop lives'),
('Z100 New York','local','United States','a6d76b84-df38-4efb-9fc1-4bd882e31d1a',5,950000,ARRAY['pop','dance','r_and_b','electronic'],'100.3 FM',true,'New York''s #1 hit music station'),
('Tyne Radio','local','United Kingdom','efbe74b2-913c-4585-877b-d3ba64f9348f',3,48000,ARRAY['rock','indie','electronic','pop'],'96.2 FM',true,'Newcastle''s best music mix'),
('Geordie Beats','local','United Kingdom','efbe74b2-913c-4585-877b-d3ba64f9348f',2,22000,ARRAY['dance','electronic','grime','hip_hop'],'89.8 FM',true,'Urban beats from Tyneside'),
('Radio Côte d''Azur','local','France','fbab7723-de1d-45b3-98f3-9588ee874e4f',3,48000,ARRAY['pop','jazz','electronic','chanson'],'97.3 FM',true,'Music from the French Riviera'),
('Promenade Radio','local','France','fbab7723-de1d-45b3-98f3-9588ee874e4f',2,22000,ARRAY['electronic','chill','world','ambient'],'91.1 FM',true,'Relaxed Mediterranean sounds'),
('Radio Robin Hood','local','United Kingdom','71bf8418-38af-443d-9e3f-80458b2d04a9',3,42000,ARRAY['rock','indie','electronic','drum_and_bass'],'94.5 FM',true,'Nottingham''s alternative music station'),
('Sherwood Sound','local','United Kingdom','71bf8418-38af-443d-9e3f-80458b2d04a9',2,18000,ARRAY['electronic','bass','grime','experimental'],'87.9 FM',true,'Bass music from the Midlands'),
('Radio Nova Paris','local','France','13d450a9-eab3-430c-b5d1-377e5d3f2539',5,650000,ARRAY['world','electronic','hip_hop','jazz','soul'],'101.5 FM',true,'Paris'' iconic eclectic music station'),
('FIP Radio','local','France','13d450a9-eab3-430c-b5d1-377e5d3f2539',5,520000,ARRAY['jazz','world','classical','chanson'],'105.1 FM',true,'France''s beloved music discovery station'),
('RTRFM Perth','local','Australia','c80a430f-0ff9-40f8-9d07-76c0b3129a69',3,62000,ARRAY['indie','electronic','rock','world'],'92.1 FM',true,'Perth''s independent music station'),
('Swan River Radio','local','Australia','c80a430f-0ff9-40f8-9d07-76c0b3129a69',2,35000,ARRAY['rock','pop','alternative','surf'],'100.3 FM',true,'West Australian sounds'),
('Philly Soul Radio','local','United States','5c8b81fd-519b-4f7b-99e5-0a7d0f7b482f',4,165000,ARRAY['soul','r_and_b','hip_hop','funk'],'100.3 FM',true,'The sound of Philadelphia soul'),
('Liberty Bell Radio','local','United States','5c8b81fd-519b-4f7b-99e5-0a7d0f7b482f',3,68000,ARRAY['rock','indie','alternative','punk'],'88.5 FM',true,'Philly''s rock and indie station'),
('Desert Rock Radio','local','United States','53491e02-545e-4bf9-ba2b-aeb1e4b42d4d',3,95000,ARRAY['rock','alternative','metal','indie'],'98.7 FM',true,'Arizona''s rock station'),
('Cactus Radio','local','United States','53491e02-545e-4bf9-ba2b-aeb1e4b42d4d',2,48000,ARRAY['country','latin','pop','rock'],'103.5 FM',true,'Southwest sounds from Phoenix'),
('Radio Porto','local','Portugal','ec2b9881-20b3-45ea-ae64-3070897873c4',3,52000,ARRAY['fado','rock','indie','electronic'],'95.7 FM',true,'Music from Portugal''s second city'),
('Douro Beats','local','Portugal','ec2b9881-20b3-45ea-ae64-3070897873c4',2,25000,ARRAY['electronic','indie','hip_hop','world'],'89.3 FM',true,'Modern sounds from Porto'),
('Solent Sound','local','United Kingdom','9d09267a-f7e8-4011-9730-538bfc836901',2,32000,ARRAY['rock','pop','indie','folk'],'96.1 FM',true,'Music from the south coast'),
('Naval Radio','local','United Kingdom','9d09267a-f7e8-4011-9730-538bfc836901',1,12000,ARRAY['rock','punk','metal','alternative'],'87.5 FM',true,'Portsmouth''s alternative station'),
('Rás 2 Reykjavik','local','Iceland','06bc729b-7599-4e41-a27a-cbe0e7993a4f',3,35000,ARRAY['indie','electronic','post_rock','ambient'],'93.5 FM',true,'Iceland''s indie and experimental music'),
('Aurora Radio','local','Iceland','06bc729b-7599-4e41-a27a-cbe0e7993a4f',2,18000,ARRAY['electronic','ambient','folk','experimental'],'88.9 FM',true,'Atmospheric sounds from Iceland'),
('Radio Riga','local','Latvia','48074b88-28d5-4f3f-8ec7-bdab5e5b18d6',2,32000,ARRAY['pop','electronic','rock','folk'],'94.3 FM',true,'Latvia''s capital music station'),
('Baltic Club Radio','local','Latvia','48074b88-28d5-4f3f-8ec7-bdab5e5b18d6',2,18000,ARRAY['electronic','house','techno','dance'],'100.5 FM',true,'Club music from the Baltics'),
('91X San Diego','local','United States','c799506e-4c16-4315-a8b1-37da5545c34d',4,135000,ARRAY['rock','alternative','indie','punk'],'91.1 FM',true,'San Diego''s alternative rock station'),
('Bordertown Radio','local','United States','c799506e-4c16-4315-a8b1-37da5545c34d',3,58000,ARRAY['latin','reggae','hip_hop','surf'],'99.7 FM',true,'Border culture and beach vibes'),
('Radio Flamenco','local','Spain','8eda5244-c553-49d2-90ec-6d0eeebb205b',3,58000,ARRAY['flamenco','world','folk','pop'],'95.8 FM',true,'Seville''s flamenco and Andalusian music'),
('Guadalquivir Radio','local','Spain','8eda5244-c553-49d2-90ec-6d0eeebb205b',2,28000,ARRAY['pop','rock','latin','electronic'],'101.3 FM',true,'Contemporary hits from southern Spain'),
('Steel City Radio','local','United Kingdom','83822ef1-93c9-46f0-85d0-de8f3d2433f4',3,48000,ARRAY['electronic','indie','rock','synth_pop'],'95.9 FM',true,'Sheffield''s electronic and indie heritage'),
('Radio Hallam','local','United Kingdom','83822ef1-93c9-46f0-85d0-de8f3d2433f4',2,28000,ARRAY['pop','rock','dance','r_and_b'],'102.1 FM',true,'South Yorkshire''s hit station'),
('Radio Sofia','local','Bulgaria','311c7d45-73a1-49a0-8fd7-6c3c96e61795',2,42000,ARRAY['pop','electronic','rock','folk'],'94.7 FM',true,'Bulgaria''s capital music station'),
('Vitosha Radio','local','Bulgaria','311c7d45-73a1-49a0-8fd7-6c3c96e61795',1,18000,ARRAY['electronic','indie','experimental','ambient'],'88.3 FM',true,'Underground sounds from Sofia'),
('Radio Tallinn','local','Estonia','91626210-1900-46de-99ba-0dd60a2db07d',2,28000,ARRAY['electronic','indie','pop','rock'],'96.1 FM',true,'Estonia''s digital music hub'),
('Baltic Beat','local','Estonia','91626210-1900-46de-99ba-0dd60a2db07d',2,15000,ARRAY['electronic','techno','house','ambient'],'89.7 FM',true,'Electronic music from Estonia'),
('Radio Tel Aviv','local','Israel','d9b7950c-2da7-4a64-932c-40e9ea6f7b6e',4,125000,ARRAY['electronic','pop','hip_hop','world'],'102.3 FM',true,'Israel''s modern music station'),
('Mediterranean Beats','local','Israel','d9b7950c-2da7-4a64-932c-40e9ea6f7b6e',3,55000,ARRAY['electronic','trance','house','world'],'95.5 FM',true,'Tel Aviv''s club and dance music'),
('J-Wave Tokyo','local','Japan','89b8b930-4fce-4776-a470-8943364ea120',5,680000,ARRAY['j_pop','rock','electronic','hip_hop'],'81.3 FM',true,'Tokyo''s premier music station'),
('Shibuya Radio','local','Japan','89b8b930-4fce-4776-a470-8943364ea120',4,180000,ARRAY['indie','electronic','experimental','j_pop'],'89.2 FM',true,'Cutting-edge sounds from Shibuya'),
('Radio Occitanie','local','France','91434342-5b91-4c13-9917-a4629a5f7a67',2,35000,ARRAY['rock','chanson','electronic','folk'],'96.5 FM',true,'Music from the Pink City'),
('FMR Toulouse','local','France','91434342-5b91-4c13-9917-a4629a5f7a67',1,12000,ARRAY['electronic','hip_hop','experimental','world'],'89.1 FM',true,'Free music radio from Toulouse'),
('Radio Vilnius','local','Lithuania','b9629ed6-fb09-47fe-a386-c21d98d2d4a6',2,32000,ARRAY['pop','electronic','rock','indie'],'95.3 FM',true,'Lithuania''s music station'),
('Gediminas Radio','local','Lithuania','b9629ed6-fb09-47fe-a386-c21d98d2d4a6',1,15000,ARRAY['electronic','ambient','indie','folk'],'88.5 FM',true,'Alternative sounds from Vilnius'),
('WPGC DC','local','United States','11001f1b-fc01-4ad4-b8e4-96ec86a1a70c',4,185000,ARRAY['hip_hop','r_and_b','pop','go_go'],'95.5 FM',true,'DC''s hip-hop and R&B station'),
('DC Go-Go Radio','local','United States','11001f1b-fc01-4ad4-b8e4-96ec86a1a70c',3,62000,ARRAY['go_go','funk','soul','hip_hop'],'93.9 FM',true,'Go-go music from the nation''s capital'),
('Radio Zagreb','local','Croatia','e1b66e69-546d-4bc1-9758-d73bfd465929',3,48000,ARRAY['rock','pop','electronic','folk'],'97.1 FM',true,'Croatia''s capital music station'),
('Adriatic Sound','local','Croatia','e1b66e69-546d-4bc1-9758-d73bfd465929',2,22000,ARRAY['electronic','indie','dance','world'],'91.8 FM',true,'Modern sounds from the Adriatic'),
('Radio Züri','local','Switzerland','629766c6-a769-47ae-94fc-8fa6f37d28f1',3,55000,ARRAY['pop','electronic','indie','jazz'],'96.3 FM',true,'Zurich''s modern music mix'),
('Swiss Underground','local','Switzerland','629766c6-a769-47ae-94fc-8fa6f37d28f1',2,25000,ARRAY['electronic','techno','experimental','indie'],'89.7 FM',true,'Underground electronic from Switzerland');
