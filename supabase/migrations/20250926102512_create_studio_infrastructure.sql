-- Create recording studio core tables and enums

DO $$
BEGIN
  CREATE TYPE public.studio_session_mood AS ENUM ('professional', 'party', 'chilled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE TYPE public.studio_booking_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE TYPE public.studio_slot AS ENUM ('morning', 'evening');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE TYPE public.studio_booking_artist_role AS ENUM ('band_member', 'session_musician', 'producer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

CREATE TABLE IF NOT EXISTS public.studios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  quality integer NOT NULL CHECK (quality BETWEEN 1 AND 100),
  cost_per_day integer NOT NULL CHECK (cost_per_day >= 0),
  engineer_rating integer NOT NULL CHECK (engineer_rating BETWEEN 1 AND 100),
  equipment_rating integer NOT NULL CHECK (equipment_rating BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS studios_city_id_idx ON public.studios (city_id);
CREATE INDEX IF NOT EXISTS studios_quality_idx ON public.studios (quality DESC);

CREATE TABLE IF NOT EXISTS public.studio_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  mood public.studio_session_mood NOT NULL,
  producer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.studio_booking_status NOT NULL DEFAULT 'pending',
  total_cost integer NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS studio_bookings_band_id_idx ON public.studio_bookings (band_id);
CREATE INDEX IF NOT EXISTS studio_bookings_studio_id_idx ON public.studio_bookings (studio_id);
CREATE INDEX IF NOT EXISTS studio_bookings_status_idx ON public.studio_bookings (status);

CREATE TABLE IF NOT EXISTS public.studio_booking_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.studio_bookings(id) ON DELETE CASCADE,
  slot_date date NOT NULL,
  slot public.studio_slot NOT NULL,
  is_booked boolean NOT NULL DEFAULT true,
  UNIQUE (booking_id, slot_date, slot)
);

CREATE INDEX IF NOT EXISTS studio_booking_slots_booking_idx ON public.studio_booking_slots (booking_id, slot_date);
CREATE INDEX IF NOT EXISTS studio_booking_slots_slot_idx ON public.studio_booking_slots (slot_date, slot);

CREATE TABLE IF NOT EXISTS public.studio_booking_artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.studio_bookings(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.studio_booking_artist_role NOT NULL,
  daily_cost integer NOT NULL DEFAULT 0 CHECK (daily_cost >= 0),
  UNIQUE (booking_id, character_id, role)
);

CREATE INDEX IF NOT EXISTS studio_booking_artists_booking_idx ON public.studio_booking_artists (booking_id);
CREATE INDEX IF NOT EXISTS studio_booking_artists_character_idx ON public.studio_booking_artists (character_id);

CREATE TABLE IF NOT EXISTS public.studio_booking_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.studio_bookings(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  progress_start numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_start >= 0 AND progress_start <= 100),
  progress_end numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_end >= 0 AND progress_end <= 100),
  momentum integer NOT NULL DEFAULT 0,
  UNIQUE (booking_id, song_id)
);

CREATE INDEX IF NOT EXISTS studio_booking_songs_booking_idx ON public.studio_booking_songs (booking_id);
CREATE INDEX IF NOT EXISTS studio_booking_songs_song_idx ON public.studio_booking_songs (song_id);

CREATE TRIGGER set_studios_updated_at
  BEFORE UPDATE ON public.studios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_studio_bookings_updated_at
  BEFORE UPDATE ON public.studio_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_booking_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_booking_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_booking_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Studios are viewable by everyone" ON public.studios;
CREATE POLICY "Studios are viewable by everyone"
  ON public.studios
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Studios managed by privileged roles" ON public.studios;
CREATE POLICY "Studios managed by privileged roles"
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

DROP POLICY IF EXISTS "Studio bookings are viewable by band members" ON public.studio_bookings;
CREATE POLICY "Studio bookings are viewable by band members"
  ON public.studio_bookings
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.bands b
      WHERE b.id = studio_bookings.band_id
        AND b.leader_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.band_members bm
      WHERE bm.band_id = studio_bookings.band_id
        AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Band leaders manage studio bookings" ON public.studio_bookings;
CREATE POLICY "Band leaders manage studio bookings"
  ON public.studio_bookings
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.bands b
      WHERE b.id = studio_bookings.band_id
        AND b.leader_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.bands b
      WHERE b.id = studio_bookings.band_id
        AND b.leader_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Studio slots follow booking visibility" ON public.studio_booking_slots;
CREATE POLICY "Studio slots follow booking visibility"
  ON public.studio_booking_slots
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.studio_bookings sb
      JOIN public.bands b ON b.id = sb.band_id
      WHERE sb.id = studio_booking_slots.booking_id
        AND (b.leader_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.band_members bm
            WHERE bm.band_id = sb.band_id
              AND bm.user_id = auth.uid()
          ))
    )
  );

DROP POLICY IF EXISTS "Studio slots managed by band leaders" ON public.studio_booking_slots;
CREATE POLICY "Studio slots managed by band leaders"
  ON public.studio_booking_slots
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.studio_bookings sb
      JOIN public.bands b ON b.id = sb.band_id
      WHERE sb.id = studio_booking_slots.booking_id
        AND b.leader_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.studio_bookings sb
      JOIN public.bands b ON b.id = sb.band_id
      WHERE sb.id = studio_booking_slots.booking_id
        AND b.leader_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Studio booking artists viewable to participants" ON public.studio_booking_artists;
CREATE POLICY "Studio booking artists viewable to participants"
  ON public.studio_booking_artists
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.studio_bookings sb
      JOIN public.bands b ON b.id = sb.band_id
      WHERE sb.id = studio_booking_artists.booking_id
        AND (b.leader_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.band_members bm
            WHERE bm.band_id = sb.band_id
              AND bm.user_id = auth.uid()
          ))
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = studio_booking_artists.character_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Studio booking artists managed by leaders" ON public.studio_booking_artists;
CREATE POLICY "Studio booking artists managed by leaders"
  ON public.studio_booking_artists
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.studio_bookings sb
      JOIN public.bands b ON b.id = sb.band_id
      WHERE sb.id = studio_booking_artists.booking_id
        AND b.leader_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.studio_bookings sb
      JOIN public.bands b ON b.id = sb.band_id
      WHERE sb.id = studio_booking_artists.booking_id
        AND b.leader_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Studio booking songs viewable to band" ON public.studio_booking_songs;
CREATE POLICY "Studio booking songs viewable to band"
  ON public.studio_booking_songs
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.studio_bookings sb
      JOIN public.bands b ON b.id = sb.band_id
      WHERE sb.id = studio_booking_songs.booking_id
        AND (b.leader_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.band_members bm
            WHERE bm.band_id = sb.band_id
              AND bm.user_id = auth.uid()
          ))
    )
  );

DROP POLICY IF EXISTS "Studio booking songs managed by leaders" ON public.studio_booking_songs;
CREATE POLICY "Studio booking songs managed by leaders"
  ON public.studio_booking_songs
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.studio_bookings sb
      JOIN public.bands b ON b.id = sb.band_id
      WHERE sb.id = studio_booking_songs.booking_id
        AND b.leader_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.studio_bookings sb
      JOIN public.bands b ON b.id = sb.band_id
      WHERE sb.id = studio_booking_songs.booking_id
        AND b.leader_id = auth.uid()
    )
  );
