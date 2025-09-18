-- Ensure London is the default starting city and align dependent defaults
DO $$
DECLARE
  london_uuid uuid;
  london_seed_uuid CONSTANT uuid := '8d2e9d90-7f57-4df4-bc51-6f4743625f59';
  portsmouth_uuid CONSTANT uuid := 'a5bf9a04-5c3b-4c7c-99bb-f3a4ed2d64d6';
BEGIN
  SELECT id INTO london_uuid
  FROM public.cities
  WHERE name = 'London';

  IF london_uuid IS NULL THEN
    london_uuid := london_seed_uuid;

    INSERT INTO public.cities (
      id,
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
      travel_hub,
      busking_value
    ) VALUES (
      london_uuid,
      'London',
      'United Kingdom',
      'Global hub where legendary rock clubs meet cutting-edge studio districts.',
      '+6% fan growth from sold-out club runs, +4% sponsorship offers after arena shows',
      true,
      9300000,
      92,
      112,
      'Rock',
      320,
      1.15,
      ARRAY[
        'Camden Amplifier Week',
        'Soho Session Crawl',
        'Royal Dome Residency'
      ],
      '[{"name":"Camden Circuit","description":"Iconic indie stretch of venues packed with late-night showcases.","highlights":["Electric Ballroom","Roundhouse"],"signature_venue":"Electric Ballroom","vibe":"Sweaty guitars and singalongs","average_ticket_price":32},{"name":"Soho Sound Lanes","description":"Labyrinth of jazz basements and neon-lit pop-up clubs.","highlights":["Ronnie Scott''s","Berwick Cellars"],"signature_venue":"Midnight Muse","vibe":"After-hours groove","average_ticket_price":38},{"name":"Royal Riverside","description":"Thames-side stages blending orchestral halls with modern arenas.","highlights":["Royal Dome","Waterline Pavilion"],"signature_venue":"Royal Dome","vibe":"Polished spectacle","average_ticket_price":55}]'::jsonb,
      '[{"mode":"tube","name":"Northern Pulse","description":"Core Underground line threading rehearsal hubs and club districts.","duration_minutes":9,"frequency":"Every 3 minutes","average_cost":4,"connects_to":["Camden Circuit","Soho Sound Lanes"],"comfort":"Packed but electric"},{"mode":"overground","name":"Skyline Loop","description":"Orbital rail linking arenas with riverside festival grounds.","duration_minutes":14,"frequency":"Every 6 minutes","average_cost":5,"connects_to":["Royal Riverside","Camden Circuit"],"comfort":"Panoramic city views"},{"mode":"river_bus","name":"Thames Rush","description":"Express river boats delivering artists to waterfront stages.","duration_minutes":12,"frequency":"Every 10 minutes","average_cost":6,"connects_to":["Royal Riverside","Soho Sound Lanes"],"comfort":"Open-deck breeze"}]'::jsonb,
      'Dame Lyra Steel',
      'St Pancras International',
      1.14
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF london_uuid IS NULL THEN
    SELECT id INTO london_uuid
    FROM public.cities
    WHERE id = london_seed_uuid;
  END IF;

  IF london_uuid IS NULL THEN
    RAISE EXCEPTION 'London city record could not be ensured';
  END IF;

  UPDATE public.cities
  SET
    name = 'London',
    country = 'United Kingdom',
    description = 'Global hub where legendary rock clubs meet cutting-edge studio districts.',
    bonuses = '+6% fan growth from sold-out club runs, +4% sponsorship offers after arena shows',
    unlocked = true,
    population = 9300000,
    music_scene = 92,
    cost_of_living = 112,
    dominant_genre = 'Rock',
    venues = 320,
    local_bonus = 1.15,
    cultural_events = ARRAY[
      'Camden Amplifier Week',
      'Soho Session Crawl',
      'Royal Dome Residency'
    ],
    districts = '[{"name":"Camden Circuit","description":"Iconic indie stretch of venues packed with late-night showcases.","highlights":["Electric Ballroom","Roundhouse"],"signature_venue":"Electric Ballroom","vibe":"Sweaty guitars and singalongs","average_ticket_price":32},{"name":"Soho Sound Lanes","description":"Labyrinth of jazz basements and neon-lit pop-up clubs.","highlights":["Ronnie Scott''s","Berwick Cellars"],"signature_venue":"Midnight Muse","vibe":"After-hours groove","average_ticket_price":38},{"name":"Royal Riverside","description":"Thames-side stages blending orchestral halls with modern arenas.","highlights":["Royal Dome","Waterline Pavilion"],"signature_venue":"Royal Dome","vibe":"Polished spectacle","average_ticket_price":55}]'::jsonb,
    travel_nodes = '[{"mode":"tube","name":"Northern Pulse","description":"Core Underground line threading rehearsal hubs and club districts.","duration_minutes":9,"frequency":"Every 3 minutes","average_cost":4,"connects_to":["Camden Circuit","Soho Sound Lanes"],"comfort":"Packed but electric"},{"mode":"overground","name":"Skyline Loop","description":"Orbital rail linking arenas with riverside festival grounds.","duration_minutes":14,"frequency":"Every 6 minutes","average_cost":5,"connects_to":["Royal Riverside","Camden Circuit"],"comfort":"Panoramic city views"},{"mode":"river_bus","name":"Thames Rush","description":"Express river boats delivering artists to waterfront stages.","duration_minutes":12,"frequency":"Every 10 minutes","average_cost":6,"connects_to":["Royal Riverside","Soho Sound Lanes"],"comfort":"Open-deck breeze"}]'::jsonb,
    famous_resident = 'Dame Lyra Steel',
    travel_hub = 'St Pancras International',
    busking_value = 1.14
  WHERE id = london_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'London city record missing after update';
  END IF;

  EXECUTE format(
    'ALTER TABLE public.profiles ALTER COLUMN current_city_id SET DEFAULT %L::uuid;',
    london_uuid::text
  );

  EXECUTE format(
    'UPDATE public.profiles SET current_city_id = %1$L::uuid WHERE current_city_id IS NULL OR current_city_id = %2$L::uuid;',
    london_uuid::text,
    portsmouth_uuid::text
  );

  EXECUTE format($fn$
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = 'public'
    AS $function$
    DECLARE
      london_id uuid;
    BEGIN
      SELECT id INTO london_id
      FROM public.cities
      WHERE id = %1$L::uuid;

      IF london_id IS NULL THEN
        RAISE EXCEPTION 'Default city London is missing';
      END IF;

      INSERT INTO public.profiles (
        user_id,
        username,
        display_name,
        current_city_id,
        current_location,
        health,
        gender,
        city_of_birth,
        age,
        slot_number,
        unlock_cost,
        is_active
      )
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'Player' || substr(NEW.id::text, 1, 8)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', 'New Player'),
        london_id,
        DEFAULT,
        DEFAULT,
        DEFAULT,
        DEFAULT,
        DEFAULT,
        1,
        0,
        true
      );

      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'user');

      INSERT INTO public.player_skills (user_id)
      VALUES (NEW.id);

      INSERT INTO public.fan_demographics (user_id)
      VALUES (NEW.id);

      INSERT INTO public.activity_feed (user_id, activity_type, message)
      VALUES (NEW.id, 'join', 'Welcome to Rockmundo! Your musical journey begins now.');

      INSERT INTO public.player_attributes (user_id, profile_id)
      SELECT p.user_id, p.id
      FROM public.profiles AS p
      WHERE p.user_id = NEW.id
      ORDER BY p.created_at DESC
      LIMIT 1
      ON CONFLICT (profile_id) DO NOTHING;

      INSERT INTO public.player_achievements (user_id, achievement_id)
      SELECT NEW.id, id FROM public.achievements WHERE name = 'First Steps';

      RETURN NEW;
    END;
    $function$;
  $fn$, london_uuid::text);

  EXECUTE format($fn$
    CREATE OR REPLACE FUNCTION public.reset_player_character()
    RETURNS TABLE (
      profile public.profiles,
      skills public.player_skills,
      attributes public.player_attributes
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      current_user_id uuid := auth.uid();
      generated_username text;
      new_profile public.profiles%ROWTYPE;
      new_skills public.player_skills%ROWTYPE;
      new_attributes public.player_attributes%ROWTYPE;
      london_id uuid;
    BEGIN
      IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to reset character' USING ERRCODE = '42501';
      END IF;

      SELECT id INTO london_id
      FROM public.cities
      WHERE id = %1$L::uuid;

      IF london_id IS NULL THEN
        RAISE EXCEPTION 'Default city London is missing';
      END IF;

      generated_username := 'Player' || substr(current_user_id::text, 1, 8);

      DELETE FROM public.social_comments WHERE user_id = current_user_id;
      DELETE FROM public.social_reposts WHERE user_id = current_user_id;
      DELETE FROM public.social_posts WHERE user_id = current_user_id;
      DELETE FROM public.promotion_campaigns WHERE user_id = current_user_id;
      DELETE FROM public.social_campaigns WHERE user_id = current_user_id;
      DELETE FROM public.streaming_stats WHERE user_id = current_user_id;
      DELETE FROM public.player_equipment WHERE user_id = current_user_id;
      DELETE FROM public.player_streaming_accounts WHERE user_id = current_user_id;
      DELETE FROM public.player_achievements WHERE user_id = current_user_id;
      DELETE FROM public.contracts WHERE user_id = current_user_id;
      DELETE FROM public.gig_performances WHERE user_id = current_user_id;
      DELETE FROM public.tours WHERE user_id = current_user_id;
      DELETE FROM public.venue_bookings WHERE user_id = current_user_id;
      DELETE FROM public.venue_relationships WHERE user_id = current_user_id;
      DELETE FROM public.user_actions WHERE user_id = current_user_id;
      DELETE FROM public.global_chat WHERE user_id = current_user_id;
      DELETE FROM public.activity_feed WHERE user_id = current_user_id;
      DELETE FROM public.fan_demographics WHERE user_id = current_user_id;
      DELETE FROM public.band_members WHERE user_id = current_user_id;
      DELETE FROM public.player_attributes WHERE user_id = current_user_id;

      DELETE FROM public.band_conflicts
        WHERE band_id IN (
          SELECT id FROM public.bands WHERE leader_id = current_user_id
        );
      DELETE FROM public.bands WHERE leader_id = current_user_id;

      DELETE FROM public.songs WHERE user_id = current_user_id;

      DELETE FROM public.player_skills WHERE user_id = current_user_id;
      DELETE FROM public.profiles WHERE user_id = current_user_id;

      INSERT INTO public.profiles (
        user_id,
        username,
        display_name,
        current_city_id,
        current_location,
        health,
        gender,
        city_of_birth,
        age,
        slot_number,
        unlock_cost,
        is_active
      )
      VALUES (
        current_user_id,
        generated_username,
        'New Player',
        london_id,
        DEFAULT,
        DEFAULT,
        DEFAULT,
        DEFAULT,
        DEFAULT,
        1,
        0,
        true
      )
      RETURNING * INTO new_profile;

      INSERT INTO public.player_skills (user_id)
      VALUES (current_user_id)
      RETURNING * INTO new_skills;

      INSERT INTO public.player_attributes (user_id, profile_id)
      VALUES (current_user_id, new_profile.id)
      RETURNING * INTO new_attributes;

      INSERT INTO public.fan_demographics (user_id)
      VALUES (current_user_id);

      INSERT INTO public.activity_feed (user_id, activity_type, message)
      VALUES (
        current_user_id,
        'reset',
        'Your journey has been reset. Time to create a new legend!'
      );

      RETURN QUERY SELECT new_profile, new_skills, new_attributes;
    END;
    $$;
  $fn$, london_uuid::text);

  EXECUTE 'GRANT EXECUTE ON FUNCTION public.reset_player_character() TO authenticated;';
END;
$$;
