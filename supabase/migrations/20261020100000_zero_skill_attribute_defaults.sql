-- Align player skill and attribute baselines with zeroed defaults
BEGIN;

-- Ensure all player skill columns default to 0 and backfill existing data
DO $$
DECLARE
  skill_columns constant text[] := ARRAY[
    'guitar',
    'vocals',
    'drums',
    'bass',
    'performance',
    'songwriting',
    'composition',
    'technical'
  ];
  present_skill_columns text[] := ARRAY[]::text[];
  column_name text;
  check_fragments text[] := ARRAY[]::text[];
  check_sql text;
BEGIN
  FOREACH column_name IN ARRAY skill_columns LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns AS cols
      WHERE cols.table_schema = 'public'
        AND cols.table_name = 'player_skills'
        AND cols.column_name = column_name
    ) THEN
      EXECUTE format('ALTER TABLE public.player_skills ALTER COLUMN %I SET DEFAULT 0', column_name);
      EXECUTE format('UPDATE public.player_skills SET %I = 0', column_name);
      EXECUTE format('ALTER TABLE public.player_skills ALTER COLUMN %I SET NOT NULL', column_name);
      present_skill_columns := array_append(present_skill_columns, column_name);
      check_fragments := array_append(check_fragments, format('%I BETWEEN 0 AND 100', column_name));
    END IF;
  END LOOP;

  IF array_length(present_skill_columns, 1) IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.player_skills DROP CONSTRAINT IF EXISTS player_skills_value_bounds_check';
    check_sql := 'ALTER TABLE public.player_skills ADD CONSTRAINT player_skills_value_bounds_check CHECK (' ||
      array_to_string(check_fragments, ' AND ') || ')';
    EXECUTE check_sql;
  END IF;
END;
$$;

-- Ensure all tracked player attributes default to 0 and backfill data
DO $$
DECLARE
  attribute_columns constant text[] := ARRAY[
    'physical_endurance',
    'mental_focus',
    'stage_presence',
    'crowd_engagement',
    'social_reach'
  ];
  present_attribute_columns text[] := ARRAY[]::text[];
  column_name text;
  check_fragments text[] := ARRAY[]::text[];
  check_sql text;
BEGIN
  FOREACH column_name IN ARRAY attribute_columns LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns AS cols
      WHERE cols.table_schema = 'public'
        AND cols.table_name = 'player_attributes'
        AND cols.column_name = column_name
    ) THEN
      EXECUTE format('ALTER TABLE public.player_attributes ALTER COLUMN %I SET DEFAULT 0', column_name);
      EXECUTE format('UPDATE public.player_attributes SET %I = 0', column_name);
      EXECUTE format('ALTER TABLE public.player_attributes ALTER COLUMN %I SET NOT NULL', column_name);
      present_attribute_columns := array_append(present_attribute_columns, column_name);
      check_fragments := array_append(check_fragments, format('%I BETWEEN 0 AND 3', column_name));
    END IF;
  END LOOP;

  IF array_length(present_attribute_columns, 1) IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.player_attributes DROP CONSTRAINT IF EXISTS player_attributes_value_bounds';
    check_sql := 'ALTER TABLE public.player_attributes ADD CONSTRAINT player_attributes_value_bounds CHECK (' ||
      array_to_string(check_fragments, ' AND ') || ')';
    EXECUTE check_sql;
  END IF;
END;
$$;

-- Provision new accounts with zeroed skills and attributes
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  portsmouth_id uuid;
  new_profile public.profiles%ROWTYPE;
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
    age,
    slot_number,
    unlock_cost,
    is_active
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
    DEFAULT,
    1,
    0,
    true
  )
  RETURNING * INTO new_profile;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  INSERT INTO public.player_skills (
    user_id,
    profile_id,
    guitar,
    vocals,
    drums,
    bass,
    performance,
    songwriting,
    composition
  )
  VALUES (
    NEW.id,
    new_profile.id,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  )
  ON CONFLICT (profile_id) DO NOTHING;

  INSERT INTO public.fan_demographics (user_id)
  VALUES (NEW.id);

  INSERT INTO public.activity_feed (user_id, profile_id, activity_type, message)
  VALUES (NEW.id, new_profile.id, 'join', 'Welcome to Rockmundo! Your musical journey begins now.');

  INSERT INTO public.player_attributes (
    user_id,
    profile_id,
    physical_endurance,
    mental_focus,
    stage_presence,
    crowd_engagement,
    social_reach,
    attribute_points
  )
  VALUES (
    NEW.id,
    new_profile.id,
    0,
    0,
    0,
    0,
    0,
    0
  )
  ON CONFLICT (profile_id) DO NOTHING;

  INSERT INTO public.player_achievements (user_id, achievement_id)
  SELECT NEW.id, id FROM public.achievements WHERE name = 'First Steps';

  RETURN NEW;
END;
$function$;

-- Ensure resets also zero out regenerated characters
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
    age,
    slot_number,
    unlock_cost,
    is_active
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
    DEFAULT,
    1,
    0,
    true
  )
  RETURNING * INTO new_profile;

  INSERT INTO public.player_skills (
    user_id,
    profile_id,
    guitar,
    vocals,
    drums,
    bass,
    performance,
    songwriting,
    composition
  )
  VALUES (
    current_user_id,
    new_profile.id,
    0,
    0,
    0,
    0,
    0,
    0,
    0
  )
  RETURNING * INTO new_skills;

  INSERT INTO public.player_attributes (
    user_id,
    profile_id,
    physical_endurance,
    mental_focus,
    stage_presence,
    crowd_engagement,
    social_reach,
    attribute_points
  )
  VALUES (
    current_user_id,
    new_profile.id,
    0,
    0,
    0,
    0,
    0,
    0
  )
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

COMMIT;
