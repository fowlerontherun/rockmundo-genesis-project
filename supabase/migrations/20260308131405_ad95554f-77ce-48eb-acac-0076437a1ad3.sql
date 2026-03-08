-- Player Producer Profiles
CREATE TABLE public.player_producer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  cost_per_hour integer NOT NULL DEFAULT 50,
  specialty_genre text NOT NULL DEFAULT 'Rock',
  bio text,
  is_available boolean NOT NULL DEFAULT true,
  city_id uuid REFERENCES public.cities(id),
  quality_bonus integer NOT NULL DEFAULT 0,
  mixing_skill integer NOT NULL DEFAULT 0,
  arrangement_skill integer NOT NULL DEFAULT 0,
  total_sessions integer NOT NULL DEFAULT 0,
  total_earnings numeric NOT NULL DEFAULT 0,
  xp_earned integer NOT NULL DEFAULT 0,
  rating numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.player_producer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read producer profiles"
  ON public.player_producer_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own producer profile"
  ON public.player_producer_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own producer profile"
  ON public.player_producer_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own producer profile"
  ON public.player_producer_profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_player_producer_profiles_updated_at
  BEFORE UPDATE ON public.player_producer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add player_producer_id to recording_sessions
ALTER TABLE public.recording_sessions
  ADD COLUMN player_producer_id uuid REFERENCES public.player_producer_profiles(id);

-- Producer Session Reviews
CREATE TABLE public.producer_session_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.recording_sessions(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  producer_profile_id uuid NOT NULL REFERENCES public.player_producer_profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, reviewer_user_id)
);

ALTER TABLE public.producer_session_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read reviews"
  ON public.producer_session_reviews FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own reviews"
  ON public.producer_session_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reviewer_user_id);

-- Function to update producer rating after review
CREATE OR REPLACE FUNCTION public.update_producer_rating()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.player_producer_profiles
  SET rating = (
    SELECT ROUND(AVG(rating)::numeric, 1)
    FROM public.producer_session_reviews
    WHERE producer_profile_id = NEW.producer_profile_id
  )
  WHERE id = NEW.producer_profile_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_producer_rating_on_review
  AFTER INSERT ON public.producer_session_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_producer_rating();