CREATE TABLE IF NOT EXISTS public.wellness_provider_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_kind text NOT NULL CHECK (provider_kind IN ('npc','player')), display_name text NOT NULL, role text NOT NULL,
  qualification_tier text NOT NULL DEFAULT 'trainee' CHECK (qualification_tier IN ('trainee','qualified','experienced','expert','elite')),
  professional_xp integer NOT NULL DEFAULT 0 CHECK (professional_xp >= 0), completed_appointments integer NOT NULL DEFAULT 0 CHECK (completed_appointments >= 0),
  reliability numeric NOT NULL DEFAULT 85 CHECK (reliability BETWEEN 0 AND 100), reputation_score numeric NOT NULL DEFAULT 0 CHECK (reputation_score BETWEEN 0 AND 100),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wellness_provider_player_or_npc CHECK ((provider_kind = 'player' AND profile_id IS NOT NULL) OR provider_kind = 'npc'));
CREATE TABLE IF NOT EXISTS public.wellness_provider_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_profile_id uuid NOT NULL REFERENCES public.wellness_provider_profiles(id) ON DELETE CASCADE,
  service_slug text NOT NULL, service_name text NOT NULL, description text, price_cents integer NOT NULL CHECK (price_cents >= 0),
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 15 AND 480),
  effects jsonb NOT NULL DEFAULT '{}'::jsonb, remote_available boolean NOT NULL DEFAULT true, paused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (provider_profile_id, service_slug));
CREATE TABLE IF NOT EXISTS public.wellness_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_profile_id uuid NOT NULL REFERENCES public.wellness_provider_profiles(id) ON DELETE RESTRICT,
  listing_id uuid REFERENCES public.wellness_provider_listings(id) ON DELETE SET NULL,
  client_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, service_slug text NOT NULL, role text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz NOT NULL, price_cents integer NOT NULL CHECK (price_cents >= 0),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('requested','booked','cancelled_early','cancelled_late','client_no_show','provider_no_show','completed','partially_completed','refunded','disputed')),
  effects_applied jsonb NOT NULL DEFAULT '{}'::jsonb, outcome_applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT wellness_appointments_valid_time CHECK (ends_at > starts_at));
CREATE INDEX IF NOT EXISTS wellness_appointments_client_idx ON public.wellness_appointments(client_profile_id, starts_at DESC);
CREATE TABLE IF NOT EXISTS public.wellness_professional_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), appointment_id uuid NOT NULL UNIQUE REFERENCES public.wellness_appointments(id) ON DELETE CASCADE,
  provider_profile_id uuid NOT NULL REFERENCES public.wellness_provider_profiles(id) ON DELETE CASCADE, client_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5), comment text, moderation_status text NOT NULL DEFAULT 'visible' CHECK (moderation_status IN ('visible','flagged','hidden')),
  created_at timestamptz NOT NULL DEFAULT now());

GRANT SELECT ON public.wellness_provider_profiles, public.wellness_provider_listings, public.wellness_appointments, public.wellness_professional_reviews TO authenticated;
GRANT ALL ON public.wellness_provider_profiles, public.wellness_provider_listings, public.wellness_appointments, public.wellness_professional_reviews TO service_role;
ALTER TABLE public.wellness_provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_provider_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_professional_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in view active professionals" ON public.wellness_provider_profiles FOR SELECT TO authenticated USING (active);
CREATE POLICY "Signed-in view open services" ON public.wellness_provider_listings FOR SELECT TO authenticated USING (NOT paused);
CREATE POLICY "Clients view own appointments" ON public.wellness_appointments FOR SELECT TO authenticated USING (client_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Signed-in view visible reviews" ON public.wellness_professional_reviews FOR SELECT TO authenticated USING (moderation_status = 'visible' OR client_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

WITH p AS (
  INSERT INTO public.wellness_provider_profiles (provider_kind, display_name, role, qualification_tier, reliability, reputation_score) VALUES
  ('npc','Dr. Maya Lindqvist','therapist','expert',95,82),
  ('npc','Owen Brady','physiotherapist','experienced',90,74),
  ('npc','Kiko Tanaka','sports_massage','qualified',88,68),
  ('npc','Rosa Delgado','vocal_coach','elite',97,90),
  ('npc','Sam Okafor','nutritionist','qualified',86,64),
  ('npc','Ingrid Vale','sleep_coach','experienced',92,71)
  RETURNING id, role)
INSERT INTO public.wellness_provider_listings (provider_profile_id, service_slug, service_name, description, price_cents, duration_minutes, effects)
SELECT p.id, v.slug, v.name, v.descr, v.price, v.mins, v.eff::jsonb FROM p JOIN (VALUES
  ('therapist','therapy_session','Therapy session','Talk through tour stress and pressure.',15000,60,'{"health":6,"energy":4}'),
  ('physiotherapist','physio_session','Physio session','Treat strains from playing and lifting gear.',12000,45,'{"health":10}'),
  ('sports_massage','deep_tissue_massage','Deep tissue massage','Loosen up after a heavy run of shows.',8000,60,'{"health":5,"energy":8}'),
  ('vocal_coach','vocal_care','Vocal care session','Rest and protect your voice between gigs.',20000,45,'{"health":4,"energy":4}'),
  ('nutritionist','meal_plan','Touring meal plan','Eat better on the road.',6000,30,'{"health":5,"energy":5}'),
  ('sleep_coach','sleep_reset','Sleep reset','Beat jet lag and late-night shows.',7000,30,'{"energy":12}')
) AS v(role, slug, name, descr, price, mins, eff) ON v.role = p.role;

CREATE OR REPLACE FUNCTION public.book_wellness_professional(p_profile_id uuid, p_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_l record; v_prov record; v_cost int; v_cash int; v_h int; v_e int; v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'Not your character'; END IF;
  SELECT * INTO v_l FROM wellness_provider_listings WHERE id = p_listing_id AND NOT paused;
  IF v_l.id IS NULL THEN RAISE EXCEPTION 'This service is not available'; END IF;
  SELECT * INTO v_prov FROM wellness_provider_profiles WHERE id = v_l.provider_profile_id AND active;
  IF v_prov.id IS NULL THEN RAISE EXCEPTION 'This professional is not available'; END IF;
  IF v_prov.profile_id = p_profile_id THEN RAISE EXCEPTION 'You cannot book yourself'; END IF;
  IF EXISTS (SELECT 1 FROM wellness_appointments WHERE client_profile_id = p_profile_id AND service_slug = v_l.service_slug AND status = 'completed' AND starts_at > now() - interval '3 days') THEN
    RAISE EXCEPTION 'You had this session recently. Try again in a few days.'; END IF;
  v_cost := CEIL(v_l.price_cents / 100.0)::int;
  SELECT cash INTO v_cash FROM profiles WHERE id = p_profile_id FOR UPDATE;
  IF coalesce(v_cash,0) < v_cost THEN RAISE EXCEPTION 'Not enough cash (need $%)', v_cost; END IF;
  v_h := coalesce((v_l.effects->>'health')::int, 0); v_e := coalesce((v_l.effects->>'energy')::int, 0);
  UPDATE profiles SET cash = cash - v_cost,
    health = LEAST(100, GREATEST(0, coalesce(health,100) + v_h)),
    energy = LEAST(100, GREATEST(0, coalesce(energy,100) + v_e))
  WHERE id = p_profile_id;
  INSERT INTO wellness_appointments (provider_profile_id, listing_id, client_profile_id, service_slug, role, starts_at, ends_at, price_cents, status, effects_applied, outcome_applied_at)
  VALUES (v_prov.id, v_l.id, p_profile_id, v_l.service_slug, v_prov.role, now(), now() + make_interval(mins => v_l.duration_minutes), v_l.price_cents, 'completed', v_l.effects, now())
  RETURNING id INTO v_id;
  UPDATE wellness_provider_profiles SET completed_appointments = completed_appointments + 1, professional_xp = professional_xp + 10, updated_at = now() WHERE id = v_prov.id;
  IF v_prov.profile_id IS NOT NULL THEN UPDATE profiles SET cash = cash + v_cost WHERE id = v_prov.profile_id; END IF;
  RETURN jsonb_build_object('appointment_id', v_id, 'cost', v_cost, 'health', v_h, 'energy', v_e);
END $$;

CREATE OR REPLACE FUNCTION public.review_wellness_appointment(p_profile_id uuid, p_appointment_id uuid, p_rating int, p_comment text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_a record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'Not your character'; END IF;
  IF p_rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Rating must be 1 to 5'; END IF;
  SELECT * INTO v_a FROM wellness_appointments WHERE id = p_appointment_id AND client_profile_id = p_profile_id AND status = 'completed';
  IF v_a.id IS NULL THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  INSERT INTO wellness_professional_reviews (appointment_id, provider_profile_id, client_profile_id, rating, comment)
  VALUES (v_a.id, v_a.provider_profile_id, p_profile_id, p_rating, left(nullif(trim(p_comment),''), 500));
  UPDATE wellness_provider_profiles SET reputation_score = LEAST(100, (SELECT avg(rating) * 20 FROM wellness_professional_reviews WHERE provider_profile_id = v_a.provider_profile_id AND moderation_status = 'visible')), updated_at = now()
  WHERE id = v_a.provider_profile_id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'You already reviewed this session';
END $$;

REVOKE ALL ON FUNCTION public.book_wellness_professional(uuid,uuid), public.review_wellness_appointment(uuid,uuid,int,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_wellness_professional(uuid,uuid), public.review_wellness_appointment(uuid,uuid,int,text) TO authenticated, service_role;