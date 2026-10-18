BEGIN;

CREATE TABLE IF NOT EXISTS public.city_night_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  quality_level integer NOT NULL CHECK (quality_level BETWEEN 1 AND 5),
  capacity integer,
  cover_charge numeric(10, 2),
  guest_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  drink_menu jsonb NOT NULL DEFAULT '[]'::jsonb,
  npc_profiles jsonb NOT NULL DEFAULT '[]'::jsonb,
  dj_slot_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS city_night_clubs_city_id_idx
  ON public.city_night_clubs (city_id);

ALTER TABLE public.city_night_clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Night clubs are viewable by everyone" ON public.city_night_clubs;
CREATE POLICY "Night clubs are viewable by everyone"
  ON public.city_night_clubs
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Privileged roles manage night clubs" ON public.city_night_clubs;
CREATE POLICY "Privileged roles manage night clubs"
  ON public.city_night_clubs
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  );

DROP TRIGGER IF EXISTS update_city_night_clubs_updated_at ON public.city_night_clubs;
CREATE TRIGGER update_city_night_clubs_updated_at
  BEFORE UPDATE ON public.city_night_clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
