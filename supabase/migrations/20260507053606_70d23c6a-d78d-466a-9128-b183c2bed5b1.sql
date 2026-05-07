
-- ====== Tables ======
CREATE TABLE IF NOT EXISTS public.city_landmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('record_store','dive_bar','rehearsal_space','park','recording_school')),
  description text,
  map_x numeric NOT NULL DEFAULT 50,
  map_y numeric NOT NULL DEFAULT 50,
  base_fame_reward integer NOT NULL DEFAULT 1,
  base_cash_reward integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_city_landmarks_city ON public.city_landmarks(city_id);

CREATE TABLE IF NOT EXISTS public.landmark_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  landmark_id uuid NOT NULL REFERENCES public.city_landmarks(id) ON DELETE CASCADE,
  event_kind text NOT NULL,
  event_summary text NOT NULL,
  cash_delta integer NOT NULL DEFAULT 0,
  fame_delta integer NOT NULL DEFAULT 0,
  visited_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_landmark_visits_profile ON public.landmark_visits(profile_id, visited_at DESC);

CREATE TABLE IF NOT EXISTS public.busking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  landmark_id uuid REFERENCES public.city_landmarks(id) ON DELETE SET NULL,
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  duration_minutes integer NOT NULL CHECK (duration_minutes IN (15,30,60)),
  crowd_size integer NOT NULL DEFAULT 0,
  tips_earned integer NOT NULL DEFAULT 0,
  fame_gained integer NOT NULL DEFAULT 0,
  vibe text NOT NULL DEFAULT 'okay',
  played_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_busking_sessions_profile ON public.busking_sessions(profile_id, played_at DESC);

-- ====== RLS ======
ALTER TABLE public.city_landmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landmark_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.busking_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "city_landmarks read" ON public.city_landmarks;
CREATE POLICY "city_landmarks read" ON public.city_landmarks
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "landmark_visits owner" ON public.landmark_visits;
CREATE POLICY "landmark_visits owner" ON public.landmark_visits
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "busking_sessions owner" ON public.busking_sessions;
CREATE POLICY "busking_sessions owner" ON public.busking_sessions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));

-- ====== Seed: 5 landmarks for top 20 cities ======
WITH top_cities AS (
  SELECT id, name FROM public.cities ORDER BY population DESC NULLS LAST LIMIT 20
),
templates AS (
  SELECT * FROM (VALUES
    ('record_store',     'Vinyl Vault',         'A dusty record store run by a retired roadie. Rare pressings hide on the back wall.', 22, 35, 2,  80),
    ('dive_bar',         'The Broken String',   'Sticky floors, cheap beer, and a stage that has launched a hundred careers.',         70, 60, 3, 120),
    ('rehearsal_space',  'Echo Rooms',          'Twenty-four soundproofed rooms rented by the hour. Free coffee, weak wi-fi.',         40, 80, 1,  60),
    ('park',             'Riverside Promenade', 'A wide, leafy walk packed with tourists on weekends — prime busking real estate.',     55, 20, 2,  40),
    ('recording_school', 'Conservatory Annex',  'A music school that rents its smaller studios out to hopefuls between classes.',       80, 30, 1, 100)
  ) AS t(kind, name_suffix, description, map_x, map_y, fame, cash)
)
INSERT INTO public.city_landmarks (city_id, slug, name, kind, description, map_x, map_y, base_fame_reward, base_cash_reward)
SELECT
  c.id,
  t.kind || '-' || lower(replace(c.name, ' ', '-')),
  c.name || ' ' || t.name_suffix,
  t.kind,
  t.description,
  t.map_x, t.map_y, t.fame, t.cash
FROM top_cities c CROSS JOIN templates t
ON CONFLICT (city_id, slug) DO NOTHING;
