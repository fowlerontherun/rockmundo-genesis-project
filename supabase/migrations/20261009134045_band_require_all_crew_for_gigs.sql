-- Band-wide crew attendance preference.
ALTER TABLE public.bands
  ADD COLUMN IF NOT EXISTS require_all_crew_for_gigs boolean NOT NULL DEFAULT false;

-- Reuse the existing gig sync path, but when the band-wide preference is on,
-- accepted crew is authoritative and replaces per-gig "not attending" choices.
CREATE OR REPLACE FUNCTION public._sync_band_crew_for_gig(p_gig_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_gig public.gigs%rowtype;
  v_count integer := 0;
  v_require_all boolean := false;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id;
  IF NOT FOUND OR v_gig.status IN ('completed','cancelled','failed') THEN
    RETURN 0;
  END IF;

  SELECT coalesce(require_all_crew_for_gigs, false)
  INTO v_require_all
  FROM public.bands
  WHERE id = v_gig.band_id;

  WITH preferred AS (
    SELECT DISTINCT ON (public.crew_role_key(c.crew_type))
      c.id,
      c.crew_type,
      c.salary_per_gig,
      public.crew_role_key(c.crew_type) AS role_key
    FROM public.band_crew_members c
    WHERE c.band_id = v_gig.band_id
      AND c.hire_date <= coalesce(v_gig.started_at, now())
    ORDER BY public.crew_role_key(c.crew_type), c.skill_level DESC, c.id
  )
  INSERT INTO public.gig_crew_assignments
    (gig_id, crew_role, worker_type, npc_staff_id, band_crew_member_id,
     assignment_status, cost)
  SELECT
    p_gig_id, p.role_key, 'npc_staff', p.id, p.id, 'accepted', p.salary_per_gig
  FROM preferred p
  ON CONFLICT (gig_id, crew_role) DO UPDATE SET
    worker_type = EXCLUDED.worker_type,
    npc_staff_id = EXCLUDED.npc_staff_id,
    profile_id = NULL,
    band_crew_member_id = EXCLUDED.band_crew_member_id,
    assignment_status = 'accepted',
    cost = EXCLUDED.cost,
    updated_at = now()
  WHERE v_require_all;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public._sync_band_crew_for_gig(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._sync_band_crew_for_gig(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.set_band_require_all_crew_for_gigs(
  p_band_id uuid,
  p_required boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_gig record;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.bands b
    WHERE b.id = p_band_id
      AND (
        b.leader_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = b.leader_id AND p.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.band_members bm
          LEFT JOIN public.profiles p ON p.id = bm.profile_id
          WHERE bm.band_id = p_band_id
            AND coalesce(bm.member_status, 'active') = 'active'
            AND lower(coalesce(bm.role, '')) IN ('leader','founder','co-leader','co_leader')
            AND (bm.user_id = auth.uid() OR p.user_id = auth.uid())
        )
      )
  ) THEN
    RAISE EXCEPTION 'Only band leaders may change the automatic crew policy';
  END IF;

  UPDATE public.bands
  SET require_all_crew_for_gigs = coalesce(p_required, false)
  WHERE id = p_band_id;

  IF coalesce(p_required, false) THEN
    FOR v_gig IN
      SELECT id
      FROM public.gigs
      WHERE band_id = p_band_id
        AND status IN ('scheduled','confirmed')
    LOOP
      PERFORM public._sync_band_crew_for_gig(v_gig.id);
    END LOOP;
  END IF;

  RETURN coalesce(p_required, false);
END;
$$;

REVOKE ALL ON FUNCTION public.set_band_require_all_crew_for_gigs(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_band_require_all_crew_for_gigs(uuid, boolean)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._auto_sync_required_crew_for_gig()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.status IN ('scheduled','confirmed')
     AND EXISTS (
       SELECT 1 FROM public.bands b
       WHERE b.id = NEW.band_id
         AND b.require_all_crew_for_gigs
     ) THEN
    PERFORM public._sync_band_crew_for_gig(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._auto_sync_required_crew_for_gig() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_auto_sync_required_crew_for_gig ON public.gigs;
CREATE TRIGGER trg_auto_sync_required_crew_for_gig
AFTER INSERT OR UPDATE OF status, band_id
ON public.gigs
FOR EACH ROW
EXECUTE FUNCTION public._auto_sync_required_crew_for_gig();

CREATE OR REPLACE FUNCTION public._auto_sync_required_crew_after_hire()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_gig record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.bands b
    WHERE b.id = NEW.band_id
      AND b.require_all_crew_for_gigs
  ) THEN
    FOR v_gig IN
      SELECT id
      FROM public.gigs
      WHERE band_id = NEW.band_id
        AND status IN ('scheduled','confirmed')
    LOOP
      PERFORM public._sync_band_crew_for_gig(v_gig.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._auto_sync_required_crew_after_hire() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_auto_sync_required_crew_after_hire ON public.band_crew_members;
CREATE TRIGGER trg_auto_sync_required_crew_after_hire
AFTER INSERT
ON public.band_crew_members
FOR EACH ROW
EXECUTE FUNCTION public._auto_sync_required_crew_after_hire();

CREATE OR REPLACE FUNCTION public.save_gig_crew_assignment(
  p_gig_id uuid,
  p_crew_role text,
  p_worker_type text,
  p_npc_staff_id uuid DEFAULT NULL,
  p_assignment_status text DEFAULT 'accepted',
  p_profile_id uuid DEFAULT NULL,
  p_cost integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_gig public.gigs%rowtype;
  v_crew public.band_crew_members%rowtype;
  v_id uuid;
  v_role text;
  v_require_all boolean := false;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id;
  IF NOT FOUND OR NOT public.is_band_leader_or_manager(v_gig.band_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the band manager may edit crew assignments';
  END IF;
  IF v_gig.status NOT IN ('scheduled','confirmed') THEN
    RAISE EXCEPTION 'Gig crew is locked after the show starts';
  END IF;

  SELECT coalesce(require_all_crew_for_gigs, false)
  INTO v_require_all
  FROM public.bands
  WHERE id = v_gig.band_id;

  IF v_require_all AND p_assignment_status = 'declined' THEN
    RAISE EXCEPTION 'All hired crew are required for this band. Change the band crew setting to allow absences.';
  END IF;

  IF p_worker_type <> 'npc_staff' OR p_npc_staff_id IS NULL OR p_profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only hired band crew can be assigned here';
  END IF;
  IF p_assignment_status NOT IN ('accepted','declined') THEN
    RAISE EXCEPTION 'Unsupported crew attendance status';
  END IF;

  SELECT * INTO v_crew
  FROM public.band_crew_members
  WHERE id = p_npc_staff_id AND band_id = v_gig.band_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crew member is not hired by this band';
  END IF;

  v_role := public.crew_role_key(v_crew.crew_type);
  IF v_role IS DISTINCT FROM public.crew_role_key(p_crew_role) THEN
    RAISE EXCEPTION 'Crew member does not qualify for the requested role';
  END IF;

  INSERT INTO public.gig_crew_assignments
    (gig_id, crew_role, worker_type, npc_staff_id, band_crew_member_id,
     assignment_status, cost)
  VALUES
    (p_gig_id, v_role, 'npc_staff', v_crew.id, v_crew.id,
     p_assignment_status, v_crew.salary_per_gig)
  ON CONFLICT (gig_id, crew_role) DO UPDATE SET
    worker_type = EXCLUDED.worker_type,
    npc_staff_id = EXCLUDED.npc_staff_id,
    profile_id = NULL,
    band_crew_member_id = EXCLUDED.band_crew_member_id,
    assignment_status = EXCLUDED.assignment_status,
    cost = EXCLUDED.cost,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'cost', v_crew.salary_per_gig);
END;
$$;

REVOKE ALL ON FUNCTION public.save_gig_crew_assignment(uuid,text,text,uuid,text,uuid,integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_gig_crew_assignment(uuid,text,text,uuid,text,uuid,integer)
  TO authenticated, service_role;
