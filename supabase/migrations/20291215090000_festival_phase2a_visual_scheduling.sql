-- Phase 2A festival visual scheduling: revisioned schedule model and RPC projections.
ALTER TABLE IF EXISTS public.festival_editions ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'UTC';
ALTER TABLE IF EXISTS public.festival_stages ADD COLUMN IF NOT EXISTS public_name text;
DO $$ BEGIN
  CREATE TYPE public.festival_schedule_revision_state AS ENUM ('draft','ready_for_review','published','locked','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.festival_schedule_item_type AS ENUM ('performance_slot','changeover','soundcheck','host_compere','dj_intermission','opening_ceremony','closing_ceremony','reserved_emergency_buffer','stage_closed','technical_maintenance','curfew_boundary');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.festival_schedule_conflict_severity AS ENUM ('information','warning','error','publication_blocker');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.festival_schedule_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  revision_number integer NOT NULL,
  state public.festival_schedule_revision_state NOT NULL DEFAULT 'draft',
  source_revision_id uuid REFERENCES public.festival_schedule_revisions(id) ON DELETE SET NULL,
  notes text,
  version integer NOT NULL DEFAULT 1,
  created_by_profile_id uuid REFERENCES public.profiles(id),
  published_by_profile_id uuid REFERENCES public.profiles(id),
  locked_by_profile_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  locked_at timestamptz,
  archived_at timestamptz,
  UNIQUE (edition_id, revision_number)
);
CREATE UNIQUE INDEX IF NOT EXISTS festival_schedule_one_draft_idx ON public.festival_schedule_revisions(edition_id) WHERE state IN ('draft','ready_for_review');
CREATE UNIQUE INDEX IF NOT EXISTS festival_schedule_one_published_idx ON public.festival_schedule_revisions(edition_id) WHERE state='published';

CREATE TABLE IF NOT EXISTS public.festival_stage_operating_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.festival_stages(id) ON DELETE CASCADE,
  festival_date date NOT NULL,
  opens_at timestamptz NOT NULL,
  curfew_at timestamptz NOT NULL,
  closure_periods jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_changeover_minutes integer NOT NULL DEFAULT 30 CHECK (default_changeover_minutes >= 0),
  soundcheck_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  shutdown_buffer_minutes integer NOT NULL DEFAULT 0 CHECK (shutdown_buffer_minutes >= 0),
  public_operating_label text,
  created_by_profile_id uuid REFERENCES public.profiles(id),
  updated_by_profile_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (curfew_at > opens_at),
  UNIQUE(stage_id, festival_date)
);

CREATE TABLE IF NOT EXISTS public.festival_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL REFERENCES public.festival_schedule_revisions(id) ON DELETE CASCADE,
  festival_id uuid NOT NULL REFERENCES public.festivals(id) ON DELETE CASCADE,
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.festival_stages(id) ON DELETE SET NULL,
  festival_date date,
  item_type public.festival_schedule_item_type NOT NULL DEFAULT 'performance_slot',
  stage_slot_id uuid REFERENCES public.festival_stage_slots(id) ON DELETE SET NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  band_id uuid REFERENCES public.bands(id) ON DELETE SET NULL,
  application_id uuid REFERENCES public.festival_applications(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.festival_contracts(id) ON DELETE SET NULL,
  requires_soundcheck boolean NOT NULL DEFAULT false,
  soundcheck_starts_at timestamptz,
  soundcheck_ends_at timestamptz,
  changeover_minutes integer NOT NULL DEFAULT 0 CHECK (changeover_minutes >= 0),
  locked boolean NOT NULL DEFAULT false,
  public_visible boolean NOT NULL DEFAULT false,
  internal_notes text,
  preferred_stage_id uuid REFERENCES public.festival_stages(id) ON DELETE SET NULL,
  preferred_festival_date date,
  booking_tier text,
  sort_order integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  created_by_profile_id uuid REFERENCES public.profiles(id),
  updated_by_profile_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text,
  CHECK ((stage_id IS NULL AND starts_at IS NULL AND ends_at IS NULL) OR (stage_id IS NOT NULL AND starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at > starts_at AND festival_date IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS festival_schedule_items_revision_idx ON public.festival_schedule_items(revision_id, festival_date, stage_id, starts_at);
CREATE UNIQUE INDEX IF NOT EXISTS festival_schedule_items_idempotency_idx ON public.festival_schedule_items(revision_id,idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.festival_schedule_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_profile_id uuid REFERENCES public.profiles(id), festival_id uuid, edition_id uuid, revision_id uuid, item_id uuid,
  action text NOT NULL, before_snapshot jsonb, after_snapshot jsonb, reason text, idempotency_key text, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.festival_schedule_actor() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
CREATE OR REPLACE FUNCTION public.festival_schedule_can_manage(p_edition_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(public.festival_admin_can_operate_edition(p_edition_id, ARRAY['festival_owner','operations_manager','stage_manager','talent_booker']), public.can_manage_festival_brand((SELECT festival_id FROM public.festival_editions WHERE id=p_edition_id)), false)
$$;

CREATE OR REPLACE FUNCTION public.ensure_festival_schedule_draft_revision(p_edition_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.festival_editions%ROWTYPE; r public.festival_schedule_revisions%ROWTYPE; p public.festival_schedule_revisions%ROWTYPE; actor uuid:=public.festival_schedule_actor();
BEGIN
  SELECT * INTO e FROM public.festival_editions WHERE id=p_edition_id; IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_EDITION_NOT_FOUND'; END IF;
  IF NOT public.festival_schedule_can_manage(p_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED'; END IF;
  SELECT * INTO r FROM public.festival_schedule_revisions WHERE edition_id=p_edition_id AND state IN ('draft','ready_for_review') ORDER BY revision_number DESC LIMIT 1; IF FOUND THEN RETURN r.id; END IF;
  SELECT * INTO p FROM public.festival_schedule_revisions WHERE edition_id=p_edition_id AND state='published' ORDER BY revision_number DESC LIMIT 1;
  INSERT INTO public.festival_schedule_revisions(festival_id,edition_id,revision_number,state,source_revision_id,created_by_profile_id)
  VALUES(e.festival_id,e.id,COALESCE((SELECT max(revision_number)+1 FROM public.festival_schedule_revisions WHERE edition_id=e.id),1),'draft',p.id,actor) RETURNING * INTO r;
  IF p.id IS NOT NULL THEN INSERT INTO public.festival_schedule_items(revision_id,festival_id,edition_id,stage_id,festival_date,item_type,stage_slot_id,starts_at,ends_at,duration_minutes,title,status,band_id,application_id,contract_id,requires_soundcheck,soundcheck_starts_at,soundcheck_ends_at,changeover_minutes,locked,public_visible,internal_notes,preferred_stage_id,preferred_festival_date,booking_tier,sort_order,created_by_profile_id)
    SELECT r.id,festival_id,edition_id,stage_id,festival_date,item_type,stage_slot_id,starts_at,ends_at,duration_minutes,title,'draft',band_id,application_id,contract_id,requires_soundcheck,soundcheck_starts_at,soundcheck_ends_at,changeover_minutes,locked,public_visible,internal_notes,preferred_stage_id,preferred_festival_date,booking_tier,sort_order,actor FROM public.festival_schedule_items WHERE revision_id=p.id; END IF;
  INSERT INTO public.festival_schedule_audit_events(actor_profile_id,festival_id,edition_id,revision_id,action,after_snapshot) VALUES(actor,e.festival_id,e.id,r.id,'revision_created',to_jsonb(r));
  RETURN r.id;
END $$;

CREATE OR REPLACE FUNCTION public.festival_schedule_conflicts(p_revision_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
WITH items AS (SELECT * FROM public.festival_schedule_items WHERE revision_id=p_revision_id), overlaps AS (
 SELECT jsonb_build_object('code','stage_overlap','severity','publication_blocker','itemIds',jsonb_build_array(a.id,b.id),'stageId',a.stage_id,'festivalDate',a.festival_date,'message','Schedule items overlap on the same stage.','suggestedResolution','Move or resize one item.','blocksPublication',true) v FROM items a JOIN items b ON a.id<b.id AND a.stage_id=b.stage_id AND tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)') WHERE a.stage_id IS NOT NULL
), hours AS (
 SELECT jsonb_build_object('code','outside_operating_hours','severity','error','itemIds',jsonb_build_array(i.id),'stageId',i.stage_id,'festivalDate',i.festival_date,'message','Item is outside configured stage operating hours.','suggestedResolution','Adjust stage hours or move the item.','blocksPublication',true) v FROM items i LEFT JOIN public.festival_stage_operating_hours h ON h.stage_id=i.stage_id AND h.festival_date=i.festival_date WHERE i.stage_id IS NOT NULL AND (h.id IS NULL OR i.starts_at<h.opens_at OR i.ends_at > (h.curfew_at - make_interval(mins=>h.shutdown_buffer_minutes)))
), invalid AS (
 SELECT jsonb_build_object('code','invalid_duration','severity','publication_blocker','itemIds',jsonb_build_array(id),'stageId',stage_id,'festivalDate',festival_date,'message','Item duration must be positive.','suggestedResolution','Set a valid end time.','blocksPublication',true) v FROM items WHERE duration_minutes <= 0
) SELECT COALESCE(jsonb_agg(v),'[]'::jsonb) FROM (SELECT v FROM overlaps UNION ALL SELECT v FROM hours UNION ALL SELECT v FROM invalid) x $$;

CREATE OR REPLACE FUNCTION public.festival_edition_schedule_workspace(p_edition_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.festival_editions%ROWTYPE; draft uuid; published uuid; tz text:='UTC'; dates jsonb; conflicts jsonb; can_edit boolean;
BEGIN
 SELECT * INTO e FROM public.festival_editions WHERE id=p_edition_id; IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_EDITION_NOT_FOUND'; END IF;
 can_edit:=public.festival_schedule_can_manage(p_edition_id); IF NOT can_edit THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED'; END IF;
 draft:=public.ensure_festival_schedule_draft_revision(p_edition_id); SELECT id INTO published FROM public.festival_schedule_revisions WHERE edition_id=p_edition_id AND state='published' ORDER BY revision_number DESC LIMIT 1;
 SELECT COALESCE(e.time_zone,'UTC') INTO tz;
 SELECT COALESCE(jsonb_agg(to_char(d,'YYYY-MM-DD') ORDER BY d),'[]'::jsonb) INTO dates FROM generate_series((e.start_at AT TIME ZONE tz)::date,(e.end_at AT TIME ZONE tz)::date,'1 day') d;
 conflicts:=public.festival_schedule_conflicts(draft);
 RETURN jsonb_build_object('festival',(SELECT to_jsonb(f) FROM public.festivals f WHERE f.id=e.festival_id),'edition',to_jsonb(e),'timeZone',tz,'festivalDates',dates,'scheduleState',(SELECT state FROM public.festival_schedule_revisions WHERE id=draft),'draftRevision',(SELECT to_jsonb(r) FROM public.festival_schedule_revisions r WHERE r.id=draft),'publishedRevision',(SELECT to_jsonb(r) FROM public.festival_schedule_revisions r WHERE r.id=published),'revisionHistory',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY revision_number DESC) FROM public.festival_schedule_revisions r WHERE r.edition_id=p_edition_id),'[]'::jsonb),'stages',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY stage_number NULLS LAST, stage_name) FROM public.festival_stages s WHERE s.edition_id=p_edition_id AND archived_at IS NULL),'[]'::jsonb),'operatingHours',COALESCE((SELECT jsonb_agg(to_jsonb(h)) FROM public.festival_stage_operating_hours h WHERE h.edition_id=p_edition_id),'[]'::jsonb),'scheduleItems',COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY festival_date, starts_at, sort_order) FROM public.festival_schedule_items i WHERE i.revision_id=draft AND i.stage_id IS NOT NULL),'[]'::jsonb),'unscheduledItems',COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY sort_order, created_at) FROM public.festival_schedule_items i WHERE i.revision_id=draft AND i.stage_id IS NULL),'[]'::jsonb),'conflictSummary',jsonb_build_object('items',conflicts,'blockingCount',(SELECT count(*) FROM jsonb_array_elements(conflicts) c WHERE (c->>'blocksPublication')::boolean),'warningCount',(SELECT count(*) FROM jsonb_array_elements(conflicts) c WHERE c->>'severity'='warning')),'readinessSummary',jsonb_build_object('structural',jsonb_build_array(jsonb_build_object('key','stages_configured','complete',EXISTS(SELECT 1 FROM public.festival_stages WHERE edition_id=p_edition_id)),jsonb_build_object('key','slots_created','complete',EXISTS(SELECT 1 FROM public.festival_schedule_items WHERE revision_id=draft)),jsonb_build_object('key','conflicts_resolved','complete',jsonb_array_length(conflicts)=0)),'booking',jsonb_build_array(jsonb_build_object('key','performer_assignments','complete',false,'blocking',false))),'permissions',jsonb_build_object('viewSchedule',true,'editDraftSchedule',can_edit,'configureStages',can_edit,'applyTemplates',can_edit,'publishSchedule',can_edit,'lockSchedule',can_edit,'overrideLock',can_edit,'viewRevisionHistory',can_edit),'availableActions',jsonb_build_array('create_item','move_item','resize_item','move_to_unscheduled','configure_hours','preview_template','apply_template','validate_schedule','publish_schedule'));
END $$;

CREATE OR REPLACE FUNCTION public.festival_schedule_configure_stage_hours(p_edition_id uuid,p_stage_id uuid,p_festival_date date,p_opening_time time,p_curfew time,p_shutdown_buffer_minutes integer DEFAULT 0,p_changeover_minutes integer DEFAULT 30,p_idempotency_key text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.festival_editions%ROWTYPE; st public.festival_stages%ROWTYPE; tz text; open_at timestamptz; curfew_at timestamptz; row public.festival_stage_operating_hours%ROWTYPE;
BEGIN SELECT * INTO e FROM public.festival_editions WHERE id=p_edition_id; SELECT * INTO st FROM public.festival_stages WHERE id=p_stage_id AND edition_id=p_edition_id; IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_STAGE_MISMATCH'; END IF; IF NOT public.festival_schedule_can_manage(p_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED'; END IF; tz:=COALESCE(e.time_zone,'UTC'); open_at:=(p_festival_date::text||' '||p_opening_time::text)::timestamp AT TIME ZONE tz; curfew_at:=(p_festival_date::text||' '||p_curfew::text)::timestamp AT TIME ZONE tz; IF curfew_at<=open_at THEN curfew_at:=curfew_at+interval '1 day'; END IF; INSERT INTO public.festival_stage_operating_hours(festival_id,edition_id,stage_id,festival_date,opens_at,curfew_at,shutdown_buffer_minutes,default_changeover_minutes,created_by_profile_id,updated_by_profile_id) VALUES(e.festival_id,e.id,p_stage_id,p_festival_date,open_at,curfew_at,p_shutdown_buffer_minutes,p_changeover_minutes,public.festival_schedule_actor(),public.festival_schedule_actor()) ON CONFLICT(stage_id,festival_date) DO UPDATE SET opens_at=excluded.opens_at,curfew_at=excluded.curfew_at,shutdown_buffer_minutes=excluded.shutdown_buffer_minutes,default_changeover_minutes=excluded.default_changeover_minutes,updated_at=now(),updated_by_profile_id=public.festival_schedule_actor() RETURNING * INTO row; RETURN to_jsonb(row); END $$;
CREATE OR REPLACE FUNCTION public.festival_schedule_upsert_item(p_edition_id uuid,p_revision_id uuid,p_item jsonb,p_expected_version integer DEFAULT NULL,p_idempotency_key text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.festival_schedule_revisions%ROWTYPE; e public.festival_editions%ROWTYPE; existing public.festival_schedule_items%ROWTYPE; out_row public.festival_schedule_items%ROWTYPE; stage uuid; starts timestamptz; ends timestamptz; dur integer; before jsonb; actor uuid:=public.festival_schedule_actor();
BEGIN SELECT * INTO r FROM public.festival_schedule_revisions WHERE id=p_revision_id AND edition_id=p_edition_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_REVISION_NOT_FOUND'; END IF; IF r.state NOT IN ('draft','ready_for_review') THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_REVISION_NOT_EDITABLE'; END IF; IF NOT public.festival_schedule_can_manage(p_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED'; END IF; SELECT * INTO e FROM public.festival_editions WHERE id=p_edition_id; IF p_idempotency_key IS NOT NULL THEN SELECT * INTO existing FROM public.festival_schedule_items WHERE revision_id=p_revision_id AND idempotency_key=p_idempotency_key; IF FOUND THEN RETURN to_jsonb(existing); END IF; END IF; stage:=NULLIF(p_item->>'stageId','')::uuid; starts:=NULLIF(p_item->>'startsAt','')::timestamptz; ends:=NULLIF(p_item->>'endsAt','')::timestamptz; dur:=COALESCE(NULLIF(p_item->>'durationMinutes','')::integer, GREATEST(1,EXTRACT(epoch FROM (ends-starts))/60)); IF p_item ? 'id' THEN SELECT * INTO existing FROM public.festival_schedule_items WHERE id=(p_item->>'id')::uuid AND revision_id=p_revision_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_ITEM_NOT_FOUND'; END IF; IF existing.locked THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_LOCKED_ITEM'; END IF; IF p_expected_version IS NOT NULL AND existing.version<>p_expected_version THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_STALE_WRITE'; END IF; before:=to_jsonb(existing); UPDATE public.festival_schedule_items SET stage_id=stage, festival_date=NULLIF(p_item->>'festivalDate','')::date, item_type=COALESCE((p_item->>'itemType')::public.festival_schedule_item_type,item_type), starts_at=starts, ends_at=ends, duration_minutes=dur, title=COALESCE(NULLIF(p_item->>'title',''),title), status=COALESCE(p_item->>'status',status), changeover_minutes=COALESCE(NULLIF(p_item->>'changeoverMinutes','')::integer,changeover_minutes), requires_soundcheck=COALESCE(NULLIF(p_item->>'requiresSoundcheck','')::boolean,requires_soundcheck), public_visible=COALESCE(NULLIF(p_item->>'publicVisible','')::boolean,public_visible), internal_notes=COALESCE(p_item->>'internalNotes',internal_notes), preferred_stage_id=COALESCE(NULLIF(p_item->>'preferredStageId','')::uuid,preferred_stage_id), preferred_festival_date=COALESCE(NULLIF(p_item->>'preferredFestivalDate','')::date,preferred_festival_date), booking_tier=COALESCE(p_item->>'bookingTier',booking_tier), version=version+1, updated_at=now(), updated_by_profile_id=actor WHERE id=existing.id RETURNING * INTO out_row; ELSE INSERT INTO public.festival_schedule_items(revision_id,festival_id,edition_id,stage_id,festival_date,item_type,starts_at,ends_at,duration_minutes,title,status,changeover_minutes,requires_soundcheck,public_visible,internal_notes,preferred_stage_id,preferred_festival_date,booking_tier,created_by_profile_id,updated_by_profile_id,idempotency_key) VALUES(r.id,e.festival_id,e.id,stage,NULLIF(p_item->>'festivalDate','')::date,COALESCE((p_item->>'itemType')::public.festival_schedule_item_type,'performance_slot'),starts,ends,dur,COALESCE(NULLIF(p_item->>'title',''),'Untitled schedule item'),COALESCE(p_item->>'status','draft'),COALESCE(NULLIF(p_item->>'changeoverMinutes','')::integer,0),COALESCE(NULLIF(p_item->>'requiresSoundcheck','')::boolean,false),COALESCE(NULLIF(p_item->>'publicVisible','')::boolean,false),p_item->>'internalNotes',NULLIF(p_item->>'preferredStageId','')::uuid,NULLIF(p_item->>'preferredFestivalDate','')::date,p_item->>'bookingTier',actor,actor,p_idempotency_key) RETURNING * INTO out_row; END IF; UPDATE public.festival_schedule_revisions SET version=version+1, updated_at=now() WHERE id=r.id; INSERT INTO public.festival_schedule_audit_events(actor_profile_id,festival_id,edition_id,revision_id,item_id,action,before_snapshot,after_snapshot,idempotency_key) VALUES(actor,e.festival_id,e.id,r.id,out_row.id,CASE WHEN before IS NULL THEN 'item_created' ELSE 'item_updated' END,before,to_jsonb(out_row),p_idempotency_key); RETURN to_jsonb(out_row); END $$;

CREATE OR REPLACE FUNCTION public.festival_schedule_preview_template(p_edition_id uuid,p_stage_id uuid,p_festival_date date,p_template text,p_opening_time time DEFAULT '12:00',p_curfew time DEFAULT '23:00') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE specs jsonb; item jsonb; out jsonb:='[]'::jsonb; t integer; end_min integer; dur integer; ch integer; idx integer:=0;
BEGIN IF NOT public.festival_schedule_can_manage(p_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED'; END IF; specs:=CASE p_template WHEN 'small_stage' THEN '[{"title":"Opening act","duration":35,"changeover":20},{"title":"Support","duration":45,"changeover":25},{"title":"Headliner","duration":75,"changeover":0}]'::jsonb WHEN 'festival_main_stage' THEN '[{"title":"Early act","duration":35,"changeover":25},{"title":"Daytime act 1","duration":40,"changeover":25},{"title":"Daytime act 2","duration":40,"changeover":25},{"title":"Daytime act 3","duration":45,"changeover":30},{"title":"Main support","duration":55,"changeover":35},{"title":"Special guest","duration":50,"changeover":30},{"title":"Headliner","duration":90,"changeover":0}]'::jsonb WHEN 'new_music_stage' THEN '[{"title":"Emerging artist","duration":25,"changeover":25},{"title":"Emerging artist","duration":25,"changeover":25},{"title":"Breakthrough act","duration":35,"changeover":30},{"title":"New music headliner","duration":50,"changeover":0}]'::jsonb WHEN 'electronic_stage' THEN '[{"title":"Opening DJ","duration":60,"changeover":10},{"title":"DJ block","duration":90,"changeover":10},{"title":"Late DJ block","duration":120,"changeover":0}]'::jsonb ELSE '[{"title":"Early opener","duration":35,"changeover":20},{"title":"Opener","duration":40,"changeover":25},{"title":"Mid-card","duration":45,"changeover":25},{"title":"Support","duration":55,"changeover":30},{"title":"Headliner","duration":80,"changeover":0}]'::jsonb END; t:=EXTRACT(hour FROM p_opening_time)::int*60+EXTRACT(minute FROM p_opening_time)::int; end_min:=EXTRACT(hour FROM p_curfew)::int*60+EXTRACT(minute FROM p_curfew)::int; IF end_min<=t THEN end_min:=end_min+1440; END IF; FOR item IN SELECT * FROM jsonb_array_elements(specs) LOOP dur:=(item->>'duration')::int; ch:=(item->>'changeover')::int; out:=out||jsonb_build_array(jsonb_build_object('title',item->>'title','itemType','performance_slot','festivalDate',p_festival_date,'stageId',p_stage_id,'startsAt',to_char((p_festival_date::timestamp + make_interval(mins=>t)),'YYYY-MM-DD"T"HH24:MI:SS'),'endsAt',to_char((p_festival_date::timestamp + make_interval(mins=>t+dur)),'YYYY-MM-DD"T"HH24:MI:SS'),'durationMinutes',dur,'changeoverMinutes',ch,'conflicts',CASE WHEN t+dur>end_min THEN jsonb_build_array('curfew') ELSE '[]'::jsonb END)); t:=t+dur+ch; idx:=idx+1; END LOOP; RETURN jsonb_build_object('template',p_template,'items',out,'unusedMinutes',GREATEST(0,end_min-t),'conflicts',(SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM jsonb_array_elements(out) x WHERE jsonb_array_length(x->'conflicts')>0)); END $$;

CREATE OR REPLACE FUNCTION public.festival_schedule_apply_template(p_edition_id uuid,p_revision_id uuid,p_stage_id uuid,p_festival_date date,p_template text,p_opening_time time DEFAULT '12:00',p_curfew time DEFAULT '23:00',p_confirm_overwrite boolean DEFAULT false,p_idempotency_key text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE preview jsonb; item jsonb; inserted jsonb:='[]'::jsonb; key text; existing int;
BEGIN IF p_idempotency_key IS NOT NULL AND EXISTS(SELECT 1 FROM public.festival_schedule_audit_events WHERE revision_id=p_revision_id AND action='template_applied' AND idempotency_key=p_idempotency_key) THEN RETURN jsonb_build_object('idempotent',true,'items',(SELECT COALESCE(jsonb_agg(to_jsonb(i)),'[]'::jsonb) FROM public.festival_schedule_items i WHERE revision_id=p_revision_id AND idempotency_key LIKE p_idempotency_key||':%')); END IF; SELECT count(*) INTO existing FROM public.festival_schedule_items WHERE revision_id=p_revision_id AND stage_id=p_stage_id AND festival_date=p_festival_date; IF existing>0 AND NOT p_confirm_overwrite THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_TEMPLATE_WOULD_OVERWRITE'; END IF; preview:=public.festival_schedule_preview_template(p_edition_id,p_stage_id,p_festival_date,p_template,p_opening_time,p_curfew); FOR item IN SELECT * FROM jsonb_array_elements(preview->'items') LOOP key:=COALESCE(p_idempotency_key,gen_random_uuid()::text)||':'||replace(item->>'title',' ','_'); inserted:=inserted||jsonb_build_array(public.festival_schedule_upsert_item(p_edition_id,p_revision_id,item||jsonb_build_object('startsAt',(item->>'startsAt')::timestamp AT TIME ZONE COALESCE((SELECT COALESCE(time_zone,'UTC') FROM public.festival_editions WHERE id=p_edition_id),'UTC'),'endsAt',(item->>'endsAt')::timestamp AT TIME ZONE COALESCE((SELECT COALESCE(time_zone,'UTC') FROM public.festival_editions WHERE id=p_edition_id),'UTC'),'publicVisible',true),NULL,key)); END LOOP; INSERT INTO public.festival_schedule_audit_events(actor_profile_id,festival_id,edition_id,revision_id,action,after_snapshot,idempotency_key) SELECT public.festival_schedule_actor(),festival_id,edition_id,p_revision_id,'template_applied',jsonb_build_object('template',p_template,'items',jsonb_array_length(inserted)),p_idempotency_key FROM public.festival_schedule_revisions WHERE id=p_revision_id; RETURN jsonb_build_object('applied',true,'items',inserted); END $$;

CREATE OR REPLACE FUNCTION public.festival_schedule_publish(p_edition_id uuid,p_revision_id uuid,p_acknowledge_warnings boolean DEFAULT false,p_idempotency_key text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.festival_schedule_revisions%ROWTYPE; conflicts jsonb; blockers int; actor uuid:=public.festival_schedule_actor();
BEGIN SELECT * INTO r FROM public.festival_schedule_revisions WHERE id=p_revision_id AND edition_id=p_edition_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_REVISION_NOT_FOUND'; END IF; IF NOT public.festival_schedule_can_manage(p_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED'; END IF; conflicts:=public.festival_schedule_conflicts(p_revision_id); SELECT count(*) INTO blockers FROM jsonb_array_elements(conflicts) c WHERE (c->>'blocksPublication')::boolean; IF blockers>0 THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PUBLICATION_BLOCKED'; END IF; UPDATE public.festival_schedule_revisions SET state='archived', archived_at=now(), updated_at=now() WHERE edition_id=p_edition_id AND state='published' AND id<>p_revision_id; UPDATE public.festival_schedule_revisions SET state='published', published_at=now(), published_by_profile_id=actor, version=version+1, updated_at=now() WHERE id=p_revision_id RETURNING * INTO r; UPDATE public.festival_schedule_items SET public_visible=true, status='published' WHERE revision_id=p_revision_id AND stage_id IS NOT NULL; INSERT INTO public.festival_schedule_audit_events(actor_profile_id,festival_id,edition_id,revision_id,action,after_snapshot,idempotency_key) VALUES(actor,r.festival_id,r.edition_id,r.id,'schedule_published',to_jsonb(r),p_idempotency_key); RETURN jsonb_build_object('published',true,'revision',to_jsonb(r)); END $$;


CREATE OR REPLACE FUNCTION public.festival_schedule_lock(p_edition_id uuid,p_revision_id uuid,p_reason text,p_idempotency_key text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.festival_schedule_revisions%ROWTYPE; actor uuid:=public.festival_schedule_actor();
BEGIN
  IF COALESCE(trim(p_reason),'')='' THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_LOCK_REASON_REQUIRED'; END IF;
  SELECT * INTO r FROM public.festival_schedule_revisions WHERE id=p_revision_id AND edition_id=p_edition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_REVISION_NOT_FOUND'; END IF;
  IF NOT public.festival_schedule_can_manage(p_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED'; END IF;
  UPDATE public.festival_schedule_revisions SET state='locked', locked_at=now(), locked_by_profile_id=actor, notes=COALESCE(notes,'')||E'\nLocked: '||p_reason, version=version+1, updated_at=now() WHERE id=p_revision_id RETURNING * INTO r;
  INSERT INTO public.festival_schedule_audit_events(actor_profile_id,festival_id,edition_id,revision_id,action,after_snapshot,reason,idempotency_key) VALUES(actor,r.festival_id,r.edition_id,r.id,'schedule_locked',to_jsonb(r),p_reason,p_idempotency_key);
  RETURN jsonb_build_object('locked',true,'revision',to_jsonb(r));
END $$;

CREATE OR REPLACE FUNCTION public.festival_schedule_reopen(p_edition_id uuid,p_revision_id uuid,p_reason text,p_idempotency_key text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.festival_schedule_revisions%ROWTYPE; draft uuid; actor uuid:=public.festival_schedule_actor();
BEGIN
  IF COALESCE(trim(p_reason),'')='' THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_REOPEN_REASON_REQUIRED'; END IF;
  SELECT * INTO r FROM public.festival_schedule_revisions WHERE id=p_revision_id AND edition_id=p_edition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_REVISION_NOT_FOUND'; END IF;
  IF NOT public.festival_schedule_can_manage(p_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED'; END IF;
  draft:=public.ensure_festival_schedule_draft_revision(p_edition_id);
  INSERT INTO public.festival_schedule_audit_events(actor_profile_id,festival_id,edition_id,revision_id,action,after_snapshot,reason,idempotency_key) VALUES(actor,r.festival_id,r.edition_id,draft,'schedule_reopened',jsonb_build_object('sourceRevisionId',r.id,'draftRevisionId',draft),p_reason,p_idempotency_key);
  RETURN jsonb_build_object('reopened',true,'draftRevisionId',draft);
END $$;

CREATE OR REPLACE FUNCTION public.festival_schedule_discard_draft(p_edition_id uuid,p_revision_id uuid,p_reason text DEFAULT NULL,p_idempotency_key text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.festival_schedule_revisions%ROWTYPE; actor uuid:=public.festival_schedule_actor();
BEGIN
  SELECT * INTO r FROM public.festival_schedule_revisions WHERE id=p_revision_id AND edition_id=p_edition_id AND state IN ('draft','ready_for_review') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_DRAFT_NOT_FOUND'; END IF;
  IF NOT public.festival_schedule_can_manage(p_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED'; END IF;
  UPDATE public.festival_schedule_revisions SET state='archived', archived_at=now(), notes=COALESCE(notes,'')||E'\nDiscarded draft: '||COALESCE(p_reason,'No reason supplied'), version=version+1, updated_at=now() WHERE id=r.id RETURNING * INTO r;
  INSERT INTO public.festival_schedule_audit_events(actor_profile_id,festival_id,edition_id,revision_id,action,before_snapshot,after_snapshot,reason,idempotency_key) VALUES(actor,r.festival_id,r.edition_id,r.id,'draft_discarded',to_jsonb(r),to_jsonb(r),p_reason,p_idempotency_key);
  RETURN jsonb_build_object('discarded',true,'revision',to_jsonb(r));
END $$;

CREATE OR REPLACE FUNCTION public.public_festival_edition_schedule(p_edition_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
WITH r AS (SELECT * FROM public.festival_schedule_revisions WHERE edition_id=p_edition_id AND state='published' ORDER BY revision_number DESC LIMIT 1)
SELECT COALESCE(jsonb_build_object('editionId',p_edition_id,'revision',(SELECT to_jsonb(r) FROM r),'festivalDates',COALESCE((SELECT jsonb_agg(DISTINCT festival_date ORDER BY festival_date) FROM public.festival_schedule_items i JOIN r ON r.id=i.revision_id WHERE i.public_visible),'[]'::jsonb),'stages',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',COALESCE(s.public_name,s.stage_name),'capacity',s.capacity) ORDER BY s.stage_number NULLS LAST, s.stage_name) FROM public.festival_stages s WHERE s.edition_id=p_edition_id AND s.archived_at IS NULL),'[]'::jsonb),'items',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'stageId',i.stage_id,'festivalDate',i.festival_date,'itemType',i.item_type,'startsAt',i.starts_at,'endsAt',i.ends_at,'title',i.title,'status',i.status,'performerName',COALESCE(b.name,i.title),'publicVisible',i.public_visible) ORDER BY i.festival_date,i.starts_at) FROM public.festival_schedule_items i JOIN r ON r.id=i.revision_id LEFT JOIN public.bands b ON b.id=i.band_id WHERE i.public_visible AND i.stage_id IS NOT NULL),'[]'::jsonb)), jsonb_build_object('editionId',p_edition_id,'items','[]'::jsonb,'stages','[]'::jsonb,'festivalDates','[]'::jsonb)) $$;

GRANT EXECUTE ON FUNCTION public.festival_edition_schedule_workspace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.festival_schedule_configure_stage_hours(uuid,uuid,date,time,time,integer,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.festival_schedule_upsert_item(uuid,uuid,jsonb,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.festival_schedule_preview_template(uuid,uuid,date,text,time,time) TO authenticated;
GRANT EXECUTE ON FUNCTION public.festival_schedule_apply_template(uuid,uuid,uuid,date,text,time,time,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.festival_schedule_publish(uuid,uuid,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.festival_schedule_lock(uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.festival_schedule_reopen(uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.festival_schedule_discard_draft(uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_festival_edition_schedule(uuid) TO anon, authenticated;
