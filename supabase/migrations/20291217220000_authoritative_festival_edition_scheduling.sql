-- Consolidate active legacy callers behind the annual-edition scheduling authority.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

ALTER TABLE public.festival_stages
  ADD COLUMN IF NOT EXISTS stage_key text,
  ADD COLUMN IF NOT EXISTS internal_name text,
  ADD COLUMN IF NOT EXISTS minimum_artist_level integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maximum_artist_level integer,
  ADD COLUMN IF NOT EXISTS supported_genres text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS production_quality integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sound_quality integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lighting_quality integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS screen_capability text,
  ADD COLUMN IF NOT EXISTS accessibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS opening_time time,
  ADD COLUMN IF NOT EXISTS closing_time time,
  ADD COLUMN IF NOT EXISTS default_soundcheck_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stage_manager_profile_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS migration_provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.festival_stages SET stage_key = 'stage-' || stage_number WHERE stage_key IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS festival_stages_edition_key_uidx ON public.festival_stages(edition_id,stage_key) WHERE archived_at IS NULL;

ALTER TABLE public.festival_stage_slots
  ADD COLUMN IF NOT EXISTS setup_start timestamptz,
  ADD COLUMN IF NOT EXISTS performance_start timestamptz,
  ADD COLUMN IF NOT EXISTS performance_end timestamptz,
  ADD COLUMN IF NOT EXISTS clearance_end timestamptz,
  ADD COLUMN IF NOT EXISTS billing_position text NOT NULL DEFAULT 'mid-card',
  ADD COLUMN IF NOT EXISTS assignment_status text NOT NULL DEFAULT 'unassigned',
  ADD COLUMN IF NOT EXISTS lock_status text NOT NULL DEFAULT 'unlocked',
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS schedule_revision integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS migration_provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.festival_stage_slots SET performance_start=COALESCE(performance_start,start_time), performance_end=COALESCE(performance_end,end_time), setup_start=COALESCE(setup_start,start_time-make_interval(mins=>COALESCE(changeover_minutes,0))), clearance_end=COALESCE(clearance_end,end_time) WHERE start_time IS NOT NULL AND end_time IS NOT NULL;
DO $$ BEGIN
  ALTER TABLE public.festival_stage_slots ADD CONSTRAINT festival_stage_slots_occupancy_no_overlap
    EXCLUDE USING gist (stage_id WITH =, tstzrange(setup_start,clearance_end,'[)') WITH &&)
    WHERE (archived_at IS NULL AND setup_start IS NOT NULL AND clearance_end IS NOT NULL AND status <> 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.festival_edition_for_legacy_id(p_legacy_festival_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT m.edition_id FROM public.festival_legacy_mappings m
  WHERE m.legacy_id=p_legacy_festival_id OR m.legacy_festival_id=p_legacy_festival_id
  ORDER BY COALESCE((m.metadata->>'historical_only')::boolean,false),m.created_at DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.legacy_festival_create_edition_stage(p_legacy_festival_id uuid,p_name text,p_capacity integer,p_genre_focus text DEFAULT NULL,p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_stages LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE edition uuid:=public.festival_edition_for_legacy_id(p_legacy_festival_id);
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'FESTIVAL_STAGE_ACCESS_DENIED'; END IF;
 IF edition IS NULL THEN RAISE EXCEPTION 'FESTIVAL_STAGE_EDITION_MISMATCH'; END IF;
 RETURN public.create_festival_edition_stage(edition,p_name,'main',p_capacity,p_genre_focus,NULL,NULL,NULL,NULL,NULL,30,NULL,'{}','{}',p_idempotency_key);
END $$;

CREATE OR REPLACE FUNCTION public.legacy_festival_create_performance_slot(p_stage_id uuid,p_day_number integer,p_slot_number integer,p_slot_type text,p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_stage_slots LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE st public.festival_stages%ROWTYPE; e public.festival_editions%ROWTYPE; s public.festival_stage_slots%ROWTYPE; start_at timestamptz; end_at timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'FESTIVAL_STAGE_ACCESS_DENIED'; END IF;
 SELECT * INTO st FROM public.festival_stages WHERE id=p_stage_id AND archived_at IS NULL FOR UPDATE; IF NOT FOUND OR st.edition_id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_STAGE_EDITION_MISMATCH'; END IF;
 IF NOT public.festival_admin_can_operate_edition(st.edition_id,ARRAY['operations_manager']) THEN RAISE EXCEPTION 'FESTIVAL_STAGE_ACCESS_DENIED'; END IF;
 SELECT * INTO e FROM public.festival_editions WHERE id=st.edition_id FOR UPDATE;
 start_at:=date_trunc('day',e.start_at)+make_interval(days=>p_day_number-1,hours=>12+(p_slot_number-1)*2); end_at:=start_at+interval '60 minutes';
 IF start_at<e.start_at OR end_at>e.end_at THEN RAISE EXCEPTION 'FESTIVAL_SLOT_OUTSIDE_EDITION'; END IF;
 IF p_idempotency_key IS NOT NULL THEN SELECT * INTO s FROM public.festival_stage_slots WHERE stage_id=p_stage_id AND idempotency_key=p_idempotency_key LIMIT 1; IF FOUND THEN RETURN s; END IF; END IF;
 INSERT INTO public.festival_stage_slots(stage_id,festival_id,edition_id,day_number,slot_number,slot_type,start_time,end_time,setup_start,performance_start,performance_end,clearance_end,changeover_minutes,idempotency_key,public_status)
 VALUES(st.id,st.festival_id,st.edition_id,p_day_number,p_slot_number,p_slot_type,start_at,end_at,start_at-make_interval(mins=>st.default_changeover_minutes),start_at,end_at,end_at,st.default_changeover_minutes,p_idempotency_key,'draft') RETURNING * INTO s;
 PERFORM public.festival_audit(st.edition_id,'slot_created','festival_stage_slot',s.id,'{}',to_jsonb(s),NULL,p_idempotency_key); RETURN s;
EXCEPTION WHEN exclusion_violation THEN RAISE EXCEPTION 'FESTIVAL_SLOT_OVERLAP'; END $$;

CREATE OR REPLACE FUNCTION public.legacy_festival_generate_edition_slots(p_stage_id uuid,p_idempotency_key text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE st public.festival_stages%ROWTYPE; e public.festival_editions%ROWTYPE; d integer; n integer; s public.festival_stage_slots%ROWTYPE; result jsonb:='[]'; kinds text[]:=ARRAY['opener','opener','support','support','support','headliner'];
BEGIN
 SELECT * INTO st FROM public.festival_stages WHERE id=p_stage_id AND archived_at IS NULL; IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_STAGE_NOT_FOUND'; END IF;
 SELECT * INTO e FROM public.festival_editions WHERE id=st.edition_id; IF NOT public.festival_admin_can_operate_edition(e.id,ARRAY['operations_manager']) THEN RAISE EXCEPTION 'FESTIVAL_STAGE_ACCESS_DENIED'; END IF;
 FOR d IN 1..GREATEST(1,(e.end_at::date-e.start_at::date)+1) LOOP FOR n IN 1..6 LOOP
  s:=public.legacy_festival_create_performance_slot(st.id,d,n,kinds[n],p_idempotency_key||':'||d||':'||n); result:=result||to_jsonb(s);
 END LOOP; END LOOP; RETURN jsonb_build_object('slots',result,'idempotent',true);
END $$;

CREATE OR REPLACE FUNCTION public.legacy_festival_assign_band_to_slot(p_slot_id uuid,p_band_id uuid,p_payout_amount numeric DEFAULT 0,p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_stage_slots LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.festival_stage_slots%ROWTYPE; c public.festival_contracts%ROWTYPE;
BEGIN
 SELECT * INTO s FROM public.festival_stage_slots WHERE id=p_slot_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_SLOT_NOT_FOUND'; END IF;
 IF NOT public.festival_admin_can_operate_edition(s.edition_id,ARRAY['operations_manager','talent_booker']) THEN RAISE EXCEPTION 'FESTIVAL_STAGE_ACCESS_DENIED'; END IF;
 SELECT * INTO c FROM public.festival_contracts WHERE edition_id=s.edition_id AND band_id=p_band_id AND status='active' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_SLOT_CONTRACT_REQUIRED'; END IF;
 IF s.canonical_contract_id IS NOT NULL AND s.canonical_contract_id<>c.id THEN RAISE EXCEPTION 'FESTIVAL_SLOT_ARTIST_ALREADY_ASSIGNED'; END IF;
 IF EXISTS(SELECT 1 FROM public.festival_stage_slots WHERE canonical_contract_id=c.id AND id<>s.id AND archived_at IS NULL) THEN RAISE EXCEPTION 'FESTIVAL_SLOT_ARTIST_ALREADY_ASSIGNED'; END IF;
 UPDATE public.festival_stage_slots SET band_id=c.band_id,canonical_contract_id=c.id,payout_amount=p_payout_amount,status='confirmed',assignment_status='assigned',version=version+1,updated_at=now() WHERE id=s.id RETURNING * INTO s;
 UPDATE public.festival_contracts SET stage_slot_id=s.id WHERE id=c.id; PERFORM public.festival_audit(s.edition_id,'contract_assigned_to_slot','festival_stage_slot',s.id,'{}',to_jsonb(s),NULL,p_idempotency_key); RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.legacy_festival_assign_npc_to_slot(p_slot_id uuid,p_genre text,p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_stage_slots LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.festival_stage_slots%ROWTYPE;
BEGIN
 SELECT * INTO s FROM public.festival_stage_slots WHERE id=p_slot_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_SLOT_NOT_FOUND'; END IF;
 IF NOT public.festival_admin_can_operate_edition(s.edition_id,ARRAY['operations_manager','talent_booker']) THEN RAISE EXCEPTION 'FESTIVAL_STAGE_ACCESS_DENIED'; END IF;
 IF s.canonical_contract_id IS NOT NULL OR s.band_id IS NOT NULL THEN RAISE EXCEPTION 'FESTIVAL_SLOT_ARTIST_ALREADY_ASSIGNED'; END IF;
 UPDATE public.festival_stage_slots SET is_npc_dj=true,npc_dj_genre=p_genre,npc_dj_quality=40+abs(hashtext(s.id::text||p_genre))%21,npc_dj_name='DJ '||p_genre||' Beats',status='booked',assignment_status='npc_fallback',version=version+1,updated_at=now() WHERE id=s.id RETURNING * INTO s;
 PERFORM public.festival_audit(s.edition_id,'npc_fallback_assigned','festival_stage_slot',s.id,'{}',to_jsonb(s),NULL,p_idempotency_key); RETURN s;
END $$;

REVOKE ALL ON FUNCTION public.legacy_festival_create_edition_stage(uuid,text,integer,text,text),public.legacy_festival_create_performance_slot(uuid,integer,integer,text,text),public.legacy_festival_generate_edition_slots(uuid,text),public.legacy_festival_assign_band_to_slot(uuid,uuid,numeric,text),public.legacy_festival_assign_npc_to_slot(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.legacy_festival_create_edition_stage(uuid,text,integer,text,text),public.legacy_festival_create_performance_slot(uuid,integer,integer,text,text),public.legacy_festival_generate_edition_slots(uuid,text),public.legacy_festival_assign_band_to_slot(uuid,uuid,numeric,text),public.legacy_festival_assign_npc_to_slot(uuid,text,text) TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.festival_stages,public.festival_stage_slots,public.festival_schedule_revisions,public.festival_schedule_items FROM authenticated;
