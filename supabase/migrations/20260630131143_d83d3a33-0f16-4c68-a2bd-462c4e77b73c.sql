
-- Local radio (must use station_type='local' and have city_id; station_type enum is national|local only)
INSERT INTO public.radio_stations (name, station_type, country, city_id, quality_level, listener_base, accepted_genres, description, frequency, is_active, min_fans_required, min_fame_required, requires_local_presence)
SELECT
  c.name || ' Community FM',
  'local', c.country, c.id, 1,
  500 + (abs(hashtext(c.id::text)) % 3000),
  ARRAY['rock','indie','folk','punk','metal','pop','hip-hop','electronic','jazz','blues']::text[],
  'Volunteer-run community station broadcasting from ' || c.name || '. Plays anything local.',
  (87 + (abs(hashtext(c.id::text || 'fm')) % 21))::text || '.' || ((abs(hashtext(c.id::text)) % 9))::text || ' FM',
  true, 0, 0, true
FROM public.cities c
WHERE NOT EXISTS (SELECT 1 FROM public.radio_stations r WHERE r.name = c.name || ' Community FM');

INSERT INTO public.radio_stations (name, station_type, country, city_id, quality_level, listener_base, accepted_genres, description, frequency, is_active, min_fans_required, min_fame_required, requires_local_presence)
SELECT
  c.name || ' College Radio',
  'local', c.country, c.id, 2,
  1500 + (abs(hashtext(c.id::text || 'col')) % 4500),
  ARRAY['indie','alternative','punk','metal','electronic','hip-hop','experimental']::text[],
  'Student-operated college radio serving the ' || c.name || ' university scene.',
  (88 + (abs(hashtext(c.id::text || 'cr')) % 20))::text || '.' || ((abs(hashtext(c.id::text||'x')) % 9))::text || ' FM',
  true, 0, 0, true
FROM public.cities c
WHERE NOT EXISTS (SELECT 1 FROM public.radio_stations r WHERE r.name = c.name || ' College Radio');

-- Local newspapers (newspaper_type 'local')
INSERT INTO public.newspapers (name, newspaper_type, country, city_id, circulation, quality_level, min_fame_required, genres, description, interview_slots_per_day, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max, is_active)
SELECT c.name || ' Gazette','local',c.country,c.id,
  1500 + (abs(hashtext(c.id::text || 'gaz')) % 7500),1,0,
  ARRAY['rock','indie','folk','pop','hip-hop','jazz','blues','country']::text[],
  'Neighborhood weekly covering events, culture, and music in ' || c.name || '.',
  2,5,25,10,80,25,200,true
FROM public.cities c
WHERE NOT EXISTS (SELECT 1 FROM public.newspapers n WHERE n.name = c.name || ' Gazette');

INSERT INTO public.newspapers (name, newspaper_type, country, city_id, circulation, quality_level, min_fame_required, genres, description, interview_slots_per_day, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max, is_active)
SELECT c.name || ' Weekly','local',c.country,c.id,
  3000 + (abs(hashtext(c.id::text || 'wk')) % 12000),2,0,
  ARRAY['rock','indie','metal','punk','pop','hip-hop','electronic']::text[],
  'Free alternative weekly focused on nightlife, gigs, and indie culture across ' || c.name || '.',
  3,8,40,20,150,50,400,true
FROM public.cities c
WHERE NOT EXISTS (SELECT 1 FROM public.newspapers n WHERE n.name = c.name || ' Weekly');

-- Local zines (magazine_type must be in enum -> use 'music')
INSERT INTO public.magazines (name, magazine_type, country, readership, quality_level, min_fame_required, genres, description, publication_frequency, interview_slots_per_issue, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max, is_active, cooldown_days)
SELECT c.name || ' Scene Zine','music',c.country,
  800 + (abs(hashtext(c.id::text || 'zn')) % 3200),1,0,
  ARRAY['punk','indie','metal','hardcore','experimental','folk']::text[],
  'Photocopied DIY zine documenting the ' || c.name || ' underground music scene.',
  'monthly',2,3,20,5,60,0,100,true,14
FROM public.cities c
WHERE NOT EXISTS (SELECT 1 FROM public.magazines m WHERE m.name = c.name || ' Scene Zine');

INSERT INTO public.magazines (name, magazine_type, country, readership, quality_level, min_fame_required, genres, description, publication_frequency, interview_slots_per_issue, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max, is_active, cooldown_days)
SELECT c.name || ' Sound','music',c.country,
  2500 + (abs(hashtext(c.id::text || 'snd')) % 7500),2,0,
  ARRAY['rock','indie','pop','hip-hop','electronic','jazz']::text[],
  'Free monthly music magazine distributed in record shops and venues across ' || c.name || '.',
  'monthly',3,8,45,25,180,40,350,true,21
FROM public.cities c
WHERE NOT EXISTS (SELECT 1 FROM public.magazines m WHERE m.name = c.name || ' Sound');

-- Local podcasts (podcast_type in enum -> use 'music' / 'interview')
INSERT INTO public.podcasts (podcast_name, podcast_type, listener_base, quality_level, min_fame_required, genres, host_name, description, episodes_per_week, slots_per_episode, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max, is_active, country, cooldown_days)
SELECT 'The ' || c.name || ' Basement Tapes','music',
  200 + (abs(hashtext(c.id::text || 'pod')) % 1500),1,0,
  ARRAY['indie','rock','punk','folk','experimental','hip-hop']::text[],
  'DJ Static',
  'A bedroom-recorded podcast spotlighting unsigned acts from ' || c.name || ' and the surrounding area.',
  1,2,4,18,8,70,0,50,true,c.country,10
FROM public.cities c
WHERE NOT EXISTS (SELECT 1 FROM public.podcasts p WHERE p.podcast_name = 'The ' || c.name || ' Basement Tapes');

INSERT INTO public.podcasts (podcast_name, podcast_type, listener_base, quality_level, min_fame_required, genres, host_name, description, episodes_per_week, slots_per_episode, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max, is_active, country, cooldown_days)
SELECT c.name || ' After Hours','interview',
  600 + (abs(hashtext(c.id::text || 'ah')) % 3400),2,0,
  ARRAY['rock','indie','metal','electronic','hip-hop','jazz']::text[],
  'Mira Vance',
  'A weekly interview show with the bands, promoters, and venue owners shaping the ' || c.name || ' nightlife.',
  1,2,8,30,20,140,25,150,true,c.country,14
FROM public.cities c
WHERE NOT EXISTS (SELECT 1 FROM public.podcasts p WHERE p.podcast_name = c.name || ' After Hours');

-- Local blogs / websites
INSERT INTO public.websites (name, country, description, traffic_rank, min_fame_required, compensation_min, compensation_max, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, genres, is_active)
SELECT c.name || ' Local Sound Blog',c.country,
  'Hyperlocal music blog covering shows, releases, and gossip from ' || c.name || '''s independent scene.',
  500000 + (abs(hashtext(c.id::text || 'blg')) % 500000),
  0,0,60,3,15,5,50,
  ARRAY['indie','rock','punk','metal','hip-hop','electronic','folk']::text[],
  true
FROM public.cities c
WHERE NOT EXISTS (SELECT 1 FROM public.websites w WHERE w.name = c.name || ' Local Sound Blog');

-- Mid-tier regional magazines
INSERT INTO public.magazines (name, magazine_type, country, readership, quality_level, min_fame_required, genres, description, publication_frequency, interview_slots_per_issue, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max, is_active, cooldown_days)
SELECT c.name || ' Metro Music','music',c.country,
  8000 + (abs(hashtext(c.id::text || 'mm')) % 12000),3,500,
  ARRAY['rock','indie','pop','hip-hop','electronic','metal']::text[],
  'Glossy regional monthly distributed across the ' || c.name || ' metropolitan area.',
  'monthly',4,20,90,80,400,150,900,true,30
FROM public.cities c
WHERE NOT EXISTS (SELECT 1 FROM public.magazines m WHERE m.name = c.name || ' Metro Music');

-- Mid-tier regional podcasts
INSERT INTO public.podcasts (podcast_name, podcast_type, listener_base, quality_level, min_fame_required, genres, host_name, description, episodes_per_week, slots_per_episode, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max, is_active, country, cooldown_days)
SELECT c.name || ' On Record','interview',
  5000 + (abs(hashtext(c.id::text || 'or')) % 8000),3,400,
  ARRAY['rock','indie','pop','hip-hop','electronic','jazz']::text[],
  'Theo Marsh',
  'Long-form regional podcast featuring rising and established acts touring through ' || c.name || '.',
  1,2,18,60,60,250,120,600,true,c.country,21
FROM public.cities c
WHERE NOT EXISTS (SELECT 1 FROM public.podcasts p WHERE p.podcast_name = c.name || ' On Record');
