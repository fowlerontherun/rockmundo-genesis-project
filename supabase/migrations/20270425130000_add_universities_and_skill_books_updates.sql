-- Add missing columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS current_city_id uuid;

-- Create universities table
CREATE TABLE IF NOT EXISTS public.universities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  city text NOT NULL,
  prestige integer DEFAULT 50,
  quality_of_learning integer DEFAULT 50,
  course_cost integer DEFAULT 1000,
  created_at timestamp with time zone DEFAULT timezone('utc', now())
);

ALTER TABLE public.universities
  ALTER COLUMN prestige SET DEFAULT 50,
  ALTER COLUMN quality_of_learning SET DEFAULT 50,
  ALTER COLUMN course_cost SET DEFAULT 1000,
  ALTER COLUMN created_at SET DEFAULT timezone('utc', now());

ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Universities are viewable by everyone" ON public.universities;
CREATE POLICY "Universities are viewable by everyone"
ON public.universities
FOR SELECT
USING (true);

-- Create skill_books table
CREATE TABLE IF NOT EXISTS public.skill_books (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_slug text NOT NULL,
  title text NOT NULL,
  description text,
  cost integer DEFAULT 100,
  xp_value integer DEFAULT 50,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc', now()),
  updated_at timestamp with time zone DEFAULT timezone('utc', now())
);

ALTER TABLE public.skill_books
  ADD COLUMN IF NOT EXISTS skill_slug text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS cost integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS xp_value integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc', now());

ALTER TABLE public.skill_books
  ALTER COLUMN cost SET DEFAULT 100,
  ALTER COLUMN xp_value SET DEFAULT 50,
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN created_at SET DEFAULT timezone('utc', now()),
  ALTER COLUMN updated_at SET DEFAULT timezone('utc', now());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'skill_books'
      AND column_name = 'xp_reward'
  ) THEN
    EXECUTE $$UPDATE public.skill_books
      SET xp_value = COALESCE(xp_reward, xp_value)
    WHERE xp_value IS NULL$$;
  END IF;
END;
$$;

UPDATE public.skill_books
SET is_active = true
WHERE is_active IS NULL;

ALTER TABLE public.skill_books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Skill books are viewable by everyone" ON public.skill_books;
CREATE POLICY "Skill books are viewable by everyone"
ON public.skill_books
FOR SELECT
USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_skill_books_updated_at'
      AND tgrelid = 'public.skill_books'::regclass
  ) THEN
    EXECUTE $$CREATE TRIGGER update_skill_books_updated_at
      BEFORE UPDATE ON public.skill_books
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column()$$;
  END IF;
END;
$$;

-- Create reset_player_character function
CREATE OR REPLACE FUNCTION public.reset_player_character(profile_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF profile_id_input IS NULL THEN
    RAISE EXCEPTION 'profile_id_input is required';
  END IF;

  SELECT user_id INTO target_user_id
  FROM public.profiles
  WHERE id = profile_id_input;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Profile % not found', profile_id_input;
  END IF;

  UPDATE public.player_skills
  SET vocals = 1,
      guitar = 1,
      bass = 1,
      drums = 1,
      songwriting = 1,
      performance = 1,
      creativity = 1,
      technical = 1,
      business = 1,
      marketing = 1,
      composition = 1,
      updated_at = timezone('utc', now())
  WHERE user_id = target_user_id;

  DELETE FROM public.skill_progress
  WHERE profile_id = profile_id_input;

  UPDATE public.player_xp_wallet
  SET xp_balance = 0,
      xp_spent = 0,
      lifetime_xp = 0,
      skill_points_earned = 0,
      attribute_points_earned = 0,
      last_recalculated = timezone('utc', now())
  WHERE profile_id = profile_id_input;

  UPDATE public.player_attributes
  SET creative_insight = 10,
      physical_endurance = 10,
      vocal_talent = 10,
      stage_presence = 10,
      musical_ability = 10,
      charisma = 10,
      looks = 10,
      mental_focus = 10,
      musicality = 10,
      business_acumen = 10,
      technical_mastery = 10,
      rhythm_sense = 10,
      marketing_savvy = 10,
      crowd_engagement = 10,
      social_reach = 10,
      attribute_points = 0,
      attribute_points_spent = 0,
      updated_at = timezone('utc', now())
  WHERE user_id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_player_character(profile_id_input uuid) TO authenticated;
