-- Add character slot metadata to profiles and ensure active slot tracking
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS slot_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unlock_cost integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;

WITH ranked_profiles AS (
  SELECT
    id,
    user_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY created_at, id
    ) AS slot_rank
  FROM public.profiles
)
UPDATE public.profiles AS p
SET
  slot_number = ranked_profiles.slot_rank,
  unlock_cost = COALESCE(p.unlock_cost, 0),
  is_active = ranked_profiles.slot_rank = 1
FROM ranked_profiles
WHERE p.id = ranked_profiles.id;

ALTER TABLE public.profiles
  ALTER COLUMN slot_number SET NOT NULL,
  ALTER COLUMN unlock_cost SET NOT NULL,
  ALTER COLUMN is_active SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_unique_user_slot UNIQUE (user_id, slot_number);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_single_active_per_user
  ON public.profiles (user_id)
  WHERE is_active;

-- Ensure new users and resets provision characters with slot metadata
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
