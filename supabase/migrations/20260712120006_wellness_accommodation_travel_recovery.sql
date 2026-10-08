-- Wellness accommodation and tour travel recovery hooks.
-- Safe additive schema: clients never submit recovery scores; server jobs/RPCs own processing.

CREATE TABLE IF NOT EXISTS public.accommodation_recovery_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_id uuid,
  accommodation_kind text NOT NULL CHECK (accommodation_kind IN ('none','home','hotel','temporary','vehicle')),
  recovery_tier text NOT NULL CHECK (recovery_tier IN ('none','basic','standard','premium','specialist')),
  sleep_quality_modifier numeric NOT NULL DEFAULT 0,
  energy_recovery_modifier numeric NOT NULL DEFAULT 0,
  fatigue_recovery_modifier numeric NOT NULL DEFAULT 0,
  stress_recovery_modifier numeric NOT NULL DEFAULT 0,
  strain_recovery_modifier numeric NOT NULL DEFAULT 0,
  condition_recovery_modifier numeric NOT NULL DEFAULT 0,
  privacy_modifier numeric NOT NULL DEFAULT 0,
  noise_modifier numeric NOT NULL DEFAULT 0,
  comfort_rating integer NOT NULL DEFAULT 50 CHECK (comfort_rating BETWEEN 0 AND 100),
  cleanliness_rating integer NOT NULL DEFAULT 50 CHECK (cleanliness_rating BETWEEN 0 AND 100),
  safety_rating integer NOT NULL DEFAULT 50 CHECK (safety_rating BETWEEN 0 AND 100),
  recovery_capacity integer NOT NULL DEFAULT 1 CHECK (recovery_capacity >= 0),
  facilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_table, source_id)
);

CREATE TABLE IF NOT EXISTS public.transport_wellness_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_tier text NOT NULL UNIQUE,
  travel_comfort integer NOT NULL DEFAULT 50 CHECK (travel_comfort BETWEEN 0 AND 100),
  sleep_capability integer NOT NULL DEFAULT 0 CHECK (sleep_capability BETWEEN 0 AND 100),
  noise integer NOT NULL DEFAULT 50 CHECK (noise BETWEEN 0 AND 100),
  vibration integer NOT NULL DEFAULT 50 CHECK (vibration BETWEEN 0 AND 100),
  personal_space integer NOT NULL DEFAULT 50 CHECK (personal_space BETWEEN 0 AND 100),
  climate_control integer NOT NULL DEFAULT 50 CHECK (climate_control BETWEEN 0 AND 100),
  seating_quality integer NOT NULL DEFAULT 50 CHECK (seating_quality BETWEEN 0 AND 100),
  movement_during_travel integer NOT NULL DEFAULT 50 CHECK (movement_during_travel BETWEEN 0 AND 100),
  recovery_efficiency integer NOT NULL DEFAULT 35 CHECK (recovery_efficiency BETWEEN 0 AND 100),
  privacy integer NOT NULL DEFAULT 50 CHECK (privacy BETWEEN 0 AND 100),
  onboard_facilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wellness_recovery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('overnight','travel','rest_day','jet_lag','accommodation','condition')),
  source_id uuid,
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, event_key)
);

CREATE TABLE IF NOT EXISTS public.tour_load_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id uuid,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_start date NOT NULL,
  window_end date NOT NULL,
  load_state text NOT NULL CHECK (load_state IN ('comfortable','active','demanding','exhausting','unsustainable')),
  load_score integer NOT NULL CHECK (load_score BETWEEN 0 AND 100),
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tour_id, profile_id, window_start, window_end)
);

ALTER TABLE public.accommodation_recovery_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_wellness_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_recovery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_load_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read accommodation recovery profiles" ON public.accommodation_recovery_profiles;
CREATE POLICY "read accommodation recovery profiles" ON public.accommodation_recovery_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "read transport wellness profiles" ON public.transport_wellness_profiles;
CREATE POLICY "read transport wellness profiles" ON public.transport_wellness_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "owners read recovery events" ON public.wellness_recovery_events;
CREATE POLICY "owners read recovery events" ON public.wellness_recovery_events FOR SELECT USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "owners read tour load summaries" ON public.tour_load_summaries;
CREATE POLICY "owners read tour load summaries" ON public.tour_load_summaries FOR SELECT USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR profile_id IS NULL);

INSERT INTO public.transport_wellness_profiles (vehicle_tier, travel_comfort, sleep_capability, noise, vibration, personal_space, climate_control, seating_quality, recovery_efficiency, privacy, onboard_facilities)
VALUES
('rusty_van', 14, 5, 78, 82, 20, 25, 20, 18, 15, '["free"]'),
('minivan', 28, 8, 68, 72, 32, 55, 35, 25, 25, '["air conditioning"]'),
('sprinter', 42, 45, 58, 60, 45, 62, 48, 45, 40, '["sleeping bunks","gear storage"]'),
('small_tour_bus', 56, 65, 48, 48, 58, 70, 60, 58, 55, '["full bunks","kitchenette","lounge"]'),
('full_tour_bus', 70, 76, 40, 40, 70, 78, 72, 68, 68, '["private bunks","full kitchen","shower"]'),
('luxury_coach', 84, 86, 30, 34, 86, 88, 86, 78, 84, '["private suites","recovery station"]'),
('tour_fleet', 84, 72, 34, 36, 78, 86, 82, 72, 76, '["band bus","crew bus","catering vehicle"]'),
('private_jet_fleet', 92, 58, 36, 25, 90, 92, 92, 62, 88, '["private jet","concierge service"]')
ON CONFLICT (vehicle_tier) DO UPDATE SET
  travel_comfort = EXCLUDED.travel_comfort,
  sleep_capability = EXCLUDED.sleep_capability,
  recovery_efficiency = EXCLUDED.recovery_efficiency,
  onboard_facilities = EXCLUDED.onboard_facilities,
  updated_at = now();

COMMENT ON TABLE public.wellness_recovery_events IS 'Idempotency ledger for overnight recovery, travel fatigue, rest day, jet lag and condition recovery effects.';
