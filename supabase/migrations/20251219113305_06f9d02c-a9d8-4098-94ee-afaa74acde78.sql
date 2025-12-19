
-- 20 UK labels
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Britpop Revival Records', 'Celebrating the spirit of 90s British rock', '{"Britpop"}', 65, c.name, 12, 50000 FROM cities c WHERE c.name = 'London' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Northern Soul Collective', 'Keeping Northern Soul alive', '{"Soul"}', 58, c.name, 8, 30000 FROM cities c WHERE c.name = 'Manchester' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Celtic Beats', 'Traditional and modern Celtic fusion', '{"Folk"}', 52, c.name, 6, 20000 FROM cities c WHERE c.name = 'Edinburgh' AND c.country = 'United Kingdom' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Garage Nation UK', 'UK Garage and 2-step specialists', '{"UK Garage"}', 70, c.name, 15, 60000 FROM cities c WHERE c.name = 'London' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Bristol Bass Collective', 'Dubstep and bass music pioneers', '{"Dubstep"}', 75, c.name, 10, 70000 FROM cities c WHERE c.name = 'Bristol' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Welsh Dragon Records', 'Showcasing Welsh musical talent', '{"Alternative"}', 45, c.name, 5, 15000 FROM cities c WHERE c.name = 'Cardiff' AND c.country = 'United Kingdom' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Steel City Sounds', 'Sheffield electronic music label', '{"Electronic"}', 68, c.name, 8, 40000 FROM cities c WHERE c.name = 'Sheffield' AND c.country = 'United Kingdom' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Geordie Noise', 'Newcastle rock and indie label', '{"Rock"}', 55, c.name, 7, 25000 FROM cities c WHERE c.name = 'Newcastle' AND c.country = 'United Kingdom' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Yorkshire Grit Records', 'Authentic Northern sound', '{"Indie Rock"}', 60, c.name, 9, 35000 FROM cities c WHERE c.name = 'Leeds' AND c.country = 'United Kingdom' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Thames Valley Music', 'Premium British pop and rock', '{"Pop Rock"}', 72, c.name, 14, 80000 FROM cities c WHERE c.name = 'London' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Midlands Metal', 'Heavy music from the heart of England', '{"Metal"}', 62, c.name, 8, 45000 FROM cities c WHERE c.name = 'Birmingham' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Scottish Highlands Sound', 'Atmospheric music from Scotland', '{"Ambient"}', 48, c.name, 5, 18000 FROM cities c WHERE c.name = 'Edinburgh' AND c.country = 'United Kingdom' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Camden Underground', 'Alternative and punk from Camden', '{"Punk"}', 58, c.name, 10, 32000 FROM cities c WHERE c.name = 'London' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Liverpool Beat Revival', 'Merseybeat for the modern era', '{"Rock"}', 55, c.name, 6, 22000 FROM cities c WHERE c.name = 'Liverpool' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Cornish Wave Records', 'Surf rock and coastal vibes', '{"Surf Rock"}', 40, c.name, 4, 12000 FROM cities c WHERE c.name = 'Bristol' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Brighton Pier Records', 'Eclectic sounds from Brighton', '{"Indie"}', 63, c.name, 9, 38000 FROM cities c WHERE c.name = 'London' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Glasgow Underground', 'Scottish dance music institution', '{"House"}', 78, c.name, 12, 90000 FROM cities c WHERE c.name = 'Glasgow' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'UK Drill Collective', 'Authentic UK drill music', '{"Drill"}', 65, c.name, 8, 55000 FROM cities c WHERE c.name = 'London' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Mancunian Madness', 'Manchester indie and alternative', '{"Indie"}', 60, c.name, 7, 30000 FROM cities c WHERE c.name = 'Manchester' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Leeds City Sound', 'Yorkshire indie and rock', '{"Indie Rock"}', 54, c.name, 6, 24000 FROM cities c WHERE c.name = 'Leeds' AND c.country = 'United Kingdom' LIMIT 1;

-- 20 US labels
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Brooklyn Beats', 'NYC underground hip-hop and R&B', '{"Hip-Hop"}', 72, c.name, 14, 75000 FROM cities c WHERE c.name = 'New York' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Sunset Strip Records', 'LA rock and metal legacy label', '{"Rock"}', 78, c.name, 16, 100000 FROM cities c WHERE c.name = 'Los Angeles' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Windy City Soul', 'Chicago soul and R&B', '{"Soul"}', 65, c.name, 10, 50000 FROM cities c WHERE c.name = 'Chicago' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Texas Twang Records', 'Country and Americana from Texas', '{"Country"}', 60, c.name, 9, 40000 FROM cities c WHERE c.name = 'Nashville' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Silicon Sound', 'Tech-influenced electronic music', '{"Electronic"}', 55, c.name, 7, 35000 FROM cities c WHERE c.name = 'San Francisco' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Motor City Motown', 'Detroit soul revival', '{"Motown"}', 70, c.name, 11, 60000 FROM cities c WHERE c.name = 'Detroit' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Philly Groove Records', 'Philadelphia soul and funk', '{"Funk"}', 62, c.name, 8, 42000 FROM cities c WHERE c.name = 'Philadelphia' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'ATL Trap House', 'Atlanta trap and hip-hop', '{"Trap"}', 75, c.name, 12, 85000 FROM cities c WHERE c.name = 'Atlanta' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Miami Bass Syndicate', 'Miami bass and Latin fusion', '{"Latin"}', 68, c.name, 10, 55000 FROM cities c WHERE c.name = 'Miami' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Seattle Grunge Revival', 'Keeping grunge alive', '{"Grunge"}', 58, c.name, 6, 30000 FROM cities c WHERE c.name = 'Seattle' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Denver High Records', 'Colorado indie and folk', '{"Folk"}', 50, c.name, 5, 20000 FROM cities c WHERE c.name = 'Denver' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Portland Weird Music', 'Experimental and indie', '{"Experimental"}', 52, c.name, 6, 25000 FROM cities c WHERE c.name = 'Portland' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Vegas Neon Records', 'Pop and electronic from Sin City', '{"Pop"}', 63, c.name, 9, 48000 FROM cities c WHERE c.name = 'Las Vegas' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'NOLA Jazz Collective', 'New Orleans jazz and brass', '{"Jazz"}', 72, c.name, 10, 52000 FROM cities c WHERE c.name = 'New Orleans' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Boston Hardcore', 'East coast hardcore punk', '{"Hardcore"}', 55, c.name, 7, 28000 FROM cities c WHERE c.name = 'Boston' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Austin Live Music', 'Live music capital recordings', '{"Indie Rock"}', 65, c.name, 11, 45000 FROM cities c WHERE c.name = 'Austin' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Minneapolis Purple Sound', 'Funk and R&B from the Twin Cities', '{"Funk"}', 60, c.name, 7, 36000 FROM cities c WHERE c.name = 'Minneapolis' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'Arizona Desert Rock', 'Desert rock and stoner metal', '{"Stoner Rock"}', 52, c.name, 5, 22000 FROM cities c WHERE c.name = 'Phoenix' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'San Diego Surf Sound', 'California surf and skate punk', '{"Punk"}', 48, c.name, 5, 18000 FROM cities c WHERE c.name = 'San Diego' LIMIT 1;
INSERT INTO labels (name, description, genre_focus, reputation_score, headquarters_city, roster_slot_capacity, marketing_budget)
SELECT 'NYC Underground Hip-Hop', 'New York underground rap scene', '{"Hip-Hop"}', 67, c.name, 10, 52000 FROM cities c WHERE c.name = 'New York' LIMIT 1;
