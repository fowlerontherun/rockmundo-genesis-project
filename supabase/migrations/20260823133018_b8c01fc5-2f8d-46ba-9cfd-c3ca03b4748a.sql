
-- 1. TV SHOWS -----------------------------------------------------------
WITH nets AS (
  SELECT id, row_number() OVER (ORDER BY id) - 1 AS rn, count(*) OVER () AS total
  FROM public.tv_networks
), src AS (
  SELECT * FROM unnest(ARRAY[
    'The Midnight Sessions','Backstage Pass','Soundcheck Live','Chart Attack','The Green Room',
    'Amplified','Studio 9','Encore Tonight','The Late Riff','Breakfast Beats',
    'Vinyl Nights','Front Row','The Support Slot','Tour Diaries','Stage Left',
    'The Rehearsal Room','Loud & Live','Weekend Warm Up','The Playlist','Feedback',
    'On The Record','Prime Time Live Music','The Acoustic Hour','Headliners','Sound Advice',
    'The Booking Desk','Rock Docket','Festival Focus','The B-Side','Two Chords and the Truth',
    'Morning Mix','Afternoon Anthems','The Long Player','Session Musicians','The Warm Up Act',
    'Screaming Fans','Merch Table','Late Night Lock In','Deep Cuts TV','The Green Room Extra',
    'Breaking Bands','Studio Confidential','The Encore Show','Rising Stars Live','Rehearsal Tapes',
    'The Sound Booth','Roadie Life','Bootleg Sessions','Crowd Surf','The Rider',
    'Sold Out','Backline','Tuning Up','Set List','The Aftershow',
    'Under The Lights','Between Songs','The Green Van','Support Act Stories','Final Bow'
  ]) WITH ORDINALITY AS t(show_name, ord)
)
INSERT INTO public.tv_shows (
  network_id, show_name, show_type, host_name, description, days_of_week, time_slot,
  slots_per_day, viewer_reach, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max,
  compensation_min, compensation_max, min_fame_required, is_active
)
SELECT
  n.id,
  s.show_name,
  (ARRAY['talk_show','morning_show','late_night','music_special','variety','entertainment'])[1 + (s.ord % 6)],
  (ARRAY['Dana Whitlock','Marcus Reeve','Priya Nandra','Colin Baxter','Sofia Marchetti','Jerome Kade','Nina Alvarez','Tom Fairbrother'])[1 + (s.ord % 8)],
  'A recurring music programme booking guest artists for interviews and live performances.',
  CASE WHEN s.ord % 3 = 0 THEN ARRAY[1,3,5] WHEN s.ord % 3 = 1 THEN ARRAY[2,4,6] ELSE ARRAY[1,2,3,4,5] END,
  (ARRAY['morning','afternoon','prime_time','late_night'])[1 + (s.ord % 4)],
  1 + (s.ord % 3),
  25000 + (s.ord * 41000) % 2400000,
  60 + (s.ord * 17) % 400,
  400 + (s.ord * 29) % 1400,
  150 + (s.ord * 23) % 900,
  1200 + (s.ord * 61) % 5200,
  300 + (s.ord * 37) % 3500,
  4000 + (s.ord * 149) % 26000,
  (ARRAY[0,0,250,750,2000,5000,12000])[1 + (s.ord % 7)],
  true
FROM src s
JOIN nets n ON n.rn = (s.ord * 7) % n.total
WHERE NOT EXISTS (SELECT 1 FROM public.tv_shows x WHERE x.show_name = s.show_name);

-- 2. PODCASTS -----------------------------------------------------------
WITH src AS (
  SELECT * FROM unnest(ARRAY[
    'Song & Story','The Touring Life','Mix Notes','Broke and Loud','Three Takes',
    'The Demo Tape','Liner Notes','Crate Diggers','Rider Requests','The Cheap Seats',
    'Guitar Shop Talk','Drum Fill','Signed and Sealed','Room Tone','The Split Sheet',
    'Support Slot Stories','Vocal Booth','Analogue Hearts','Backline Banter','Chorus Trouble',
    'Publishing Problems','The Long Drive','Two Mic Setup','Off The Cuff Sessions','Fan Mail',
    'Label Politics','Sound Money','The Rehearsal Hour','Encore Requests','Late Load Out',
    'Tour Bus Confessions','Bedroom Producers','Genre Trouble','The Openers','Second Album Syndrome',
    'Green Room Gossip','Bootleg Radio','Songwriters Anonymous','The Session Log','Hooks and Bridges',
    'Charts and Charts','Sold Out Sundays','Venue Owners','Merch Math','Festival Mud',
    'The Deep Cut','Rough Mix','Studio Cats','Pedalboard','Sync Deals'
  ]) WITH ORDINALITY AS t(podcast_name, ord)
)
INSERT INTO public.podcasts (
  podcast_name, podcast_type, listener_base, quality_level, min_fame_required, host_name,
  description, episodes_per_week, slots_per_episode, fame_boost_min, fame_boost_max,
  fan_boost_min, fan_boost_max, compensation_min, compensation_max, is_active, country, cooldown_days
)
SELECT
  s.podcast_name,
  (ARRAY['music','interview','industry','storytelling','comedy','culture'])[1 + (s.ord % 6)],
  4000 + (s.ord * 33000) % 900000,
  1 + (s.ord % 10),
  (ARRAY[0,100,300,800,2000,6000])[1 + (s.ord % 6)],
  (ARRAY['Ellie Hart','Sam Oduya','Rae Lindqvist','Danny Cortez','Bex Ferrall','Owen Mbeki','Ines Duval','Cal Sutherland'])[1 + (s.ord % 8)],
  'An independent music podcast that interviews working artists about their craft and careers.',
  1 + (s.ord % 3),
  1 + (s.ord % 2),
  50 + (s.ord * 13) % 300,
  300 + (s.ord * 27) % 900,
  120 + (s.ord * 19) % 600,
  800 + (s.ord * 43) % 3000,
  50 + (s.ord * 31) % 700,
  900 + (s.ord * 97) % 4500,
  true,
  (ARRAY['United Kingdom','United States','Canada','Australia','Germany','Sweden','Ireland','Netherlands'])[1 + (s.ord % 8)],
  7 + (s.ord % 3) * 7
FROM src s
WHERE NOT EXISTS (SELECT 1 FROM public.podcasts x WHERE x.podcast_name = s.podcast_name);

-- 3. FILM PRODUCTIONS ---------------------------------------------------
WITH studios AS (
  SELECT id, row_number() OVER (ORDER BY id) - 1 AS rn, count(*) OVER () AS total
  FROM public.film_studios
), src AS (
  SELECT * FROM unnest(ARRAY[
    'Neon Rain','The Last Encore','Dust and Diamonds','Northern Line','Static',
    'Hollow Crown','Saltwater Kids','The Quiet Set','Paper Tigers','Ash Wednesday',
    'Ninety Minutes','Glass Harbour','Rust','The Understudy','Cold Open',
    'Midnight Matinee','Feral','The Long Weekend','Signal Lost','Bright Alley',
    'Tin Halo','Sparrow Street','The Ferryman','Blue Hour','Loud Quiet Loud',
    'Second Take','Bad Weather Friends','The Tour Manager','Runaway Sound','Cassette',
    'Lightning Field','Pale Horses','The Backline','Amp Room','Fade Out',
    'Chasing Static','The Session','Wired','Ghost Note','Last Train Home'
  ]) WITH ORDINALITY AS t(title, ord)
)
INSERT INTO public.film_productions (
  studio_id, title, film_type, genre, description, min_fame_required,
  compensation_min, compensation_max, fame_boost, fan_boost, filming_duration_days, is_available
)
SELECT
  st.id,
  s.title,
  (ARRAY['cameo','cameo','supporting','supporting','lead'])[1 + (s.ord % 5)],
  (ARRAY['drama','thriller','music documentary','comedy','biopic','romance','crime','coming of age'])[1 + (s.ord % 8)],
  'A feature production casting musicians for on-screen roles and soundtrack involvement.',
  (ARRAY[5000,12000,25000,45000,80000,150000])[1 + (s.ord % 6)],
  8000 + (s.ord * 4300) % 60000,
  90000 + (s.ord * 27000) % 700000,
  1500 + (s.ord * 370) % 12000,
  6000 + (s.ord * 1900) % 60000,
  3 + (s.ord % 6) * 4,
  true
FROM src s
JOIN studios st ON st.rn = (s.ord * 5) % st.total
WHERE NOT EXISTS (SELECT 1 FROM public.film_productions x WHERE x.title = s.title);

-- 4. MAGAZINES ----------------------------------------------------------
WITH src AS (
  SELECT * FROM unnest(ARRAY[
    'Reverb Quarterly','Stagecraft','Tonearm','The Bridge','Loud Paper',
    'Wireframe Music','Cut & Press','Sonics','Tempo Journal','Backbeat Review',
    'The Fader Line','Overdrive Monthly','Session Weekly','Circuit','Chorus & Verse',
    'Analogue Digest','Cadence','Roadcase','Rough Edit','Modulate',
    'Ampersand','The Rider Magazine','Vinyl Culture','Stage Whisper','Signal Path',
    'Crowd Noise','Songcraft','Mainstage','The Bootleg','Harmonic',
    'Feedback Loop','Downbeat Times','Fret','Nightshift','Encore Weekly',
    'Bandwidth','Off Axis','Gain Structure','The Setlist Review','Crescendo'
  ]) WITH ORDINALITY AS t(name, ord)
)
INSERT INTO public.magazines (
  name, magazine_type, country, readership, quality_level, min_fame_required, description,
  publication_frequency, interview_slots_per_issue, fame_boost_min, fame_boost_max,
  fan_boost_min, fan_boost_max, compensation_min, compensation_max, is_active, cooldown_days
)
SELECT
  s.name,
  (ARRAY['music','entertainment','lifestyle','celebrity','industry'])[1 + (s.ord % 5)],
  (ARRAY['United Kingdom','United States','Germany','France','Japan','Australia','Canada','Sweden','Brazil','Spain'])[1 + (s.ord % 10)],
  15000 + (s.ord * 47000) % 1500000,
  1 + (s.ord % 10),
  (ARRAY[0,200,500,1500,4000,10000])[1 + (s.ord % 6)],
  'A print and online music title running artist interviews, reviews and features.',
  (ARRAY['weekly','biweekly','monthly'])[1 + (s.ord % 3)],
  2 + (s.ord % 4),
  60 + (s.ord * 11) % 300,
  350 + (s.ord * 31) % 1300,
  200 + (s.ord * 17) % 800,
  1000 + (s.ord * 53) % 4000,
  120 + (s.ord * 41) % 1500,
  1800 + (s.ord * 87) % 6000,
  true,
  7 + (s.ord % 3) * 7
FROM src s
WHERE NOT EXISTS (SELECT 1 FROM public.magazines x WHERE x.name = s.name);

-- 5. NEWSPAPERS ---------------------------------------------------------
WITH src AS (
  SELECT * FROM unnest(ARRAY[
    'The Northern Echo Today','City Evening Post','The Daily Marker','Harbour Gazette','The Standard Review',
    'Metro Chronicle','The Weekend Herald','Borough Times','The Riverside Post','Union Street Journal',
    'The Nightly Ledger','Cathedral Quarter News','The Docklands Reporter','Parkside Bulletin','The Morning Wire',
    'Coastal Courier','The Civic Times','Old Town Observer','The Signal','Market Square News',
    'The Provincial','Ironbridge Gazette','The Late Edition','Highland Herald','The Commuter',
    'Southbank Sentinel','The Lantern','Quarry Hill Press','The Broadsheet Weekly','Kingsway Record',
    'The Tabloid Times','Fleet Row News','The Regional Voice','Eastgate Express','The Daily Riff',
    'Pier Head Post','The Culture Column','Greenfield Gazette','The Loud Edition','Station Road Times'
  ]) WITH ORDINALITY AS t(name, ord)
)
INSERT INTO public.newspapers (
  name, newspaper_type, country, circulation, quality_level, min_fame_required, description,
  interview_slots_per_day, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max,
  compensation_min, compensation_max, is_active
)
SELECT
  s.name,
  (ARRAY['local','regional','national','tabloid','broadsheet'])[1 + (s.ord % 5)],
  (ARRAY['United Kingdom','United States','Ireland','Canada','Australia','Germany','Netherlands','Spain'])[1 + (s.ord % 8)],
  8000 + (s.ord * 29000) % 900000,
  1 + (s.ord % 10),
  (ARRAY[0,0,150,400,1200,3500])[1 + (s.ord % 6)],
  'A newspaper arts desk that covers local gigs, releases and artist interviews.',
  1 + (s.ord % 4),
  30 + (s.ord * 7) % 200,
  220 + (s.ord * 23) % 900,
  80 + (s.ord * 13) % 500,
  600 + (s.ord * 37) % 2500,
  60 + (s.ord * 19) % 900,
  1200 + (s.ord * 71) % 4000,
  true
FROM src s
WHERE NOT EXISTS (SELECT 1 FROM public.newspapers x WHERE x.name = s.name);

-- 6. SPONSORSHIP BRANDS -------------------------------------------------
WITH src AS (
  SELECT * FROM unnest(ARRAY[
    'Voltaic Audio','Kestrel Denim','Northwind Energy','Palladio Watches','Bitter Rivers Brewing',
    'Crosstown Sneakers','Halcyon Headphones','Ridgeline Motors','Saltbox Coffee','Lumen Optics',
    'Fathom Streaming','Bramble Skincare','Tundra Outerwear','Circuit Nine Games','Ember Guitars',
    'Marlow Luggage','Nine Bells Cider','Vantage Airlines','Pixel Harbour Tech','Cobalt Fitness',
    'Rustic Rye Bakery','Solstice Eyewear','Grandstand Sportswear','Nimbus Cloud Tools','Petal & Pine',
    'Harrow Amplification','Beacon Bank','Twelve String Strings','Momentum Rideshare','Copperleaf Tea',
    'Astra Phones','Wildline Camping','Tabletop Studios','Fenwick Tailors','Hive Delivery',
    'Coastline Surf Co','Quartz Speakers','Meridian Hotels','Basalt Footwear','Sunbelt Sodas'
  ]) WITH ORDINALITY AS t(name, ord)
)
INSERT INTO public.sponsorship_brands (
  name, category, region, size, wealth_tier, min_fame_required, is_active,
  available_budget, wealth_score, targeting_flags, min_fame_threshold, exclusivity_pref
)
SELECT
  s.name,
  (ARRAY['automotive','entertainment','fashion','food_beverage','music_gear','retail','streetwear','technology'])[1 + (s.ord % 8)],
  (ARRAY['local','regional','national','global'])[1 + (s.ord % 4)],
  (ARRAY['indie','small','medium','regional','national','major','premium'])[1 + (s.ord % 7)],
  1 + (s.ord % 5),
  (ARRAY[0,250,1000,5000,20000,75000])[1 + (s.ord % 6)],
  true,
  20000 + (s.ord * 137000) % 4000000,
  10 + (s.ord * 7) % 90,
  ARRAY[]::text[],
  (ARRAY[0,250,1000,5000,20000,75000])[1 + (s.ord % 6)],
  (s.ord % 5 = 0)
FROM src s
WHERE NOT EXISTS (SELECT 1 FROM public.sponsorship_brands x WHERE x.name = s.name);

-- 7. MERCH BRAND PARTNERS ----------------------------------------------
WITH src AS (
  SELECT * FROM unnest(ARRAY[
    'Backprint Co','Loomstate Apparel','Blackout Press','Riot Roll Screenprint','Heavy Cotton Club',
    'Northside Threads','Inkwell Merch','Stagehand Supply','Tourwear Collective','Paper Route Prints',
    'Cutline Garments','Anvil & Ink','Fanbase Goods','Cassette Club Apparel','Union Print Works',
    'Ironpress Textiles','Lowline Apparel','Crowdwear','Setlist Supply','Marquee Merch',
    'Rough Cut Clothing','Studio Stock','Nightshift Prints','Bandroom Basics','Encore Apparel'
  ]) WITH ORDINALITY AS t(name, ord)
)
INSERT INTO public.merch_brand_partners (
  name, brand_tier, description, min_fame_required, min_fans_required,
  base_upfront_payment, royalty_percentage, quality_boost, sales_boost_pct, product_types, is_active
)
SELECT
  s.name,
  (ARRAY['indie','indie','mainstream','premium','luxury'])[1 + (s.ord % 5)],
  'A merchandise manufacturing partner offering print runs and tour stock for artists.',
  (ARRAY[0,0,500,2500,10000,40000])[1 + (s.ord % 6)],
  (ARRAY[0,100,1000,5000,25000,100000])[1 + (s.ord % 6)],
  500 + (s.ord * 1700) % 40000,
  round((3 + (s.ord % 13) * 0.75)::numeric, 2),
  (ARRAY['basic','standard','premium','exclusive'])[1 + (s.ord % 4)],
  round((5 + (s.ord % 9) * 2.5)::numeric, 1),
  CASE WHEN s.ord % 4 = 0 THEN ARRAY['tshirt','hoodie','cap']
       WHEN s.ord % 4 = 1 THEN ARRAY['tshirt','poster','sticker']
       WHEN s.ord % 4 = 2 THEN ARRAY['tshirt','hoodie','vinyl','tote']
       ELSE ARRAY['tshirt','hoodie','longsleeve','beanie'] END,
  true
FROM src s
WHERE NOT EXISTS (SELECT 1 FROM public.merch_brand_partners x WHERE x.name = s.name);
