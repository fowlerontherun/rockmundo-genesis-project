
-- ============================================================
-- World Reset: maintenance mode, audit log, and reset routine
-- ============================================================

-- 1) Maintenance singleton
CREATE TABLE IF NOT EXISTS public.game_maintenance (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_active BOOLEAN NOT NULL DEFAULT false,
  message TEXT,
  scheduled_reset_at TIMESTAMPTZ,
  initiated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.game_maintenance TO anon;
GRANT SELECT ON public.game_maintenance TO authenticated;
GRANT ALL ON public.game_maintenance TO service_role;

ALTER TABLE public.game_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read maintenance state"
  ON public.game_maintenance FOR SELECT
  USING (true);

CREATE POLICY "admins manage maintenance"
  ON public.game_maintenance FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.game_maintenance (id, is_active) VALUES (1, false)
  ON CONFLICT (id) DO NOTHING;

-- 2) Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) Preserve list (curated catalogs that survive a world reset)
CREATE TABLE IF NOT EXISTS public.world_reset_preserve_list (
  table_name TEXT PRIMARY KEY,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.world_reset_preserve_list TO authenticated;
GRANT ALL ON public.world_reset_preserve_list TO service_role;

ALTER TABLE public.world_reset_preserve_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read preserve list"
  ON public.world_reset_preserve_list FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "admins manage preserve list"
  ON public.world_reset_preserve_list FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed preserve list with curated catalogs / system tables.
-- Tables not in this list (and not system-prefixed) will be archived & truncated.
INSERT INTO public.world_reset_preserve_list (table_name, reason) VALUES
  ('game_maintenance', 'system: maintenance state'),
  ('admin_audit_log', 'system: audit log'),
  ('world_reset_preserve_list', 'system: this preserve list'),
  ('user_roles', 'auth: user roles must persist'),
  ('game_calendar_config', 'config: calendar (reseeded, not wiped)'),
  ('season_genre_modifiers', 'catalog: seasonal modifiers'),
  ('cities', 'catalog: world cities'),
  ('districts', 'catalog: city districts'),
  ('venues', 'catalog: venue templates'),
  ('rehearsal_rooms', 'catalog: rehearsal rooms'),
  ('night_clubs', 'catalog: night clubs'),
  ('city_studios', 'catalog: recording studios'),
  ('travel_routes', 'catalog: travel network'),
  ('transport_schedules', 'catalog: transport schedules'),
  ('skill_definitions', 'catalog: skill tree'),
  ('skill_books', 'catalog: learning materials'),
  ('universities', 'catalog: education'),
  ('courses', 'catalog: education'),
  ('youtube_videos', 'catalog: education videos'),
  ('mentors', 'catalog: mentors'),
  ('achievements', 'catalog: achievement definitions'),
  ('experience_rewards', 'catalog: xp rewards'),
  ('gear_items', 'catalog: gear catalog'),
  ('gear_categories', 'catalog: gear categories'),
  ('brands', 'catalog: brands'),
  ('personal_gear', 'catalog: personal gear catalog'),
  ('stage_equipment_catalog', 'catalog: stage gear'),
  ('crew_catalog', 'catalog: crew presets'),
  ('stage_templates', 'catalog: stage templates'),
  ('band_avatars', 'catalog: avatar presets'),
  ('crowd_behavior', 'catalog: crowd behaviors'),
  ('crowd_sounds', 'catalog: crowd audio'),
  ('practice_tracks', 'catalog: stage practice audio'),
  ('production_notes', 'catalog: setlist elements'),
  ('radio_stations', 'catalog: radio network'),
  ('radio_content', 'catalog: jingles & adverts'),
  ('streaming_platforms', 'catalog: streaming platforms'),
  ('ticket_operators', 'catalog: ticket operators'),
  ('jobs', 'catalog: jobs list'),
  ('genres', 'catalog: genre taxonomy'),
  ('tutorials', 'catalog: tutorial steps'),
  ('random_events', 'catalog: random events'),
  ('pov_clips', 'catalog: POV clip library'),
  ('page_graphics', 'catalog: UI graphics'),
  ('skin_collections', 'catalog: cosmetics collections'),
  ('producers', 'catalog: producer presets'),
  ('contract_clauses', 'catalog: contract clauses'),
  ('eurovision_config', 'catalog: eurovision'),
  ('game_balance_config', 'config: balance tuning'),
  ('stream_multiplier_config', 'config: stream multipliers'),
  ('release_config', 'config: release tuning'),
  ('schema_migrations', 'system: migrations'),
  ('migrations', 'system: migrations')
ON CONFLICT (table_name) DO NOTHING;

-- 4) Enable maintenance mode
CREATE OR REPLACE FUNCTION public.admin_enable_maintenance(
  p_message TEXT,
  p_scheduled_at TIMESTAMPTZ
) RETURNS public.game_maintenance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_maintenance;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  UPDATE public.game_maintenance
    SET is_active = true,
        message = p_message,
        scheduled_reset_at = p_scheduled_at,
        initiated_by = auth.uid(),
        updated_at = now()
    WHERE id = 1
    RETURNING * INTO v_row;

  INSERT INTO public.admin_audit_log (actor_id, action, payload)
    VALUES (auth.uid(), 'maintenance.enable',
            jsonb_build_object('message', p_message, 'scheduled_at', p_scheduled_at));

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_enable_maintenance(TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_enable_maintenance(TEXT, TIMESTAMPTZ) TO authenticated;

-- 5) Disable maintenance mode
CREATE OR REPLACE FUNCTION public.admin_disable_maintenance()
RETURNS public.game_maintenance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_maintenance;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  UPDATE public.game_maintenance
    SET is_active = false,
        scheduled_reset_at = NULL,
        message = NULL,
        updated_at = now()
    WHERE id = 1
    RETURNING * INTO v_row;

  INSERT INTO public.admin_audit_log (actor_id, action, payload)
    VALUES (auth.uid(), 'maintenance.disable', '{}'::jsonb);

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_disable_maintenance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_disable_maintenance() TO authenticated;

-- 6) Preview which tables will be wiped vs preserved
CREATE OR REPLACE FUNCTION public.admin_world_reset_preview()
RETURNS TABLE(table_name TEXT, action TEXT, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT t.tablename::text,
         CASE WHEN p.table_name IS NOT NULL THEN 'preserve' ELSE 'wipe' END,
         COALESCE(p.reason, 'user-generated gameplay data')
  FROM pg_tables t
  LEFT JOIN public.world_reset_preserve_list p
    ON p.table_name = t.tablename
  WHERE t.schemaname = 'public'
  ORDER BY 2, 1;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_world_reset_preview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_world_reset_preview() TO authenticated;

-- 7) List existing reset archives
CREATE OR REPLACE FUNCTION public.admin_list_reset_archives()
RETURNS TABLE(schema_name TEXT, table_count BIGINT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT n.nspname::text,
         (SELECT count(*) FROM pg_tables WHERE schemaname = n.nspname),
         NULL::timestamptz
  FROM pg_namespace n
  WHERE n.nspname LIKE 'archive_reset_%'
  ORDER BY n.nspname DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_reset_archives() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_reset_archives() TO authenticated;

-- 8) The main world reset routine
CREATE OR REPLACE FUNCTION public.admin_world_reset(p_confirm TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_archive_schema TEXT;
  v_table RECORD;
  v_archive RECORD;
  v_wiped INT := 0;
  v_archived INT := 0;
  v_state public.game_maintenance;
  v_old_schemas TEXT[];
BEGIN
  -- Auth checks
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  IF p_confirm IS DISTINCT FROM 'RESET WORLD' THEN
    RAISE EXCEPTION 'confirmation phrase required (RESET WORLD)';
  END IF;

  SELECT * INTO v_state FROM public.game_maintenance WHERE id = 1;
  IF NOT v_state.is_active THEN
    RAISE EXCEPTION 'maintenance mode must be enabled before reset';
  END IF;
  IF v_state.scheduled_reset_at IS NULL OR v_state.scheduled_reset_at > now() THEN
    RAISE EXCEPTION 'scheduled reset time has not passed yet';
  END IF;

  -- Create archive schema
  v_archive_schema := 'archive_reset_' || to_char(now(), 'YYYYMMDD_HH24MISS');
  EXECUTE format('CREATE SCHEMA %I', v_archive_schema);

  -- Archive + truncate every public table that is not in the preserve list
  FOR v_table IN
    SELECT t.tablename
    FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND t.tablename NOT IN (SELECT table_name FROM public.world_reset_preserve_list)
    ORDER BY t.tablename
  LOOP
    BEGIN
      EXECUTE format('CREATE TABLE %I.%I AS TABLE public.%I',
                     v_archive_schema, v_table.tablename, v_table.tablename);
      v_archived := v_archived + 1;
    EXCEPTION WHEN OTHERS THEN
      -- continue archiving best-effort
      NULL;
    END;
  END LOOP;

  -- Truncate in one shot with CASCADE to handle FKs
  FOR v_table IN
    SELECT t.tablename
    FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND t.tablename NOT IN (SELECT table_name FROM public.world_reset_preserve_list)
  LOOP
    BEGIN
      EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', v_table.tablename);
      v_wiped := v_wiped + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Reseed calendar epoch (Jan 1 2026)
  UPDATE public.game_calendar_config
    SET is_active = false
    WHERE is_active = true;

  -- Drop archive schemas older than the last 3
  SELECT array_agg(nspname ORDER BY nspname DESC) INTO v_old_schemas
  FROM pg_namespace
  WHERE nspname LIKE 'archive_reset_%';

  IF v_old_schemas IS NOT NULL AND array_length(v_old_schemas, 1) > 3 THEN
    FOR i IN 4..array_length(v_old_schemas, 1) LOOP
      EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', v_old_schemas[i]);
    END LOOP;
  END IF;

  -- Audit log
  INSERT INTO public.admin_audit_log (actor_id, action, payload)
    VALUES (auth.uid(), 'world.reset',
            jsonb_build_object(
              'archive_schema', v_archive_schema,
              'tables_archived', v_archived,
              'tables_wiped', v_wiped
            ));

  -- Disable maintenance mode
  UPDATE public.game_maintenance
    SET is_active = false,
        scheduled_reset_at = NULL,
        message = NULL,
        updated_at = now()
    WHERE id = 1;

  RETURN jsonb_build_object(
    'success', true,
    'archive_schema', v_archive_schema,
    'tables_archived', v_archived,
    'tables_wiped', v_wiped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_world_reset(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_world_reset(TEXT) TO authenticated;

-- Updated-at trigger for game_maintenance
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_game_maintenance_touch ON public.game_maintenance;
CREATE TRIGGER trg_game_maintenance_touch
  BEFORE UPDATE ON public.game_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
