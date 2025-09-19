-- Create festivals and festival lineups tables
CREATE TABLE IF NOT EXISTS public.festivals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE RESTRICT,
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  expected_attendance integer,
  ticket_price_low numeric(10, 2),
  ticket_price_high numeric(10, 2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ticket_price_low IS NULL OR ticket_price_low >= 0),
  CHECK (ticket_price_high IS NULL OR ticket_price_high >= 0),
  CHECK (
    ticket_price_low IS NULL
    OR ticket_price_high IS NULL
    OR ticket_price_high >= ticket_price_low
  ),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.festival_lineups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  performance_day date,
  stage_name text,
  set_time timestamptz,
  duration_minutes integer,
  is_headliner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (duration_minutes IS NULL OR duration_minutes > 0)
);

CREATE INDEX IF NOT EXISTS festivals_city_id_idx ON public.festivals (city_id);
CREATE INDEX IF NOT EXISTS festival_lineups_festival_id_idx ON public.festival_lineups (festival_id);
CREATE INDEX IF NOT EXISTS festival_lineups_band_id_idx ON public.festival_lineups (band_id);

ALTER TABLE public.festivals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_lineups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Festivals are viewable by everyone"
  ON public.festivals
  FOR SELECT
  USING (true);

CREATE POLICY "Service roles manage festivals"
  ON public.festivals
  FOR INSERT
  WITH CHECK (auth.role() IN ('service_role', 'supabase_admin'));

CREATE POLICY "Service roles update festivals"
  ON public.festivals
  FOR UPDATE
  USING (auth.role() IN ('service_role', 'supabase_admin'))
  WITH CHECK (auth.role() IN ('service_role', 'supabase_admin'));

CREATE POLICY "Festival lineups are viewable by everyone"
  ON public.festival_lineups
  FOR SELECT
  USING (true);

CREATE POLICY "Band members can add festival lineup slots"
  ON public.festival_lineups
  FOR INSERT
  WITH CHECK (
    auth.role() IN ('service_role', 'supabase_admin')
    OR EXISTS (
      SELECT 1
      FROM public.band_members bm
      WHERE bm.band_id = festival_lineups.band_id
        AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Band members can update festival lineup slots"
  ON public.festival_lineups
  FOR UPDATE
  USING (
    auth.role() IN ('service_role', 'supabase_admin')
    OR EXISTS (
      SELECT 1
      FROM public.band_members bm
      WHERE bm.band_id = festival_lineups.band_id
        AND bm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() IN ('service_role', 'supabase_admin')
    OR EXISTS (
      SELECT 1
      FROM public.band_members bm
      WHERE bm.band_id = festival_lineups.band_id
        AND bm.user_id = auth.uid()
    )
  );

-- Seed representative festivals and lineups when supporting data exists
WITH london AS (
  SELECT id AS city_id FROM public.cities WHERE name = 'London' LIMIT 1
),
festival_grounds AS (
  SELECT id AS venue_id FROM public.venues WHERE name = 'Festival Grounds' LIMIT 1
),
inserted_festival AS (
  INSERT INTO public.festivals (
    name,
    city_id,
    venue_id,
    start_date,
    end_date,
    expected_attendance,
    ticket_price_low,
    ticket_price_high,
    metadata
  )
  SELECT
    'Rockmundo Summer Fest',
    london.city_id,
    festival_grounds.venue_id,
    DATE '2025-08-15',
    DATE '2025-08-17',
    45000,
    75,
    250,
    jsonb_build_object(
      'headliners', jsonb_build_array('The Electric Suns', 'Neon Nights', 'Aurora Skies'),
      'daily_schedule', jsonb_build_array(
        jsonb_build_object('day', 'Friday', 'theme', 'Opening Night'),
        jsonb_build_object('day', 'Saturday', 'theme', 'Legends of Rock'),
        jsonb_build_object('day', 'Sunday', 'theme', 'Future Sounds')
      )
    )
  FROM london
  CROSS JOIN festival_grounds
  WHERE london.city_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.festivals WHERE name = 'Rockmundo Summer Fest')
  RETURNING id
)
INSERT INTO public.festival_lineups (
  festival_id,
  band_id,
  performance_day,
  stage_name,
  set_time,
  duration_minutes,
  is_headliner
)
SELECT
  inserted_festival.id,
  bands.id,
  COALESCE(festival_days.performance_day, DATE '2025-08-15'),
  festival_days.stage_name,
  festival_days.set_time,
  festival_days.duration_minutes,
  festival_days.is_headliner
FROM inserted_festival
JOIN (
  SELECT
    b.id,
    ROW_NUMBER() OVER (ORDER BY b.created_at NULLS LAST, b.id) AS band_position
  FROM public.bands b
) bands ON true
JOIN LATERAL (
  SELECT
    CASE
      WHEN bands.band_position = 1 THEN DATE '2025-08-15'
      WHEN bands.band_position = 2 THEN DATE '2025-08-16'
      ELSE DATE '2025-08-17'
    END AS performance_day,
    CASE
      WHEN bands.band_position <= 2 THEN 'Main Stage'
      ELSE 'Indie Grove'
    END AS stage_name,
    CASE
      WHEN bands.band_position = 1 THEN timestamptz '2025-08-15 21:30:00+00'
      WHEN bands.band_position = 2 THEN timestamptz '2025-08-16 21:00:00+00'
      ELSE timestamptz '2025-08-17 18:30:00+00'
    END AS set_time,
    CASE
      WHEN bands.band_position <= 2 THEN 90
      ELSE 60
    END AS duration_minutes,
    bands.band_position <= 2 AS is_headliner
) festival_days ON true
WHERE bands.band_position <= 5;

