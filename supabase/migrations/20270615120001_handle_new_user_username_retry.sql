-- Ensure onboarding can gracefully handle username collisions during signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  default_city_id uuid := public.get_default_city_id();
  base_username text := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'username'), ''),
    'player' || substr(NEW.id::text, 1, 8)
  );
  sanitized_username text := lower(regexp_replace(base_username, '[^a-z0-9_]', '', 'gi'));
  username_root text;
  candidate_username text;
  suffix_attempts integer := 0;
  suffix_token text;
  safe_display_name text := left(
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'display_name'), ''), 'New Player'),
    100
  );
  new_profile public.profiles%ROWTYPE;
BEGIN
  IF sanitized_username IS NULL OR char_length(sanitized_username) = 0 THEN
    sanitized_username := 'player' || substr(NEW.id::text, 1, 8);
  END IF;

  username_root := left(sanitized_username, 50);

  LOOP
    IF suffix_attempts = 0 THEN
      candidate_username := username_root;
    ELSE
      suffix_token := lpad(((floor(random() * 10000))::int)::text, 4, '0');
      candidate_username := left(username_root, GREATEST(1, 50 - char_length(suffix_token))) || suffix_token;
    END IF;

    BEGIN
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
        candidate_username,
        safe_display_name,
        default_city_id,
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

      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        IF SQLERRM LIKE '%profiles_username_key%' THEN
          suffix_attempts := suffix_attempts + 1;
        ELSE
          RAISE;
        END IF;
    END;
  END LOOP;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.player_skills (
    user_id,
    profile_id,
    guitar,
    vocals,
    drums,
    bass,
    performance,
    songwriting,
    composition,
    creativity,
    technical,
    business,
    marketing
  )
  VALUES (
    NEW.id,
    new_profile.id,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5
  )
  ON CONFLICT (profile_id) DO NOTHING;

  INSERT INTO public.fan_demographics (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.activity_feed (user_id, profile_id, activity_type, message)
  VALUES (
    NEW.id,
    new_profile.id,
    'join',
    'Welcome to Rockmundo! Your musical journey begins now.'
  );

  UPDATE public.player_attributes
  SET
    profile_id = new_profile.id,
    physical_endurance = 5,
    mental_focus = 5,
    stage_presence = 5,
    crowd_engagement = 5,
    social_reach = 5,
    looks = 5,
    charisma = 5,
    musicality = 5,
    creativity = 5,
    technical = 5,
    business = 5,
    marketing = 5,
    composition = 5,
    attribute_points = 0,
    attribute_points_spent = 0
  WHERE user_id = NEW.id;

  IF NOT FOUND THEN
    INSERT INTO public.player_attributes (
      user_id,
      profile_id,
      physical_endurance,
      mental_focus,
      stage_presence,
      crowd_engagement,
      social_reach,
      looks,
      charisma,
      musicality,
      creativity,
      technical,
      business,
      marketing,
      composition,
      attribute_points,
      attribute_points_spent
    )
    VALUES (
      NEW.id,
      new_profile.id,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      5,
      0,
      0
    )
    ON CONFLICT ON CONSTRAINT player_attributes_user_id_key DO UPDATE SET
      profile_id = EXCLUDED.profile_id,
      physical_endurance = EXCLUDED.physical_endurance,
      mental_focus = EXCLUDED.mental_focus,
      stage_presence = EXCLUDED.stage_presence,
      crowd_engagement = EXCLUDED.crowd_engagement,
      social_reach = EXCLUDED.social_reach,
      looks = EXCLUDED.looks,
      charisma = EXCLUDED.charisma,
      musicality = EXCLUDED.musicality,
      creativity = EXCLUDED.creativity,
      technical = EXCLUDED.technical,
      business = EXCLUDED.business,
      marketing = EXCLUDED.marketing,
      composition = EXCLUDED.composition,
      attribute_points = EXCLUDED.attribute_points,
      attribute_points_spent = EXCLUDED.attribute_points_spent;
  END IF;

  INSERT INTO public.player_achievements (user_id, achievement_id)
  SELECT NEW.id, id
  FROM public.achievements
  WHERE name = 'First Steps'
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
