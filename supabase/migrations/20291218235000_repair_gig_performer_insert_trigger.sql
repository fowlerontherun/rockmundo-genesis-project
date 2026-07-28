-- Forward-only repair after inspecting the complete migration order.
-- 20290711030000 replaces seed_gig_performers *after* the 20260728160000
-- reconciliation and installs validate_gig_performer on the INSERT path.  That
-- validator writes optional NEW.updated_at / NEW.performed_at fields, so a live
-- gig_performers table created from the older contract raises SQLSTATE 42703.
-- Booking does not need either field: remove that trigger dependency rather than
-- adding speculative compatibility columns.

CREATE OR REPLACE FUNCTION public.validate_gig_performer()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_band_id uuid;
BEGIN
  SELECT g.band_id INTO v_band_id
  FROM public.gigs g
  WHERE g.id = NEW.gig_id;

  IF v_band_id IS NULL OR NEW.band_id <> v_band_id THEN
    RAISE EXCEPTION 'Performer band must match gig band';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.active_band_performing_members(NEW.band_id) member
    WHERE member.profile_id = NEW.profile_id
  ) THEN
    RAISE EXCEPTION 'Gig performer must be an active performing band member';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_gig_performer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_gig_performer() TO authenticated, service_role;

-- Restore the canonical seeder overwritten by 20290711030000.  It includes a
-- row-less leader and excludes inactive/touring members.
CREATE OR REPLACE FUNCTION public.seed_gig_performers(p_gig_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gig public.gigs%ROWTYPE;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id;
  IF NOT FOUND OR COALESCE(v_gig.status, '') IN ('cancelled', 'failed') THEN
    RETURN 0;
  END IF;

  INSERT INTO public.gig_performers
    (gig_id, band_id, profile_id, role_or_instrument, lineup_status, selected_at)
  SELECT v_gig.id,
         v_gig.band_id,
         member.profile_id,
         NULLIF(COALESCE(bm.instrument_role, bm.role), ''),
         'selected',
         now()
  FROM public.active_band_performing_members(v_gig.band_id) member
  LEFT JOIN LATERAL (
    SELECT candidate.instrument_role, candidate.role, candidate.joined_at
    FROM public.band_members candidate
    WHERE candidate.band_id = v_gig.band_id
      AND candidate.profile_id = member.profile_id
    ORDER BY candidate.joined_at NULLS LAST, candidate.id
    LIMIT 1
  ) bm ON true
  WHERE bm.joined_at IS NULL OR bm.joined_at <= v_gig.scheduled_date
  ON CONFLICT ON CONSTRAINT gig_performers_unique DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_gig_performers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_gig_performers(uuid) TO authenticated, service_role;

-- Fail deployment if the actual trigger target still contains either absent
-- optional-field reference or the seeder has again drifted from the canonical
-- membership resolver.
DO $$
DECLARE
  v_validator text := pg_get_functiondef('public.validate_gig_performer()'::regprocedure);
  v_seeder text := pg_get_functiondef('public.seed_gig_performers(uuid)'::regprocedure);
BEGIN
  IF position('new.updated_at' IN lower(v_validator)) > 0
     OR position('new.performed_at' IN lower(v_validator)) > 0 THEN
    RAISE EXCEPTION 'gig performer deployment verification failed: validator retains an optional absent column';
  END IF;
  IF position('active_band_performing_members' IN v_seeder) = 0 THEN
    RAISE EXCEPTION 'gig performer deployment verification failed: legacy seeder remains installed';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
