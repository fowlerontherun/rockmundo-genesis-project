-- Add location and health tracking to player profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_city_id uuid REFERENCES public.cities(id),
  ADD COLUMN IF NOT EXISTS current_location text DEFAULT 'Unknown',
  ADD COLUMN IF NOT EXISTS health integer NOT NULL DEFAULT 100;

-- Ensure existing rows have initialized values
UPDATE public.profiles
SET
  current_location = COALESCE(current_location, 'Unknown'),
  health = COALESCE(health, 100);

-- Enforce non-null constraint on current_location now that defaults are set
ALTER TABLE public.profiles
  ALTER COLUMN current_location SET NOT NULL;

-- Refresh the profile update policy to guarantee players can manage their own state
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure new users receive initialized profile state
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Create profile with default progression and location stats
  INSERT INTO public.profiles (
    user_id,
    username,
    display_name,
    current_city_id,
    current_location,
    health
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'Player' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'New Player'),
    DEFAULT,
    DEFAULT,
    DEFAULT
  );

  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  -- Create initial skills
  INSERT INTO public.player_skills (user_id)
  VALUES (NEW.id);

  -- Create initial fan demographics
  INSERT INTO public.fan_demographics (user_id)
  VALUES (NEW.id);

  -- Create initial activity
  INSERT INTO public.activity_feed (user_id, activity_type, message)
  VALUES (NEW.id, 'join', 'Welcome to Rockmundo! Your musical journey begins now.');

  -- Grant "First Steps" achievement
  INSERT INTO public.player_achievements (user_id, achievement_id)
  SELECT NEW.id, id FROM public.achievements WHERE name = 'First Steps';

  RETURN NEW;
END;
$function$;

-- Keep reset_player_character in sync with the new profile fields
CREATE OR REPLACE FUNCTION public.reset_player_character()
RETURNS TABLE (
  profile public.profiles,
  skills public.player_skills
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
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to reset character' USING ERRCODE = '42501';
  END IF;

  generated_username := 'Player' || substr(current_user_id::text, 1, 8);

  -- Remove dependent records that belong to the current character
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

  -- Remove bands the player owns and any related conflicts
  DELETE FROM public.band_conflicts
    WHERE band_id IN (
      SELECT id FROM public.bands WHERE leader_id = current_user_id
    );
  DELETE FROM public.bands WHERE leader_id = current_user_id;

  -- Remove songs and related stats after associated campaign data is cleared
  DELETE FROM public.songs WHERE user_id = current_user_id;

  -- Reset core profile & skills data
  DELETE FROM public.player_skills WHERE user_id = current_user_id;
  DELETE FROM public.profiles WHERE user_id = current_user_id;

  INSERT INTO public.profiles (
    user_id,
    username,
    display_name,
    current_city_id,
    current_location,
    health
  )
  VALUES (
    current_user_id,
    generated_username,
    'New Player',
    DEFAULT,
    DEFAULT,
    DEFAULT
  )
  RETURNING * INTO new_profile;

  INSERT INTO public.player_skills (user_id)
  VALUES (current_user_id)
  RETURNING * INTO new_skills;

  INSERT INTO public.fan_demographics (user_id)
  VALUES (current_user_id);

  INSERT INTO public.activity_feed (user_id, activity_type, message)
  VALUES (
    current_user_id,
    'reset',
    'Your journey has been reset. Time to create a new legend!'
  );

  RETURN QUERY SELECT new_profile, new_skills;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_player_character() TO authenticated;
