-- Keep hired crew, gig attendance, contracted wages, and career progression in one
-- authoritative path. Historical gigs are deliberately not awarded retroactively
-- without attendance evidence.
ALTER TABLE public.band_crew_members
  ADD COLUMN IF NOT EXISTS career_xp integer NOT NULL DEFAULT 0 CHECK (career_xp >= 0),
  ADD COLUMN IF NOT EXISTS last_gig_at timestamptz;

-- Some installations still have the older July preparation table, whose
-- schema includes a required band_id but not the August cost/profile fields.
-- Repair those differences without rebuilding assignments or wiping data.
ALTER TABLE public.gig_crew_assignments
  ADD COLUMN IF NOT EXISTS band_crew_member_id uuid,
  ADD COLUMN IF NOT EXISTS cost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='gig_crew_assignments'
      AND column_name='band_id' AND is_nullable='NO'
  ) THEN
    ALTER TABLE public.gig_crew_assignments ALTER COLUMN band_id DROP NOT NULL;
  END IF;
  IF EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.gig_crew_assignments'::regclass
      AND conname='gig_crew_assignments_crew_role_check'
  ) THEN
    -- Role eligibility is now checked against the actual hired member by RPC.
    -- This also permits Wardrobe Stylist on older schemas.
    ALTER TABLE public.gig_crew_assignments
      DROP CONSTRAINT gig_crew_assignments_crew_role_check;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.gig_crew_assignments'::regclass
      AND conname = 'gig_crew_assignments_band_crew_member_id_fkey'
  ) THEN
    ALTER TABLE public.gig_crew_assignments
      ADD CONSTRAINT gig_crew_assignments_band_crew_member_id_fkey
      FOREIGN KEY (band_crew_member_id)
      REFERENCES public.band_crew_members(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS gig_crew_assignments_roster_idx
  ON public.gig_crew_assignments(band_crew_member_id, gig_id);

CREATE TABLE IF NOT EXISTS public.gig_crew_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  crew_member_id uuid REFERENCES public.band_crew_members(id) ON DELETE SET NULL,
  crew_name text NOT NULL,
  crew_role text NOT NULL,
  salary_paid integer NOT NULL CHECK (salary_paid >= 0),
  xp_awarded integer NOT NULL CHECK (xp_awarded >= 0),
  skill_before integer NOT NULL,
  skill_after integer NOT NULL,
  cohesion_before numeric NOT NULL,
  cohesion_after numeric NOT NULL,
  settled_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gig_crew_settlements_once UNIQUE (gig_id, crew_member_id)
);
CREATE INDEX IF NOT EXISTS gig_crew_settlements_band_idx
  ON public.gig_crew_settlements(band_id, settled_at DESC);
ALTER TABLE public.gig_crew_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gig_crew_settlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.gig_crew_settlements TO authenticated;
GRANT ALL ON public.gig_crew_settlements TO service_role;
DROP POLICY IF EXISTS crew_settlement_band_read ON public.gig_crew_settlements;
CREATE POLICY crew_settlement_band_read ON public.gig_crew_settlements
  FOR SELECT TO authenticated USING (
    public.caller_in_band(band_id)
  );

-- All roster writes go through authoritative management RPCs. Ordinary band
-- members keep read access; they cannot fake skills, tenure or salary.
DROP POLICY IF EXISTS "Band members can manage their crew" ON public.band_crew_members;
REVOKE INSERT, UPDATE, DELETE ON public.band_crew_members FROM authenticated;
GRANT SELECT ON public.band_crew_members TO authenticated;

DROP POLICY IF EXISTS "Band members can claim and release crew" ON public.crew_catalog;
REVOKE UPDATE ON public.crew_catalog FROM authenticated;
GRANT SELECT ON public.crew_catalog TO authenticated;

DROP POLICY IF EXISTS gig_crew_assignments_band_all ON public.gig_crew_assignments;
DROP POLICY IF EXISTS gig_crew_assignments_band_read ON public.gig_crew_assignments;
CREATE POLICY gig_crew_assignments_band_read ON public.gig_crew_assignments
  FOR SELECT TO authenticated USING (public.caller_in_gig_band(gig_id));
-- Assignments are changed only via server-validated RPCs; no direct row writes.
REVOKE INSERT, UPDATE, DELETE ON public.gig_crew_assignments FROM authenticated;
GRANT SELECT ON public.gig_crew_assignments TO authenticated;

CREATE OR REPLACE FUNCTION public.crew_role_key(p_role text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public AS $$
  SELECT CASE lower(trim(coalesce(p_role,'')))
    WHEN 'front of house engineer' THEN 'sound_engineer'
    WHEN 'sound engineer' THEN 'sound_engineer'
    WHEN 'lighting director' THEN 'lighting_engineer'
    WHEN 'lighting engineer' THEN 'lighting_engineer'
    WHEN 'road crew chief' THEN 'stage_manager'
    WHEN 'stage manager' THEN 'stage_manager'
    WHEN 'backline technician' THEN 'guitar_technician'
    WHEN 'guitar technician' THEN 'guitar_technician'
    WHEN 'tour manager' THEN 'tour_manager'
    WHEN 'security lead' THEN 'security'
    WHEN 'security' THEN 'security'
    WHEN 'merch director' THEN 'merchandise_manager'
    WHEN 'merchandise manager' THEN 'merchandise_manager'
    WHEN 'wardrobe stylist' THEN 'wardrobe_stylist'
    ELSE replace(lower(trim(coalesce(p_role,''))), ' ', '_')
  END;
$$;

CREATE OR REPLACE FUNCTION public.hire_band_crew(p_band_id uuid, p_catalog_crew_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_catalog public.crew_catalog%rowtype; v_fame integer; v_id uuid;
BEGIN
  IF NOT public.is_band_leader_or_manager(p_band_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only band leaders and managers may hire crew';
  END IF;
  SELECT fame INTO v_fame FROM public.bands WHERE id=p_band_id;
  SELECT * INTO v_catalog FROM public.crew_catalog
    WHERE id=p_catalog_crew_id FOR UPDATE;
  IF NOT FOUND OR v_catalog.hired_by_band_id IS NOT NULL THEN
    RAISE EXCEPTION 'Crew candidate is unavailable';
  END IF;
  IF coalesce(v_fame,0) < v_catalog.min_fame_required THEN
    RAISE EXCEPTION 'Insufficient band fame for this hire';
  END IF;
  INSERT INTO public.band_crew_members
    (band_id,name,crew_type,experience_years,hire_date,salary_per_gig,
     skill_level,star_rating,cohesion_rating,gigs_together,catalog_crew_id,notes)
  VALUES
    (p_band_id,v_catalog.name,v_catalog.role,v_catalog.experience,now(),v_catalog.salary,
     v_catalog.skill,v_catalog.star_rating,0,0,v_catalog.id,
     jsonb_build_object('specialties',v_catalog.specialties,'traits',v_catalog.traits)::text)
  RETURNING id INTO v_id;
  UPDATE public.crew_catalog SET hired_by_band_id=p_band_id,updated_at=now()
    WHERE id=p_catalog_crew_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.hire_band_crew(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hire_band_crew(uuid,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.release_band_crew(p_crew_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_crew public.band_crew_members%rowtype;
BEGIN
  SELECT * INTO v_crew FROM public.band_crew_members WHERE id=p_crew_member_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Crew member not found'; END IF;
  IF NOT public.is_band_leader_or_manager(v_crew.band_id,auth.uid()) THEN
    RAISE EXCEPTION 'Only band leaders and managers may release crew';
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.gig_crew_assignments a
    JOIN public.gigs g ON g.id=a.gig_id
    WHERE a.band_crew_member_id=p_crew_member_id AND a.assignment_status='accepted'
      AND g.status IN ('in_progress','ready_for_completion','processing_outcome')
  ) THEN
    RAISE EXCEPTION 'Cannot release crew while they are working a live gig';
  END IF;
  UPDATE public.crew_catalog SET hired_by_band_id=NULL, updated_at=now()
    WHERE id=v_crew.catalog_crew_id AND hired_by_band_id=v_crew.band_id;
  DELETE FROM public.gig_crew_assignments a
    USING public.gigs g WHERE a.gig_id=g.id
    AND a.band_crew_member_id=p_crew_member_id
    AND g.status NOT IN ('completed','in_progress','ready_for_completion','processing_outcome');
  DELETE FROM public.band_crew_members WHERE id=p_crew_member_id;
END; $$;
REVOKE ALL ON FUNCTION public.release_band_crew(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.release_band_crew(uuid) TO authenticated,service_role;

-- A private helper shared by the manager UI, automatic gig starts, and legacy
-- scheduled gigs. The highest-skilled eligible worker fills each role once.
CREATE OR REPLACE FUNCTION public._sync_band_crew_for_gig(p_gig_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_gig public.gigs%rowtype; v_count integer := 0;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id=p_gig_id;
  IF NOT FOUND OR v_gig.status IN ('completed','cancelled','failed') THEN RETURN 0; END IF;
  WITH preferred AS (
    SELECT DISTINCT ON (public.crew_role_key(c.crew_type))
      c.id,c.crew_type,c.salary_per_gig,public.crew_role_key(c.crew_type) AS role_key
    FROM public.band_crew_members c
    WHERE c.band_id=v_gig.band_id
      AND c.hire_date<=coalesce(v_gig.started_at,now())
    ORDER BY public.crew_role_key(c.crew_type),c.skill_level DESC,c.id
  )
  INSERT INTO public.gig_crew_assignments
    (gig_id,crew_role,worker_type,npc_staff_id,band_crew_member_id,
     assignment_status,cost)
  SELECT p_gig_id,p.role_key,'npc_staff',p.id,p.id,'accepted',p.salary_per_gig
  FROM preferred p
  ON CONFLICT (gig_id,crew_role) DO NOTHING;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public._sync_band_crew_for_gig(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._sync_band_crew_for_gig(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_band_crew_for_gig(p_gig_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_band uuid; v_status text;
BEGIN
  SELECT band_id,status INTO v_band,v_status FROM public.gigs WHERE id=p_gig_id;
  IF v_band IS NULL OR NOT public.is_band_leader_or_manager(v_band,auth.uid()) THEN
    RAISE EXCEPTION 'Only the band manager may assign crew';
  END IF;
  IF v_status NOT IN ('scheduled','confirmed') THEN
    RAISE EXCEPTION 'Crew assignments are locked after the gig starts';
  END IF;
  RETURN public._sync_band_crew_for_gig(p_gig_id);
END; $$;
REVOKE ALL ON FUNCTION public.sync_band_crew_for_gig(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_band_crew_for_gig(uuid) TO authenticated,service_role;

-- Keep this existing seven-argument signature, but never trust client price or
-- permit an arbitrary NPC from another band.
CREATE OR REPLACE FUNCTION public.save_gig_crew_assignment(
  p_gig_id uuid,p_crew_role text,p_worker_type text,p_npc_staff_id uuid DEFAULT NULL,
  p_assignment_status text DEFAULT 'accepted',p_profile_id uuid DEFAULT NULL,
  p_cost integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_gig public.gigs%rowtype; v_crew public.band_crew_members%rowtype;
        v_id uuid; v_role text;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id=p_gig_id;
  IF NOT FOUND OR NOT public.is_band_leader_or_manager(v_gig.band_id,auth.uid()) THEN
    RAISE EXCEPTION 'Only the band manager may edit crew assignments';
  END IF;
  IF v_gig.status NOT IN ('scheduled','confirmed') THEN
    RAISE EXCEPTION 'Gig crew is locked after the show starts';
  END IF;
  IF p_worker_type<>'npc_staff' OR p_npc_staff_id IS NULL OR p_profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only hired band crew can be assigned here';
  END IF;
  IF p_assignment_status NOT IN ('accepted','declined') THEN
    RAISE EXCEPTION 'Unsupported crew attendance status';
  END IF;
  SELECT * INTO v_crew FROM public.band_crew_members
    WHERE id=p_npc_staff_id AND band_id=v_gig.band_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Crew member is not hired by this band'; END IF;
  v_role:=public.crew_role_key(v_crew.crew_type);
  IF v_role IS DISTINCT FROM public.crew_role_key(p_crew_role) THEN
    RAISE EXCEPTION 'Crew member does not qualify for the requested role';
  END IF;
  INSERT INTO public.gig_crew_assignments
    (gig_id,crew_role,worker_type,npc_staff_id,band_crew_member_id,
     assignment_status,cost)
  VALUES (p_gig_id,v_role,'npc_staff',v_crew.id,v_crew.id,p_assignment_status,v_crew.salary_per_gig)
  ON CONFLICT(gig_id,crew_role) DO UPDATE SET
    worker_type=excluded.worker_type,npc_staff_id=excluded.npc_staff_id,
    profile_id=NULL,band_crew_member_id=excluded.band_crew_member_id,
    assignment_status=excluded.assignment_status,cost=excluded.cost,updated_at=now()
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id',v_id,'cost',v_crew.salary_per_gig);
END; $$;
REVOKE ALL ON FUNCTION public.save_gig_crew_assignment(uuid,text,text,uuid,text,uuid,integer)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_gig_crew_assignment(uuid,text,text,uuid,text,uuid,integer)
  TO authenticated,service_role;

-- The existing completion caller needs authoritative amounts even before gig
-- status becomes completed; career progression happens afterwards, once only.
CREATE OR REPLACE FUNCTION public.process_gig_preparation_costs_and_rewards(p_gig_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_gig public.gigs%rowtype; v_prod integer := 0; v_sound integer := 0;
        v_crew integer := 0; v_rental integer := 0; v_rewards integer := 0;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id=p_gig_id;
  IF NOT FOUND OR v_gig.status IN ('cancelled','failed') THEN
    RETURN jsonb_build_object('production_costs',0,'soundcheck_costs',0,
      'crew_costs',0,'rental_costs',0,'rewards',0);
  END IF;
  IF v_gig.status NOT IN ('completed','cancelled','failed') THEN
    PERFORM public._sync_band_crew_for_gig(p_gig_id);
  END IF;
  SELECT coalesce(estimated_cost,0) INTO v_prod FROM public.gig_production_plans WHERE gig_id=p_gig_id;
  SELECT coalesce(estimated_cost,0) INTO v_sound FROM public.gig_soundcheck_plans WHERE gig_id=p_gig_id;
  SELECT coalesce(sum(a.cost),0) INTO v_crew
    FROM public.gig_crew_assignments a
    JOIN public.band_crew_members c ON c.id=a.band_crew_member_id
    WHERE a.gig_id=p_gig_id AND c.band_id=v_gig.band_id AND a.assignment_status='accepted';
  SELECT coalesce(sum(rental_cost),0) INTO v_rental
    FROM public.gig_equipment_loadouts WHERE gig_id=p_gig_id;
  SELECT count(*) INTO v_rewards FROM public.gig_crew_settlements WHERE gig_id=p_gig_id;
  RETURN jsonb_build_object('production_costs',coalesce(v_prod,0),
    'soundcheck_costs',coalesce(v_sound,0),'crew_costs',v_crew,
    'rental_costs',v_rental,'rewards',v_rewards);
END; $$;
REVOKE ALL ON FUNCTION public.process_gig_preparation_costs_and_rewards(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_gig_preparation_costs_and_rewards(uuid)
  TO service_role;

-- Never award historic gigs merely because someone is currently on the roster.
-- Only accepted, snapshotted gig assignments are eligible to earn XP.
CREATE OR REPLACE FUNCTION public._settle_completed_gig_crew(p_gig_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_gig public.gigs%rowtype; v_rating numeric; v_capacity integer;
        v_xp integer; v_skill integer; v_cohesion numeric; v_inserted uuid;
        v_count integer := 0; r record;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id=p_gig_id;
  IF NOT FOUND OR v_gig.status<>'completed' THEN RETURN 0; END IF;
  SELECT o.overall_rating INTO v_rating FROM public.gig_outcomes o
    WHERE o.gig_id=p_gig_id AND o.completed_at IS NOT NULL LIMIT 1;
  IF NOT FOUND THEN RETURN 0; END IF;
  SELECT capacity INTO v_capacity FROM public.venues WHERE id=v_gig.venue_id;
  v_xp := CASE WHEN coalesce(v_capacity,0)>5000 THEN 25
               WHEN v_capacity>1500 THEN 20
               WHEN v_capacity>500 THEN 15 ELSE 10 END
          + CASE WHEN coalesce(v_rating,0)>=18 THEN 5 ELSE 0 END;
  FOR r IN
    SELECT a.*,c.name,c.crew_type,c.skill_level,c.career_xp,
           c.cohesion_rating,c.gigs_together
      FROM public.gig_crew_assignments a
      JOIN public.band_crew_members c ON c.id=a.band_crew_member_id
      WHERE a.gig_id=p_gig_id AND a.assignment_status='accepted'
        AND c.band_id=v_gig.band_id
        AND c.hire_date<=coalesce(v_gig.started_at,v_gig.scheduled_date)
      ORDER BY c.id FOR UPDATE OF c
  LOOP
    v_skill := least(100,r.skill_level + (r.career_xp+v_xp)/100 - r.career_xp/100);
    v_cohesion := least(100,r.cohesion_rating + 2 + CASE WHEN coalesce(v_rating,0)>=18 THEN 1 ELSE 0 END);
    v_inserted := NULL;
    INSERT INTO public.gig_crew_settlements
      (gig_id,band_id,crew_member_id,crew_name,crew_role,salary_paid,
       xp_awarded,skill_before,skill_after,cohesion_before,cohesion_after)
    VALUES(p_gig_id,v_gig.band_id,r.band_crew_member_id,r.name,r.crew_type,r.cost,
           v_xp,r.skill_level,v_skill,r.cohesion_rating,v_cohesion)
    ON CONFLICT (gig_id,crew_member_id) DO NOTHING RETURNING id INTO v_inserted;
    IF v_inserted IS NOT NULL THEN
      UPDATE public.band_crew_members
        SET career_xp=career_xp+v_xp,skill_level=v_skill,
            cohesion_rating=v_cohesion,gigs_together=gigs_together+1,
            last_gig_at=coalesce(v_gig.completed_at,now())
        WHERE id=r.band_crew_member_id;
      v_count:=v_count+1;
    END IF;
  END LOOP;
  RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public._settle_completed_gig_crew(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._settle_completed_gig_crew(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_prepare_crew_on_gig_start()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM public._sync_band_crew_for_gig(NEW.id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_prepare_crew_on_gig_start ON public.gigs;
CREATE TRIGGER trg_prepare_crew_on_gig_start
  AFTER UPDATE OF status ON public.gigs FOR EACH ROW
  WHEN (NEW.status='in_progress' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trg_prepare_crew_on_gig_start();

CREATE OR REPLACE FUNCTION public.trg_settle_crew_on_gig_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM public._settle_completed_gig_crew(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Crew settlement needs retry for gig %: %',NEW.id,SQLERRM;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_settle_crew_on_gig_completion ON public.gigs;
CREATE TRIGGER trg_settle_crew_on_gig_completion
  AFTER UPDATE OF status ON public.gigs FOR EACH ROW
  WHEN (NEW.status='completed' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.trg_settle_crew_on_gig_completion();

REVOKE ALL ON FUNCTION public.trg_prepare_crew_on_gig_start() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.trg_settle_crew_on_gig_completion() FROM PUBLIC,anon,authenticated;
