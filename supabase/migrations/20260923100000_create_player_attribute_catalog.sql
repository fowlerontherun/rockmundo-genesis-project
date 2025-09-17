-- Create attribute catalog and player attributes tables with baseline seeding
CREATE TABLE IF NOT EXISTS public.attribute_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  base_value numeric(6,3) NOT NULL DEFAULT 1.0,
  max_value numeric(6,3) NOT NULL DEFAULT 3.0,
  category text NOT NULL DEFAULT 'core',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.player_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  physical_endurance numeric(6,3) NOT NULL DEFAULT 1.0,
  mental_focus numeric(6,3) NOT NULL DEFAULT 1.0,
  attribute_points integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT player_attributes_unique_profile UNIQUE (profile_id)
);

CREATE INDEX IF NOT EXISTS idx_player_attributes_user_id
  ON public.player_attributes (user_id);

ALTER TABLE public.attribute_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Attribute catalog is public"
  ON public.attribute_catalog
  FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Players can view their attributes"
  ON public.player_attributes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Players can insert their attributes"
  ON public.player_attributes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Players can update their attributes"
  ON public.player_attributes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_attribute_catalog_updated_at
  BEFORE UPDATE ON public.attribute_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_player_attributes_updated_at
  BEFORE UPDATE ON public.player_attributes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.attribute_catalog (key, name, description, base_value, max_value, category)
VALUES
  (
    'physical_endurance',
    'Physical Endurance',
    'Represents stamina and resilience. Reduces energy costs and accelerates recovery windows.',
    1.0,
    3.0,
    'core'
  ),
  (
    'mental_focus',
    'Mental Focus',
    'Measures discipline and concentration. Improves the effectiveness of skill training and preparation.',
    1.0,
    3.0,
    'core'
  )
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  base_value = EXCLUDED.base_value,
  max_value = EXCLUDED.max_value,
  category = EXCLUDED.category,
  updated_at = now();

INSERT INTO public.player_attributes (user_id, profile_id, physical_endurance, mental_focus)
SELECT p.user_id, p.id, 1.0, 1.0
FROM public.profiles AS p
ON CONFLICT (profile_id) DO UPDATE
SET user_id = EXCLUDED.user_id;

CREATE OR REPLACE FUNCTION public.ensure_player_attributes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.player_attributes (user_id, profile_id)
  VALUES (NEW.user_id, NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_ensure_attributes ON public.profiles;
CREATE TRIGGER profiles_ensure_attributes
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_player_attributes();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
    age
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'Player' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'New Player'),
    DEFAULT,
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
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to reset character' USING ERRCODE = '42501';
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
    DEFAULT,
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
