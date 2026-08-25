-- Support Band Marketplace - Phase 1 foundation
-- Adds support preferences, city/date availability, invitation slots and an
-- authoritative candidate query that reuses the live gig/member schedule model.

CREATE TABLE IF NOT EXISTS public.band_support_preferences (
  band_id uuid PRIMARY KEY REFERENCES public.bands(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  single_gigs_enabled boolean NOT NULL DEFAULT true,
  tour_enabled boolean NOT NULL DEFAULT true,
  travel_enabled boolean NOT NULL DEFAULT false,
  max_travel_minutes integer,
  minimum_headliner_fame integer NOT NULL DEFAULT 0,
  minimum_venue_capacity integer NOT NULL DEFAULT 0,
  preferred_genres text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT band_support_preferences_travel_minutes_check
    CHECK (max_travel_minutes IS NULL OR max_travel_minutes >= 0),
  CONSTRAINT band_support_preferences_min_fame_check
    CHECK (minimum_headliner_fame >= 0),
  CONSTRAINT band_support_preferences_min_capacity_check
    CHECK (minimum_venue_capacity >= 0)
);

CREATE TABLE IF NOT EXISTS public.band_support_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  available_from date NOT NULL,
  available_until date NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT band_support_availability_date_check
    CHECK (available_until >= available_from),
  CONSTRAINT band_support_availability_status_check
    CHECK (status IN ('active','temporarily_unavailable','expired','disabled'))
);

CREATE INDEX IF NOT EXISTS band_support_availability_lookup_idx
  ON public.band_support_availability (city_id, available_from, available_until, band_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS band_support_availability_band_idx
  ON public.band_support_availability (band_id, status, available_from, available_until);

CREATE TABLE IF NOT EXISTS public.gig_support_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  support_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  revenue_share numeric(5,4) NOT NULL DEFAULT 0.2000,
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gig_support_slots_status_check
    CHECK (status IN ('pending','accepted','declined','cancelled','expired','completed')),
  CONSTRAINT gig_support_slots_revenue_share_check
    CHECK (revenue_share >= 0 AND revenue_share <= 1)
);

-- Initial release: one accepted/completed support act per show.
CREATE UNIQUE INDEX IF NOT EXISTS gig_support_slots_one_confirmed_per_gig_uidx
  ON public.gig_support_slots (gig_id)
  WHERE status IN ('accepted','completed');

CREATE INDEX IF NOT EXISTS gig_support_slots_band_status_idx
  ON public.gig_support_slots (support_band_id, status, gig_id);

ALTER TABLE public.band_support_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_support_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_support_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Support preferences are publicly readable" ON public.band_support_preferences;
CREATE POLICY "Support preferences are publicly readable"
  ON public.band_support_preferences FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Band managers can manage support preferences" ON public.band_support_preferences;
CREATE POLICY "Band managers can manage support preferences"
  ON public.band_support_preferences FOR ALL TO authenticated
  USING (public.can_manage_band_gigs(band_id, auth.uid()))
  WITH CHECK (public.can_manage_band_gigs(band_id, auth.uid()));

DROP POLICY IF EXISTS "Support availability is publicly readable" ON public.band_support_availability;
CREATE POLICY "Support availability is publicly readable"
  ON public.band_support_availability FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Band managers can manage support availability" ON public.band_support_availability;
CREATE POLICY "Band managers can manage support availability"
  ON public.band_support_availability FOR ALL TO authenticated
  USING (public.can_manage_band_gigs(band_id, auth.uid()))
  WITH CHECK (public.can_manage_band_gigs(band_id, auth.uid()));

DROP POLICY IF EXISTS "Support slots are visible to involved bands" ON public.gig_support_slots;
CREATE POLICY "Support slots are visible to involved bands"
  ON public.gig_support_slots FOR SELECT TO authenticated
  USING (
    public.can_manage_band_gigs(support_band_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.gigs g
      WHERE g.id = gig_id
        AND public.can_manage_band_gigs(g.band_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Headliners can create support slots" ON public.gig_support_slots;
CREATE POLICY "Headliners can create support slots"
  ON public.gig_support_slots FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gigs g
      WHERE g.id = gig_id
        AND g.band_id <> support_band_id
        AND public.can_manage_band_gigs(g.band_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Involved bands can update support slots" ON public.gig_support_slots;
CREATE POLICY "Involved bands can update support slots"
  ON public.gig_support_slots FOR UPDATE TO authenticated
  USING (
    public.can_manage_band_gigs(support_band_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.gigs g
      WHERE g.id = gig_id
        AND public.can_manage_band_gigs(g.band_id, auth.uid())
    )
  )
  WITH CHECK (
    public.can_manage_band_gigs(support_band_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.gigs g
      WHERE g.id = gig_id
        AND public.can_manage_band_gigs(g.band_id, auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.set_band_support_preferences(
  p_band_id uuid,
  p_enabled boolean,
  p_single_gigs_enabled boolean DEFAULT true,
  p_tour_enabled boolean DEFAULT true,
  p_travel_enabled boolean DEFAULT false,
  p_max_travel_minutes integer DEFAULT NULL,
  p_minimum_headliner_fame integer DEFAULT 0,
  p_minimum_venue_capacity integer DEFAULT 0,
  p_preferred_genres text[] DEFAULT '{}'::text[]
) RETURNS public.band_support_preferences
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.band_support_preferences%ROWTYPE;
BEGIN
  IF NOT public.can_manage_band_gigs(p_band_id, auth.uid()) THEN
    RAISE EXCEPTION 'support_preferences_forbidden' USING ERRCODE='42501';
  END IF;

  INSERT INTO public.band_support_preferences (
    band_id, enabled, single_gigs_enabled, tour_enabled, travel_enabled,
    max_travel_minutes, minimum_headliner_fame, minimum_venue_capacity,
    preferred_genres, updated_at
  ) VALUES (
    p_band_id, COALESCE(p_enabled,false), COALESCE(p_single_gigs_enabled,true),
    COALESCE(p_tour_enabled,true), COALESCE(p_travel_enabled,false),
    p_max_travel_minutes, GREATEST(COALESCE(p_minimum_headliner_fame,0),0),
    GREATEST(COALESCE(p_minimum_venue_capacity,0),0),
    COALESCE(p_preferred_genres,'{}'::text[]), now()
  )
  ON CONFLICT (band_id) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    single_gigs_enabled = EXCLUDED.single_gigs_enabled,
    tour_enabled = EXCLUDED.tour_enabled,
    travel_enabled = EXCLUDED.travel_enabled,
    max_travel_minutes = EXCLUDED.max_travel_minutes,
    minimum_headliner_fame = EXCLUDED.minimum_headliner_fame,
    minimum_venue_capacity = EXCLUDED.minimum_venue_capacity,
    preferred_genres = EXCLUDED.preferred_genres,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_band_support_availability(
  p_band_id uuid,
  p_city_id uuid,
  p_available_from date,
  p_available_until date
) RETURNS public.band_support_availability
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.band_support_availability%ROWTYPE;
BEGIN
  IF NOT public.can_manage_band_gigs(p_band_id, auth.uid()) THEN
    RAISE EXCEPTION 'support_availability_forbidden' USING ERRCODE='42501';
  END IF;
  IF p_available_from IS NULL OR p_available_until IS NULL OR p_available_until < p_available_from THEN
    RAISE EXCEPTION 'support_availability_dates_invalid' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cities c WHERE c.id = p_city_id) THEN
    RAISE EXCEPTION 'support_availability_city_invalid' USING ERRCODE='23503';
  END IF;

  INSERT INTO public.band_support_availability (
    band_id, city_id, available_from, available_until, status
  ) VALUES (p_band_id, p_city_id, p_available_from, p_available_until, 'active')
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Authoritative candidate search for a proposed support slot.
-- Phase 1 validates city/date declaration plus existing gig/member schedule conflicts.
-- Tour travel feasibility is deliberately added in Phase 3 once the itinerary is known.
CREATE OR REPLACE FUNCTION public.find_available_support_bands(
  p_headliner_band_id uuid,
  p_city_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_for_tour boolean DEFAULT false,
  p_venue_capacity integer DEFAULT 0
) RETURNS TABLE (
  band_id uuid,
  band_name text,
  fame integer,
  popularity integer,
  availability_id uuid,
  available_from date,
  available_until date
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH headliner AS (
    SELECT b.id, COALESCE(b.fame,0)::integer AS fame
    FROM public.bands b
    WHERE b.id = p_headliner_band_id AND b.status = 'active'
  ), candidates AS (
    SELECT DISTINCT ON (b.id)
      b.id AS band_id,
      b.name AS band_name,
      COALESCE(b.fame,0)::integer AS fame,
      COALESCE(b.popularity,0)::integer AS popularity,
      a.id AS availability_id,
      a.available_from,
      a.available_until
    FROM public.bands b
    JOIN public.band_support_preferences pref ON pref.band_id = b.id
    JOIN public.band_support_availability a ON a.band_id = b.id
    CROSS JOIN headliner h
    WHERE b.status = 'active'
      AND b.id <> p_headliner_band_id
      AND pref.enabled
      AND (CASE WHEN p_for_tour THEN pref.tour_enabled ELSE pref.single_gigs_enabled END)
      AND h.fame >= pref.minimum_headliner_fame
      AND COALESCE(p_venue_capacity,0) >= pref.minimum_venue_capacity
      AND a.status = 'active'
      AND a.city_id = p_city_id
      AND (p_start AT TIME ZONE 'UTC')::date BETWEEN a.available_from AND a.available_until
      AND NOT EXISTS (
        SELECT 1
        FROM public.gigs g
        WHERE g.band_id = b.id
          AND g.status IN ('scheduled','in_progress','ready_for_completion')
          AND g.scheduled_date < p_end
          AND COALESCE(g.scheduled_end, g.scheduled_date + interval '3 hours') > p_start
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.player_scheduled_activities psa
        WHERE psa.status IN ('scheduled','in_progress')
          AND psa.scheduled_start < p_end
          AND psa.scheduled_end > p_start
          AND psa.profile_id IN (
            SELECT COALESCE(bm.profile_id, mp.id)
            FROM public.band_members bm
            LEFT JOIN public.profiles mp ON mp.user_id = bm.user_id
            WHERE bm.band_id = b.id
              AND COALESCE(bm.member_status,'active') = 'active'
              AND COALESCE(bm.is_touring_member,false) = false
              AND COALESCE(bm.profile_id, mp.id) IS NOT NULL
            UNION
            SELECT b.leader_id
            WHERE EXISTS (SELECT 1 FROM public.profiles lp WHERE lp.id = b.leader_id)
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.gig_support_slots gs
        JOIN public.gigs existing_gig ON existing_gig.id = gs.gig_id
        WHERE gs.support_band_id = b.id
          AND gs.status IN ('accepted','completed')
          AND existing_gig.scheduled_date < p_end
          AND COALESCE(existing_gig.scheduled_end, existing_gig.scheduled_date + interval '3 hours') > p_start
      )
    ORDER BY b.id, a.available_until DESC
  )
  SELECT * FROM candidates
  ORDER BY popularity DESC, fame DESC, band_name ASC;
$$;

REVOKE ALL ON FUNCTION public.set_band_support_preferences(uuid,boolean,boolean,boolean,boolean,integer,integer,integer,text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_band_support_availability(uuid,uuid,date,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_available_support_bands(uuid,uuid,timestamptz,timestamptz,boolean,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_band_support_preferences(uuid,boolean,boolean,boolean,boolean,integer,integer,integer,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_band_support_availability(uuid,uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_available_support_bands(uuid,uuid,timestamptz,timestamptz,boolean,integer) TO authenticated;

COMMENT ON TABLE public.band_support_preferences IS 'Band-level opt-in and filtering preferences for support slots.';
COMMENT ON TABLE public.band_support_availability IS 'Cities and date ranges where a band has declared itself willing to support another act.';
COMMENT ON TABLE public.gig_support_slots IS 'Support-act invitation and confirmation lifecycle for gigs. Initial release permits one confirmed support band per gig.';
COMMENT ON FUNCTION public.find_available_support_bands(uuid,uuid,timestamptz,timestamptz,boolean,integer) IS 'Returns support bands whose declared city/date availability is valid and whose authoritative gig/member schedules are conflict-free for the proposed show window.';
