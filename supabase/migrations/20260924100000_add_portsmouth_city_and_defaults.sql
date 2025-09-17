-- Seed Portsmouth as a default starting city and align dependent data
DO $$
DECLARE
  target_city_id CONSTANT uuid := 'a5bf9a04-5c3b-4c7c-99bb-f3a4ed2d64d6';
  existing_city_id uuid;
BEGIN
  SELECT id INTO existing_city_id
  FROM public.cities
  WHERE name = 'Portsmouth';

  IF existing_city_id IS NOT NULL AND existing_city_id <> target_city_id THEN
    RAISE EXCEPTION 'Existing Portsmouth city uses unexpected id %, expected %', existing_city_id, target_city_id;
  END IF;

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
    target_city_id,
    'Portsmouth',
    'United Kingdom',
    'Historic naval port where waterfront clubs champion emerging indie and soul acts.',
    '+5% merch sales at coastal gigs, +8% fan engagement for maritime festivals',
    true,
    215000,
    72,
    68,
    'Indie Soul',
    1,
    1.08,
    ARRAY[
      'Harbour Lights Showcase',
      'Southsea Sound Circuit',
      'Dockyard Revival Nights'
    ],
    '[{"name":"Southsea Promenade","description":"Seaside stretch of cozy clubs and outdoor stages overlooking the Solent.","highlights":["Pierline Pavilion","Bandstand Terrace"],"signature_venue":"The Wedgewood Room","vibe":"Salt-air indie energy","average_ticket_price":22},{"name":"Historic Dockyard","description":"Reclaimed naval warehouses now housing soul collectives and maritime museums.","highlights":["Signal House","Anchor Forge"],"signature_venue":"Flagship Atrium","vibe":"Industrial heritage glow","average_ticket_price":28},{"name":"Guildhall Quarter","description":"Neo-classical squares blending student jazz lounges with late-night buskers.","highlights":["Guild Steps","Cathedral Lanes"],"signature_venue":"Guildhall Rotunda","vibe":"Academic arts bustle","average_ticket_price":24}]'::jsonb,
    '[{"mode":"ferry","name":"Solent Shuttle","description":"Electric harbour ferries connecting Southsea with the Historic Dockyard.","duration_minutes":7,"frequency":"Every 10 minutes","average_cost":3,"connects_to":["Southsea Promenade","Historic Dockyard"],"comfort":"Sea breeze decks"},{"mode":"tram","name":"Guildhall Link","description":"Compact tram loop that threads university venues with downtown stages.","duration_minutes":9,"frequency":"Every 6 minutes","average_cost":2,"connects_to":["Guildhall Quarter","Southsea Promenade"],"comfort":"Art deco cabins"},{"mode":"night_bus","name":"Midnight Spinnaker","description":"Overnight route keeping musicians moving between rehearsal spaces and hostels.","duration_minutes":15,"frequency":"Every 20 minutes","average_cost":2,"connects_to":["Southsea Promenade","Historic Dockyard","Guildhall Quarter"],"comfort":"Low-lit ambience"}]'::jsonb,
    'DJ Marina Blake',
    'Portsmouth & Southsea Station',
    1.12
  )
  ON CONFLICT (name) DO UPDATE
  SET
    id = EXCLUDED.id,
    country = EXCLUDED.country,
    description = EXCLUDED.description,
    bonuses = EXCLUDED.bonuses,
    unlocked = EXCLUDED.unlocked,
    population = EXCLUDED.population,
    music_scene = EXCLUDED.music_scene,
    cost_of_living = EXCLUDED.cost_of_living,
    dominant_genre = EXCLUDED.dominant_genre,
    venues = EXCLUDED.venues,
    local_bonus = EXCLUDED.local_bonus,
    cultural_events = EXCLUDED.cultural_events,
    districts = EXCLUDED.districts,
    travel_nodes = EXCLUDED.travel_nodes,
    famous_resident = EXCLUDED.famous_resident,
    travel_hub = EXCLUDED.travel_hub,
    busking_value = EXCLUDED.busking_value;

  IF NOT EXISTS (
    SELECT 1 FROM public.cities WHERE id = target_city_id
  ) THEN
    RAISE EXCEPTION 'Failed to ensure Portsmouth has expected id %', target_city_id;
  END IF;

END;
$$;

-- Align starter venue offerings with Portsmouth
INSERT INTO public.venues (name, location, venue_type, capacity, base_payment, prestige_level, requirements)
VALUES (
  'The Wedgewood Room',
  'Portsmouth',
  'club',
  400,
  1000,
  2,
  '{"fame": 100}'
)
ON CONFLICT (name) DO UPDATE
SET
  location = EXCLUDED.location,
  venue_type = EXCLUDED.venue_type,
  capacity = EXCLUDED.capacity,
  base_payment = EXCLUDED.base_payment,
  prestige_level = EXCLUDED.prestige_level,
  requirements = EXCLUDED.requirements;

-- Make Portsmouth the default city for new and existing profiles
ALTER TABLE public.profiles
  ALTER COLUMN current_city_id SET DEFAULT 'a5bf9a04-5c3b-4c7c-99bb-f3a4ed2d64d6'::uuid;

UPDATE public.profiles
SET current_city_id = 'a5bf9a04-5c3b-4c7c-99bb-f3a4ed2d64d6'::uuid
WHERE current_city_id IS NULL;

-- Ensure busking multipliers cover Portsmouth explicitly
UPDATE public.cities
SET busking_value = 1.12
WHERE name = 'Portsmouth';

-- Refresh onboarding and reset routines to pin players to Portsmouth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  portsmouth_id uuid;
BEGIN
  SELECT id INTO portsmouth_id
  FROM public.cities
  WHERE id = 'a5bf9a04-5c3b-4c7c-99bb-f3a4ed2d64d6';

  IF portsmouth_id IS NULL THEN
    RAISE EXCEPTION 'Default city Portsmouth is missing';
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
    age
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'Player' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'New Player'),
    portsmouth_id,
    DEFAULT,
    DEFAULT,
    DEFAULT,
    DEFAULT,
    DEFAULT
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
  portsmouth_id uuid;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to reset character' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO portsmouth_id
  FROM public.cities
  WHERE id = 'a5bf9a04-5c3b-4c7c-99bb-f3a4ed2d64d6';

  IF portsmouth_id IS NULL THEN
    RAISE EXCEPTION 'Default city Portsmouth is missing';
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
    age
  )
  VALUES (
    current_user_id,
    generated_username,
    'New Player',
    portsmouth_id,
    DEFAULT,
    DEFAULT,
    DEFAULT,
    DEFAULT,
    DEFAULT
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

GRANT EXECUTE ON FUNCTION public.reset_player_character() TO authenticated;
