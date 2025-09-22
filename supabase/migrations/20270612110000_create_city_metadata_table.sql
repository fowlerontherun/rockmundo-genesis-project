-- Create a dedicated table for richer city metadata used by the world environment UI
create table if not exists public.city_metadata (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  summary text,
  famous_resident text,
  signature_sound text,
  metro_area text,
  timezone text,
  aliases text[] not null default '{}',
  intra_locations jsonb not null default '[]'::jsonb,
  travel_modes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint city_metadata_city_id_key unique (city_id)
);

alter table public.city_metadata enable row level security;

create policy if not exists "City metadata is viewable by everyone"
  on public.city_metadata for select
  using (true);

create policy if not exists "Authenticated users manage city metadata"
  on public.city_metadata for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Ensure updated_at stays in sync with updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'city_metadata_set_updated_at'
      AND tgrelid = 'public.city_metadata'::regclass
  ) THEN
    CREATE TRIGGER city_metadata_set_updated_at
      BEFORE UPDATE ON public.city_metadata
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- Seed rich metadata for the starter cities surfaced in the UI
DO $$
DECLARE
  city_uuid uuid;
BEGIN
  SELECT id INTO city_uuid
  FROM public.cities
  WHERE name = 'London'
  LIMIT 1;

  IF city_uuid IS NULL THEN
    RAISE EXCEPTION 'City % missing for city_metadata seed', 'London';
  END IF;

  INSERT INTO public.city_metadata (
    city_id,
    summary,
    famous_resident,
    signature_sound,
    metro_area,
    timezone,
    aliases,
    intra_locations,
    travel_modes
  ) VALUES (
    city_uuid,
    'Global hub where legendary rock clubs meet cutting-edge studio districts.',
    'Dame Lyra Steel',
    'Anthemic rock crescendos echoing along the Thames.',
    'Greater London',
    'Europe/London',
    ARRAY['London', 'The Capital', 'Thames Metropolis'],
    jsonb_build_array(
      jsonb_build_object(
        'id', 'london-camden-circuit',
        'name', 'Camden Circuit',
        'category', 'District',
        'description', 'Iconic indie stretch of venues packed with late-night showcases.',
        'vibe', 'Sweaty guitars and singalongs'
      ),
      jsonb_build_object(
        'id', 'london-soho-sound-lanes',
        'name', 'Soho Sound Lanes',
        'category', 'Nightlife',
        'description', 'Labyrinth of jazz basements and neon-lit pop-up clubs.',
        'vibe', 'After-hours groove'
      ),
      jsonb_build_object(
        'id', 'london-royal-riverside',
        'name', 'Royal Riverside',
        'category', 'Waterfront',
        'description', 'Thames-side stages blending orchestral halls with modern arenas.',
        'vibe', 'Polished spectacle'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', 'london-northern-pulse',
        'name', 'Northern Pulse',
        'mode', 'tube',
        'travel_time', 0.15,
        'cost', 4,
        'comfort', 3,
        'description', 'Core Underground line threading rehearsal hubs and club districts.'
      ),
      jsonb_build_object(
        'id', 'london-skyline-loop',
        'name', 'Skyline Loop',
        'mode', 'overground',
        'travel_time', 0.23,
        'cost', 5,
        'comfort', 4,
        'description', 'Orbital rail linking arenas with riverside festival grounds.'
      ),
      jsonb_build_object(
        'id', 'london-thames-rush',
        'name', 'Thames Rush',
        'mode', 'river_bus',
        'travel_time', 0.2,
        'cost', 6,
        'comfort', 3,
        'description', 'Express river boats delivering artists to waterfront stages.'
      )
    )
  )
  ON CONFLICT (city_id) DO UPDATE SET
    summary = EXCLUDED.summary,
    famous_resident = EXCLUDED.famous_resident,
    signature_sound = EXCLUDED.signature_sound,
    metro_area = EXCLUDED.metro_area,
    timezone = EXCLUDED.timezone,
    aliases = EXCLUDED.aliases,
    intra_locations = EXCLUDED.intra_locations,
    travel_modes = EXCLUDED.travel_modes,
    updated_at = timezone('utc'::text, now());
END;
$$;

DO $$
DECLARE
  city_uuid uuid;
BEGIN
  SELECT id INTO city_uuid
  FROM public.cities
  WHERE name = 'Neo Tokyo'
  LIMIT 1;

  IF city_uuid IS NULL THEN
    RAISE EXCEPTION 'City % missing for city_metadata seed', 'Neo Tokyo';
  END IF;

  INSERT INTO public.city_metadata (
    city_id,
    summary,
    famous_resident,
    signature_sound,
    metro_area,
    timezone,
    aliases,
    intra_locations,
    travel_modes
  ) VALUES (
    city_uuid,
    'Neon megacity where experimental electronica spills into every rooftop garden.',
    'DJ Kairo',
    'Neon-drenched electronica experiments pulsing through elevated plazas.',
    'Kanto Megalopolis',
    'Asia/Tokyo',
    ARRAY['Neo Tokyo', 'Shibuya Pulse'],
    jsonb_build_array(
      jsonb_build_object(
        'id', 'neo-tokyo-shibuya-pulse',
        'name', 'Shibuya Pulse',
        'category', 'District',
        'description', 'Neon-drenched nightlife district known for experimental showcases.',
        'vibe', 'Electric youth energy'
      ),
      jsonb_build_object(
        'id', 'neo-tokyo-harbor-jazz',
        'name', 'Harbor Jazz Collective',
        'category', 'Waterfront',
        'description', 'Floating stages anchored along the bay with nightly improv sessions.',
        'vibe', 'Late-night sophistication'
      ),
      jsonb_build_object(
        'id', 'neo-tokyo-skyline-gardens',
        'name', 'Skyline Gardens',
        'category', 'Rooftop',
        'description', 'Lush rooftop circuit supporting acoustic sunrise performances.',
        'vibe', 'Chill ambient mornings'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', 'neo-tokyo-hyperloop',
        'name', 'Shibuya Hyperloop',
        'mode', 'maglev',
        'travel_time', 0.13,
        'cost', 18,
        'comfort', 5,
        'description', 'Ultra-fast maglev linking downtown venues with orbital stages.'
      ),
      jsonb_build_object(
        'id', 'neo-tokyo-metro-loop',
        'name', 'Metro Loop Line',
        'mode', 'subway',
        'travel_time', 0.2,
        'cost', 5,
        'comfort', 3,
        'description', '24/7 subway connecting underground clubs and rehearsal lofts.'
      ),
      jsonb_build_object(
        'id', 'neo-tokyo-aerial-lifts',
        'name', 'Aerial Stage Lifts',
        'mode', 'drone_taxi',
        'travel_time', 0.08,
        'cost', 32,
        'comfort', 4,
        'description', 'Autonomous drones shuttling artists to elevated rooftop sessions.'
      )
    )
  )
  ON CONFLICT (city_id) DO UPDATE SET
    summary = EXCLUDED.summary,
    famous_resident = EXCLUDED.famous_resident,
    signature_sound = EXCLUDED.signature_sound,
    metro_area = EXCLUDED.metro_area,
    timezone = EXCLUDED.timezone,
    aliases = EXCLUDED.aliases,
    intra_locations = EXCLUDED.intra_locations,
    travel_modes = EXCLUDED.travel_modes,
    updated_at = timezone('utc'::text, now());
END;
$$;

DO $$
DECLARE
  city_uuid uuid;
BEGIN
  SELECT id INTO city_uuid
  FROM public.cities
  WHERE name = 'Solace City'
  LIMIT 1;

  IF city_uuid IS NULL THEN
    RAISE EXCEPTION 'City % missing for city_metadata seed', 'Solace City';
  END IF;

  INSERT INTO public.city_metadata (
    city_id,
    summary,
    famous_resident,
    signature_sound,
    metro_area,
    timezone,
    aliases,
    intra_locations,
    travel_modes
  ) VALUES (
    city_uuid,
    'Coastal creative capital blending indie collectives with sustainable tech.',
    'Riley Nova',
    'Sun-drenched indie pop carried on ocean breezes.',
    'Solace Bay Metro',
    'America/Los_Angeles',
    ARRAY['Solace City', 'The Solace Coast'],
    jsonb_build_array(
      jsonb_build_object(
        'id', 'solace-golden-shoreline',
        'name', 'Golden Shoreline',
        'category', 'Boardwalk',
        'description', 'Boardwalk of open-air stages bathed in solar lanterns.',
        'vibe', 'Laid-back coastal grooves'
      ),
      jsonb_build_object(
        'id', 'solace-echo-quarter',
        'name', 'Echo Quarter',
        'category', 'Arts District',
        'description', 'Warehouse district reimagined for immersive multimedia gigs.',
        'vibe', 'DIY innovation'
      ),
      jsonb_build_object(
        'id', 'solace-innovation-yard',
        'name', 'Innovation Yard',
        'category', 'Campus',
        'description', 'Sustainability campus with pop-up listening pods and labs.',
        'vibe', 'Future-forward collaboration'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', 'solace-tram-loop',
        'name', 'Coastal Tram Loop',
        'mode', 'tram',
        'travel_time', 0.23,
        'cost', 4,
        'comfort', 4,
        'description', 'Solar-powered tram hugging the shoreline arts trail.'
      ),
      jsonb_build_object(
        'id', 'solace-solar-ferry',
        'name', 'Solar Ferry Network',
        'mode', 'ferry',
        'travel_time', 0.3,
        'cost', 6,
        'comfort', 3,
        'description', 'Quiet catamarans linking harbor stages and floating studios.'
      ),
      jsonb_build_object(
        'id', 'solace-indiecycle-grid',
        'name', 'IndieCycle Grid',
        'mode', 'bike_share',
        'travel_time', 0.17,
        'cost', 2,
        'comfort', 3,
        'description', 'Smart bike paths connecting rehearsal lofts across the city.'
      )
    )
  )
  ON CONFLICT (city_id) DO UPDATE SET
    summary = EXCLUDED.summary,
    famous_resident = EXCLUDED.famous_resident,
    signature_sound = EXCLUDED.signature_sound,
    metro_area = EXCLUDED.metro_area,
    timezone = EXCLUDED.timezone,
    aliases = EXCLUDED.aliases,
    intra_locations = EXCLUDED.intra_locations,
    travel_modes = EXCLUDED.travel_modes,
    updated_at = timezone('utc'::text, now());
END;
$$;

DO $$
DECLARE
  city_uuid uuid;
BEGIN
  SELECT id INTO city_uuid
  FROM public.cities
  WHERE name = 'Vela Horizonte'
  LIMIT 1;

  IF city_uuid IS NULL THEN
    RAISE EXCEPTION 'City % missing for city_metadata seed', 'Vela Horizonte';
  END IF;

  INSERT INTO public.city_metadata (
    city_id,
    summary,
    famous_resident,
    signature_sound,
    metro_area,
    timezone,
    aliases,
    intra_locations,
    travel_modes
  ) VALUES (
    city_uuid,
    'Tropical metropolis where rainforest rhythms meet futurist skyline venues.',
    'Marina Sol',
    'Tropical percussion colliding with futurist synth swells.',
    'Atlântico Sul Corridor',
    'America/Sao_Paulo',
    ARRAY['Vela Horizonte', 'Selva City'],
    jsonb_build_array(
      jsonb_build_object(
        'id', 'vela-lumen-heights',
        'name', 'Lumen Heights',
        'category', 'Hilltop',
        'description', 'Hilltop barrio with projection-mapped amphitheaters.',
        'vibe', 'Festive twilight energy'
      ),
      jsonb_build_object(
        'id', 'vela-ritmo-mercado',
        'name', 'Ritmo Mercado',
        'category', 'Market',
        'description', 'Street market of percussion collectives and dance battles.',
        'vibe', 'Perpetual celebration'
      ),
      jsonb_build_object(
        'id', 'vela-rainforest-fringe',
        'name', 'Rainforest Fringe',
        'category', 'Canopy',
        'description', 'Suspended platforms weaving through biodomes and canopy paths.',
        'vibe', 'Lush organic ambience'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', 'vela-selva-skyrail',
        'name', 'Selva Skyrail',
        'mode', 'skyrail',
        'travel_time', 0.18,
        'cost', 7,
        'comfort', 4,
        'description', 'Gondola weaving above the canopy connecting eco-stages.'
      ),
      jsonb_build_object(
        'id', 'vela-samba-riverboats',
        'name', 'Samba Riverboats',
        'mode', 'riverboat',
        'travel_time', 0.25,
        'cost', 5,
        'comfort', 3,
        'description', 'Colorful boats ferry crowds along the glittering riverfront.'
      ),
      jsonb_build_object(
        'id', 'vela-midnight-moto',
        'name', 'Midnight Moto Crew',
        'mode', 'moto_taxi',
        'travel_time', 0.13,
        'cost', 3,
        'comfort', 2,
        'description', 'Coordinated moto taxis keeping late shows moving through traffic.'
      )
    )
  )
  ON CONFLICT (city_id) DO UPDATE SET
    summary = EXCLUDED.summary,
    famous_resident = EXCLUDED.famous_resident,
    signature_sound = EXCLUDED.signature_sound,
    metro_area = EXCLUDED.metro_area,
    timezone = EXCLUDED.timezone,
    aliases = EXCLUDED.aliases,
    intra_locations = EXCLUDED.intra_locations,
    travel_modes = EXCLUDED.travel_modes,
    updated_at = timezone('utc'::text, now());
END;
$$;

DO $$
DECLARE
  city_uuid uuid;
BEGIN
  SELECT id INTO city_uuid
  FROM public.cities
  WHERE name = 'Asterhaven'
  LIMIT 1;

  IF city_uuid IS NULL THEN
    RAISE EXCEPTION 'City % missing for city_metadata seed', 'Asterhaven';
  END IF;

  INSERT INTO public.city_metadata (
    city_id,
    summary,
    famous_resident,
    signature_sound,
    metro_area,
    timezone,
    aliases,
    intra_locations,
    travel_modes
  ) VALUES (
    city_uuid,
    'Historic capital reinvented with skybridge stages and immersive galleries.',
    'Sir Cadence Vale',
    'Cathedral-scale chamber pop with modular synth flourishes.',
    'Crown Archipelago',
    'Europe/London',
    ARRAY['Asterhaven', 'Crown City'],
    jsonb_build_array(
      jsonb_build_object(
        'id', 'asterhaven-cathedral-quarter',
        'name', 'Cathedral Quarter',
        'category', 'Historic District',
        'description', 'Gothic halls transformed into resonant chamber pop venues.',
        'vibe', 'Reverent grandeur'
      ),
      jsonb_build_object(
        'id', 'asterhaven-synth-docklands',
        'name', 'Synth Docklands',
        'category', 'Redeveloped Docks',
        'description', 'Redeveloped docks pulsing with modular synth labs and clubs.',
        'vibe', 'Sleek nocturnal energy'
      ),
      jsonb_build_object(
        'id', 'asterhaven-greenbelt-commons',
        'name', 'Greenbelt Commons',
        'category', 'Parklands',
        'description', 'Verdant parks hosting afternoon folk circles and avant-garde picnics.',
        'vibe', 'Warm community spirit'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', 'asterhaven-skybridge-tramway',
        'name', 'Skybridge Tramway',
        'mode', 'tram',
        'travel_time', 0.15,
        'cost', 4,
        'comfort', 4,
        'description', 'Glass bridges linking skyline stages with tram glides.'
      ),
      jsonb_build_object(
        'id', 'asterhaven-night-tube',
        'name', 'Night Tube Lines',
        'mode', 'tube',
        'travel_time', 0.1,
        'cost', 3,
        'comfort', 3,
        'description', 'After-hours underground service prioritising venue stops.'
      ),
      jsonb_build_object(
        'id', 'asterhaven-thameslite-clippers',
        'name', 'Thameslite Clippers',
        'mode', 'water_taxi',
        'travel_time', 0.22,
        'cost', 5,
        'comfort', 4,
        'description', 'Electric water taxis drifting between riverside performances.'
      )
    )
  )
  ON CONFLICT (city_id) DO UPDATE SET
    summary = EXCLUDED.summary,
    famous_resident = EXCLUDED.famous_resident,
    signature_sound = EXCLUDED.signature_sound,
    metro_area = EXCLUDED.metro_area,
    timezone = EXCLUDED.timezone,
    aliases = EXCLUDED.aliases,
    intra_locations = EXCLUDED.intra_locations,
    travel_modes = EXCLUDED.travel_modes,
    updated_at = timezone('utc'::text, now());
END;
$$;

DO $$
DECLARE
  city_uuid uuid;
BEGIN
  SELECT id INTO city_uuid
  FROM public.cities
  WHERE name = 'Portsmouth'
  LIMIT 1;

  IF city_uuid IS NULL THEN
    RAISE EXCEPTION 'City % missing for city_metadata seed', 'Portsmouth';
  END IF;

  INSERT INTO public.city_metadata (
    city_id,
    summary,
    famous_resident,
    signature_sound,
    metro_area,
    timezone,
    aliases,
    intra_locations,
    travel_modes
  ) VALUES (
    city_uuid,
    'Historic naval port where waterfront clubs champion emerging indie and soul acts.',
    'DJ Marina Blake',
    'Sea-breeze soul with coastal indie hooks.',
    'Solent Waterfront',
    'Europe/London',
    ARRAY['Portsmouth', 'Southsea'],
    jsonb_build_array(
      jsonb_build_object(
        'id', 'portsmouth-southsea-promenade',
        'name', 'Southsea Promenade',
        'category', 'Seafront',
        'description', 'Seaside stretch of cozy clubs and outdoor stages overlooking the Solent.',
        'vibe', 'Salt-air indie energy'
      ),
      jsonb_build_object(
        'id', 'portsmouth-historic-dockyard',
        'name', 'Historic Dockyard',
        'category', 'Dockyard',
        'description', 'Reclaimed naval warehouses housing soul collectives and museums.',
        'vibe', 'Industrial heritage glow'
      ),
      jsonb_build_object(
        'id', 'portsmouth-guildhall-quarter',
        'name', 'Guildhall Quarter',
        'category', 'Civic Center',
        'description', 'Neo-classical squares mixing student jazz lounges with buskers.',
        'vibe', 'Academic arts bustle'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', 'portsmouth-solent-shuttle',
        'name', 'Solent Shuttle',
        'mode', 'ferry',
        'travel_time', 0.12,
        'cost', 3,
        'comfort', 3,
        'description', 'Electric harbour ferries connecting Southsea with the Dockyard.'
      ),
      jsonb_build_object(
        'id', 'portsmouth-guildhall-link',
        'name', 'Guildhall Link',
        'mode', 'tram',
        'travel_time', 0.15,
        'cost', 2,
        'comfort', 3,
        'description', 'Compact tram loop threading university venues with downtown stages.'
      ),
      jsonb_build_object(
        'id', 'portsmouth-midnight-spinnaker',
        'name', 'Midnight Spinnaker',
        'mode', 'night_bus',
        'travel_time', 0.25,
        'cost', 2,
        'comfort', 2,
        'description', 'Overnight route keeping musicians moving between rehearsal spaces and hostels.'
      )
    )
  )
  ON CONFLICT (city_id) DO UPDATE SET
    summary = EXCLUDED.summary,
    famous_resident = EXCLUDED.famous_resident,
    signature_sound = EXCLUDED.signature_sound,
    metro_area = EXCLUDED.metro_area,
    timezone = EXCLUDED.timezone,
    aliases = EXCLUDED.aliases,
    intra_locations = EXCLUDED.intra_locations,
    travel_modes = EXCLUDED.travel_modes,
    updated_at = timezone('utc'::text, now());
END;
$$;
