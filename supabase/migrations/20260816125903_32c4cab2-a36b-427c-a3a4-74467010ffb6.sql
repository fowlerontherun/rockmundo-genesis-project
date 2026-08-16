
-- =========================================================
-- Live gig authority: missing tables + server-side RPCs
-- =========================================================

ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS result_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_positions integer[] NOT NULL DEFAULT '{}'::integer[];

-- ---------- helper: is caller a member of the band ----------
CREATE OR REPLACE FUNCTION public.caller_in_band(p_band_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.band_members bm
    JOIN public.profiles p ON p.id = bm.profile_id
    WHERE bm.band_id = p_band_id AND p.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.bands b
    JOIN public.profiles p ON p.id = b.leader_id
    WHERE b.id = p_band_id AND p.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.caller_in_gig_band(p_gig_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.gigs g WHERE g.id = p_gig_id AND public.caller_in_band(g.band_id));
$$;

-- ---------- setlists ----------
CREATE TABLE IF NOT EXISTS public.gig_setlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Gig setlist',
  total_duration_seconds integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS gig_setlists_one_per_gig ON public.gig_setlists(gig_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gig_setlists TO authenticated;
GRANT ALL ON public.gig_setlists TO service_role;
ALTER TABLE public.gig_setlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY gig_setlists_band_all ON public.gig_setlists FOR ALL TO authenticated
  USING (public.caller_in_gig_band(gig_id)) WITH CHECK (public.caller_in_gig_band(gig_id));

CREATE TABLE IF NOT EXISTS public.gig_setlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id uuid NOT NULL REFERENCES public.gig_setlists(id) ON DELETE CASCADE,
  song_id uuid,
  position integer NOT NULL,
  is_encore boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gig_setlist_items_setlist_idx ON public.gig_setlist_items(setlist_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gig_setlist_items TO authenticated;
GRANT ALL ON public.gig_setlist_items TO service_role;
ALTER TABLE public.gig_setlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY gig_setlist_items_band_all ON public.gig_setlist_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gig_setlists s WHERE s.id = setlist_id AND public.caller_in_gig_band(s.gig_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.gig_setlists s WHERE s.id = setlist_id AND public.caller_in_gig_band(s.gig_id)));

-- ---------- production / soundcheck ----------
CREATE TABLE IF NOT EXISTS public.gig_production_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  lighting_package text NOT NULL DEFAULT 'basic',
  visual_package text NOT NULL DEFAULT 'none',
  effects_package text NOT NULL DEFAULT 'none',
  setup_level text NOT NULL DEFAULT 'standard',
  estimated_cost integer NOT NULL DEFAULT 0,
  estimated_setup_minutes integer NOT NULL DEFAULT 20,
  cost_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS gig_production_plans_one_per_gig ON public.gig_production_plans(gig_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gig_production_plans TO authenticated;
GRANT ALL ON public.gig_production_plans TO service_role;
ALTER TABLE public.gig_production_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY gig_production_plans_band_all ON public.gig_production_plans FOR ALL TO authenticated
  USING (public.caller_in_gig_band(gig_id)) WITH CHECK (public.caller_in_gig_band(gig_id));

CREATE TABLE IF NOT EXISTS public.gig_soundcheck_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  soundcheck_type text NOT NULL DEFAULT 'none',
  scheduled_start timestamptz,
  estimated_cost integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS gig_soundcheck_plans_one_per_gig ON public.gig_soundcheck_plans(gig_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gig_soundcheck_plans TO authenticated;
GRANT ALL ON public.gig_soundcheck_plans TO service_role;
ALTER TABLE public.gig_soundcheck_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY gig_soundcheck_plans_band_all ON public.gig_soundcheck_plans FOR ALL TO authenticated
  USING (public.caller_in_gig_band(gig_id)) WITH CHECK (public.caller_in_gig_band(gig_id));

-- ---------- crew / equipment ----------
CREATE TABLE IF NOT EXISTS public.gig_crew_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  crew_role text NOT NULL,
  worker_type text NOT NULL DEFAULT 'npc_staff',
  npc_staff_id uuid,
  profile_id uuid,
  band_crew_member_id uuid,
  assignment_status text NOT NULL DEFAULT 'accepted',
  cost integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS gig_crew_assignments_role_unique ON public.gig_crew_assignments(gig_id, crew_role);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gig_crew_assignments TO authenticated;
GRANT ALL ON public.gig_crew_assignments TO service_role;
ALTER TABLE public.gig_crew_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY gig_crew_assignments_band_all ON public.gig_crew_assignments FOR ALL TO authenticated
  USING (public.caller_in_gig_band(gig_id)) WITH CHECK (public.caller_in_gig_band(gig_id));

CREATE TABLE IF NOT EXISTS public.gig_equipment_loadouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  equipment_role text NOT NULL,
  source_type text NOT NULL DEFAULT 'band_owned',
  band_stage_equipment_id uuid,
  rented_item_name text,
  is_primary boolean NOT NULL DEFAULT true,
  is_spare boolean NOT NULL DEFAULT false,
  rental_cost integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gig_equipment_loadouts_gig_idx ON public.gig_equipment_loadouts(gig_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gig_equipment_loadouts TO authenticated;
GRANT ALL ON public.gig_equipment_loadouts TO service_role;
ALTER TABLE public.gig_equipment_loadouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY gig_equipment_loadouts_band_all ON public.gig_equipment_loadouts FOR ALL TO authenticated
  USING (public.caller_in_gig_band(gig_id)) WITH CHECK (public.caller_in_gig_band(gig_id));

-- ---------- forecasts / settlement / replays ----------
CREATE TABLE IF NOT EXISTS public.gig_forecast_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  forecast jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculation_version integer NOT NULL DEFAULT 1,
  is_final boolean NOT NULL DEFAULT false,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gig_forecast_snapshots_gig_idx ON public.gig_forecast_snapshots(gig_id, generated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS gig_forecast_snapshots_one_final ON public.gig_forecast_snapshots(gig_id) WHERE is_final;
GRANT SELECT ON public.gig_forecast_snapshots TO authenticated;
GRANT ALL ON public.gig_forecast_snapshots TO service_role;
ALTER TABLE public.gig_forecast_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY gig_forecast_snapshots_read ON public.gig_forecast_snapshots FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.gig_commerce_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  commerce_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  merch_items_sold integer NOT NULL DEFAULT 0,
  merch_gross_revenue integer NOT NULL DEFAULT 0,
  merch_cost integer NOT NULL DEFAULT 0,
  bar_band_entitlement integer NOT NULL DEFAULT 0,
  settled_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS gig_commerce_settlements_one_per_gig ON public.gig_commerce_settlements(gig_id);
GRANT SELECT ON public.gig_commerce_settlements TO authenticated;
GRANT ALL ON public.gig_commerce_settlements TO service_role;
ALTER TABLE public.gig_commerce_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY gig_commerce_settlements_read ON public.gig_commerce_settlements FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.gig_viewer_replays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  gig_outcome_id uuid,
  viewer_version text NOT NULL,
  event_schema_version integer NOT NULL DEFAULT 1,
  simulation_seed text,
  duration_ms integer NOT NULL DEFAULT 0,
  event_count integer NOT NULL DEFAULT 0,
  event_payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  checksum text,
  generation_status text NOT NULL DEFAULT 'generating',
  generation_error_code text,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS gig_viewer_replays_gig_version ON public.gig_viewer_replays(gig_id, viewer_version);
GRANT SELECT ON public.gig_viewer_replays TO authenticated;
GRANT ALL ON public.gig_viewer_replays TO service_role;
ALTER TABLE public.gig_viewer_replays ENABLE ROW LEVEL SECURITY;
CREATE POLICY gig_viewer_replays_read ON public.gig_viewer_replays FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.gig_post_processing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  processing_version integer NOT NULL DEFAULT 1,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gig_post_processing_gig_idx ON public.gig_post_processing(gig_id, created_at DESC);
GRANT SELECT ON public.gig_post_processing TO authenticated;
GRANT ALL ON public.gig_post_processing TO service_role;
ALTER TABLE public.gig_post_processing ENABLE ROW LEVEL SECURITY;
CREATE POLICY gig_post_processing_read ON public.gig_post_processing FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.gig_consequence_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  category text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  consequence_key text NOT NULL,
  previous_value numeric,
  delta_value numeric,
  new_value numeric,
  status text NOT NULL DEFAULT 'applied',
  explanation text,
  source_factors jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gig_consequence_snapshots_gig_idx ON public.gig_consequence_snapshots(gig_id, created_at);
GRANT SELECT ON public.gig_consequence_snapshots TO authenticated;
GRANT ALL ON public.gig_consequence_snapshots TO service_role;
ALTER TABLE public.gig_consequence_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY gig_consequence_snapshots_read ON public.gig_consequence_snapshots FOR SELECT TO authenticated USING (true);

-- ---------- audience ----------
CREATE TABLE IF NOT EXISTS public.gig_audience_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  live_session_id uuid,
  ticket_id uuid,
  attendance_type text NOT NULL DEFAULT 'in_person',
  status text NOT NULL DEFAULT 'checked_in',
  participation_score integer NOT NULL DEFAULT 0,
  watch_duration_seconds integer NOT NULL DEFAULT 0,
  reward_status text NOT NULL DEFAULT 'pending',
  last_presence_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS gig_audience_attendance_unique ON public.gig_audience_attendance(gig_id, profile_id);
GRANT SELECT, INSERT, UPDATE ON public.gig_audience_attendance TO authenticated;
GRANT ALL ON public.gig_audience_attendance TO service_role;
ALTER TABLE public.gig_audience_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY gig_audience_attendance_read ON public.gig_audience_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY gig_audience_attendance_own_write ON public.gig_audience_attendance FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));
CREATE POLICY gig_audience_attendance_own_update ON public.gig_audience_attendance FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.gig_audience_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES public.gig_audience_attendance(id) ON DELETE CASCADE,
  reaction_type text NOT NULL,
  segment_id uuid,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS gig_audience_reactions_idem ON public.gig_audience_reactions(idempotency_key);
GRANT SELECT, INSERT ON public.gig_audience_reactions TO authenticated;
GRANT ALL ON public.gig_audience_reactions TO service_role;
ALTER TABLE public.gig_audience_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY gig_audience_reactions_read ON public.gig_audience_reactions FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.gig_audience_segment_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id uuid NOT NULL,
  gig_id uuid,
  participation_level text NOT NULL DEFAULT 'warming_up',
  participation_score integer NOT NULL DEFAULT 0,
  reaction_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  unique_participants integer NOT NULL DEFAULT 0,
  encore_demand integer NOT NULL DEFAULT 0,
  singalong_strength integer NOT NULL DEFAULT 0,
  audience_modifier numeric NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS gig_audience_segment_session ON public.gig_audience_segment_aggregates(live_session_id);
GRANT SELECT ON public.gig_audience_segment_aggregates TO authenticated;
GRANT ALL ON public.gig_audience_segment_aggregates TO service_role;
ALTER TABLE public.gig_audience_segment_aggregates ENABLE ROW LEVEL SECURITY;
CREATE POLICY gig_audience_segment_read ON public.gig_audience_segment_aggregates FOR SELECT TO authenticated USING (true);

-- =========================================================
-- RPCs
-- =========================================================

CREATE OR REPLACE FUNCTION public.start_gig_authoritative(p_gig_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.gigs%ROWTYPE;
BEGIN
  SELECT * INTO g FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_not_found'; END IF;
  IF auth.role() <> 'service_role' AND NOT public.caller_in_band(g.band_id) THEN
    RAISE EXCEPTION 'not_authorised';
  END IF;
  IF g.started_at IS NOT NULL OR g.status = 'in_progress' THEN
    RETURN jsonb_build_object('alreadyStarted', true, 'startedAt', g.started_at);
  END IF;
  IF g.status = 'completed' THEN
    RETURN jsonb_build_object('alreadyStarted', true, 'completed', true);
  END IF;
  UPDATE public.gigs
     SET status = 'in_progress', started_at = now(), current_song_position = COALESCE(current_song_position, 0), updated_at = now()
   WHERE id = p_gig_id;
  RETURN jsonb_build_object('alreadyStarted', false, 'startedAt', now());
END; $$;

CREATE OR REPLACE FUNCTION public.claim_gig_completion(p_gig_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.gigs%ROWTYPE;
BEGIN
  SELECT * INTO g FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_not_found'; END IF;
  IF g.status = 'completed' AND g.result_ready_at IS NOT NULL THEN
    RETURN jsonb_build_object('alreadyCompleted', true, 'alreadyProcessing', false);
  END IF;
  IF g.completion_claimed_at IS NOT NULL AND g.completion_claimed_at > now() - interval '5 minutes' THEN
    RETURN jsonb_build_object('alreadyCompleted', false, 'alreadyProcessing', true);
  END IF;
  UPDATE public.gigs SET completion_claimed_at = now(), updated_at = now() WHERE id = p_gig_id;
  INSERT INTO public.gig_post_processing (gig_id, status) VALUES (p_gig_id, 'processing');
  RETURN jsonb_build_object('alreadyCompleted', false, 'alreadyProcessing', false, 'claimedAt', now());
END; $$;

CREATE OR REPLACE FUNCTION public.mark_gig_position_processed(p_gig_id uuid, p_position integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.gigs
     SET processed_positions = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(processed_positions,'{}') || ARRAY[p_position]) ORDER BY 1)),
         current_song_position = GREATEST(COALESCE(current_song_position, 0), p_position),
         updated_at = now()
   WHERE id = p_gig_id;
  RETURN jsonb_build_object('gigId', p_gig_id, 'position', p_position);
END; $$;

CREATE OR REPLACE FUNCTION public.preserve_final_gig_forecast_snapshot(p_gig_id uuid, p_forecast jsonb, p_version integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.gig_forecast_snapshots WHERE gig_id = p_gig_id AND is_final;
  IF v_id IS NOT NULL THEN RETURN jsonb_build_object('preserved', false, 'id', v_id); END IF;
  INSERT INTO public.gig_forecast_snapshots (gig_id, forecast, calculation_version, is_final)
  VALUES (p_gig_id, COALESCE(p_forecast,'{}'::jsonb), COALESCE(p_version,1), true)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('preserved', true, 'id', v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.claim_gig_viewer_replay_generation(p_gig_id uuid, p_gig_outcome_id uuid, p_viewer_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.gig_viewer_replays%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.gig_viewer_replays
   WHERE gig_id = p_gig_id AND viewer_version = p_viewer_version FOR UPDATE;
  IF FOUND THEN
    IF r.generation_status = 'ready' THEN
      RETURN jsonb_build_object('alreadyReady', true, 'alreadyGenerating', false, 'replayId', r.id);
    ELSIF r.generation_status = 'generating' AND r.generated_at > now() - interval '5 minutes' THEN
      RETURN jsonb_build_object('alreadyReady', false, 'alreadyGenerating', true, 'replayId', r.id);
    END IF;
    UPDATE public.gig_viewer_replays
       SET generation_status = 'generating', generation_error_code = NULL, generated_at = now(), gig_outcome_id = p_gig_outcome_id
     WHERE id = r.id;
    RETURN jsonb_build_object('alreadyReady', false, 'alreadyGenerating', false, 'replayId', r.id);
  END IF;
  INSERT INTO public.gig_viewer_replays (gig_id, gig_outcome_id, viewer_version, generation_status)
  VALUES (p_gig_id, p_gig_outcome_id, p_viewer_version, 'generating')
  RETURNING * INTO r;
  RETURN jsonb_build_object('alreadyReady', false, 'alreadyGenerating', false, 'replayId', r.id);
END; $$;

CREATE OR REPLACE FUNCTION public.process_gig_preparation_costs_and_rewards(p_gig_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prod integer := 0; v_sound integer := 0; v_crew integer := 0; v_rental integer := 0;
BEGIN
  SELECT COALESCE(estimated_cost,0) INTO v_prod FROM public.gig_production_plans WHERE gig_id = p_gig_id;
  SELECT COALESCE(estimated_cost,0) INTO v_sound FROM public.gig_soundcheck_plans WHERE gig_id = p_gig_id;
  SELECT COALESCE(SUM(cost),0) INTO v_crew FROM public.gig_crew_assignments WHERE gig_id = p_gig_id;
  SELECT COALESCE(SUM(rental_cost),0) INTO v_rental FROM public.gig_equipment_loadouts WHERE gig_id = p_gig_id;
  RETURN jsonb_build_object(
    'production_costs', COALESCE(v_prod,0),
    'soundcheck_costs', COALESCE(v_sound,0),
    'crew_costs', COALESCE(v_crew,0),
    'rental_costs', COALESCE(v_rental,0)
  );
END; $$;

CREATE OR REPLACE FUNCTION public.settle_gig_commerce(p_gig_id uuid, p_performance_rating numeric, p_merch_multiplier numeric DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing public.gig_commerce_settlements%ROWTYPE;
  g public.gigs%ROWTYPE;
  v_attendance integer := 0;
  v_rating numeric := GREATEST(0, LEAST(25, COALESCE(p_performance_rating, 12)));
  v_mult numeric := GREATEST(0.1, LEAST(3, COALESCE(p_merch_multiplier, 1)));
  v_conv numeric;
  v_items integer;
  v_unit numeric := 18;
  v_gross integer;
  v_cost integer;
  v_snapshot jsonb;
BEGIN
  SELECT * INTO existing FROM public.gig_commerce_settlements WHERE gig_id = p_gig_id;
  IF FOUND THEN RETURN existing.commerce_snapshot; END IF;

  SELECT * INTO g FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_not_found'; END IF;

  SELECT COALESCE(actual_attendance, 0) INTO v_attendance FROM public.gig_outcomes WHERE gig_id = p_gig_id ORDER BY created_at DESC LIMIT 1;
  v_attendance := COALESCE(NULLIF(v_attendance, 0), COALESCE(g.attendance, g.estimated_attendance, 0));

  v_conv := (0.02 + (v_rating / 25.0) * 0.10) * v_mult;
  v_items := GREATEST(0, FLOOR(v_attendance * v_conv))::integer;
  v_gross := ROUND(v_items * v_unit)::integer;
  v_cost := ROUND(v_gross * 0.4)::integer;

  v_snapshot := jsonb_build_object(
    'merchandise', jsonb_build_object('itemsSold', v_items, 'grossRevenue', v_gross, 'cost', v_cost, 'unitPrice', v_unit, 'conversionRate', ROUND(v_conv, 4)),
    'bar', jsonb_build_object('bandEntitlement', 0, 'venueRevenue', ROUND(v_attendance * 6.5)::integer),
    'attendance', v_attendance,
    'performanceRating', v_rating,
    'settledAt', now()
  );

  INSERT INTO public.gig_commerce_settlements (gig_id, commerce_snapshot, merch_items_sold, merch_gross_revenue, merch_cost, bar_band_entitlement)
  VALUES (p_gig_id, v_snapshot, v_items, v_gross, v_cost, 0)
  ON CONFLICT (gig_id) DO NOTHING;

  SELECT commerce_snapshot INTO v_snapshot FROM public.gig_commerce_settlements WHERE gig_id = p_gig_id;
  RETURN v_snapshot;
END; $$;

-- ---------- planning saves ----------
CREATE OR REPLACE FUNCTION public.save_gig_setlist(p_gig_id uuid, p_name text, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_setlist_id uuid; v_total integer := 0;
BEGIN
  IF NOT public.caller_in_gig_band(p_gig_id) THEN RAISE EXCEPTION 'not_authorised'; END IF;
  INSERT INTO public.gig_setlists (gig_id, name) VALUES (p_gig_id, COALESCE(NULLIF(p_name,''),'Gig setlist'))
  ON CONFLICT (gig_id) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
  RETURNING id INTO v_setlist_id;

  DELETE FROM public.gig_setlist_items WHERE setlist_id = v_setlist_id;
  INSERT INTO public.gig_setlist_items (setlist_id, song_id, position, is_encore)
  SELECT v_setlist_id,
         NULLIF(item->>'song_id','')::uuid,
         COALESCE((item->>'position')::integer, ordinality::integer),
         COALESCE((item->>'is_encore')::boolean, false)
  FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb)) WITH ORDINALITY AS t(item, ordinality);

  SELECT COALESCE(SUM(COALESCE(s.duration_seconds, 210)), 0) INTO v_total
    FROM public.gig_setlist_items i LEFT JOIN public.songs s ON s.id = i.song_id
   WHERE i.setlist_id = v_setlist_id;

  UPDATE public.gig_setlists SET total_duration_seconds = v_total, updated_at = now() WHERE id = v_setlist_id;
  UPDATE public.gigs SET setlist_duration_minutes = GREATEST(1, ROUND(v_total / 60.0))::integer, updated_at = now() WHERE id = p_gig_id;
  RETURN jsonb_build_object('setlistId', v_setlist_id, 'totalDurationSeconds', v_total);
END; $$;

CREATE OR REPLACE FUNCTION public.save_gig_production_plan(
  p_gig_id uuid, p_lighting_package text, p_visual_package text, p_effects_package text,
  p_setup_level text, p_status text DEFAULT 'draft')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cost integer; v_minutes integer; v_complexity integer; v_id uuid;
  v_light integer := CASE p_lighting_package WHEN 'basic' THEN 0 WHEN 'enhanced' THEN 400 WHEN 'arena' THEN 1200 ELSE 200 END;
  v_visual integer := CASE p_visual_package WHEN 'none' THEN 0 WHEN 'screens' THEN 600 WHEN 'immersive' THEN 1500 ELSE 200 END;
  v_effect integer := CASE p_effects_package WHEN 'none' THEN 0 WHEN 'haze' THEN 250 WHEN 'pyro' THEN 1800 ELSE 300 END;
  v_setup integer := CASE p_setup_level WHEN 'minimal' THEN 10 WHEN 'standard' THEN 25 WHEN 'full' THEN 60 ELSE 25 END;
BEGIN
  IF NOT public.caller_in_gig_band(p_gig_id) THEN RAISE EXCEPTION 'not_authorised'; END IF;
  v_cost := v_light + v_visual + v_effect;
  v_minutes := v_setup;
  v_complexity := LEAST(100, GREATEST(5, (v_cost / 60) + v_setup));
  INSERT INTO public.gig_production_plans (gig_id, lighting_package, visual_package, effects_package, setup_level, estimated_cost, estimated_setup_minutes, cost_breakdown, status)
  VALUES (p_gig_id, p_lighting_package, p_visual_package, p_effects_package, p_setup_level, v_cost, v_minutes,
          jsonb_build_object('lighting', v_light, 'visual', v_visual, 'effects', v_effect, 'complexity', v_complexity), COALESCE(p_status,'draft'))
  ON CONFLICT (gig_id) DO UPDATE SET
    lighting_package = EXCLUDED.lighting_package, visual_package = EXCLUDED.visual_package,
    effects_package = EXCLUDED.effects_package, setup_level = EXCLUDED.setup_level,
    estimated_cost = EXCLUDED.estimated_cost, estimated_setup_minutes = EXCLUDED.estimated_setup_minutes,
    cost_breakdown = EXCLUDED.cost_breakdown, status = EXCLUDED.status, updated_at = now()
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'estimatedCost', v_cost, 'setupMinutes', v_minutes);
END; $$;

CREATE OR REPLACE FUNCTION public.save_gig_soundcheck_plan(
  p_gig_id uuid, p_soundcheck_type text, p_scheduled_start timestamptz DEFAULT NULL, p_status text DEFAULT 'draft')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
  v_cost integer := CASE p_soundcheck_type
    WHEN 'none' THEN 0 WHEN 'line_check' THEN 80 WHEN 'short_soundcheck' THEN 200
    WHEN 'standard_soundcheck' THEN 400 WHEN 'full_production_soundcheck' THEN 900 ELSE 150 END;
BEGIN
  IF NOT public.caller_in_gig_band(p_gig_id) THEN RAISE EXCEPTION 'not_authorised'; END IF;
  INSERT INTO public.gig_soundcheck_plans (gig_id, soundcheck_type, scheduled_start, estimated_cost, status)
  VALUES (p_gig_id, p_soundcheck_type, p_scheduled_start, v_cost, COALESCE(p_status,'draft'))
  ON CONFLICT (gig_id) DO UPDATE SET
    soundcheck_type = EXCLUDED.soundcheck_type, scheduled_start = EXCLUDED.scheduled_start,
    estimated_cost = EXCLUDED.estimated_cost, status = EXCLUDED.status, updated_at = now()
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'estimatedCost', v_cost);
END; $$;

CREATE OR REPLACE FUNCTION public.save_gig_crew_assignment(
  p_gig_id uuid, p_crew_role text, p_worker_type text, p_npc_staff_id uuid DEFAULT NULL,
  p_assignment_status text DEFAULT 'accepted', p_profile_id uuid DEFAULT NULL, p_cost integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.caller_in_gig_band(p_gig_id) THEN RAISE EXCEPTION 'not_authorised'; END IF;
  INSERT INTO public.gig_crew_assignments (gig_id, crew_role, worker_type, npc_staff_id, profile_id, assignment_status, cost)
  VALUES (p_gig_id, p_crew_role, COALESCE(p_worker_type,'npc_staff'), p_npc_staff_id, p_profile_id, COALESCE(p_assignment_status,'accepted'), COALESCE(p_cost,0))
  ON CONFLICT (gig_id, crew_role) DO UPDATE SET
    worker_type = EXCLUDED.worker_type, npc_staff_id = EXCLUDED.npc_staff_id, profile_id = EXCLUDED.profile_id,
    assignment_status = EXCLUDED.assignment_status, cost = EXCLUDED.cost, updated_at = now()
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.save_gig_equipment_loadout(
  p_gig_id uuid, p_equipment_role text, p_source_type text, p_band_stage_equipment_id uuid DEFAULT NULL,
  p_is_primary boolean DEFAULT true, p_is_spare boolean DEFAULT false, p_rental_cost integer DEFAULT 0,
  p_rented_item_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.caller_in_gig_band(p_gig_id) THEN RAISE EXCEPTION 'not_authorised'; END IF;
  INSERT INTO public.gig_equipment_loadouts (gig_id, equipment_role, source_type, band_stage_equipment_id, is_primary, is_spare, rental_cost, rented_item_name)
  VALUES (p_gig_id, p_equipment_role, COALESCE(p_source_type,'band_owned'), p_band_stage_equipment_id, COALESCE(p_is_primary,true), COALESCE(p_is_spare,false), COALESCE(p_rental_cost,0), p_rented_item_name)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END; $$;

-- ---------- audience participation ----------
CREATE OR REPLACE FUNCTION public.check_in_gig_audience(
  p_gig_id uuid, p_ticket_id uuid DEFAULT NULL, p_attendance_type text DEFAULT 'in_person')
RETURNS public.gig_audience_attendance LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_profile uuid; v_row public.gig_audience_attendance%ROWTYPE;
BEGIN
  SELECT id INTO v_profile FROM public.profiles WHERE user_id = auth.uid() AND COALESCE(is_active, true) ORDER BY COALESCE(is_active,true) DESC, created_at LIMIT 1;
  IF v_profile IS NULL THEN RAISE EXCEPTION 'no_active_profile'; END IF;
  INSERT INTO public.gig_audience_attendance (gig_id, profile_id, ticket_id, attendance_type)
  VALUES (p_gig_id, v_profile, p_ticket_id, COALESCE(p_attendance_type,'in_person'))
  ON CONFLICT (gig_id, profile_id) DO UPDATE SET
    attendance_type = EXCLUDED.attendance_type, last_presence_at = now(), status = 'checked_in'
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.record_gig_audience_reaction(
  p_attendance_id uuid, p_reaction_type text, p_segment_id uuid DEFAULT NULL, p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key text := COALESCE(p_idempotency_key, p_attendance_id::text || ':' || p_reaction_type || ':' || extract(epoch from now())::bigint::text);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.gig_audience_attendance a JOIN public.profiles p ON p.id = a.profile_id
     WHERE a.id = p_attendance_id AND p.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not_authorised'; END IF;

  INSERT INTO public.gig_audience_reactions (attendance_id, reaction_type, segment_id, idempotency_key)
  VALUES (p_attendance_id, p_reaction_type, p_segment_id, v_key)
  ON CONFLICT (idempotency_key) DO NOTHING;

  UPDATE public.gig_audience_attendance
     SET participation_score = LEAST(1000, participation_score + 5), last_presence_at = now()
   WHERE id = p_attendance_id;

  RETURN jsonb_build_object('recorded', true);
END; $$;

GRANT EXECUTE ON FUNCTION
  public.start_gig_authoritative(uuid),
  public.claim_gig_completion(uuid),
  public.mark_gig_position_processed(uuid, integer),
  public.preserve_final_gig_forecast_snapshot(uuid, jsonb, integer),
  public.claim_gig_viewer_replay_generation(uuid, uuid, text),
  public.process_gig_preparation_costs_and_rewards(uuid),
  public.settle_gig_commerce(uuid, numeric, numeric),
  public.save_gig_setlist(uuid, text, jsonb),
  public.save_gig_production_plan(uuid, text, text, text, text, text),
  public.save_gig_soundcheck_plan(uuid, text, timestamptz, text),
  public.save_gig_crew_assignment(uuid, text, text, uuid, text, uuid, integer),
  public.save_gig_equipment_loadout(uuid, text, text, uuid, boolean, boolean, integer, text),
  public.check_in_gig_audience(uuid, uuid, text),
  public.record_gig_audience_reaction(uuid, text, uuid, text),
  public.caller_in_band(uuid),
  public.caller_in_gig_band(uuid)
TO authenticated, service_role;
