DO $$ BEGIN
  CREATE TYPE public.festival_performance_session_status AS ENUM ('scheduled','arrival_open','checked_in','soundcheck_pending','soundcheck_complete','ready','stage_call','in_progress','completed','partially_completed','cancelled','no_show','abandoned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.festival_readiness_band AS ENUM ('excellent','ready','strained','compromised','unfit','blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.festival_arrival_status AS ENUM ('expected','checked_in','late','absent','excused','replacement');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.festival_incident_severity AS ENUM ('info','warning','critical','blocking');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.festival_performance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.festival_contracts(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  stage_id uuid,
  stage_slot_id uuid REFERENCES public.festival_stage_slots(id) ON DELETE SET NULL,
  setlist_id uuid REFERENCES public.festival_contract_setlists(id) ON DELETE SET NULL,
  status public.festival_performance_session_status NOT NULL DEFAULT 'scheduled',
  scheduled_start_at timestamptz NOT NULL,
  scheduled_end_at timestamptz NOT NULL,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  stage_call_at timestamptz,
  arrival_deadline_at timestamptz NOT NULL,
  arrival_window_opens_at timestamptz NOT NULL,
  soundcheck_start_at timestamptz,
  soundcheck_end_at timestamptz,
  readiness_locked_at timestamptz,
  started_by_profile_id uuid REFERENCES public.profiles(id),
  completed_by_profile_id uuid REFERENCES public.profiles(id),
  session_version integer NOT NULL DEFAULT 1,
  current_setlist_position integer NOT NULL DEFAULT 0,
  active_song_position integer,
  readiness_snapshot jsonb NOT NULL DEFAULT '{}',
  attendance_snapshot jsonb NOT NULL DEFAULT '{}',
  equipment_snapshot jsonb NOT NULL DEFAULT '{}',
  crew_snapshot jsonb NOT NULL DEFAULT '{}',
  health_snapshot jsonb NOT NULL DEFAULT '{}',
  setlist_snapshot jsonb NOT NULL DEFAULT '{}',
  technical_snapshot jsonb NOT NULL DEFAULT '{}',
  incident_snapshot jsonb NOT NULL DEFAULT '{}',
  performance_evidence jsonb NOT NULL DEFAULT '{}',
  outcome_status text NOT NULL DEFAULT 'pending_settlement',
  cancellation_evidence jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contract_id)
);

CREATE TABLE IF NOT EXISTS public.festival_performance_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.festival_performance_sessions(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id),
  band_member_id uuid,
  guest_profile_id uuid REFERENCES public.profiles(id),
  expected_role text NOT NULL DEFAULT 'performer',
  required_attendance boolean NOT NULL DEFAULT true,
  arrival_status public.festival_arrival_status NOT NULL DEFAULT 'expected',
  checked_in_at timestamptz,
  late_minutes integer NOT NULL DEFAULT 0,
  absence_reason text,
  replacement_status text NOT NULL DEFAULT 'none',
  participation_status text NOT NULL DEFAULT 'expected',
  checked_in_source text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.festival_session_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.festival_performance_sessions(id) ON DELETE CASCADE,
  required_item text NOT NULL,
  supplied_by text NOT NULL DEFAULT 'band',
  assigned_profile_id uuid REFERENCES public.profiles(id),
  condition text,
  availability text NOT NULL DEFAULT 'unknown',
  compatibility text NOT NULL DEFAULT 'unchecked',
  readiness public.festival_readiness_band NOT NULL DEFAULT 'blocked',
  issue_reason text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.festival_session_crew (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.festival_performance_sessions(id) ON DELETE CASCADE,
  required_role text NOT NULL,
  assigned_entity_id uuid,
  assigned_entity_type text,
  skill integer,
  attendance text NOT NULL DEFAULT 'unknown',
  readiness public.festival_readiness_band NOT NULL DEFAULT 'strained',
  workload_conflict text,
  supplied_by text NOT NULL DEFAULT 'festival',
  issue_reason text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.festival_performance_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.festival_performance_sessions(id) ON DELETE CASCADE,
  category text NOT NULL,
  severity public.festival_incident_severity NOT NULL DEFAULT 'warning',
  source text NOT NULL DEFAULT 'manual',
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution text,
  impact jsonb NOT NULL DEFAULT '{}',
  responsible_party text,
  session_state_effect text,
  actor_profile_id uuid REFERENCES public.profiles(id),
  random_seed text,
  stored_outcome jsonb NOT NULL DEFAULT '{}',
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.festival_performance_session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.festival_performance_sessions(id) ON DELETE CASCADE,
  actor_profile_id uuid REFERENCES public.profiles(id),
  event_type text NOT NULL,
  event_time timestamptz NOT NULL DEFAULT now(),
  setlist_position integer,
  metadata jsonb NOT NULL DEFAULT '{}',
  idempotency_key text,
  source text NOT NULL DEFAULT 'server',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, event_type, idempotency_key)
);

GRANT SELECT ON public.festival_performance_sessions, public.festival_performance_attendance, public.festival_session_equipment, public.festival_session_crew, public.festival_performance_incidents, public.festival_performance_session_events TO authenticated;
GRANT ALL ON public.festival_performance_sessions, public.festival_performance_attendance, public.festival_session_equipment, public.festival_session_crew, public.festival_performance_incidents, public.festival_performance_session_events TO service_role;

ALTER TABLE public.festival_performance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_performance_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_session_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_session_crew ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_performance_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_performance_session_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY fps_read ON public.festival_performance_sessions FOR SELECT TO authenticated USING (public.is_active_band_member(band_id) OR public.can_manage_festival_brand(festival_id));
CREATE POLICY fpa_read ON public.festival_performance_attendance FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.festival_performance_sessions s WHERE s.id=session_id AND (public.is_active_band_member(s.band_id) OR public.can_manage_festival_brand(s.festival_id))));
CREATE POLICY fse_read ON public.festival_session_equipment FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.festival_performance_sessions s WHERE s.id=session_id AND (public.is_active_band_member(s.band_id) OR public.can_manage_festival_brand(s.festival_id))));
CREATE POLICY fsc_read ON public.festival_session_crew FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.festival_performance_sessions s WHERE s.id=session_id AND (public.is_active_band_member(s.band_id) OR public.can_manage_festival_brand(s.festival_id))));
CREATE POLICY fpi_read ON public.festival_performance_incidents FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.festival_performance_sessions s WHERE s.id=session_id AND (public.is_active_band_member(s.band_id) OR public.can_manage_festival_brand(s.festival_id))));
CREATE POLICY fpe_read ON public.festival_performance_session_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.festival_performance_sessions s WHERE s.id=session_id AND (public.is_active_band_member(s.band_id) OR public.can_manage_festival_brand(s.festival_id))));

CREATE INDEX IF NOT EXISTS idx_fps_edition_status ON public.festival_performance_sessions(edition_id,status,scheduled_start_at);
CREATE INDEX IF NOT EXISTS idx_fps_band ON public.festival_performance_sessions(band_id,scheduled_start_at);
CREATE INDEX IF NOT EXISTS idx_fps_stage ON public.festival_performance_sessions(stage_id,scheduled_start_at);
CREATE INDEX IF NOT EXISTS idx_fpa_session ON public.festival_performance_attendance(session_id,arrival_status);
CREATE INDEX IF NOT EXISTS idx_fpsi_session ON public.festival_performance_incidents(session_id,severity,resolved_at);
CREATE INDEX IF NOT EXISTS idx_fpse_session ON public.festival_performance_session_events(session_id,event_time);

CREATE OR REPLACE FUNCTION public.festival_session_can_transition(p_from text, p_to text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT (p_from,p_to) IN (VALUES
    ('scheduled','arrival_open'),('arrival_open','checked_in'),('checked_in','soundcheck_pending'),('arrival_open','soundcheck_pending'),
    ('soundcheck_pending','soundcheck_complete'),('soundcheck_complete','ready'),('checked_in','ready'),('ready','stage_call'),
    ('stage_call','in_progress'),('ready','in_progress'),('in_progress','completed'),('in_progress','partially_completed'),('in_progress','abandoned'),
    ('scheduled','cancelled'),('arrival_open','cancelled'),('checked_in','cancelled'),('soundcheck_pending','cancelled'),('soundcheck_complete','cancelled'),('ready','cancelled'),('stage_call','cancelled'),
    ('scheduled','no_show'),('arrival_open','no_show'),('stage_call','no_show')
  );
$$;

CREATE OR REPLACE FUNCTION public.festival_session_timing(p_start timestamptz, p_end timestamptz)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT jsonb_build_object(
    'arrival_window_opens_at', p_start - interval '6 hours', 'arrival_deadline_at', p_start - interval '45 minutes',
    'soundcheck_start_at', p_start - interval '90 minutes', 'stage_call_at', p_start - interval '15 minutes',
    'late_after_minutes', 0, 'start_tolerance_minutes', 20, 'no_show_after_minutes', 15,
    'scheduled_duration_minutes', greatest(1, extract(epoch FROM (p_end-p_start))/60)::integer
  );
$$;

CREATE OR REPLACE FUNCTION public.festival_setlist_snapshot(p_setlist_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT jsonb_build_object('setlist_id', sl.id, 'status', sl.status, 'version', sl.version, 'total_duration_seconds', sl.total_duration_seconds,
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('position', i.position, 'song_id', i.song_id, 'planned_duration_seconds', i.planned_duration_seconds, 'transition_notes', i.transition_notes, 'is_encore', i.is_encore, 'performance_notes', i.performance_notes) ORDER BY i.position) FROM public.festival_contract_setlist_items i WHERE i.setlist_id=sl.id), '[]'::jsonb))
  FROM public.festival_contract_setlists sl WHERE sl.id=p_setlist_id;
$$;

CREATE OR REPLACE FUNCTION public.ensure_festival_performance_session(p_contract_id uuid, p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_performance_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.festival_contracts%ROWTYPE; ss public.festival_stage_slots%ROWTYPE; sl public.festival_contract_setlists%ROWTYPE; s public.festival_performance_sessions%ROWTYPE; timing jsonb; actor uuid:=public.current_profile_id_safe();
BEGIN
  SELECT * INTO c FROM public.festival_contracts WHERE id=p_contract_id FOR UPDATE;
  IF NOT FOUND OR c.status <> 'active' THEN RAISE EXCEPTION 'Active festival contract required'; END IF;
  IF NOT (public.is_active_band_member(c.band_id) OR public.can_manage_festival_brand(c.festival_id)) THEN RAISE EXCEPTION 'Not authorised to create performance session'; END IF;
  SELECT * INTO s FROM public.festival_performance_sessions WHERE contract_id=c.id;
  IF FOUND THEN RETURN s; END IF;
  SELECT * INTO ss FROM public.festival_stage_slots WHERE id=c.stage_slot_id FOR UPDATE;
  IF NOT FOUND OR ss.status <> 'confirmed' OR ss.canonical_contract_id <> c.id THEN RAISE EXCEPTION 'Confirmed stage reservation required'; END IF;
  SELECT * INTO sl FROM public.festival_contract_setlists WHERE contract_id=c.id AND status IN ('locked','approved') ORDER BY CASE WHEN status='locked' THEN 0 ELSE 1 END, version DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approved or locked setlist required'; END IF;
  IF sl.status='approved' THEN UPDATE public.festival_contract_setlists SET status='locked', locked_at=now() WHERE id=sl.id RETURNING * INTO sl; END IF;
  timing:=public.festival_session_timing(COALESCE((c.terms_snapshot->>'proposed_start_at')::timestamptz, ss.start_time), COALESCE((c.terms_snapshot->>'proposed_end_at')::timestamptz, ss.end_time));
  IF COALESCE((c.terms_snapshot->>'proposed_start_at')::timestamptz, ss.start_time) IS NULL OR COALESCE((c.terms_snapshot->>'proposed_end_at')::timestamptz, ss.end_time) IS NULL THEN RAISE EXCEPTION 'Schedule block required'; END IF;
  INSERT INTO public.festival_performance_sessions(edition_id,festival_id,contract_id,band_id,stage_id,stage_slot_id,setlist_id,scheduled_start_at,scheduled_end_at,arrival_window_opens_at,arrival_deadline_at,soundcheck_start_at,stage_call_at,setlist_snapshot)
  VALUES(c.edition_id,c.festival_id,c.id,c.band_id,ss.stage_id,ss.id,sl.id,COALESCE((c.terms_snapshot->>'proposed_start_at')::timestamptz, ss.start_time),COALESCE((c.terms_snapshot->>'proposed_end_at')::timestamptz, ss.end_time),(timing->>'arrival_window_opens_at')::timestamptz,(timing->>'arrival_deadline_at')::timestamptz,(timing->>'soundcheck_start_at')::timestamptz,(timing->>'stage_call_at')::timestamptz,public.festival_setlist_snapshot(sl.id)) RETURNING * INTO s;
  INSERT INTO public.festival_performance_session_events(session_id,actor_profile_id,event_type,idempotency_key,metadata) VALUES(s.id,actor,'session_created',p_idempotency_key,jsonb_build_object('contract_id',c.id));
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.festival_snapshot_expected_performers(p_session_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.festival_performance_sessions%ROWTYPE; inserted integer:=0;
BEGIN
 SELECT * INTO s FROM public.festival_performance_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
 INSERT INTO public.festival_performance_attendance(session_id,profile_id,band_member_id,expected_role,required_attendance,metadata)
 SELECT s.id, COALESCE(bm.profile_id, (SELECT p.id FROM public.profiles p WHERE p.user_id=bm.user_id LIMIT 1)), bm.id, COALESCE(bm.role,'performer'), true, jsonb_build_object('snapshot_source','band_members')
 FROM public.band_members bm WHERE bm.band_id=s.band_id AND COALESCE(bm.member_status,'active')='active'
 ON CONFLICT (session_id, profile_id) DO NOTHING;
 GET DIAGNOSTICS inserted = ROW_COUNT;
 RETURN inserted;
END $$;

CREATE OR REPLACE FUNCTION public.check_in_festival_performer(p_session_id uuid, p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.festival_performance_sessions%ROWTYPE; a public.festival_performance_attendance%ROWTYPE; actor uuid:=public.current_profile_id_safe(); late integer; blockers text[]:=ARRAY[]::text[]; warnings text[]:=ARRAY[]::text[];
BEGIN
 SELECT * INTO s FROM public.festival_performance_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
 IF NOT public.festival_session_can_transition(s.status::text,'arrival_open') AND s.status='scheduled' THEN UPDATE public.festival_performance_sessions SET status='arrival_open',updated_at=now(),session_version=session_version+1 WHERE id=s.id RETURNING * INTO s; END IF;
 PERFORM public.festival_snapshot_expected_performers(s.id);
 SELECT * INTO a FROM public.festival_performance_attendance WHERE session_id=s.id AND profile_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Not an expected performer for this session'; END IF;
 IF a.checked_in_at IS NOT NULL THEN RETURN jsonb_build_object('status',a.arrival_status,'late_minutes',a.late_minutes,'readiness_impact','unchanged','blockers',blockers,'warnings',warnings,'idempotent',true); END IF;
 IF now() < s.arrival_window_opens_at THEN blockers:=array_append(blockers,'Arrival window is not open'); END IF;
 late:=greatest(0, floor(extract(epoch FROM (now()-s.arrival_deadline_at))/60)::integer);
 IF late>0 THEN warnings:=array_append(warnings,'Performer checked in after the arrival deadline'); END IF;
 UPDATE public.festival_performance_attendance SET checked_in_at=now(), arrival_status=CASE WHEN late>0 THEN 'late'::public.festival_arrival_status ELSE 'checked_in'::public.festival_arrival_status END, late_minutes=late, checked_in_source='self', updated_at=now() WHERE id=a.id RETURNING * INTO a;
 INSERT INTO public.festival_performance_session_events(session_id,actor_profile_id,event_type,idempotency_key,metadata) VALUES(s.id,actor,'performer_checked_in',p_idempotency_key,jsonb_build_object('late_minutes',late)) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('status',a.arrival_status,'late_minutes',late,'readiness_impact',CASE WHEN late>0 THEN 'warning' ELSE 'positive' END,'blockers',blockers,'warnings',warnings,'idempotent',false);
END $$;

CREATE OR REPLACE FUNCTION public.festival_session_arrival_status(p_session_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('expected_performers',count(*),'arrived_performers',count(*) FILTER (WHERE checked_in_at IS NOT NULL),'missing_performers',count(*) FILTER (WHERE checked_in_at IS NULL AND required_attendance),'late_performers',count(*) FILTER (WHERE late_minutes>0),'required_roles_present',COALESCE(jsonb_agg(DISTINCT expected_role) FILTER (WHERE checked_in_at IS NOT NULL AND required_attendance),'[]'::jsonb),'optional_guests_present',count(*) FILTER (WHERE NOT required_attendance AND checked_in_at IS NOT NULL),'arrival_readiness',CASE WHEN count(*) FILTER (WHERE checked_in_at IS NULL AND required_attendance)>0 THEN 'blocked' ELSE 'ready' END,'next_deadline',(SELECT arrival_deadline_at FROM public.festival_performance_sessions WHERE id=p_session_id),'allowed_actions',jsonb_build_array('check_in')) FROM public.festival_performance_attendance WHERE session_id=p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.festival_equipment_preflight(p_session_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('required_equipment',COALESCE(jsonb_agg(to_jsonb(e)),'[]'::jsonb),'available_equipment',COALESCE(jsonb_agg(to_jsonb(e)) FILTER (WHERE availability='available'),'[]'::jsonb),'missing_items',COALESCE(jsonb_agg(required_item) FILTER (WHERE readiness IN ('blocked','unfit') OR availability='missing'),'[]'::jsonb),'damaged_items',COALESCE(jsonb_agg(required_item) FILTER (WHERE condition IN ('damaged','broken')),'[]'::jsonb),'festival_supplied_items',COALESCE(jsonb_agg(required_item) FILTER (WHERE supplied_by='festival'),'[]'::jsonb),'incompatible_rider_items',COALESCE(jsonb_agg(required_item) FILTER (WHERE compatibility='incompatible'),'[]'::jsonb),'blockers',COALESCE(jsonb_agg(issue_reason) FILTER (WHERE readiness='blocked' AND issue_reason IS NOT NULL),'[]'::jsonb),'warnings',COALESCE(jsonb_agg(issue_reason) FILTER (WHERE readiness IN ('strained','compromised') AND issue_reason IS NOT NULL),'[]'::jsonb),'possible_remedial_actions',jsonb_build_array('use_festival_backline','rent_replacement','assign_compatible_item','accept_reduced_readiness')) FROM public.festival_session_equipment e WHERE session_id=p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.festival_crew_preflight(p_session_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('crew',COALESCE(jsonb_agg(to_jsonb(c)),'[]'::jsonb),'blockers',COALESCE(jsonb_agg(issue_reason) FILTER (WHERE readiness='blocked'),'[]'::jsonb),'warnings',COALESCE(jsonb_agg(issue_reason) FILTER (WHERE readiness IN ('strained','compromised')),'[]'::jsonb),'suggested_remedies',jsonb_build_array('assign_festival_staff','hire_contractor','accept_reduced_readiness')) FROM public.festival_session_crew c WHERE session_id=p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.festival_session_readiness(p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE arrival jsonb; equip jsonb; crew jsonb; critical integer; overall text:='ready';
BEGIN
 arrival:=public.festival_session_arrival_status(p_session_id); equip:=public.festival_equipment_preflight(p_session_id); crew:=public.festival_crew_preflight(p_session_id);
 SELECT count(*) INTO critical FROM public.festival_performance_incidents WHERE session_id=p_session_id AND severity IN ('critical','blocking') AND resolved_at IS NULL;
 IF (arrival->>'arrival_readiness')='blocked' OR jsonb_array_length(equip->'blockers')>0 OR jsonb_array_length(crew->'blockers')>0 OR critical>0 THEN overall:='blocked'; END IF;
 RETURN jsonb_build_object('attendance',arrival,'arrival',arrival,'health',jsonb_build_object('status','ready','blockers','[]'::jsonb,'warnings','[]'::jsonb),'equipment',equip,'crew',crew,'technical',jsonb_build_object('status',CASE WHEN critical>0 THEN 'blocked' ELSE 'ready' END,'unresolved_critical_incidents',critical),'soundcheck',jsonb_build_object('status',(SELECT status FROM public.festival_performance_sessions WHERE id=p_session_id)),'setlist',jsonb_build_object('status',CASE WHEN (SELECT setlist_snapshot FROM public.festival_performance_sessions WHERE id=p_session_id) <> '{}'::jsonb THEN 'ready' ELSE 'blocked' END),'schedule',jsonb_build_object('status','ready'),'overall',jsonb_build_object('status',overall,'last_calculated_at',now()));
END $$;

CREATE OR REPLACE FUNCTION public.lock_festival_session_readiness(p_session_id uuid, p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.festival_performance_sessions%ROWTYPE; r jsonb; actor uuid:=public.current_profile_id_safe();
BEGIN
 SELECT * INTO s FROM public.festival_performance_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT (public.can_manage_festival_brand(s.festival_id) OR public.is_active_band_member(s.band_id)) THEN RAISE EXCEPTION 'Not authorised to lock readiness'; END IF;
 IF s.readiness_locked_at IS NOT NULL THEN RETURN s.readiness_snapshot; END IF;
 PERFORM public.festival_snapshot_expected_performers(s.id); r:=public.festival_session_readiness(s.id);
 UPDATE public.festival_performance_sessions SET readiness_locked_at=now(), readiness_snapshot=r, attendance_snapshot=public.festival_session_arrival_status(s.id), equipment_snapshot=public.festival_equipment_preflight(s.id), crew_snapshot=public.festival_crew_preflight(s.id), incident_snapshot=(SELECT COALESCE(jsonb_agg(to_jsonb(i)),'[]'::jsonb) FROM public.festival_performance_incidents i WHERE i.session_id=s.id), status=CASE WHEN r#>>'{overall,status}'='blocked' THEN status ELSE 'ready'::public.festival_performance_session_status END, updated_at=now(), session_version=session_version+1 WHERE id=s.id RETURNING * INTO s;
 INSERT INTO public.festival_performance_session_events(session_id,actor_profile_id,event_type,idempotency_key,metadata) VALUES(s.id,actor,'readiness_locked',p_idempotency_key,r) ON CONFLICT DO NOTHING;
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.begin_festival_soundcheck(p_session_id uuid, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_performance_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.festival_performance_sessions%ROWTYPE; BEGIN SELECT * INTO s FROM public.festival_performance_sessions WHERE id=p_session_id FOR UPDATE; IF NOT (public.can_manage_festival_brand(s.festival_id) OR public.is_active_band_member(s.band_id)) THEN RAISE EXCEPTION 'Not authorised'; END IF; UPDATE public.festival_performance_sessions SET status='soundcheck_pending',soundcheck_start_at=COALESCE(soundcheck_start_at,now()),updated_at=now(),session_version=session_version+1 WHERE id=s.id RETURNING * INTO s; INSERT INTO public.festival_performance_session_events(session_id,event_type,idempotency_key) VALUES(s.id,'soundcheck_started',p_idempotency_key) ON CONFLICT DO NOTHING; RETURN s; END $$;
CREATE OR REPLACE FUNCTION public.record_festival_soundcheck_issue(p_session_id uuid, p_category text, p_severity text, p_notes text, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_performance_incidents LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE i public.festival_performance_incidents%ROWTYPE; BEGIN INSERT INTO public.festival_performance_incidents(session_id,category,severity,source,impact,actor_profile_id,idempotency_key) VALUES(p_session_id,p_category,p_severity::public.festival_incident_severity,'soundcheck',jsonb_build_object('notes',p_notes),public.current_profile_id_safe(),p_idempotency_key) ON CONFLICT (session_id,idempotency_key) DO UPDATE SET category=EXCLUDED.category RETURNING * INTO i; INSERT INTO public.festival_performance_session_events(session_id,event_type,idempotency_key,metadata) VALUES(p_session_id,'issue_recorded',p_idempotency_key,to_jsonb(i)) ON CONFLICT DO NOTHING; RETURN i; END $$;
CREATE OR REPLACE FUNCTION public.resolve_festival_soundcheck_issue(p_incident_id uuid, p_resolution text, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_performance_incidents LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE i public.festival_performance_incidents%ROWTYPE; BEGIN UPDATE public.festival_performance_incidents SET resolved_at=now(), resolution=p_resolution WHERE id=p_incident_id RETURNING * INTO i; INSERT INTO public.festival_performance_session_events(session_id,event_type,idempotency_key,metadata) VALUES(i.session_id,'issue_resolved',p_idempotency_key,to_jsonb(i)) ON CONFLICT DO NOTHING; RETURN i; END $$;
CREATE OR REPLACE FUNCTION public.complete_festival_soundcheck(p_session_id uuid, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_performance_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.festival_performance_sessions%ROWTYPE; unresolved integer; BEGIN SELECT count(*) INTO unresolved FROM public.festival_performance_incidents WHERE session_id=p_session_id AND severity IN ('critical','blocking') AND resolved_at IS NULL; IF unresolved>0 THEN RAISE EXCEPTION 'Unresolved critical soundcheck issue'; END IF; UPDATE public.festival_performance_sessions SET status='soundcheck_complete',soundcheck_end_at=now(),technical_snapshot=jsonb_build_object('soundcheck','complete','completed_at',now()),updated_at=now(),session_version=session_version+1 WHERE id=p_session_id RETURNING * INTO s; INSERT INTO public.festival_performance_session_events(session_id,event_type,idempotency_key) VALUES(s.id,'soundcheck_completed',p_idempotency_key) ON CONFLICT DO NOTHING; RETURN s; END $$;

CREATE OR REPLACE FUNCTION public.call_festival_band_to_stage(p_session_id uuid, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_performance_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.festival_performance_sessions%ROWTYPE; BEGIN SELECT * INTO s FROM public.festival_performance_sessions WHERE id=p_session_id FOR UPDATE; IF s.readiness_locked_at IS NULL THEN RAISE EXCEPTION 'Readiness must be locked before stage call'; END IF; IF NOT (public.can_manage_festival_brand(s.festival_id) OR public.is_active_band_member(s.band_id)) THEN RAISE EXCEPTION 'Not authorised'; END IF; UPDATE public.festival_performance_sessions SET status='stage_call',updated_at=now(),session_version=session_version+1 WHERE id=s.id RETURNING * INTO s; INSERT INTO public.festival_performance_session_events(session_id,event_type,idempotency_key) VALUES(s.id,'stage_call',p_idempotency_key) ON CONFLICT DO NOTHING; RETURN s; END $$;
CREATE OR REPLACE FUNCTION public.start_festival_performance(p_session_id uuid, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_performance_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.festival_performance_sessions%ROWTYPE; BEGIN SELECT * INTO s FROM public.festival_performance_sessions WHERE id=p_session_id FOR UPDATE; IF s.status='in_progress' THEN RETURN s; END IF; IF s.status NOT IN ('stage_call','ready') THEN RAISE EXCEPTION 'Performance must be at stage call or ready'; END IF; IF EXISTS (SELECT 1 FROM public.festival_performance_sessions x WHERE x.stage_id=s.stage_id AND x.id<>s.id AND x.status='in_progress') THEN RAISE EXCEPTION 'Stage already has an active performance'; END IF; UPDATE public.festival_performance_sessions SET status='in_progress',actual_start_at=now(),started_by_profile_id=public.current_profile_id_safe(),updated_at=now(),session_version=session_version+1,performance_evidence=performance_evidence||jsonb_build_object('settlement_status','pending','no_rewards_awarded',true) WHERE id=s.id RETURNING * INTO s; INSERT INTO public.festival_performance_session_events(session_id,actor_profile_id,event_type,idempotency_key) VALUES(s.id,public.current_profile_id_safe(),'performance_started',p_idempotency_key) ON CONFLICT DO NOTHING; RETURN s; END $$;

CREATE OR REPLACE FUNCTION public.advance_festival_performance(p_session_id uuid, p_expected_position integer, p_action text, p_metadata jsonb DEFAULT '{}', p_idempotency_key text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.festival_performance_sessions%ROWTYPE; total integer; nextpos integer;
BEGIN
 SELECT * INTO s FROM public.festival_performance_sessions WHERE id=p_session_id FOR UPDATE;
 IF s.status<>'in_progress' THEN RAISE EXCEPTION 'Performance is not in progress'; END IF;
 IF s.current_setlist_position<>p_expected_position THEN RAISE EXCEPTION 'Stale setlist position'; END IF;
 total:=COALESCE(jsonb_array_length(s.setlist_snapshot->'items'),0);
 IF p_action NOT IN ('start_song','complete_song','skip_song','start_encore','end_encore','curtail_remaining_set') THEN RAISE EXCEPTION 'Unsupported performance action'; END IF;
 nextpos:=CASE WHEN p_action IN ('complete_song','skip_song') THEN LEAST(total,p_expected_position+1) WHEN p_action='curtail_remaining_set' THEN total ELSE p_expected_position END;
 UPDATE public.festival_performance_sessions SET current_setlist_position=nextpos, active_song_position=CASE WHEN p_action='start_song' THEN p_expected_position+1 ELSE NULL END, performance_evidence=jsonb_set(performance_evidence, ARRAY['progression'], COALESCE(performance_evidence->'progression','[]'::jsonb)||jsonb_build_array(jsonb_build_object('action',p_action,'position',p_expected_position,'metadata',p_metadata,'recorded_at',now())), true), updated_at=now(), session_version=session_version+1 WHERE id=s.id RETURNING * INTO s;
 INSERT INTO public.festival_performance_session_events(session_id,actor_profile_id,event_type,setlist_position,metadata,idempotency_key) VALUES(s.id,public.current_profile_id_safe(),replace(p_action,'_','-'),p_expected_position,p_metadata,p_idempotency_key) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('position',s.current_setlist_position,'total',total,'action',p_action,'evidence',s.performance_evidence->'progression');
END $$;

CREATE OR REPLACE FUNCTION public.cancel_festival_performance_session(p_session_id uuid, p_reason text, p_cancel_status text DEFAULT 'cancelled', p_idempotency_key text DEFAULT NULL) RETURNS public.festival_performance_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.festival_performance_sessions%ROWTYPE; BEGIN IF nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Cancellation reason required'; END IF; SELECT * INTO s FROM public.festival_performance_sessions WHERE id=p_session_id FOR UPDATE; IF s.status='in_progress' AND p_cancel_status='cancelled' THEN p_cancel_status:='abandoned'; END IF; UPDATE public.festival_performance_sessions SET status=p_cancel_status::public.festival_performance_session_status, actual_end_at=CASE WHEN p_cancel_status IN ('abandoned','no_show','cancelled') THEN now() ELSE actual_end_at END, cancellation_evidence=jsonb_build_object('reason',p_reason,'actor_profile_id',public.current_profile_id_safe(),'timing',now(),'future_settlement_flag',true), outcome_status='settlement_pending', updated_at=now(),session_version=session_version+1 WHERE id=s.id RETURNING * INTO s; INSERT INTO public.festival_performance_session_events(session_id,event_type,idempotency_key,metadata) VALUES(s.id,p_cancel_status,p_idempotency_key,s.cancellation_evidence) ON CONFLICT DO NOTHING; RETURN s; END $$;
CREATE OR REPLACE FUNCTION public.complete_festival_performance(p_session_id uuid, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_performance_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.festival_performance_sessions%ROWTYPE; total integer; final_status public.festival_performance_session_status; BEGIN SELECT * INTO s FROM public.festival_performance_sessions WHERE id=p_session_id FOR UPDATE; IF s.status<>'in_progress' THEN RAISE EXCEPTION 'Performance is not in progress'; END IF; total:=COALESCE(jsonb_array_length(s.setlist_snapshot->'items'),0); IF s.current_setlist_position < total THEN RAISE EXCEPTION 'Completion requires valid progression'; END IF; final_status:=CASE WHEN total=0 THEN 'partially_completed' ELSE 'completed' END; UPDATE public.festival_performance_sessions SET status=final_status,actual_end_at=now(),completed_by_profile_id=public.current_profile_id_safe(),outcome_status='settlement_pending',performance_evidence=performance_evidence||jsonb_build_object('completed_at',now(),'settlement_pending',true,'no_money_or_fame_awarded',true),updated_at=now(),session_version=session_version+1 WHERE id=s.id RETURNING * INTO s; INSERT INTO public.festival_performance_session_events(session_id,event_type,idempotency_key,metadata) VALUES(s.id,'performance_completed',p_idempotency_key,s.performance_evidence) ON CONFLICT DO NOTHING; RETURN s; END $$;

CREATE OR REPLACE FUNCTION public.public_festival_performance_sessions(p_edition_id uuid DEFAULT NULL)
RETURNS TABLE(session_id uuid, festival_id uuid, edition_id uuid, band_id uuid, stage_id uuid, scheduled_start_at timestamptz, scheduled_end_at timestamptz, actual_start_at timestamptz, actual_end_at timestamptz, public_status text, current_safe_progress jsonb, completed_song_count integer, total_planned_song_count integer, headline boolean, public_incident_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT s.id,s.festival_id,s.edition_id,s.band_id,s.stage_id,s.scheduled_start_at,s.scheduled_end_at,s.actual_start_at,s.actual_end_at,s.status::text,jsonb_build_object('current_position',s.current_setlist_position,'active_song_position',s.active_song_position),s.current_setlist_position,COALESCE(jsonb_array_length(s.setlist_snapshot->'items'),0),COALESCE((c.terms_snapshot->>'headline')::boolean,false),CASE WHEN EXISTS (SELECT 1 FROM public.festival_performance_incidents i WHERE i.session_id=s.id AND i.severity IN ('critical','blocking') AND i.resolved_at IS NULL) THEN 'major_issue' ELSE 'normal' END FROM public.festival_performance_sessions s JOIN public.festival_contracts c ON c.id=s.contract_id WHERE p_edition_id IS NULL OR s.edition_id=p_edition_id;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_festival_performance_session(uuid,text), public.check_in_festival_performer(uuid,text), public.festival_session_arrival_status(uuid), public.festival_equipment_preflight(uuid), public.festival_crew_preflight(uuid), public.festival_session_readiness(uuid), public.lock_festival_session_readiness(uuid,text), public.begin_festival_soundcheck(uuid,text), public.record_festival_soundcheck_issue(uuid,text,text,text,text), public.resolve_festival_soundcheck_issue(uuid,text,text), public.complete_festival_soundcheck(uuid,text), public.call_festival_band_to_stage(uuid,text), public.start_festival_performance(uuid,text), public.advance_festival_performance(uuid,integer,text,jsonb,text), public.cancel_festival_performance_session(uuid,text,text,text), public.complete_festival_performance(uuid,text), public.public_festival_performance_sessions(uuid), public.festival_session_can_transition(text,text) TO authenticated;