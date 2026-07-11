-- Phase 3 gig preparation: stage production, soundcheck, setup timeline and outcome incidents.
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS stage_size integer,
  ADD COLUMN IF NOT EXISTS lighting_rig_quality integer,
  ADD COLUMN IF NOT EXISTS electrical_capacity integer,
  ADD COLUMN IF NOT EXISTS ceiling_height_m numeric,
  ADD COLUMN IF NOT EXISTS is_indoor boolean,
  ADD COLUMN IF NOT EXISTS allows_pyrotechnics boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS allows_smoke_haze boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS screen_projection_support boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS setup_access_minutes integer DEFAULT 120,
  ADD COLUMN IF NOT EXISTS curfew_minutes_after_start integer DEFAULT 180,
  ADD COLUMN IF NOT EXISTS house_production_level integer DEFAULT 35,
  ADD COLUMN IF NOT EXISTS venue_technicians integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.gig_production_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE UNIQUE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  lighting_package text NOT NULL DEFAULT 'venue_basic' CHECK (lighting_package IN ('venue_basic','standard','enhanced','professional','arena_spectacle')),
  visual_package text NOT NULL DEFAULT 'none' CHECK (visual_package IN ('none','static_backdrop','branded_projection','led_visuals','synchronised_show')),
  backdrop_option text NOT NULL DEFAULT 'none',
  effects_package text NOT NULL DEFAULT 'none' CHECK (effects_package IN ('none','haze','smoke','limited_pyro','full_pyro')),
  decoration_level integer NOT NULL DEFAULT 0 CHECK (decoration_level BETWEEN 0 AND 5),
  crowd_screens boolean NOT NULL DEFAULT false,
  additional_stage_crew integer NOT NULL DEFAULT 0 CHECK (additional_stage_crew BETWEEN 0 AND 8),
  setup_level text NOT NULL DEFAULT 'minimal' CHECK (setup_level IN ('minimal','standard','expanded','headline','festival_scale')),
  estimated_setup_minutes integer NOT NULL DEFAULT 20 CHECK (estimated_setup_minutes >= 0),
  estimated_cost numeric NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  cost_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  compatibility_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','locked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gig_soundcheck_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE UNIQUE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  soundcheck_type text NOT NULL DEFAULT 'none' CHECK (soundcheck_type IN ('none','line_check','short_soundcheck','standard_soundcheck','full_production_soundcheck')),
  scheduled_start timestamptz,
  duration_minutes integer NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  estimated_cost numeric NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  validation_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','locked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gig_preparation_cost_ledger DROP CONSTRAINT IF EXISTS gig_preparation_cost_ledger_cost_type_check;
ALTER TABLE public.gig_preparation_cost_ledger ADD CONSTRAINT gig_preparation_cost_ledger_cost_type_check CHECK (cost_type IN ('crew_fee','equipment_rental','production_hire','soundcheck_fee'));
ALTER TABLE public.gig_outcomes ADD COLUMN IF NOT EXISTS production_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.gig_outcomes ADD COLUMN IF NOT EXISTS soundcheck_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.gig_outcomes ADD COLUMN IF NOT EXISTS production_incidents jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_gig_production_plans_gig ON public.gig_production_plans(gig_id);
CREATE INDEX IF NOT EXISTS idx_gig_production_plans_band ON public.gig_production_plans(band_id);
CREATE INDEX IF NOT EXISTS idx_gig_soundcheck_plans_gig ON public.gig_soundcheck_plans(gig_id);
CREATE INDEX IF NOT EXISTS idx_gig_soundcheck_plans_band ON public.gig_soundcheck_plans(band_id);
CREATE INDEX IF NOT EXISTS idx_venues_production_caps ON public.venues(capacity, prestige_level, setup_access_minutes);

ALTER TABLE public.gig_production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_soundcheck_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Band members can view gig production plans" ON public.gig_production_plans FOR SELECT USING (EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = gig_production_plans.band_id AND bm.user_id = auth.uid()));
CREATE POLICY "Band managers can manage gig production plans" ON public.gig_production_plans FOR ALL USING (public.is_band_leader_or_manager(band_id, auth.uid())) WITH CHECK (public.is_band_leader_or_manager(band_id, auth.uid()));
CREATE POLICY "Band members can view gig soundcheck plans" ON public.gig_soundcheck_plans FOR SELECT USING (EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = gig_soundcheck_plans.band_id AND bm.user_id = auth.uid()));
CREATE POLICY "Band managers can manage gig soundcheck plans" ON public.gig_soundcheck_plans FOR ALL USING (public.is_band_leader_or_manager(band_id, auth.uid())) WITH CHECK (public.is_band_leader_or_manager(band_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.gig_production_estimate(p_lighting text, p_visual text, p_effects text, p_setup text, p_additional_crew integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_cost integer := 0; v_minutes integer := 0; v_crew integer := greatest(0, coalesce(p_additional_crew,0)); v_complexity integer := 0;
BEGIN
  v_cost := v_cost + CASE p_lighting WHEN 'venue_basic' THEN 0 WHEN 'standard' THEN 180 WHEN 'enhanced' THEN 420 WHEN 'professional' THEN 900 WHEN 'arena_spectacle' THEN 2200 ELSE 0 END;
  v_minutes := v_minutes + CASE p_lighting WHEN 'venue_basic' THEN 15 WHEN 'standard' THEN 35 WHEN 'enhanced' THEN 55 WHEN 'professional' THEN 85 WHEN 'arena_spectacle' THEN 130 ELSE 15 END;
  v_crew := greatest(v_crew, CASE p_lighting WHEN 'standard' THEN 1 WHEN 'enhanced' THEN 1 WHEN 'professional' THEN 2 WHEN 'arena_spectacle' THEN 4 ELSE 0 END);
  v_complexity := v_complexity + CASE p_lighting WHEN 'venue_basic' THEN 4 WHEN 'standard' THEN 8 WHEN 'enhanced' THEN 12 WHEN 'professional' THEN 18 WHEN 'arena_spectacle' THEN 28 ELSE 4 END;
  v_cost := v_cost + CASE p_visual WHEN 'none' THEN 0 WHEN 'static_backdrop' THEN 90 WHEN 'branded_projection' THEN 260 WHEN 'led_visuals' THEN 750 WHEN 'synchronised_show' THEN 1600 ELSE 0 END;
  v_minutes := v_minutes + CASE p_visual WHEN 'none' THEN 0 WHEN 'static_backdrop' THEN 20 WHEN 'branded_projection' THEN 40 WHEN 'led_visuals' THEN 75 WHEN 'synchronised_show' THEN 110 ELSE 0 END;
  IF p_visual IN ('branded_projection','led_visuals','synchronised_show') THEN v_crew := v_crew + 1; END IF;
  v_complexity := v_complexity + CASE p_visual WHEN 'none' THEN 0 WHEN 'static_backdrop' THEN 3 WHEN 'branded_projection' THEN 9 WHEN 'led_visuals' THEN 16 WHEN 'synchronised_show' THEN 24 ELSE 0 END;
  v_cost := v_cost + CASE p_effects WHEN 'none' THEN 0 WHEN 'haze' THEN 80 WHEN 'smoke' THEN 180 WHEN 'limited_pyro' THEN 800 WHEN 'full_pyro' THEN 1800 ELSE 0 END;
  v_minutes := v_minutes + CASE p_effects WHEN 'none' THEN 0 WHEN 'haze' THEN 15 WHEN 'smoke' THEN 25 WHEN 'limited_pyro' THEN 55 WHEN 'full_pyro' THEN 90 ELSE 0 END;
  IF p_effects IN ('limited_pyro','full_pyro') THEN v_crew := v_crew + 1; END IF;
  v_complexity := v_complexity + CASE p_effects WHEN 'none' THEN 0 WHEN 'haze' THEN 4 WHEN 'smoke' THEN 9 WHEN 'limited_pyro' THEN 24 WHEN 'full_pyro' THEN 36 ELSE 0 END;
  v_cost := v_cost + CASE p_setup WHEN 'minimal' THEN 0 WHEN 'standard' THEN 120 WHEN 'expanded' THEN 360 WHEN 'headline' THEN 900 WHEN 'festival_scale' THEN 2100 ELSE 0 END + greatest(0, coalesce(p_additional_crew,0))*95;
  v_minutes := v_minutes + CASE p_setup WHEN 'minimal' THEN 20 WHEN 'standard' THEN 40 WHEN 'expanded' THEN 75 WHEN 'headline' THEN 115 WHEN 'festival_scale' THEN 180 ELSE 20 END;
  v_crew := greatest(v_crew, CASE p_setup WHEN 'standard' THEN 1 WHEN 'expanded' THEN 2 WHEN 'headline' THEN 3 WHEN 'festival_scale' THEN 5 ELSE 0 END);
  v_complexity := least(100, round((v_complexity + CASE p_setup WHEN 'minimal' THEN 12 WHEN 'standard' THEN 30 WHEN 'expanded' THEN 52 WHEN 'headline' THEN 74 WHEN 'festival_scale' THEN 95 ELSE 12 END) / 1.8));
  RETURN jsonb_build_object('estimated_cost', v_cost, 'estimated_setup_minutes', v_minutes, 'crew_required', v_crew, 'complexity', v_complexity);
END; $$;

CREATE OR REPLACE FUNCTION public.save_gig_production_plan(p_gig_id uuid, p_lighting_package text, p_visual_package text, p_backdrop_option text DEFAULT 'none', p_effects_package text DEFAULT 'none', p_decoration_level integer DEFAULT 0, p_setup_level text DEFAULT 'minimal', p_crowd_screens boolean DEFAULT false, p_additional_stage_crew integer DEFAULT 0, p_status text DEFAULT 'confirmed')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gig record; v_venue record; v_est jsonb; v_errors text[] := '{}'; v_id uuid;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF v_gig.id IS NULL THEN RAISE EXCEPTION 'Gig not found.'; END IF;
  IF v_gig.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Completed or cancelled gigs cannot be edited.'; END IF;
  IF NOT public.is_band_leader_or_manager(v_gig.band_id, auth.uid()) THEN RAISE EXCEPTION 'Only authorised band managers can edit production plans.'; END IF;
  SELECT * INTO v_venue FROM public.venues WHERE id = v_gig.venue_id;
  v_est := public.gig_production_estimate(p_lighting_package, p_visual_package, p_effects_package, p_setup_level, p_additional_stage_crew);
  IF p_effects_package IN ('limited_pyro','full_pyro') AND coalesce(v_venue.allows_pyrotechnics,false) = false THEN v_errors := array_append(v_errors, 'Pyrotechnics are not permitted at this venue.'); END IF;
  IF p_effects_package IN ('haze','smoke','limited_pyro','full_pyro') AND coalesce(v_venue.allows_smoke_haze,true) = false THEN v_errors := array_append(v_errors, 'Smoke or haze effects are not permitted at this venue.'); END IF;
  IF p_visual_package IN ('branded_projection','led_visuals','synchronised_show') AND coalesce(v_venue.screen_projection_support,false) = false THEN v_errors := array_append(v_errors, 'Screens or projection are not supported at this venue.'); END IF;
  IF coalesce(v_venue.setup_access_minutes,120) < (v_est->>'estimated_setup_minutes')::integer THEN v_errors := array_append(v_errors, 'Production setup does not fit the venue access window.'); END IF;
  IF p_setup_level = 'festival_scale' AND coalesce(v_venue.capacity,0) < 2000 THEN v_errors := array_append(v_errors, 'Festival-scale setup is oversized for this venue.'); END IF;
  IF array_length(v_errors, 1) IS NOT NULL THEN RAISE EXCEPTION '%', array_to_string(v_errors, ' '); END IF;
  INSERT INTO public.gig_production_plans(gig_id, band_id, lighting_package, visual_package, backdrop_option, effects_package, decoration_level, crowd_screens, additional_stage_crew, setup_level, estimated_setup_minutes, estimated_cost, cost_breakdown, compatibility_breakdown, status)
  VALUES (p_gig_id, v_gig.band_id, p_lighting_package, p_visual_package, p_backdrop_option, p_effects_package, p_decoration_level, p_crowd_screens, p_additional_stage_crew, p_setup_level, (v_est->>'estimated_setup_minutes')::integer, (v_est->>'estimated_cost')::numeric, v_est, jsonb_build_object('valid', true, 'venue_id', v_gig.venue_id), p_status)
  ON CONFLICT (gig_id) DO UPDATE SET lighting_package=excluded.lighting_package, visual_package=excluded.visual_package, backdrop_option=excluded.backdrop_option, effects_package=excluded.effects_package, decoration_level=excluded.decoration_level, crowd_screens=excluded.crowd_screens, additional_stage_crew=excluded.additional_stage_crew, setup_level=excluded.setup_level, estimated_setup_minutes=excluded.estimated_setup_minutes, estimated_cost=excluded.estimated_cost, cost_breakdown=excluded.cost_breakdown, compatibility_breakdown=excluded.compatibility_breakdown, status=excluded.status, updated_at=now()
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.save_gig_soundcheck_plan(p_gig_id uuid, p_soundcheck_type text, p_scheduled_start timestamptz DEFAULT NULL, p_status text DEFAULT 'confirmed')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gig record; v_prod record; v_duration integer; v_cost numeric; v_latest timestamptz; v_access timestamptz; v_id uuid;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF v_gig.id IS NULL THEN RAISE EXCEPTION 'Gig not found.'; END IF;
  IF v_gig.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Completed or cancelled gigs cannot be edited.'; END IF;
  IF NOT public.is_band_leader_or_manager(v_gig.band_id, auth.uid()) THEN RAISE EXCEPTION 'Only authorised band managers can edit soundcheck plans.'; END IF;
  SELECT * INTO v_prod FROM public.gig_production_plans WHERE gig_id = p_gig_id;
  v_duration := CASE p_soundcheck_type WHEN 'none' THEN 0 WHEN 'line_check' THEN 15 WHEN 'short_soundcheck' THEN 30 WHEN 'standard_soundcheck' THEN 45 WHEN 'full_production_soundcheck' THEN 75 ELSE NULL END;
  IF v_duration IS NULL THEN RAISE EXCEPTION 'Unsupported soundcheck type.'; END IF;
  v_cost := CASE p_soundcheck_type WHEN 'short_soundcheck' THEN 60 WHEN 'standard_soundcheck' THEN 120 WHEN 'full_production_soundcheck' THEN 260 ELSE 0 END;
  v_latest := v_gig.scheduled_date - ((v_duration + 25) || ' minutes')::interval;
  v_access := v_gig.scheduled_date - (coalesce(v_prod.estimated_setup_minutes,20) + v_duration + 75 || ' minutes')::interval;
  IF p_soundcheck_type <> 'none' AND p_scheduled_start IS NOT NULL AND p_scheduled_start > v_latest THEN RAISE EXCEPTION 'Soundcheck cannot fit before showtime.'; END IF;
  IF p_soundcheck_type <> 'none' AND p_scheduled_start IS NOT NULL AND p_scheduled_start < v_access THEN RAISE EXCEPTION 'Soundcheck cannot start before venue access and setup.'; END IF;
  INSERT INTO public.gig_soundcheck_plans(gig_id, band_id, soundcheck_type, scheduled_start, duration_minutes, estimated_cost, validation_breakdown, status)
  VALUES (p_gig_id, v_gig.band_id, p_soundcheck_type, p_scheduled_start, v_duration, v_cost, jsonb_build_object('valid', true, 'latest_start', v_latest), p_status)
  ON CONFLICT (gig_id) DO UPDATE SET soundcheck_type=excluded.soundcheck_type, scheduled_start=excluded.scheduled_start, duration_minutes=excluded.duration_minutes, estimated_cost=excluded.estimated_cost, validation_breakdown=excluded.validation_breakdown, status=excluded.status, updated_at=now()
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.process_gig_preparation_costs_and_rewards(p_gig_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gig record; v_crew numeric := 0; v_rental numeric := 0; v_production numeric := 0; v_soundcheck numeric := 0; v_rewards integer := 0; r record;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id;
  IF v_gig.id IS NULL THEN RAISE EXCEPTION 'Gig not found.'; END IF;
  IF v_gig.status = 'cancelled' THEN RETURN jsonb_build_object('crew_costs',0,'rental_costs',0,'production_costs',0,'soundcheck_costs',0,'rewards',0); END IF;
  FOR r IN SELECT * FROM public.gig_crew_assignments WHERE gig_id = p_gig_id AND assignment_status = 'accepted' LOOP
    IF NOT r.fee_covered_by_employment AND r.agreed_fee > 0 THEN INSERT INTO public.gig_preparation_cost_ledger(gig_id, band_id, cost_type, source_id, amount) VALUES (p_gig_id, v_gig.band_id, 'crew_fee', r.id, r.agreed_fee) ON CONFLICT DO NOTHING; END IF;
    IF r.player_id IS NOT NULL THEN INSERT INTO public.gig_crew_reward_ledger(gig_id, assignment_id, player_id, amount, xp_awarded) VALUES (p_gig_id, r.id, r.player_id, r.agreed_fee, greatest(5, round(r.effectiveness_score/5))) ON CONFLICT DO NOTHING; END IF;
  END LOOP;
  INSERT INTO public.gig_preparation_cost_ledger(gig_id, band_id, cost_type, source_id, amount) SELECT p_gig_id, v_gig.band_id, 'equipment_rental', id, rental_cost FROM public.gig_equipment_loadouts WHERE gig_id = p_gig_id AND rental_cost > 0 ON CONFLICT DO NOTHING;
  INSERT INTO public.gig_preparation_cost_ledger(gig_id, band_id, cost_type, source_id, amount) SELECT p_gig_id, v_gig.band_id, 'production_hire', id, estimated_cost FROM public.gig_production_plans WHERE gig_id = p_gig_id AND estimated_cost > 0 ON CONFLICT DO NOTHING;
  INSERT INTO public.gig_preparation_cost_ledger(gig_id, band_id, cost_type, source_id, amount) SELECT p_gig_id, v_gig.band_id, 'soundcheck_fee', id, estimated_cost FROM public.gig_soundcheck_plans WHERE gig_id = p_gig_id AND estimated_cost > 0 ON CONFLICT DO NOTHING;
  SELECT coalesce(sum(amount) FILTER (WHERE cost_type='crew_fee'),0), coalesce(sum(amount) FILTER (WHERE cost_type='equipment_rental'),0), coalesce(sum(amount) FILTER (WHERE cost_type='production_hire'),0), coalesce(sum(amount) FILTER (WHERE cost_type='soundcheck_fee'),0) INTO v_crew, v_rental, v_production, v_soundcheck FROM public.gig_preparation_cost_ledger WHERE gig_id = p_gig_id;
  SELECT count(*) INTO v_rewards FROM public.gig_crew_reward_ledger WHERE gig_id = p_gig_id;
  RETURN jsonb_build_object('crew_costs',v_crew,'rental_costs',v_rental,'production_costs',v_production,'soundcheck_costs',v_soundcheck,'rewards',v_rewards);
END; $$;

GRANT EXECUTE ON FUNCTION public.save_gig_production_plan(uuid,text,text,text,text,integer,text,boolean,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_gig_soundcheck_plan(uuid,text,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gig_production_estimate(text,text,text,text,integer) TO authenticated;
