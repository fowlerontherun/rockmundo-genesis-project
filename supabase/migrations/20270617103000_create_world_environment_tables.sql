-- Create world environment support tables referenced by the application UI
BEGIN;

-- Detailed city metadata used by the world environment and city detail panels
CREATE TABLE IF NOT EXISTS public.city_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  summary text,
  famous_resident text,
  signature_sound text,
  metro_area text,
  timezone text,
  aliases text[] NOT NULL DEFAULT '{}',
  locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  travel_modes jsonb NOT NULL DEFAULT '[]'::jsonb,
  travel_nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  transport_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  featured_venues jsonb NOT NULL DEFAULT '[]'::jsonb,
  featured_studios jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS city_metadata_city_id_idx
  ON public.city_metadata (city_id);

ALTER TABLE public.city_metadata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "City metadata is viewable by everyone" ON public.city_metadata;
CREATE POLICY "City metadata is viewable by everyone"
  ON public.city_metadata
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Privileged roles manage city metadata" ON public.city_metadata;
CREATE POLICY "Privileged roles manage city metadata"
  ON public.city_metadata
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  );

DROP TRIGGER IF EXISTS update_city_metadata_updated_at ON public.city_metadata;
CREATE TRIGGER update_city_metadata_updated_at
  BEFORE UPDATE ON public.city_metadata
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Recording studios surfaced in the admin management experience
CREATE TABLE IF NOT EXISTS public.studios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  quality integer CHECK (quality BETWEEN 0 AND 100),
  engineer_rating integer CHECK (engineer_rating BETWEEN 0 AND 100),
  equipment_rating integer CHECK (equipment_rating BETWEEN 0 AND 100),
  cost_per_day numeric(10, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS studios_city_id_idx ON public.studios (city_id);

ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Studios are viewable by everyone" ON public.studios;
CREATE POLICY "Studios are viewable by everyone"
  ON public.studios
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Privileged roles manage studios" ON public.studios;
CREATE POLICY "Privileged roles manage studios"
  ON public.studios
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  );

DROP TRIGGER IF EXISTS update_studios_updated_at ON public.studios;
CREATE TRIGGER update_studios_updated_at
  BEFORE UPDATE ON public.studios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Global weather snapshots that influence city conditions
CREATE TABLE IF NOT EXISTS public.weather (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  country text NOT NULL DEFAULT '',
  condition text NOT NULL,
  temperature numeric,
  humidity numeric,
  wind_speed numeric,
  effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  forecast_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weather_city_idx ON public.weather (city);

ALTER TABLE public.weather ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Weather is viewable by everyone" ON public.weather;
CREATE POLICY "Weather is viewable by everyone"
  ON public.weather
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Privileged roles manage weather" ON public.weather;
CREATE POLICY "Privileged roles manage weather"
  ON public.weather
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  );

DROP TRIGGER IF EXISTS update_weather_updated_at ON public.weather;
CREATE TRIGGER update_weather_updated_at
  BEFORE UPDATE ON public.weather
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- High-level world events that impact gameplay modifiers
CREATE TABLE IF NOT EXISTS public.world_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text NOT NULL,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz NOT NULL DEFAULT now(),
  affected_cities text[] NOT NULL DEFAULT '{}',
  global_effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  participation_reward numeric,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS world_events_active_start_idx
  ON public.world_events (is_active, start_date);

ALTER TABLE public.world_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "World events are viewable by everyone" ON public.world_events;
CREATE POLICY "World events are viewable by everyone"
  ON public.world_events
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Privileged roles manage world events" ON public.world_events;
CREATE POLICY "Privileged roles manage world events"
  ON public.world_events
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  );

DROP TRIGGER IF EXISTS update_world_events_updated_at ON public.world_events;
CREATE TRIGGER update_world_events_updated_at
  BEFORE UPDATE ON public.world_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Time-limited random events surfaced to players
CREATE TABLE IF NOT EXISTS public.random_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  rarity text NOT NULL DEFAULT 'common',
  expiry timestamptz NOT NULL,
  choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS random_events_expiry_idx
  ON public.random_events (expiry);

ALTER TABLE public.random_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Random events are viewable by everyone" ON public.random_events;
CREATE POLICY "Random events are viewable by everyone"
  ON public.random_events
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Privileged roles manage random events" ON public.random_events;
CREATE POLICY "Privileged roles manage random events"
  ON public.random_events
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  );

DROP TRIGGER IF EXISTS update_random_events_updated_at ON public.random_events;
CREATE TRIGGER update_random_events_updated_at
  BEFORE UPDATE ON public.random_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Allow unauthenticated username lookups to use the public profile view during sign-up flows
GRANT SELECT ON public.public_profiles TO anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
