-- Create attribute catalog and player attribute stars tables with baseline seeding
CREATE TABLE IF NOT EXISTS public.attribute_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  base_value numeric(6,3) NOT NULL DEFAULT 0,
  max_value numeric(6,3) NOT NULL DEFAULT 5,
  category text NOT NULL DEFAULT 'core',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.player_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attribute_key text NOT NULL REFERENCES public.attribute_catalog(key) ON DELETE CASCADE,
  stars integer NOT NULL DEFAULT 0 CHECK (stars >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT player_attributes_unique_profile_attr UNIQUE (profile_id, attribute_key)
);

CREATE INDEX IF NOT EXISTS idx_player_attributes_profile_id
  ON public.player_attributes (profile_id);

CREATE INDEX IF NOT EXISTS idx_player_attributes_attribute_key
  ON public.player_attributes (attribute_key);

ALTER TABLE public.attribute_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Attribute catalog is public"
  ON public.attribute_catalog
  FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Players can view their attributes"
  ON public.player_attributes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = player_attributes.profile_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Players can insert their attributes"
  ON public.player_attributes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = player_attributes.profile_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Players can update their attributes"
  ON public.player_attributes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = player_attributes.profile_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = player_attributes.profile_id
        AND p.user_id = auth.uid()
    )
  );

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
    'musical_ability',
    'Musical Ability',
    'Overall instrumental precision, tone, and fretboard mastery.',
    0,
    5,
    'core'
  ),
  (
    'vocal_talent',
    'Voice',
    'Pitch control, range, and the nuances that make performances soar.',
    0,
    5,
    'core'
  ),
  (
    'rhythm_sense',
    'Rhythm Sense',
    'Timing, groove, and percussive instincts that anchor a band.',
    0,
    5,
    'core'
  ),
  (
    'stage_presence',
    'Stage Presence',
    'Charisma, confidence, and crowd engagement during live shows.',
    0,
    5,
    'performance'
  ),
  (
    'creative_insight',
    'Creative Insight',
    'Songwriting intuition, lyrical storytelling, and innovative ideas.',
    0,
    5,
    'creative'
  ),
  (
    'technical_mastery',
    'Technical Mastery',
    'Studio expertise, production prowess, and sound engineering instincts.',
    0,
    5,
    'technical'
  ),
  (
    'business_acumen',
    'Business Acumen',
    'Negotiation savvy, strategic planning, and deal-making confidence.',
    0,
    5,
    'business'
  ),
  (
    'marketing_savvy',
    'Marketing Savvy',
    'Brand vision, campaign insight, and community-building instincts.',
    0,
    5,
    'business'
  )
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  base_value = EXCLUDED.base_value,
  max_value = EXCLUDED.max_value,
  category = EXCLUDED.category,
  updated_at = now();

INSERT INTO public.player_attributes (profile_id, attribute_key, stars)
SELECT p.id, ac.key, 0
FROM public.profiles AS p
CROSS JOIN public.attribute_catalog AS ac
ON CONFLICT (profile_id, attribute_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_player_attributes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wallet_inserted boolean := false;
BEGIN
  INSERT INTO public.player_attributes (profile_id, attribute_key, stars)
  SELECT NEW.id, ac.key, 0
  FROM public.attribute_catalog AS ac
  ON CONFLICT (profile_id, attribute_key) DO NOTHING;

  IF to_regclass('public.player_xp_wallet') IS NOT NULL THEN
    INSERT INTO public.player_xp_wallet (profile_id)
    VALUES (NEW.id)
    ON CONFLICT (profile_id) DO NOTHING;

    wallet_inserted := FOUND;

    IF wallet_inserted AND to_regclass('public.xp_ledger') IS NOT NULL THEN
      BEGIN
        INSERT INTO public.xp_ledger (
          profile_id,
          event_type,
          xp_delta,
          balance_after,
          attribute_points_delta,
          skill_points_delta,
          metadata
        )
        VALUES (
          NEW.id,
          'wallet_initialized',
          0,
          0,
          0,
          0,
          jsonb_build_object('source', 'ensure_player_attributes')
        );
      EXCEPTION
        WHEN check_violation THEN
          NULL;
      END;
    END IF;
  END IF;

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
DECLARE
  new_profile public.profiles%ROWTYPE;
  wallet_inserted boolean := false;
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
  )
  RETURNING * INTO new_profile;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  INSERT INTO public.player_skills (user_id)
  VALUES (NEW.id);

  INSERT INTO public.fan_demographics (user_id)
  VALUES (NEW.id);

  INSERT INTO public.activity_feed (user_id, activity_type, message)
  VALUES (NEW.id, 'join', 'Welcome to Rockmundo! Your musical journey begins now.');

  INSERT INTO public.player_attributes (profile_id, attribute_key, stars)
  SELECT new_profile.id, ac.key, 0
  FROM public.attribute_catalog AS ac
  ON CONFLICT (profile_id, attribute_key) DO NOTHING;

  IF to_regclass('public.player_xp_wallet') IS NOT NULL THEN
    INSERT INTO public.player_xp_wallet (profile_id)
    VALUES (new_profile.id)
    ON CONFLICT (profile_id) DO NOTHING;

    wallet_inserted := FOUND;

    IF wallet_inserted AND to_regclass('public.xp_ledger') IS NOT NULL THEN
      BEGIN
        INSERT INTO public.xp_ledger (
          profile_id,
          event_type,
          xp_delta,
          balance_after,
          attribute_points_delta,
          skill_points_delta,
          metadata
        )
        VALUES (
          new_profile.id,
          'wallet_initialized',
          0,
          0,
          0,
          0,
          jsonb_build_object('source', 'handle_new_user')
        );
      EXCEPTION
        WHEN check_violation THEN
          NULL;
      END;
    END IF;
  END IF;

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
  profile_ids uuid[];
  new_profile public.profiles%ROWTYPE;
  new_skills public.player_skills%ROWTYPE;
  new_attributes public.player_attributes%ROWTYPE;
  wallet_inserted boolean := false;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to reset character' USING ERRCODE = '42501';
  END IF;

  generated_username := 'Player' || substr(current_user_id::text, 1, 8);

  SELECT array_agg(id)
  INTO profile_ids
  FROM public.profiles
  WHERE user_id = current_user_id;

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

  IF profile_ids IS NOT NULL THEN
    IF to_regclass('public.xp_ledger') IS NOT NULL THEN
      DELETE FROM public.xp_ledger WHERE profile_id = ANY(profile_ids);
    END IF;
    IF to_regclass('public.player_xp_wallet') IS NOT NULL THEN
      DELETE FROM public.player_xp_wallet WHERE profile_id = ANY(profile_ids);
    END IF;
    DELETE FROM public.player_attributes WHERE profile_id = ANY(profile_ids);
  END IF;

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

  INSERT INTO public.player_attributes (profile_id, attribute_key, stars)
  SELECT new_profile.id, ac.key, 0
  FROM public.attribute_catalog AS ac
  ON CONFLICT (profile_id, attribute_key) DO NOTHING;

  IF to_regclass('public.player_xp_wallet') IS NOT NULL THEN
    INSERT INTO public.player_xp_wallet (profile_id)
    VALUES (new_profile.id)
    ON CONFLICT (profile_id) DO NOTHING;

    wallet_inserted := FOUND;

    IF wallet_inserted AND to_regclass('public.xp_ledger') IS NOT NULL THEN
      BEGIN
        INSERT INTO public.xp_ledger (
          profile_id,
          event_type,
          xp_delta,
          balance_after,
          attribute_points_delta,
          skill_points_delta,
          metadata
        )
        VALUES (
          new_profile.id,
          'wallet_initialized',
          0,
          0,
          0,
          0,
          jsonb_build_object('source', 'reset_player_character')
        );
      EXCEPTION
        WHEN check_violation THEN
          NULL;
      END;
    END IF;
  END IF;

  INSERT INTO public.fan_demographics (user_id)
  VALUES (current_user_id);

  INSERT INTO public.activity_feed (user_id, activity_type, message)
  VALUES (
    current_user_id,
    'reset',
    'Your journey has been reset. Time to create a new legend!'
  );

  new_attributes := NULL;

  RETURN QUERY SELECT new_profile, new_skills, new_attributes;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_player_character() TO authenticated;
