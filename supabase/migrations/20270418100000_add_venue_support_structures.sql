-- Ensure band_members.user_id references public.profiles for PostgREST relationship support
DO $$
BEGIN
  -- Remove any existing band_members.user_id foreign key to re-create it with the correct target
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'band_members_user_id_fkey'
      AND conrelid = 'public.band_members'::regclass
  ) THEN
    ALTER TABLE public.band_members
      DROP CONSTRAINT band_members_user_id_fkey;
  END IF;
END $$;

-- Clean up orphaned band member records before re-establishing the constraint
DELETE FROM public.band_members bm
WHERE NOT EXISTS (
  SELECT 1
  FROM public.profiles p
  WHERE p.user_id = bm.user_id
);

ALTER TABLE public.band_members
  ADD CONSTRAINT band_members_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(user_id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

-- Make sure venues expose a city foreign key that can be joined from PostgREST
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS city uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'venues_city_fkey'
      AND conrelid = 'public.venues'::regclass
  ) THEN
    ALTER TABLE public.venues
      ADD CONSTRAINT venues_city_fkey
      FOREIGN KEY (city)
      REFERENCES public.cities(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS venues_city_idx ON public.venues(city);

-- Create venue_relationships table
CREATE TABLE IF NOT EXISTS public.venue_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  relationship_score integer NOT NULL DEFAULT 0,
  last_interaction timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  CONSTRAINT venue_relationships_user_venue_key UNIQUE (user_id, venue_id)
);

ALTER TABLE public.venue_relationships
  ADD CONSTRAINT venue_relationships_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(user_id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

ALTER TABLE public.venue_relationships
  ADD CONSTRAINT venue_relationships_venue_id_fkey
  FOREIGN KEY (venue_id)
  REFERENCES public.venues(id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS venue_relationships_user_id_idx ON public.venue_relationships(user_id);
CREATE INDEX IF NOT EXISTS venue_relationships_venue_id_idx ON public.venue_relationships(venue_id);

ALTER TABLE public.venue_relationships ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'venue_relationships'
      AND policyname = 'Users view their venue relationships'
  ) THEN
    CREATE POLICY "Users view their venue relationships"
      ON public.venue_relationships
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'venue_relationships'
      AND policyname = 'Users manage their venue relationships'
  ) THEN
    CREATE POLICY "Users manage their venue relationships"
      ON public.venue_relationships
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Create venue_bookings table
CREATE TABLE IF NOT EXISTS public.venue_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL,
  user_id uuid NOT NULL,
  event_date timestamptz,
  status text NOT NULL DEFAULT 'pending',
  ticket_price numeric(10, 2),
  expected_attendance integer,
  tickets_sold integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.venue_bookings
  ADD CONSTRAINT venue_bookings_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(user_id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

ALTER TABLE public.venue_bookings
  ADD CONSTRAINT venue_bookings_venue_id_fkey
  FOREIGN KEY (venue_id)
  REFERENCES public.venues(id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS venue_bookings_user_id_idx ON public.venue_bookings(user_id);
CREATE INDEX IF NOT EXISTS venue_bookings_venue_id_idx ON public.venue_bookings(venue_id);
CREATE INDEX IF NOT EXISTS venue_bookings_event_date_idx ON public.venue_bookings(event_date);

ALTER TABLE public.venue_bookings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'venue_bookings'
      AND policyname = 'Users view their venue bookings'
  ) THEN
    CREATE POLICY "Users view their venue bookings"
      ON public.venue_bookings
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'venue_bookings'
      AND policyname = 'Users manage their venue bookings'
  ) THEN
    CREATE POLICY "Users manage their venue bookings"
      ON public.venue_bookings
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
