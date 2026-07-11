-- Phase 2 gig preparation: crew assignments, equipment loadouts, costs and rewards.
CREATE TABLE IF NOT EXISTS public.gig_crew_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  crew_role text NOT NULL CHECK (crew_role IN ('tour_manager','sound_engineer','lighting_engineer','stage_manager','guitar_technician','drum_technician','keyboard_technician','stage_crew','security','merchandise_manager')),
  worker_type text NOT NULL CHECK (worker_type IN ('player','npc_staff','company_staff')),
  player_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  npc_staff_id uuid REFERENCES public.band_crew_members(id) ON DELETE SET NULL,
  company_staff_id uuid REFERENCES public.company_employees(id) ON DELETE SET NULL,
  agreed_fee numeric NOT NULL DEFAULT 0 CHECK (agreed_fee >= 0),
  fee_covered_by_employment boolean NOT NULL DEFAULT false,
  assignment_status text NOT NULL DEFAULT 'offered' CHECK (assignment_status IN ('offered','accepted','declined','cancelled','completed')),
  effectiveness_score integer NOT NULL DEFAULT 50 CHECK (effectiveness_score BETWEEN 0 AND 100),
  attendance_status text NOT NULL DEFAULT 'pending' CHECK (attendance_status IN ('pending','confirmed','conflict','absent')),
  reward_processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gig_crew_exactly_one_worker CHECK (((player_id IS NOT NULL)::int + (npc_staff_id IS NOT NULL)::int + (company_staff_id IS NOT NULL)::int) = 1),
  CONSTRAINT gig_crew_worker_type_matches CHECK ((worker_type = 'player' AND player_id IS NOT NULL) OR (worker_type = 'npc_staff' AND npc_staff_id IS NOT NULL) OR (worker_type = 'company_staff' AND company_staff_id IS NOT NULL)),
  UNIQUE (gig_id, crew_role)
);

CREATE TABLE IF NOT EXISTS public.gig_equipment_loadouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  equipment_item_id uuid REFERENCES public.player_equipment(id) ON DELETE SET NULL,
  band_stage_equipment_id uuid REFERENCES public.band_stage_equipment(id) ON DELETE SET NULL,
  assigned_member_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  equipment_role text NOT NULL CHECK (equipment_role IN ('vocals_microphone','guitar','bass_guitar','drum_kit','keyboard','amplifier','pa_speaker','mixing','accessory','spare_instrument')),
  source_type text NOT NULL CHECK (source_type IN ('band_owned','member_owned','rented','venue_provided','company_owned')),
  is_primary boolean NOT NULL DEFAULT true,
  is_spare boolean NOT NULL DEFAULT false,
  rental_cost numeric NOT NULL DEFAULT 0 CHECK (rental_cost >= 0),
  quality_score integer NOT NULL DEFAULT 50 CHECK (quality_score BETWEEN 0 AND 100),
  condition_score integer NOT NULL DEFAULT 70 CHECK (condition_score BETWEEN 0 AND 100),
  reliability_score integer NOT NULL DEFAULT 70 CHECK (reliability_score BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gig_equipment_has_source CHECK (source_type IN ('rented','venue_provided','company_owned') OR equipment_item_id IS NOT NULL OR band_stage_equipment_id IS NOT NULL),
  CONSTRAINT gig_equipment_primary_or_spare CHECK (is_primary <> is_spare OR is_primary = true)
);

CREATE TABLE IF NOT EXISTS public.gig_preparation_cost_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  cost_type text NOT NULL CHECK (cost_type IN ('crew_fee','equipment_rental')),
  source_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cost_type, source_id)
);

CREATE TABLE IF NOT EXISTS public.gig_crew_reward_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.gig_crew_assignments(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  xp_awarded integer NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0),
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id)
);

ALTER TABLE public.gig_outcomes ADD COLUMN IF NOT EXISTS crew_equipment_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.gig_outcomes ADD COLUMN IF NOT EXISTS equipment_failures jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_gig_crew_assignments_gig ON public.gig_crew_assignments(gig_id);
CREATE INDEX IF NOT EXISTS idx_gig_crew_assignments_band ON public.gig_crew_assignments(band_id);
CREATE INDEX IF NOT EXISTS idx_gig_crew_assignments_player ON public.gig_crew_assignments(player_id, assignment_status);
CREATE INDEX IF NOT EXISTS idx_gig_crew_assignments_npc ON public.gig_crew_assignments(npc_staff_id);
CREATE INDEX IF NOT EXISTS idx_gig_equipment_loadouts_gig ON public.gig_equipment_loadouts(gig_id);
CREATE INDEX IF NOT EXISTS idx_gig_equipment_loadouts_band ON public.gig_equipment_loadouts(band_id);
CREATE INDEX IF NOT EXISTS idx_gig_equipment_loadouts_item ON public.gig_equipment_loadouts(equipment_item_id);

ALTER TABLE public.gig_crew_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_equipment_loadouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_preparation_cost_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_crew_reward_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members and workers can view gig crew" ON public.gig_crew_assignments FOR SELECT USING (public.is_band_leader_or_manager(band_id, auth.uid()) OR player_id = auth.uid() OR EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = gig_crew_assignments.band_id AND bm.user_id = auth.uid()));
CREATE POLICY "Band managers can manage gig crew" ON public.gig_crew_assignments FOR ALL USING (public.is_band_leader_or_manager(band_id, auth.uid())) WITH CHECK (public.is_band_leader_or_manager(band_id, auth.uid()));
CREATE POLICY "Band members can view gig equipment" ON public.gig_equipment_loadouts FOR SELECT USING (EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = gig_equipment_loadouts.band_id AND bm.user_id = auth.uid()));
CREATE POLICY "Band managers can manage gig equipment" ON public.gig_equipment_loadouts FOR ALL USING (public.is_band_leader_or_manager(band_id, auth.uid())) WITH CHECK (public.is_band_leader_or_manager(band_id, auth.uid()));
CREATE POLICY "Band managers can view gig prep costs" ON public.gig_preparation_cost_ledger FOR SELECT USING (public.is_band_leader_or_manager(band_id, auth.uid()));
CREATE POLICY "Crew workers can view own rewards" ON public.gig_crew_reward_ledger FOR SELECT USING (player_id = auth.uid() OR EXISTS (SELECT 1 FROM public.gigs g WHERE g.id = gig_crew_reward_ledger.gig_id AND public.is_band_leader_or_manager(g.band_id, auth.uid())));

CREATE OR REPLACE FUNCTION public.calculate_gig_crew_effectiveness(p_worker_type text, p_base numeric, p_skill numeric, p_experience numeric, p_quality numeric, p_engagement numeric, p_fatigue numeric, p_attendance text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT greatest(0, least(100, round(coalesce(p_base, CASE WHEN p_worker_type = 'npc_staff' THEN 58 ELSE 45 END) + coalesce(p_skill,0)*0.28 + least(12, coalesce(p_experience,0)*1.5) + (coalesce(p_quality,50)-50)*0.18 + CASE WHEN p_worker_type='player' THEN least(8, coalesce(p_engagement,50)/100*8) ELSE 0 END - least(18, greatest(0, coalesce(p_fatigue,0))*0.18) - CASE p_attendance WHEN 'absent' THEN 35 WHEN 'conflict' THEN 22 WHEN 'pending' THEN 8 ELSE 0 END)))::integer;
$$;

CREATE OR REPLACE FUNCTION public.save_gig_crew_assignment(p_gig_id uuid, p_crew_role text, p_worker_type text, p_player_id uuid DEFAULT NULL, p_npc_staff_id uuid DEFAULT NULL, p_company_staff_id uuid DEFAULT NULL, p_assignment_status text DEFAULT 'accepted')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gig record; v_fee numeric := 0; v_effect integer := 50; v_id uuid; v_overlap integer := 0; v_is_employee boolean := false;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF v_gig.id IS NULL THEN RAISE EXCEPTION 'Gig not found.'; END IF;
  IF v_gig.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Completed or cancelled gigs cannot be edited.'; END IF;
  IF NOT public.is_band_leader_or_manager(v_gig.band_id, auth.uid()) THEN RAISE EXCEPTION 'Only authorised band managers can edit crew.'; END IF;
  IF ((p_player_id IS NOT NULL)::int + (p_npc_staff_id IS NOT NULL)::int + (p_company_staff_id IS NOT NULL)::int) <> 1 THEN RAISE EXCEPTION 'Crew assignment must reference exactly one worker.'; END IF;
  IF p_worker_type = 'npc_staff' THEN
    SELECT salary_per_gig, public.calculate_gig_crew_effectiveness('npc_staff', skill_level, skill_level, experience_years, 55, 0, 0, 'confirmed') INTO v_fee, v_effect FROM public.band_crew_members WHERE id = p_npc_staff_id AND band_id = v_gig.band_id;
    IF v_effect IS NULL THEN RAISE EXCEPTION 'NPC crew member is not eligible for this band.'; END IF;
  ELSIF p_worker_type = 'player' THEN
    SELECT EXISTS (SELECT 1 FROM public.band_members WHERE band_id = v_gig.band_id AND user_id = p_player_id) INTO v_is_employee;
    IF NOT v_is_employee THEN RAISE EXCEPTION 'Real-player crew requires an accepted band relationship before assignment.'; END IF;
    SELECT count(*) INTO v_overlap FROM public.gig_crew_assignments gca JOIN public.gigs g ON g.id = gca.gig_id WHERE gca.player_id = p_player_id AND gca.assignment_status IN ('offered','accepted') AND g.status NOT IN ('completed','cancelled') AND abs(extract(epoch from (g.scheduled_date - v_gig.scheduled_date))) < 14400 AND g.id <> p_gig_id;
    IF v_overlap > 0 THEN RAISE EXCEPTION 'Player has a conflicting gig crew assignment.'; END IF;
    v_fee := 100; v_effect := public.calculate_gig_crew_effectiveness('player', 45, 55, 0, 55, 60, 0, 'confirmed');
  ELSIF p_worker_type = 'company_staff' THEN
    SELECT salary, public.calculate_gig_crew_effectiveness('company_staff', performance_rating, performance_rating, 0, performance_rating, 0, 0, 'confirmed') INTO v_fee, v_effect FROM public.company_employees WHERE id = p_company_staff_id AND status = 'active';
    IF v_effect IS NULL THEN RAISE EXCEPTION 'Company staff member is not eligible.'; END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported worker type.';
  END IF;
  INSERT INTO public.gig_crew_assignments(gig_id, band_id, crew_role, worker_type, player_id, npc_staff_id, company_staff_id, agreed_fee, fee_covered_by_employment, assignment_status, effectiveness_score, attendance_status)
  VALUES (p_gig_id, v_gig.band_id, p_crew_role, p_worker_type, p_player_id, p_npc_staff_id, p_company_staff_id, v_fee, p_worker_type = 'company_staff', p_assignment_status, v_effect, 'confirmed')
  ON CONFLICT (gig_id, crew_role) DO UPDATE SET worker_type = excluded.worker_type, player_id = excluded.player_id, npc_staff_id = excluded.npc_staff_id, company_staff_id = excluded.company_staff_id, agreed_fee = excluded.agreed_fee, fee_covered_by_employment = excluded.fee_covered_by_employment, assignment_status = excluded.assignment_status, effectiveness_score = excluded.effectiveness_score, attendance_status = excluded.attendance_status, updated_at = now()
  RETURNING id INTO v_id;
  IF p_player_id IS NOT NULL THEN INSERT INTO public.notifications(user_id, type, message) VALUES (p_player_id, 'system', 'You have been assigned to gig crew work.') ON CONFLICT DO NOTHING; END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.save_gig_equipment_loadout(p_gig_id uuid, p_equipment_role text, p_source_type text, p_equipment_item_id uuid DEFAULT NULL, p_band_stage_equipment_id uuid DEFAULT NULL, p_assigned_member_id uuid DEFAULT NULL, p_is_primary boolean DEFAULT true, p_is_spare boolean DEFAULT false, p_rental_cost numeric DEFAULT 0)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gig record; v_quality integer := 55; v_condition integer := 70; v_id uuid; v_conflict integer := 0;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF v_gig.id IS NULL THEN RAISE EXCEPTION 'Gig not found.'; END IF;
  IF v_gig.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Completed or cancelled gigs cannot be edited.'; END IF;
  IF NOT public.is_band_leader_or_manager(v_gig.band_id, auth.uid()) THEN RAISE EXCEPTION 'Only authorised band managers can edit equipment.'; END IF;
  IF p_band_stage_equipment_id IS NOT NULL THEN
    SELECT quality_rating, CASE lower(condition) WHEN 'excellent' THEN 95 WHEN 'good' THEN 78 WHEN 'fair' THEN 55 WHEN 'poor' THEN 30 ELSE 70 END INTO v_quality, v_condition FROM public.band_stage_equipment WHERE id = p_band_stage_equipment_id AND band_id = v_gig.band_id;
    IF v_quality IS NULL THEN RAISE EXCEPTION 'Band equipment is not available to this band.'; END IF;
  ELSIF p_equipment_item_id IS NOT NULL THEN
    SELECT CASE ei.rarity WHEN 'legendary' THEN 95 WHEN 'epic' THEN 85 WHEN 'rare' THEN 72 ELSE 58 END, 75 INTO v_quality, v_condition FROM public.player_equipment pe JOIN public.equipment_items ei ON ei.id = pe.equipment_id WHERE pe.id = p_equipment_item_id AND (pe.user_id = p_assigned_member_id OR EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = v_gig.band_id AND bm.user_id = pe.user_id));
    IF v_quality IS NULL THEN RAISE EXCEPTION 'Equipment is not legitimately available to this band.'; END IF;
  ELSIF p_source_type NOT IN ('rented','venue_provided','company_owned') THEN
    RAISE EXCEPTION 'Loadout requires a valid equipment source.';
  END IF;
  IF v_condition < 15 THEN RAISE EXCEPTION 'Unusable equipment cannot be assigned.'; END IF;
  SELECT count(*) INTO v_conflict FROM public.gig_equipment_loadouts gel JOIN public.gigs g ON g.id = gel.gig_id WHERE coalesce(gel.equipment_item_id, gel.band_stage_equipment_id) = coalesce(p_equipment_item_id, p_band_stage_equipment_id) AND g.status NOT IN ('completed','cancelled') AND abs(extract(epoch from (g.scheduled_date - v_gig.scheduled_date))) < 14400 AND gel.gig_id <> p_gig_id;
  IF v_conflict > 0 THEN RAISE EXCEPTION 'Equipment is already committed to a conflicting gig.'; END IF;
  INSERT INTO public.gig_equipment_loadouts(gig_id, band_id, equipment_role, source_type, equipment_item_id, band_stage_equipment_id, assigned_member_id, is_primary, is_spare, rental_cost, quality_score, condition_score, reliability_score)
  VALUES (p_gig_id, v_gig.band_id, p_equipment_role, p_source_type, p_equipment_item_id, p_band_stage_equipment_id, p_assigned_member_id, p_is_primary, p_is_spare, p_rental_cost, v_quality, v_condition, greatest(0, least(100, round(v_condition*0.65 + v_quality*0.25)))) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.process_gig_preparation_costs_and_rewards(p_gig_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gig record; v_crew numeric := 0; v_rental numeric := 0; v_rewards integer := 0; r record;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id;
  IF v_gig.id IS NULL THEN RAISE EXCEPTION 'Gig not found.'; END IF;
  IF v_gig.status = 'cancelled' THEN RETURN jsonb_build_object('crew_costs',0,'rental_costs',0,'rewards',0); END IF;
  FOR r IN SELECT * FROM public.gig_crew_assignments WHERE gig_id = p_gig_id AND assignment_status = 'accepted' LOOP
    IF NOT r.fee_covered_by_employment AND r.agreed_fee > 0 THEN INSERT INTO public.gig_preparation_cost_ledger(gig_id, band_id, cost_type, source_id, amount) VALUES (p_gig_id, v_gig.band_id, 'crew_fee', r.id, r.agreed_fee) ON CONFLICT DO NOTHING; END IF;
    IF r.player_id IS NOT NULL THEN INSERT INTO public.gig_crew_reward_ledger(gig_id, assignment_id, player_id, amount, xp_awarded) VALUES (p_gig_id, r.id, r.player_id, r.agreed_fee, greatest(5, round(r.effectiveness_score/5))) ON CONFLICT DO NOTHING; END IF;
  END LOOP;
  INSERT INTO public.gig_preparation_cost_ledger(gig_id, band_id, cost_type, source_id, amount) SELECT p_gig_id, v_gig.band_id, 'equipment_rental', id, rental_cost FROM public.gig_equipment_loadouts WHERE gig_id = p_gig_id AND rental_cost > 0 ON CONFLICT DO NOTHING;
  SELECT coalesce(sum(amount) FILTER (WHERE cost_type='crew_fee'),0), coalesce(sum(amount) FILTER (WHERE cost_type='equipment_rental'),0) INTO v_crew, v_rental FROM public.gig_preparation_cost_ledger WHERE gig_id = p_gig_id;
  SELECT count(*) INTO v_rewards FROM public.gig_crew_reward_ledger WHERE gig_id = p_gig_id;
  RETURN jsonb_build_object('crew_costs',v_crew,'rental_costs',v_rental,'rewards',v_rewards);
END; $$;

GRANT EXECUTE ON FUNCTION public.save_gig_crew_assignment(uuid,text,text,uuid,uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_gig_equipment_loadout(uuid,text,text,uuid,uuid,uuid,boolean,boolean,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_gig_preparation_costs_and_rewards(uuid) TO authenticated;
