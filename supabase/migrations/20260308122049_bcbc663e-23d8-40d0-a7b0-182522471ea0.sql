-- Tattoo Artists table
CREATE TABLE public.tattoo_artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parlour_id UUID NOT NULL REFERENCES public.tattoo_parlours(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nickname TEXT,
  fame_level INTEGER NOT NULL DEFAULT 1 CHECK (fame_level >= 1 AND fame_level <= 100),
  specialty TEXT,
  quality_bonus INTEGER NOT NULL DEFAULT 0 CHECK (quality_bonus >= 0 AND quality_bonus <= 30),
  price_premium NUMERIC NOT NULL DEFAULT 1.0 CHECK (price_premium >= 1.0 AND price_premium <= 3.0),
  accepts_custom BOOLEAN NOT NULL DEFAULT false,
  bio TEXT,
  total_tattoos_done INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Custom tattoo requests table
CREATE TABLE public.custom_tattoo_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES public.tattoo_artists(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  body_slot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  quoted_price NUMERIC NOT NULL DEFAULT 0,
  estimated_quality INTEGER NOT NULL DEFAULT 50,
  completed_tattoo_id UUID REFERENCES public.player_tattoos(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add artist_id to player_tattoos
ALTER TABLE public.player_tattoos ADD COLUMN artist_id UUID REFERENCES public.tattoo_artists(id);

-- RLS
ALTER TABLE public.tattoo_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_tattoo_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view artists" ON public.tattoo_artists
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view own custom requests" ON public.custom_tattoo_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own custom requests" ON public.custom_tattoo_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own custom requests" ON public.custom_tattoo_requests
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom requests" ON public.custom_tattoo_requests
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Seed artists across existing parlours
DO $$
DECLARE
  v_parlour RECORD;
  v_tier INTEGER;
BEGIN
  FOR v_parlour IN SELECT id, name, quality_tier FROM public.tattoo_parlours LOOP
    v_tier := v_parlour.quality_tier;
    
    IF v_tier = 1 THEN
      INSERT INTO public.tattoo_artists (parlour_id, name, nickname, fame_level, specialty, quality_bonus, price_premium, accepts_custom, bio, total_tattoos_done) VALUES
        (v_parlour.id, 'Buzz McInk', 'Buzzy', 8, 'tribal', 2, 1.0, false, 'Self-taught street artist. Cheap but rough.', 45),
        (v_parlour.id, 'Snake Williams', NULL, 15, 'skull', 4, 1.0, false, 'Former biker, now slinging ink in dodgy parlours.', 120);
    ELSIF v_tier = 2 THEN
      INSERT INTO public.tattoo_artists (parlour_id, name, nickname, fame_level, specialty, quality_bonus, price_premium, accepts_custom, bio, total_tattoos_done) VALUES
        (v_parlour.id, 'Rosa Delgado', 'Rosa Ink', 28, 'text', 7, 1.2, false, 'Specialises in script and lettering work.', 280),
        (v_parlour.id, 'Tommy Needles', NULL, 35, 'geometric', 10, 1.2, false, 'Precision geometric work at budget prices.', 350);
    ELSIF v_tier = 3 THEN
      INSERT INTO public.tattoo_artists (parlour_id, name, nickname, fame_level, specialty, quality_bonus, price_premium, accepts_custom, bio, total_tattoos_done) VALUES
        (v_parlour.id, 'Yuki Tanaka', 'Yuki', 52, 'japanese', 15, 1.5, true, 'Trained in traditional Japanese irezumi.', 600),
        (v_parlour.id, 'Marcus Stone', 'Stoney', 48, 'portrait', 13, 1.5, true, 'Photorealistic portrait specialist.', 520),
        (v_parlour.id, 'Lena Frost', NULL, 42, 'abstract', 11, 1.3, false, 'Watercolor and abstract fusion artist.', 410);
    ELSIF v_tier = 4 THEN
      INSERT INTO public.tattoo_artists (parlour_id, name, nickname, fame_level, specialty, quality_bonus, price_premium, accepts_custom, bio, total_tattoos_done) VALUES
        (v_parlour.id, 'Viktor Drago', 'V', 75, 'skull', 22, 2.0, true, 'Dark realism master. Celebrity clientele.', 1200),
        (v_parlour.id, 'Sakura Ito', 'Cherry', 70, 'japanese', 20, 2.0, true, 'Modern Japanese with neo-traditional flair.', 980),
        (v_parlour.id, 'DJ Inkwell', NULL, 65, 'musical', 18, 1.8, true, 'Music-themed tattoo specialist. Ex-drummer.', 850);
    ELSIF v_tier = 5 THEN
      INSERT INTO public.tattoo_artists (parlour_id, name, nickname, fame_level, specialty, quality_bonus, price_premium, accepts_custom, bio, total_tattoos_done) VALUES
        (v_parlour.id, 'Alejandro "El Maestro" Cruz', 'El Maestro', 95, 'sleeve', 30, 3.0, true, 'Living legend. 30 years of full sleeve masterwork.', 3500),
        (v_parlour.id, 'Ingrid Blackwood', 'The Raven', 88, 'tribal', 26, 2.5, true, 'Nordic tribal fusion. International magazines.', 2200),
        (v_parlour.id, 'Kai Nakamura', NULL, 92, 'japanese', 28, 2.8, true, 'Third-generation irezumi master from Tokyo.', 2800);
    END IF;
  END LOOP;
END $$;

-- Trigger for updated_at on custom_tattoo_requests
CREATE TRIGGER update_custom_tattoo_requests_updated_at
  BEFORE UPDATE ON public.custom_tattoo_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();