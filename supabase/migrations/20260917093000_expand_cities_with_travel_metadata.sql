-- Create or extend the cities table with travel metadata
create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  country text not null,
  description text,
  bonuses text,
  unlocked boolean not null default false,
  population integer not null default 0,
  music_scene integer not null default 0,
  cost_of_living integer not null default 0,
  dominant_genre text not null default '',
  venues integer not null default 0,
  local_bonus numeric not null default 1,
  cultural_events text[] not null default '{}',
  districts jsonb not null default '[]'::jsonb,
  travel_nodes jsonb not null default '[]'::jsonb,
  famous_resident text,
  travel_hub text
);

alter table public.cities
  add column if not exists description text,
  add column if not exists bonuses text,
  add column if not exists unlocked boolean default false,
  add column if not exists population integer default 0,
  add column if not exists music_scene integer default 0,
  add column if not exists cost_of_living integer default 0,
  add column if not exists dominant_genre text default '',
  add column if not exists venues integer default 0,
  add column if not exists local_bonus numeric default 1,
  add column if not exists cultural_events text[] default '{}',
  add column if not exists districts jsonb default '[]'::jsonb,
  add column if not exists travel_nodes jsonb default '[]'::jsonb,
  add column if not exists famous_resident text,
  add column if not exists travel_hub text;

update public.cities
  set cultural_events = coalesce(cultural_events, '{}'),
      districts = coalesce(districts, '[]'::jsonb),
      travel_nodes = coalesce(travel_nodes, '[]'::jsonb);

alter table public.cities
  alter column cultural_events set not null,
  alter column districts set not null,
  alter column travel_nodes set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cities_name_key'
      and conrelid = 'public.cities'::regclass
  ) then
    alter table public.cities
      add constraint cities_name_key unique (name);
  end if;
end;
$$;

alter table public.cities enable row level security;

create policy if not exists "Cities are viewable by everyone"
  on public.cities for select
  using (true);

create policy if not exists "Authenticated users manage cities"
  on public.cities for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

insert into public.cities (
  name,
  country,
  description,
  bonuses,
  unlocked,
  population,
  music_scene,
  cost_of_living,
  dominant_genre,
  venues,
  local_bonus,
  cultural_events,
  districts,
  travel_nodes,
  famous_resident,
  travel_hub
) values
  (
    'Neo Tokyo',
    'Japan',
    'Neon megacity where experimental electronica spills into every rooftop garden.',
    '+10% streaming buzz, +5% merch during night gigs',
    true,
    37000000,
    95,
    120,
    'Electronic',
    420,
    1.3,
    array['Tokyo Sound Week', 'Neon Nights Parade', 'Sakura Synth Fest'],
    '[{"name":"Shibuya Pulse","description":"Neon-drenched nightlife district known for experimental electronica showcases.","highlights":["Crossfade Arena","Pulse Alley"],"signature_venue":"Hachiko Dome","vibe":"Electric youth energy","average_ticket_price":45},{"name":"Harbor Jazz Collective","description":"Floating stages anchored along the bay, hosting nightly improv sessions.","highlights":["Pier Resonance","Blue Lantern Barge"],"signature_venue":"Tidewave Amphitheater","vibe":"Late-night sophistication","average_ticket_price":38},{"name":"Skyline Gardens","description":"Lush rooftop circuit supporting acoustic sunrise performances.","highlights":["Zenith Conservatory","Aurora Pergola"],"signature_venue":"Skylight Atrium","vibe":"Chill ambient mornings","average_ticket_price":28}]'::jsonb,
    '[{"mode":"maglev","name":"Shibuya Hyperloop","description":"Ultra-fast maglev linking downtown venues with orbital stages.","duration_minutes":8,"frequency":"Every 4 minutes","average_cost":18,"connects_to":["Shibuya Pulse","Skyline Gardens"],"comfort":"Luxury cabins"},{"mode":"subway","name":"Metro Loop Line","description":"24/7 subway connecting underground clubs and rehearsal lofts.","duration_minutes":12,"frequency":"Every 3 minutes","average_cost":5,"connects_to":["Shibuya Pulse","Harbor Jazz Collective"],"comfort":"Crowded but efficient"},{"mode":"drone_taxi","name":"Aerial Stage Lifts","description":"Autonomous drones shuttle artists to rooftop sessions.","duration_minutes":5,"frequency":"On demand","average_cost":32,"connects_to":["Skyline Gardens"],"comfort":"Scenic skyline views"}]'::jsonb,
    'DJ Kairo',
    'Shibuya Hyperloop Terminal'
  ),
  (
    'Solace City',
    'United States',
    'Coastal creative capital blending indie collectives with sustainable tech.',
    '+8% fan loyalty, +5% acoustic set tips',
    true,
    5200000,
    88,
    98,
    'Indie Rock',
    185,
    1.15,
    array['Sunset Sessions', 'Harbor Lights Live', 'Aurora Folk Expo'],
    '[{"name":"Golden Shoreline","description":"Boardwalk of open-air stages bathed in solar lanterns.","highlights":["Sunset Esplanade","Low Tide Lounge"],"signature_venue":"Radiant Pier","vibe":"Laid-back coastal grooves","average_ticket_price":30},{"name":"Echo Quarter","description":"Reimagined warehouse district for immersive multimedia gigs.","highlights":["Reverb Hall","Circuit Alley"],"signature_venue":"The Circuit","vibe":"DIY innovation","average_ticket_price":26},{"name":"Innovation Yard","description":"Sustainability campus fusing research labs with pop-up listening pods.","highlights":["Solar Fields","Aural Arboretum"],"signature_venue":"Greenlight Forum","vibe":"Future-forward collaboration","average_ticket_price":22}]'::jsonb,
    '[{"mode":"tram","name":"Coastal Tram Loop","description":"Solar-powered tram hugging the shoreline arts trail.","duration_minutes":14,"frequency":"Every 6 minutes","average_cost":4,"connects_to":["Golden Shoreline","Echo Quarter"],"comfort":"Panoramic ocean views"},{"mode":"ferry","name":"Solar Ferry Network","description":"Quiet catamarans linking harbor stages and floating studios.","duration_minutes":18,"frequency":"Every 12 minutes","average_cost":6,"connects_to":["Golden Shoreline","Innovation Yard"],"comfort":"Breezy deck seating"},{"mode":"bike_share","name":"IndieCycle Grid","description":"Citywide smart bike paths connecting rehearsal lofts.","duration_minutes":10,"frequency":"Always available","average_cost":2,"connects_to":["Echo Quarter","Innovation Yard"],"comfort":"Self-paced exploration"}]'::jsonb,
    'Riley Nova',
    'Solace Union Station'
  ),
  (
    'Vela Horizonte',
    'Brazil',
    'Tropical metropolis where rainforest rhythms meet futurist skyline venues.',
    '+12% dance attendance, +6% festival merch',
    true,
    12900000,
    91,
    76,
    'Latin Fusion',
    240,
    1.25,
    array['Rio Resonance Carnival', 'Jungle Groove Summit', 'Midnight Samba Cruise'],
    '[{"name":"Lumen Heights","description":"Hilltop barrio with projection-mapped amphitheaters.","highlights":["Aurora Steps","Chromatic Terrace"],"signature_venue":"Mirador Stage","vibe":"Festive twilight energy","average_ticket_price":24},{"name":"Ritmo Mercado","description":"Street market of percussion collectives and dance battles.","highlights":["Drumfire Arcade","Sabor Alley"],"signature_venue":"Mercado Central","vibe":"Perpetual celebration","average_ticket_price":18},{"name":"Rainforest Fringe","description":"Suspended platforms weaving through biodomes and canopy paths.","highlights":["Canopy Walk","Pulse Conservatory"],"signature_venue":"Selva Pavilion","vibe":"Lush organic ambience","average_ticket_price":27}]'::jsonb,
    '[{"mode":"skyrail","name":"Selva Skyrail","description":"Gondola weaving above the canopy connecting eco-stages.","duration_minutes":11,"frequency":"Every 7 minutes","average_cost":7,"connects_to":["Rainforest Fringe","Lumen Heights"],"comfort":"Open-air breeze"},{"mode":"riverboat","name":"Samba Riverboats","description":"Colorful boats ferry crowds along the glittering riverfront.","duration_minutes":15,"frequency":"Every 10 minutes","average_cost":5,"connects_to":["Ritmo Mercado","Lumen Heights"],"comfort":"Live onboard percussion"},{"mode":"moto_taxi","name":"Midnight Moto Crew","description":"Coordinated moto taxis with rhythm-synced routes for late shows.","duration_minutes":8,"frequency":"Every 5 minutes","average_cost":3,"connects_to":["Ritmo Mercado","Rainforest Fringe"],"comfort":"Adrenaline-fueled"}]'::jsonb,
    'Marina Sol',
    'Estação Harmonia'
  ),
  (
    'Asterhaven',
    'United Kingdom',
    'Historic capital reinvented with skybridge stages and immersive galleries.',
    '+7% VIP upgrades, +5% sponsorship interest',
    true,
    8600000,
    84,
    110,
    'Alternative Pop',
    210,
    1.2,
    array['Skybridge Soirée', 'Cathedral Echo Festival', 'Midnight Manuscript Trail'],
    '[{"name":"Cathedral Quarter","description":"Gothic halls transformed into resonant chamber pop venues.","highlights":["Choir Nave","Glasswork Atrium"],"signature_venue":"Starlight Abbey","vibe":"Cathedral-scale reverence","average_ticket_price":32},{"name":"Synth Docklands","description":"Redeveloped docks pulsing with modular synth labs and waterside clubs.","highlights":["Pulse Terminal","Neon Wharf"],"signature_venue":"Docklands Observatory","vibe":"Sleek nocturnal energy","average_ticket_price":34},{"name":"Greenbelt Commons","description":"Verdant parks hosting afternoon folk circles and avant-garde picnics.","highlights":["Lyric Lawn","Harmony Grove"],"signature_venue":"Commonwealth Stage","vibe":"Warm community spirit","average_ticket_price":20}]'::jsonb,
    '[{"mode":"tram","name":"Skybridge Tramway","description":"Glide across suspended glass bridges linking skyline stages.","duration_minutes":9,"frequency":"Every 5 minutes","average_cost":4,"connects_to":["Cathedral Quarter","Synth Docklands"],"comfort":"Elevated city views"},{"mode":"tube","name":"Night Tube Lines","description":"After-hours underground service prioritising venue stops.","duration_minutes":6,"frequency":"Every 4 minutes","average_cost":3,"connects_to":["Synth Docklands","Greenbelt Commons"],"comfort":"Ambient carriage lighting"},{"mode":"water_taxi","name":"Thameslite Clippers","description":"Electric water taxis drifting between riverside performances.","duration_minutes":13,"frequency":"Every 8 minutes","average_cost":5,"connects_to":["Cathedral Quarter","Greenbelt Commons"],"comfort":"Heated cabin lounges"}]'::jsonb,
    'Sir Cadence Vale',
    'Asterhaven Grand Terminal'
  )
on conflict (name) do update set
  country = excluded.country,
  description = excluded.description,
  bonuses = excluded.bonuses,
  unlocked = excluded.unlocked,
  population = excluded.population,
  music_scene = excluded.music_scene,
  cost_of_living = excluded.cost_of_living,
  dominant_genre = excluded.dominant_genre,
  venues = excluded.venues,
  local_bonus = excluded.local_bonus,
  cultural_events = excluded.cultural_events,
  districts = excluded.districts,
  travel_nodes = excluded.travel_nodes,
  famous_resident = excluded.famous_resident,
  travel_hub = excluded.travel_hub;
