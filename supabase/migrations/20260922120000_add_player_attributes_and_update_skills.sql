-- Create table to track core character attributes
CREATE TABLE IF NOT EXISTS public.player_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  looks integer NOT NULL DEFAULT 500,
  charisma integer NOT NULL DEFAULT 500,
  musicality integer NOT NULL DEFAULT 500,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_attributes_looks_range CHECK (looks BETWEEN 0 AND 1000),
  CONSTRAINT player_attributes_charisma_range CHECK (charisma BETWEEN 0 AND 1000),
  CONSTRAINT player_attributes_musicality_range CHECK (musicality BETWEEN 0 AND 1000)
);

ALTER TABLE public.player_attributes
  ADD CONSTRAINT player_attributes_unique_profile UNIQUE (profile_id);

ALTER TABLE public.player_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attributes are viewable by everyone"
ON public.player_attributes
FOR SELECT
USING (true);

CREATE POLICY "Users can update their own attributes"
ON public.player_attributes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = player_attributes.profile_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = player_attributes.profile_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own attributes"
ON public.player_attributes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = player_attributes.profile_id
      AND p.user_id = auth.uid()
  )
);

CREATE TRIGGER update_player_attributes_updated_at
  BEFORE UPDATE ON public.player_attributes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure every existing profile has an attribute row
INSERT INTO public.player_attributes (profile_id)
SELECT p.id
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.player_attributes pa
  WHERE pa.profile_id = p.id
);

-- Migrate player_skills to focus on core musical abilities
ALTER TABLE public.player_skills
  DROP CONSTRAINT IF EXISTS player_skills_value_bounds_check,
  DROP CONSTRAINT IF EXISTS player_skills_total_points_check,
  DROP COLUMN IF EXISTS creativity,
  DROP COLUMN IF EXISTS business,
  DROP COLUMN IF EXISTS marketing;

-- Scale legacy values into the 0-100 range
UPDATE public.player_skills
SET
  guitar = LEAST(GREATEST(COALESCE(guitar, 0) * 10, 0), 100),
  vocals = LEAST(GREATEST(COALESCE(vocals, 0) * 10, 0), 100),
  drums = LEAST(GREATEST(COALESCE(drums, 0) * 10, 0), 100),
  bass = LEAST(GREATEST(COALESCE(bass, 0) * 10, 0), 100),
  performance = LEAST(GREATEST(COALESCE(performance, 0) * 10, 0), 100),
  songwriting = LEAST(GREATEST(COALESCE(songwriting, 0) * 10, 0), 100),
  composition = LEAST(GREATEST(COALESCE(composition, 0) * 10, 0), 100),
  technical = LEAST(GREATEST(COALESCE(technical, 0) * 10, 0), 100);

ALTER TABLE public.player_skills
  ALTER COLUMN guitar SET DEFAULT 10,
  ALTER COLUMN vocals SET DEFAULT 10,
  ALTER COLUMN drums SET DEFAULT 10,
  ALTER COLUMN bass SET DEFAULT 10,
  ALTER COLUMN performance SET DEFAULT 10,
  ALTER COLUMN songwriting SET DEFAULT 10,
  ALTER COLUMN composition SET DEFAULT 10,
  ALTER COLUMN technical SET DEFAULT 10,
  ALTER COLUMN guitar SET NOT NULL,
  ALTER COLUMN vocals SET NOT NULL,
  ALTER COLUMN drums SET NOT NULL,
  ALTER COLUMN bass SET NOT NULL,
  ALTER COLUMN performance SET NOT NULL,
  ALTER COLUMN songwriting SET NOT NULL,
  ALTER COLUMN composition SET NOT NULL,
  ALTER COLUMN technical SET NOT NULL;

ALTER TABLE public.player_skills
  ADD CONSTRAINT player_skills_value_bounds_check CHECK (
    guitar BETWEEN 0 AND 100 AND
    vocals BETWEEN 0 AND 100 AND
    drums BETWEEN 0 AND 100 AND
    bass BETWEEN 0 AND 100 AND
    performance BETWEEN 0 AND 100 AND
    songwriting BETWEEN 0 AND 100 AND
    composition BETWEEN 0 AND 100 AND
    technical BETWEEN 0 AND 100
  );

-- Refresh onboarding trigger to populate attributes alongside skills
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  new_profile public.profiles%ROWTYPE;
BEGIN
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
  )
  RETURNING * INTO new_profile;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  INSERT INTO public.player_skills (user_id, profile_id)
  VALUES (NEW.id, new_profile.id);

  INSERT INTO public.player_attributes (profile_id)
  VALUES (new_profile.id);

  INSERT INTO public.fan_demographics (user_id)
  VALUES (NEW.id);

  INSERT INTO public.activity_feed (user_id, profile_id, activity_type, message)
  VALUES (NEW.id, new_profile.id, 'join', 'Welcome to Rockmundo! Your musical journey begins now.');

  INSERT INTO public.player_achievements (user_id, achievement_id)
  SELECT NEW.id, id FROM public.achievements WHERE name = 'First Steps';

  RETURN NEW;
END;
$function$;

-- Ensure the reset helper also provisions attributes
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

  INSERT INTO public.player_skills (user_id, profile_id)
  VALUES (current_user_id, new_profile.id)
  RETURNING * INTO new_skills;

  INSERT INTO public.player_attributes (profile_id)
  VALUES (new_profile.id)
  RETURNING * INTO new_attributes;

  INSERT INTO public.fan_demographics (user_id)
  VALUES (current_user_id);

  INSERT INTO public.activity_feed (user_id, profile_id, activity_type, message)
  VALUES (
    current_user_id,
    new_profile.id,
    'reset',
    'Your journey has been reset. Time to create a new legend!'
  );

  RETURN QUERY SELECT new_profile, new_skills, new_attributes;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_player_character() TO authenticated;
