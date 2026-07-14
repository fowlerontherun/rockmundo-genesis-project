
CREATE TABLE IF NOT EXISTS public.festivals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE RESTRICT,
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  scale text NOT NULL DEFAULT 'small',
  status text NOT NULL DEFAULT 'upcoming',
  start_date date NOT NULL,
  end_date date NOT NULL,
  expected_attendance integer,
  ticket_price_low numeric(10, 2),
  ticket_price_high numeric(10, 2),
  genre text,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ticket_price_low IS NULL OR ticket_price_low >= 0),
  CHECK (ticket_price_high IS NULL OR ticket_price_high >= 0),
  CHECK (ticket_price_low IS NULL OR ticket_price_high IS NULL OR ticket_price_high >= ticket_price_low),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS festivals_city_id_idx ON public.festivals (city_id);
CREATE INDEX IF NOT EXISTS festivals_start_date_idx ON public.festivals (start_date);

GRANT SELECT ON public.festivals TO anon, authenticated;
GRANT ALL ON public.festivals TO service_role;

ALTER TABLE public.festivals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='festivals' AND policyname='Festivals are viewable by everyone') THEN
    CREATE POLICY "Festivals are viewable by everyone" ON public.festivals FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='festivals' AND policyname='Service roles manage festivals') THEN
    CREATE POLICY "Service roles manage festivals" ON public.festivals FOR ALL USING (auth.role() IN ('service_role','supabase_admin')) WITH CHECK (auth.role() IN ('service_role','supabase_admin'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_festivals_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_festivals_updated_at ON public.festivals;
CREATE TRIGGER trg_festivals_updated_at BEFORE UPDATE ON public.festivals FOR EACH ROW EXECUTE FUNCTION public.set_festivals_updated_at();
