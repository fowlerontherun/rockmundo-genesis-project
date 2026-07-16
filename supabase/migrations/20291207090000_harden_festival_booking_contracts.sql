-- Harden canonical festival booking contracts and setlists after PR #1193.
-- This migration is additive/corrective: it does not edit the historical booking foundation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.festival_stage_slot_reservation_status AS ENUM ('provisional','confirmed','released','expired');

CREATE TABLE IF NOT EXISTS public.festival_booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text NOT NULL CHECK (operation ~ '^[a-z_]+$'),
  entity_scope text NOT NULL CHECK (entity_scope <> ''),
  entity_id uuid,
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  result_entity_type text,
  result_entity_id uuid,
  result_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT festival_booking_requests_once UNIQUE(operation, actor_profile_id, entity_scope, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.festival_stage_slot_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  stage_slot_id uuid NOT NULL REFERENCES public.festival_stage_slots(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.festival_contract_offers(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.festival_contracts(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  status public.festival_stage_slot_reservation_status NOT NULL DEFAULT 'provisional',
  reserved_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  released_at timestamptz,
  release_reason text,
  CHECK (status NOT IN ('released','expired') OR release_reason IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS festival_stage_slot_reservations_one_live_slot_idx
  ON public.festival_stage_slot_reservations(stage_slot_id)
  WHERE status IN ('provisional','confirmed');
CREATE UNIQUE INDEX IF NOT EXISTS festival_stage_slot_reservations_one_offer_idx
  ON public.festival_stage_slot_reservations(offer_id)
  WHERE offer_id IS NOT NULL AND status IN ('provisional','confirmed');
CREATE UNIQUE INDEX IF NOT EXISTS festival_stage_slot_reservations_one_contract_idx
  ON public.festival_stage_slot_reservations(contract_id)
  WHERE contract_id IS NOT NULL AND status IN ('provisional','confirmed');

ALTER TABLE public.festival_contract_offers ADD COLUMN IF NOT EXISTS current_revision_id uuid;
ALTER TABLE public.festival_contract_offers ADD COLUMN IF NOT EXISTS accepted_revision_id uuid;
ALTER TABLE public.festival_contract_offers ADD COLUMN IF NOT EXISTS current_terms_hash text;

CREATE TABLE IF NOT EXISTS public.festival_contract_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.festival_contracts(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  terms_snapshot jsonb NOT NULL,
  terms_hash text NOT NULL CHECK (terms_hash ~ '^[a-f0-9]{64}$'),
  created_by_profile_id uuid REFERENCES public.profiles(id),
  created_by_side public.festival_booking_side NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contract_id, version),
  UNIQUE(id)
);
ALTER TABLE public.festival_contracts ADD COLUMN IF NOT EXISTS current_version_id uuid;
ALTER TABLE public.festival_contracts ADD COLUMN IF NOT EXISTS settlement_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.festival_contracts ADD COLUMN IF NOT EXISTS cancelled_by_side public.festival_booking_side;
ALTER TABLE public.festival_contracts ADD COLUMN IF NOT EXISTS cancelled_by_profile_id uuid REFERENCES public.profiles(id);

ALTER TABLE public.festival_contract_setlists ADD COLUMN IF NOT EXISTS supersedes_setlist_id uuid REFERENCES public.festival_contract_setlists(id);
ALTER TABLE public.festival_contract_setlists ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;
ALTER TABLE public.festival_contract_setlists ADD COLUMN IF NOT EXISTS content_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS festival_contract_setlists_one_current_idx
  ON public.festival_contract_setlists(contract_id) WHERE is_current;
CREATE UNIQUE INDEX IF NOT EXISTS festival_contract_setlists_content_idempotent_idx
  ON public.festival_contract_setlists(contract_id, content_hash) WHERE content_hash IS NOT NULL;

ALTER TABLE public.festival_contract_setlist_items
  ALTER COLUMN song_id SET NOT NULL;
ALTER TABLE public.festival_contract_setlist_items
  ADD CONSTRAINT festival_contract_setlist_items_song_fk FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS festival_contract_setlist_items_unique_song_idx
  ON public.festival_contract_setlist_items(setlist_id, song_id);

CREATE UNIQUE INDEX IF NOT EXISTS festival_contracts_one_per_offer_idx ON public.festival_contracts(offer_id) WHERE offer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS festival_contracts_one_per_revision_idx ON public.festival_contracts(accepted_offer_revision_id) WHERE accepted_offer_revision_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS festival_contract_events_idempotency_idx ON public.festival_contract_events(contract_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS festival_application_events_idempotency_idx ON public.festival_application_events(application_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.festival_stage_slots DROP CONSTRAINT IF EXISTS festival_stage_slots_canonical_contract_fk;
ALTER TABLE public.festival_stage_slots ADD CONSTRAINT festival_stage_slots_canonical_contract_fk
  FOREIGN KEY (canonical_contract_id) REFERENCES public.festival_contracts(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.current_profile_id_safe() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_current_band_member(p_band_id uuid, p_profile_id uuid DEFAULT public.current_profile_id_safe()) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id=p_band_id AND (bm.profile_id=p_profile_id OR bm.user_id=auth.uid())
      AND COALESCE(bm.member_status,'active')='active' AND COALESCE(bm.is_touring_member,false)=false
  )
$$;
CREATE OR REPLACE FUNCTION public.is_active_band_member(p_band_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_current_band_member(p_band_id) $$;

CREATE OR REPLACE FUNCTION public.can_manage_festival_booking(p_band_id uuid, p_profile_id uuid DEFAULT public.current_profile_id_safe()) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.band_members bm
    JOIN public.bands b ON b.id=bm.band_id
    WHERE bm.band_id=p_band_id AND (bm.profile_id=p_profile_id OR bm.user_id=auth.uid() OR b.leader_id=auth.uid())
      AND COALESCE(bm.member_status,'active')='active'
      AND lower(COALESCE(bm.role,'')) IN ('leader','founder','co-leader','manager')
  ) OR COALESCE(public.has_role(auth.uid(),'admin'::public.app_role), false)
$$;
CREATE OR REPLACE FUNCTION public.can_apply_for_band(p_band_id uuid, p_profile_id uuid DEFAULT public.current_profile_id_safe()) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.can_manage_festival_booking(p_band_id,p_profile_id) $$;
CREATE OR REPLACE FUNCTION public.can_negotiate_for_band(p_band_id uuid, p_profile_id uuid DEFAULT public.current_profile_id_safe()) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.can_manage_festival_booking(p_band_id,p_profile_id) $$;
CREATE OR REPLACE FUNCTION public.can_sign_for_band(p_band_id uuid, p_profile_id uuid DEFAULT public.current_profile_id_safe()) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.can_manage_festival_booking(p_band_id,p_profile_id) $$;

CREATE OR REPLACE FUNCTION public.festival_jsonb_sha256(p_value jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT encode(digest(COALESCE(p_value,'null'::jsonb)::text, 'sha256'), 'hex') $$;
CREATE OR REPLACE FUNCTION public.festival_terms_hash(p_terms jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT public.festival_jsonb_sha256(COALESCE(p_terms,'{}'::jsonb)) $$;

CREATE OR REPLACE FUNCTION public.validate_festival_application_transition(p_from public.festival_application_status, p_to public.festival_application_status) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
BEGIN
 IF p_from=p_to THEN RETURN true; END IF;
 IF p_from IN ('withdrawn','rejected','expired','converted_to_contract') THEN RETURN false; END IF;
 RETURN (p_from='draft' AND p_to='submitted')
   OR (p_from='submitted' AND p_to IN ('under_review','shortlisted','waitlisted','rejected','withdrawn','offer_pending','expired'))
   OR (p_from='under_review' AND p_to IN ('shortlisted','waitlisted','rejected','withdrawn','offer_pending','expired'))
   OR (p_from='waitlisted' AND p_to IN ('shortlisted','rejected','withdrawn','offer_pending','expired'))
   OR (p_from='shortlisted' AND p_to IN ('offer_pending','rejected','withdrawn','expired'))
   OR (p_from='offer_pending' AND p_to IN ('converted_to_contract','withdrawn','expired'));
END $$;

CREATE OR REPLACE FUNCTION public.validate_festival_contract_transition(p_from public.festival_contract_status, p_to public.festival_contract_status) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
BEGIN
 IF p_from=p_to THEN RETURN true; END IF;
 IF p_from IN ('cancelled','terminated','fulfilled','expired','breached') THEN RETURN false; END IF;
 RETURN (p_from IN ('draft','proposed') AND p_to IN ('awaiting_signatures','awaiting_band_signature','awaiting_organiser_signature','cancelled','expired'))
   OR (p_from IN ('awaiting_signatures','awaiting_band_signature','awaiting_organiser_signature') AND p_to IN ('active','cancelled','expired','amendment_required'))
   OR (p_from='active' AND p_to IN ('amendment_required','cancelled','terminated','fulfilled','breached'))
   OR (p_from='amendment_required' AND p_to IN ('awaiting_signatures','cancelled','terminated'));
END $$;

CREATE OR REPLACE FUNCTION public.validate_festival_setlist_transition(p_from public.festival_setlist_status, p_to public.festival_setlist_status) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
BEGIN
 IF p_from=p_to THEN RETURN true; END IF;
 IF p_from IN ('performed','cancelled') THEN RETURN false; END IF;
 RETURN (p_from='draft' AND p_to IN ('submitted','cancelled'))
   OR (p_from='changes_requested' AND p_to IN ('submitted','cancelled'))
   OR (p_from='submitted' AND p_to IN ('approved','changes_requested','cancelled'))
   OR (p_from='approved' AND p_to IN ('locked','changes_requested','cancelled'))
   OR (p_from='locked' AND p_to IN ('performed','cancelled'));
END $$;

CREATE OR REPLACE FUNCTION public.festival_validate_terms(p_terms jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE k text; allowed text[] := ARRAY['stage_slot_id','proposed_stage_name','proposed_slot_type','proposed_start_at','proposed_end_at','set_duration_minutes','guarantee_fee_cents','deposit_cents','performance_bonus_cents','ticket_bonus_terms','merch_share_percent','travel_terms','accommodation_terms','hospitality_terms','technical_terms','exclusivity_terms','cancellation_terms','currency_code','message','expires_at','headline','soundcheck_start_at','soundcheck_end_at','metadata'];
BEGIN
 IF p_terms IS NULL OR jsonb_typeof(p_terms) <> 'object' THEN RAISE EXCEPTION 'Festival terms must be a JSON object'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_terms) LOOP IF NOT k = ANY(allowed) THEN RAISE EXCEPTION 'Unsupported festival term: %', k; END IF; END LOOP;
 IF COALESCE((p_terms->>'guarantee_fee_cents')::bigint,0) < 0 OR COALESCE((p_terms->>'deposit_cents')::bigint,0) < 0 OR COALESCE((p_terms->>'performance_bonus_cents')::bigint,0) < 0 THEN RAISE EXCEPTION 'Money fields must be non-negative'; END IF;
 IF p_terms ? 'merch_share_percent' AND ((p_terms->>'merch_share_percent')::numeric < 0 OR (p_terms->>'merch_share_percent')::numeric > 100) THEN RAISE EXCEPTION 'Merch share must be between 0 and 100'; END IF;
 IF COALESCE(p_terms->>'currency_code','USD') !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Currency code must be ISO-4217 style'; END IF;
 IF p_terms ? 'set_duration_minutes' AND (p_terms->>'set_duration_minutes')::integer NOT BETWEEN 5 AND 240 THEN RAISE EXCEPTION 'Set duration is outside supported bounds'; END IF;
 RETURN jsonb_build_object(
   'stage_slot_id', p_terms->>'stage_slot_id', 'proposed_stage_name', p_terms->>'proposed_stage_name', 'proposed_slot_type', p_terms->>'proposed_slot_type',
   'proposed_start_at', p_terms->>'proposed_start_at', 'proposed_end_at', p_terms->>'proposed_end_at', 'set_duration_minutes', COALESCE((p_terms->>'set_duration_minutes')::integer,60),
   'guarantee_fee_cents', COALESCE((p_terms->>'guarantee_fee_cents')::bigint,0), 'deposit_cents', COALESCE((p_terms->>'deposit_cents')::bigint,0),
   'performance_bonus_cents', COALESCE((p_terms->>'performance_bonus_cents')::bigint,0), 'ticket_bonus_terms', COALESCE(p_terms->'ticket_bonus_terms','{}'::jsonb),
   'merch_share_percent', CASE WHEN p_terms ? 'merch_share_percent' THEN (p_terms->>'merch_share_percent')::numeric ELSE NULL END,
   'travel_terms', COALESCE(p_terms->'travel_terms','{}'::jsonb), 'accommodation_terms', COALESCE(p_terms->'accommodation_terms','{}'::jsonb),
   'hospitality_terms', COALESCE(p_terms->'hospitality_terms','{}'::jsonb), 'technical_terms', COALESCE(p_terms->'technical_terms','{}'::jsonb),
   'exclusivity_terms', COALESCE(p_terms->'exclusivity_terms','{}'::jsonb), 'cancellation_terms', COALESCE(p_terms->'cancellation_terms','{}'::jsonb),
   'currency_code', COALESCE(p_terms->>'currency_code','USD'), 'message', p_terms->>'message', 'expires_at', p_terms->>'expires_at',
   'headline', COALESCE((p_terms->>'headline')::boolean,false), 'soundcheck_start_at', p_terms->>'soundcheck_start_at', 'soundcheck_end_at', p_terms->>'soundcheck_end_at', 'metadata', COALESCE(p_terms->'metadata','{}'::jsonb)
 );
END $$;

CREATE OR REPLACE FUNCTION public.festival_request_begin(p_operation text, p_scope text, p_entity_id uuid, p_key text, p_hash text, p_actor uuid)
RETURNS public.festival_booking_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.festival_booking_requests%ROWTYPE;
BEGIN
 IF p_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF NULLIF(btrim(p_key),'') IS NULL THEN RAISE EXCEPTION 'Idempotency key is required'; END IF;
 INSERT INTO public.festival_booking_requests(operation,entity_scope,entity_id,actor_profile_id,idempotency_key,request_hash)
 VALUES(p_operation,p_scope,p_entity_id,p_actor,p_key,p_hash)
 ON CONFLICT(operation,actor_profile_id,entity_scope,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key
 RETURNING * INTO r;
 IF r.request_hash <> p_hash THEN RAISE EXCEPTION 'Idempotency key reused with different input'; END IF;
 IF r.completed_at IS NOT NULL THEN RETURN r; END IF;
 RETURN r;
END $$;
CREATE OR REPLACE FUNCTION public.festival_request_complete(p_request_id uuid, p_type text, p_id uuid, p_snapshot jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.festival_booking_requests SET result_entity_type=p_type,result_entity_id=p_id,result_snapshot=COALESCE(p_snapshot,'{}'::jsonb),completed_at=COALESCE(completed_at,now()) WHERE id=p_request_id
$$;

CREATE OR REPLACE FUNCTION public.festival_validate_stage_slot(p_edition_id uuid, p_slot_id uuid, p_terms jsonb) RETURNS public.festival_stage_slots
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.festival_stage_slots%ROWTYPE; ed public.festival_editions%ROWTYPE; st record;
BEGIN
 IF p_slot_id IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO ed FROM public.festival_editions WHERE id=p_edition_id;
 SELECT * INTO s FROM public.festival_stage_slots WHERE id=p_slot_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stage slot not found'; END IF;
 SELECT * INTO st FROM public.festival_stages WHERE id=s.stage_id;
 IF NOT FOUND OR st.festival_id IS DISTINCT FROM ed.festival_id THEN RAISE EXCEPTION 'Stage slot belongs to another festival'; END IF;
 IF s.festival_id IS DISTINCT FROM ed.festival_id THEN RAISE EXCEPTION 'Stage slot belongs to another edition'; END IF;
 IF p_terms ? 'proposed_start_at' AND s.start_time IS NOT NULL AND s.start_time <> (p_terms->>'proposed_start_at')::timestamptz THEN RAISE EXCEPTION 'Stage slot start does not match terms'; END IF;
 IF p_terms ? 'proposed_end_at' AND s.end_time IS NOT NULL AND s.end_time <> (p_terms->>'proposed_end_at')::timestamptz THEN RAISE EXCEPTION 'Stage slot end does not match terms'; END IF;
 IF EXISTS (SELECT 1 FROM public.festival_stage_slot_reservations r WHERE r.stage_slot_id=p_slot_id AND r.status IN ('provisional','confirmed')) THEN RAISE EXCEPTION 'Stage slot already reserved'; END IF;
 RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.create_festival_offer(p_edition_id uuid, p_band_id uuid, p_application_id uuid DEFAULT NULL, p_terms jsonb DEFAULT '{}', p_idempotency_key text DEFAULT NULL) RETURNS public.festival_contract_offers
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=public.current_profile_id_safe(); e public.festival_editions%ROWTYPE; a public.festival_applications%ROWTYPE; o public.festival_contract_offers%ROWTYPE; rev public.festival_offer_revisions%ROWTYPE; terms jsonb; h text; req public.festival_booking_requests%ROWTYPE; slot uuid;
BEGIN
 terms:=public.festival_validate_terms(COALESCE(p_terms,'{}'::jsonb)); h:=public.festival_terms_hash(terms || jsonb_build_object('edition_id',p_edition_id,'band_id',p_band_id,'application_id',p_application_id));
 req:=public.festival_request_begin('create_offer','edition:'||p_edition_id::text,p_application_id,p_idempotency_key,h,actor); IF req.completed_at IS NOT NULL THEN SELECT * INTO o FROM public.festival_contract_offers WHERE id=req.result_entity_id; RETURN o; END IF;
 SELECT * INTO e FROM public.festival_editions WHERE id=p_edition_id FOR SHARE; IF NOT FOUND OR e.status NOT IN ('applications_open','booking','booked','announced') THEN RAISE EXCEPTION 'Edition does not permit booking'; END IF;
 IF NOT public.can_manage_festival_brand(e.festival_id) THEN RAISE EXCEPTION 'Not authorised to create festival offer'; END IF;
 IF p_application_id IS NOT NULL THEN SELECT * INTO a FROM public.festival_applications WHERE id=p_application_id FOR UPDATE; IF NOT FOUND OR a.edition_id<>p_edition_id OR a.band_id<>p_band_id THEN RAISE EXCEPTION 'Application does not match offer'; END IF; IF a.status NOT IN ('submitted','under_review','shortlisted','waitlisted') THEN RAISE EXCEPTION 'Application is not offer eligible'; END IF; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.bands WHERE id=p_band_id) THEN RAISE EXCEPTION 'Band not found'; END IF;
 IF EXISTS (SELECT 1 FROM public.festival_contracts WHERE edition_id=p_edition_id AND band_id=p_band_id AND status IN ('awaiting_signatures','awaiting_band_signature','awaiting_organiser_signature','active','amendment_required')) THEN RAISE EXCEPTION 'Active festival contract already exists'; END IF;
 slot:=NULLIF(terms->>'stage_slot_id','')::uuid; IF slot IS NOT NULL THEN PERFORM public.festival_validate_stage_slot(p_edition_id,slot,terms); END IF;
 INSERT INTO public.festival_contract_offers(edition_id,application_id,band_id,created_by_profile_id,status,stage_slot_id,proposed_stage_name,proposed_slot_type,proposed_start_at,proposed_end_at,guarantee_fee_cents,deposit_cents,performance_bonus_cents,set_duration_minutes,currency_code,message,expires_at,idempotency_key,request_hash,current_terms_hash)
 VALUES(p_edition_id,p_application_id,p_band_id,actor,'sent',slot,terms->>'proposed_stage_name',terms->>'proposed_slot_type',(terms->>'proposed_start_at')::timestamptz,(terms->>'proposed_end_at')::timestamptz,(terms->>'guarantee_fee_cents')::bigint,(terms->>'deposit_cents')::bigint,(terms->>'performance_bonus_cents')::bigint,(terms->>'set_duration_minutes')::integer,terms->>'currency_code',terms->>'message',(terms->>'expires_at')::timestamptz,p_idempotency_key,h,h) RETURNING * INTO o;
 INSERT INTO public.festival_offer_revisions(offer_id,revision_number,proposed_by_side,proposed_by_profile_id,terms_snapshot,request_hash,idempotency_key) VALUES(o.id,1,'organiser',actor,terms,h,p_idempotency_key) RETURNING * INTO rev;
 UPDATE public.festival_contract_offers SET current_revision_id=rev.id WHERE id=o.id RETURNING * INTO o;
 IF slot IS NOT NULL THEN INSERT INTO public.festival_stage_slot_reservations(edition_id,stage_slot_id,offer_id,band_id,status,reserved_until) VALUES(p_edition_id,slot,o.id,p_band_id,'provisional',(terms->>'expires_at')::timestamptz); END IF;
 IF p_application_id IS NOT NULL THEN IF NOT public.validate_festival_application_transition(a.status,'offer_pending') THEN RAISE EXCEPTION 'Invalid application transition'; END IF; UPDATE public.festival_applications SET status='offer_pending',updated_at=now() WHERE id=a.id; END IF;
 PERFORM public.festival_request_complete(req.id,'festival_contract_offer',o.id,to_jsonb(o)); RETURN o;
END $$;

CREATE OR REPLACE FUNCTION public.submit_festival_application(p_edition_id uuid, p_band_id uuid, p_details jsonb DEFAULT '{}', p_idempotency_key text DEFAULT NULL) RETURNS public.festival_applications
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=public.current_profile_id_safe(); e public.festival_editions%ROWTYPE; app public.festival_applications%ROWTYPE; h text; req public.festival_booking_requests%ROWTYPE; allowed text[]:=ARRAY['preferred_stage_types','preferred_slot_types','preferred_dates','minimum_fee_cents','requested_fee_cents','currency_code','requested_set_minutes','application_message']; k text;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 FOR k IN SELECT jsonb_object_keys(COALESCE(p_details,'{}'::jsonb)) LOOP IF NOT k=ANY(allowed) THEN RAISE EXCEPTION 'Unsupported application field: %', k; END IF; END LOOP;
 h:=public.festival_terms_hash(COALESCE(p_details,'{}') || jsonb_build_object('edition_id',p_edition_id,'band_id',p_band_id)); req:=public.festival_request_begin('submit_application','edition:'||p_edition_id::text,p_band_id,p_idempotency_key,h,actor); IF req.completed_at IS NOT NULL THEN SELECT * INTO app FROM public.festival_applications WHERE id=req.result_entity_id; RETURN app; END IF;
 SELECT * INTO e FROM public.festival_editions WHERE id=p_edition_id FOR SHARE; IF NOT FOUND OR e.status NOT IN ('applications_open','booking') OR e.end_at <= now() THEN RAISE EXCEPTION 'Festival edition is not open for applications'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.bands WHERE id=p_band_id) THEN RAISE EXCEPTION 'Band not found'; END IF; IF NOT public.can_apply_for_band(p_band_id,actor) THEN RAISE EXCEPTION 'Not authorised to submit for this band'; END IF;
 IF EXISTS (SELECT 1 FROM public.festival_applications WHERE edition_id=p_edition_id AND band_id=p_band_id AND status IN ('draft','submitted','under_review','waitlisted','shortlisted','offer_pending')) THEN RAISE EXCEPTION 'Active application already exists'; END IF;
 IF COALESCE((p_details->>'minimum_fee_cents')::bigint,0) < 0 OR COALESCE((p_details->>'requested_fee_cents')::bigint,0) < 0 THEN RAISE EXCEPTION 'Fees must be non-negative'; END IF;
 IF COALESCE(p_details->>'currency_code','USD') !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Currency code must be valid'; END IF;
 INSERT INTO public.festival_applications(edition_id,band_id,submitted_by_profile_id,preferred_stage_types,preferred_slot_types,preferred_dates,minimum_fee_cents,requested_fee_cents,currency_code,requested_set_minutes,application_message,eligibility_snapshot,band_snapshot,idempotency_key,request_hash)
 VALUES(p_edition_id,p_band_id,actor,COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_details->'preferred_stage_types')),'{}'),COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_details->'preferred_slot_types')),'{}'),COALESCE(p_details->'preferred_dates','[]'),(p_details->>'minimum_fee_cents')::bigint,(p_details->>'requested_fee_cents')::bigint,COALESCE(p_details->>'currency_code','USD'),(p_details->>'requested_set_minutes')::integer,p_details->>'application_message',jsonb_build_object('outcome','eligible','advisory_conflicts','[]'::jsonb), (SELECT to_jsonb(b) FROM public.bands b WHERE b.id=p_band_id),p_idempotency_key,h) RETURNING * INTO app;
 INSERT INTO public.festival_application_events(application_id,to_state,actor_profile_id,metadata,idempotency_key) VALUES(app.id,'submitted',actor,jsonb_build_object('event','submitted'),p_idempotency_key);
 PERFORM public.festival_request_complete(req.id,'festival_application',app.id,to_jsonb(app)); RETURN app;
END $$;

CREATE OR REPLACE FUNCTION public.counter_festival_offer(p_offer_id uuid, p_expected_revision integer, p_terms jsonb, p_change_summary text DEFAULT NULL, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_offer_revisions
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=public.current_profile_id_safe(); o public.festival_contract_offers%ROWTYPE; cur public.festival_offer_revisions%ROWTYPE; rev public.festival_offer_revisions%ROWTYPE; e public.festival_editions%ROWTYPE; side public.festival_booking_side; terms jsonb:=public.festival_validate_terms(p_terms); h text; req public.festival_booking_requests%ROWTYPE;
BEGIN
 SELECT * INTO o FROM public.festival_contract_offers WHERE id=p_offer_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Offer not found'; END IF; SELECT * INTO cur FROM public.festival_offer_revisions WHERE id=o.current_revision_id FOR UPDATE; SELECT * INTO e FROM public.festival_editions WHERE id=o.edition_id;
 IF cur.revision_number<>p_expected_revision THEN RAISE EXCEPTION 'Stale offer revision'; END IF; IF o.expires_at IS NOT NULL AND o.expires_at <= now() THEN RAISE EXCEPTION 'Offer has expired'; END IF; IF o.status NOT IN ('sent','viewed','countered') THEN RAISE EXCEPTION 'Offer is not negotiable'; END IF;
 IF public.can_manage_festival_brand(e.festival_id) THEN side:='organiser'; ELSIF public.can_negotiate_for_band(o.band_id,actor) THEN side:='band'; ELSE RAISE EXCEPTION 'Not authorised'; END IF;
 IF side=cur.proposed_by_side THEN RAISE EXCEPTION 'Current proposer cannot counter itself'; END IF;
 h:=public.festival_terms_hash(terms || jsonb_build_object('offer_id',p_offer_id,'expected_revision',p_expected_revision,'side',side)); req:=public.festival_request_begin('counter_offer','offer:'||p_offer_id::text,p_offer_id,p_idempotency_key,h,actor); IF req.completed_at IS NOT NULL THEN SELECT * INTO rev FROM public.festival_offer_revisions WHERE id=req.result_entity_id; RETURN rev; END IF;
 INSERT INTO public.festival_offer_revisions(offer_id,revision_number,proposed_by_side,proposed_by_profile_id,terms_snapshot,change_summary,request_hash,idempotency_key) VALUES(p_offer_id,p_expected_revision+1,side,actor,terms,p_change_summary,h,p_idempotency_key) RETURNING * INTO rev;
 UPDATE public.festival_contract_offers SET offer_revision=rev.revision_number,current_revision_id=rev.id,status='countered',current_terms_hash=h,updated_at=now() WHERE id=p_offer_id;
 PERFORM public.festival_request_complete(req.id,'festival_offer_revision',rev.id,to_jsonb(rev)); RETURN rev;
END $$;

CREATE OR REPLACE FUNCTION public.accept_festival_offer(p_offer_id uuid, p_revision_number integer, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_contracts
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=public.current_profile_id_safe(); o public.festival_contract_offers%ROWTYPE; rev public.festival_offer_revisions%ROWTYPE; e public.festival_editions%ROWTYPE; c public.festival_contracts%ROWTYPE; v public.festival_contract_versions%ROWTYPE; side public.festival_booking_side; h text; req public.festival_booking_requests%ROWTYPE; res public.festival_stage_slot_reservations%ROWTYPE;
BEGIN
 SELECT * INTO o FROM public.festival_contract_offers WHERE id=p_offer_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Offer not found'; END IF; SELECT * INTO rev FROM public.festival_offer_revisions WHERE id=o.current_revision_id FOR UPDATE; SELECT * INTO e FROM public.festival_editions WHERE id=o.edition_id;
 h:=public.festival_terms_hash(jsonb_build_object('offer_id',p_offer_id,'revision',p_revision_number)); req:=public.festival_request_begin('accept_offer','offer:'||p_offer_id::text,p_offer_id,p_idempotency_key,h,actor); IF req.completed_at IS NOT NULL THEN SELECT * INTO c FROM public.festival_contracts WHERE id=req.result_entity_id; RETURN c; END IF;
 IF rev.revision_number<>p_revision_number THEN RAISE EXCEPTION 'Offer revision mismatch'; END IF; IF o.expires_at IS NOT NULL AND o.expires_at <= now() THEN RAISE EXCEPTION 'Offer has expired'; END IF; IF o.status NOT IN ('sent','viewed','countered') THEN RAISE EXCEPTION 'Offer cannot be accepted'; END IF;
 IF public.can_manage_festival_brand(e.festival_id) THEN side:='organiser'; ELSIF public.can_sign_for_band(o.band_id,actor) THEN side:='band'; ELSE RAISE EXCEPTION 'Not authorised'; END IF; IF side=rev.proposed_by_side THEN RAISE EXCEPTION 'Proposer cannot accept own revision'; END IF;
 IF o.stage_slot_id IS NOT NULL THEN SELECT * INTO res FROM public.festival_stage_slot_reservations WHERE offer_id=o.id AND status='provisional' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Stage reservation was lost'; END IF; END IF;
 INSERT INTO public.festival_contracts(edition_id,application_id,offer_id,accepted_offer_revision_id,band_id,festival_id,stage_slot_id,status,contract_version,terms_snapshot) VALUES(o.edition_id,o.application_id,o.id,rev.id,o.band_id,e.festival_id,o.stage_slot_id,'awaiting_signatures',1,rev.terms_snapshot) RETURNING * INTO c;
 INSERT INTO public.festival_contract_versions(contract_id,version,terms_snapshot,terms_hash,created_by_profile_id,created_by_side,reason) VALUES(c.id,1,rev.terms_snapshot,public.festival_terms_hash(rev.terms_snapshot),actor,side,'accepted offer') RETURNING * INTO v;
 UPDATE public.festival_contracts SET current_version_id=v.id WHERE id=c.id RETURNING * INTO c; UPDATE public.festival_contract_offers SET status='accepted_pending_contract',accepted_revision_id=rev.id,responded_at=now() WHERE id=o.id; UPDATE public.festival_stage_slot_reservations SET contract_id=c.id WHERE offer_id=o.id AND status='provisional';
 PERFORM public.festival_request_complete(req.id,'festival_contract',c.id,to_jsonb(c)); RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.sign_festival_contract(p_contract_id uuid, p_expected_contract_version integer, p_signing_side public.festival_booking_side, p_acknowledgement jsonb DEFAULT '{}', p_idempotency_key text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=public.current_profile_id_safe(); c public.festival_contracts%ROWTYPE; v public.festival_contract_versions%ROWTYPE; e public.festival_editions%ROWTYPE; s public.festival_contract_signatures%ROWTYPE; req public.festival_booking_requests%ROWTYPE; h text; updated_slot uuid;
BEGIN
 SELECT * INTO c FROM public.festival_contracts WHERE id=p_contract_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF; SELECT * INTO v FROM public.festival_contract_versions WHERE id=c.current_version_id FOR UPDATE; SELECT * INTO e FROM public.festival_editions WHERE id=c.edition_id;
 h:=public.festival_terms_hash(jsonb_build_object('contract_id',p_contract_id,'version',p_expected_contract_version,'side',p_signing_side,'ack',COALESCE(p_acknowledgement,'{}'::jsonb))); req:=public.festival_request_begin('sign_contract','contract:'||p_contract_id::text,p_contract_id,p_idempotency_key,h,actor); IF req.completed_at IS NOT NULL THEN RETURN req.result_snapshot; END IF;
 IF c.status NOT IN ('awaiting_signatures','awaiting_band_signature','awaiting_organiser_signature','proposed') THEN RAISE EXCEPTION 'Contract is not signable'; END IF; IF v.version<>p_expected_contract_version OR v.terms_hash<>public.festival_terms_hash(c.terms_snapshot) THEN RAISE EXCEPTION 'Contract version mismatch'; END IF;
 IF p_signing_side='band' AND NOT public.can_sign_for_band(c.band_id,actor) THEN RAISE EXCEPTION 'Not authorised to sign for band'; END IF; IF p_signing_side='organiser' AND NOT public.can_manage_festival_brand(e.festival_id) THEN RAISE EXCEPTION 'Not authorised to sign for organiser'; END IF; IF jsonb_typeof(COALESCE(p_acknowledgement,'{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'Acknowledgement must be an object'; END IF;
 INSERT INTO public.festival_contract_signatures(contract_id,contract_version,signing_side,profile_id,terms_hash,acknowledgement_snapshot,idempotency_key) VALUES(c.id,p_expected_contract_version,p_signing_side,actor,v.terms_hash,p_acknowledgement,p_idempotency_key) RETURNING * INTO s;
 IF EXISTS (SELECT 1 FROM public.festival_contract_signatures WHERE contract_id=c.id AND contract_version=v.version AND signing_side='band' FOR UPDATE) AND EXISTS (SELECT 1 FROM public.festival_contract_signatures WHERE contract_id=c.id AND contract_version=v.version AND signing_side='organiser' FOR UPDATE) THEN
   IF c.stage_slot_id IS NOT NULL THEN
     UPDATE public.festival_stage_slot_reservations SET status='confirmed',confirmed_at=now() WHERE contract_id=c.id AND stage_slot_id=c.stage_slot_id AND status='provisional'; IF NOT FOUND THEN RAISE EXCEPTION 'Stage reservation was lost'; END IF;
     UPDATE public.festival_stage_slots SET canonical_contract_id=c.id, band_id=c.band_id, status='confirmed' WHERE id=c.stage_slot_id AND (canonical_contract_id IS NULL OR canonical_contract_id=c.id) RETURNING id INTO updated_slot; IF updated_slot IS NULL THEN RAISE EXCEPTION 'Stage slot assignment failed'; END IF;
   END IF;
   INSERT INTO public.player_scheduled_activities(user_id,profile_id,activity_type,scheduled_start,scheduled_end,duration_minutes,status,title,description,metadata)
   SELECT bm.user_id,bm.profile_id,'gig',(v.terms_snapshot->>'proposed_start_at')::timestamptz,(v.terms_snapshot->>'proposed_end_at')::timestamptz,EXTRACT(EPOCH FROM ((v.terms_snapshot->>'proposed_end_at')::timestamptz-(v.terms_snapshot->>'proposed_start_at')::timestamptz))/60,'scheduled','Festival performance','Canonical festival booking block',jsonb_build_object('canonical_edition_id',c.edition_id,'festival_contract_id',c.id,'stage_slot_id',c.stage_slot_id,'band_id',c.band_id)
   FROM public.band_members bm WHERE bm.band_id=c.band_id AND COALESCE(bm.member_status,'active')='active' AND bm.user_id IS NOT NULL
   ON CONFLICT DO NOTHING;
   UPDATE public.festival_contracts SET status='active',activated_at=now(),band_signature_status='signed',organiser_signature_status='signed',band_signed_at=COALESCE(band_signed_at,now()),organiser_signed_at=COALESCE(organiser_signed_at,now()) WHERE id=c.id RETURNING * INTO c;
   UPDATE public.festival_contract_offers SET status='converted_to_contract' WHERE id=c.offer_id; UPDATE public.festival_applications SET status='converted_to_contract' WHERE id=c.application_id;
 END IF;
 PERFORM public.festival_request_complete(req.id,'festival_contract_signature',s.id,jsonb_build_object('contract',to_jsonb(c),'signature',to_jsonb(s))); RETURN jsonb_build_object('contract',to_jsonb(c),'signature',to_jsonb(s));
END $$;

CREATE OR REPLACE FUNCTION public.cancel_festival_contract(p_contract_id uuid, p_reason text, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_contracts
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=public.current_profile_id_safe(); c public.festival_contracts%ROWTYPE; e public.festival_editions%ROWTYPE; side public.festival_booking_side; req public.festival_booking_requests%ROWTYPE; h text;
BEGIN
 IF NULLIF(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Cancellation reason is required'; END IF; SELECT * INTO c FROM public.festival_contracts WHERE id=p_contract_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Contract not found'; END IF; SELECT * INTO e FROM public.festival_editions WHERE id=c.edition_id;
 h:=public.festival_terms_hash(jsonb_build_object('contract_id',p_contract_id,'reason',p_reason)); req:=public.festival_request_begin('cancel_contract','contract:'||p_contract_id::text,p_contract_id,p_idempotency_key,h,actor); IF req.completed_at IS NOT NULL THEN SELECT * INTO c FROM public.festival_contracts WHERE id=req.result_entity_id; RETURN c; END IF;
 IF c.status IN ('cancelled','terminated','fulfilled','expired') THEN RAISE EXCEPTION 'Terminal contract cannot be cancelled again'; END IF; IF public.can_manage_festival_brand(e.festival_id) THEN side:='organiser'; ELSIF public.can_negotiate_for_band(c.band_id,actor) THEN side:='band'; ELSE RAISE EXCEPTION 'Not authorised'; END IF;
 UPDATE public.festival_stage_slot_reservations SET status='released',released_at=now(),release_reason=p_reason WHERE contract_id=c.id AND status IN ('provisional','confirmed'); UPDATE public.festival_stage_slots SET canonical_contract_id=NULL,band_id=NULL,status='open' WHERE canonical_contract_id=c.id;
 UPDATE public.player_scheduled_activities SET status='cancelled',metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object('cancelled_by_festival_contract',c.id) WHERE metadata->>'festival_contract_id'=c.id::text AND status IN ('scheduled','in_progress');
 UPDATE public.festival_contracts SET status='cancelled',cancelled_at=now(),cancellation_reason=p_reason,cancelled_by_side=side,cancelled_by_profile_id=actor,settlement_required=(status='active') WHERE id=c.id RETURNING * INTO c;
 INSERT INTO public.festival_contract_events(contract_id,from_state,to_state,actor_profile_id,reason,idempotency_key) VALUES(c.id,NULL,'cancelled',actor,p_reason,p_idempotency_key) ON CONFLICT DO NOTHING; PERFORM public.festival_request_complete(req.id,'festival_contract',c.id,to_jsonb(c)); RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.save_festival_setlist_draft(p_contract_id uuid, p_expected_version integer, p_items jsonb, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_contract_setlists
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=public.current_profile_id_safe(); c public.festival_contracts%ROWTYPE; cur public.festival_contract_setlists%ROWTYPE; sl public.festival_contract_setlists%ROWTYPE; maxsec int; total int; h text; req public.festival_booking_requests%ROWTYPE; item jsonb; pos int:=0;
BEGIN
 SELECT * INTO c FROM public.festival_contracts WHERE id=p_contract_id FOR SHARE; IF NOT FOUND OR c.status<>'active' THEN RAISE EXCEPTION 'Active contract required'; END IF; IF NOT public.can_negotiate_for_band(c.band_id,actor) THEN RAISE EXCEPTION 'Not authorised to edit setlist'; END IF;
 IF jsonb_typeof(COALESCE(p_items,'[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'Setlist items must be an array'; END IF; h:=public.festival_terms_hash(COALESCE(p_items,'[]'::jsonb)); req:=public.festival_request_begin('save_setlist','contract:'||p_contract_id::text,p_contract_id,p_idempotency_key,h,actor); IF req.completed_at IS NOT NULL THEN SELECT * INTO sl FROM public.festival_contract_setlists WHERE id=req.result_entity_id; RETURN sl; END IF;
 SELECT * INTO cur FROM public.festival_contract_setlists WHERE contract_id=c.id AND is_current FOR UPDATE; IF FOUND AND cur.status='locked' THEN RAISE EXCEPTION 'Locked setlist cannot be edited'; END IF; IF FOUND AND cur.version<>p_expected_version THEN RAISE EXCEPTION 'Setlist version mismatch'; END IF;
 maxsec:=COALESCE((c.terms_snapshot->>'set_duration_minutes')::int,60)*60; SELECT COALESCE(sum((value->>'planned_duration_seconds')::int),0) INTO total FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb)); IF total>maxsec OR total<60 THEN RAISE EXCEPTION 'Setlist duration outside contracted bounds'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb)) x LEFT JOIN public.songs s ON s.id=(x.value->>'song_id')::uuid WHERE s.id IS NULL OR COALESCE(s.status,'draft') NOT IN ('recorded','released','active')) THEN RAISE EXCEPTION 'Setlist contains an invalid song'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb)) x LEFT JOIN public.songs s ON s.id=(x.value->>'song_id')::uuid WHERE COALESCE(s.band_id,c.band_id)<>c.band_id AND COALESCE(s.user_id,s.artist_id) NOT IN (SELECT bm.user_id FROM public.band_members bm WHERE bm.band_id=c.band_id)) THEN RAISE EXCEPTION 'Setlist contains a song this band cannot perform'; END IF;
 UPDATE public.festival_contract_setlists SET is_current=false WHERE contract_id=c.id AND is_current;
 INSERT INTO public.festival_contract_setlists(contract_id,band_id,edition_id,status,version,total_duration_seconds,maximum_duration_seconds,supersedes_setlist_id,is_current,content_hash,idempotency_key) VALUES(c.id,c.band_id,c.edition_id,'draft',COALESCE(cur.version,0)+1,total,maxsec,cur.id,true,h,p_idempotency_key) RETURNING * INTO sl;
 FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb)) LOOP pos:=pos+1; INSERT INTO public.festival_contract_setlist_items(setlist_id,position,song_id,planned_duration_seconds,performance_notes,transition_notes,is_encore,guest_profile_id) VALUES(sl.id,pos,(item->>'song_id')::uuid,(item->>'planned_duration_seconds')::int,item->>'performance_notes',item->>'transition_notes',COALESCE((item->>'is_encore')::boolean,false),NULLIF(item->>'guest_profile_id','')::uuid); END LOOP;
 PERFORM public.festival_request_complete(req.id,'festival_contract_setlist',sl.id,to_jsonb(sl)); RETURN sl;
END $$;

CREATE OR REPLACE FUNCTION public.submit_festival_setlist(p_setlist_id uuid, p_idempotency_key text DEFAULT gen_random_uuid()::text) RETURNS public.festival_contract_setlists LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE sl public.festival_contract_setlists%ROWTYPE; BEGIN SELECT * INTO sl FROM public.festival_contract_setlists WHERE id=p_setlist_id FOR UPDATE; IF NOT public.can_negotiate_for_band(sl.band_id) THEN RAISE EXCEPTION 'Not authorised'; END IF; IF NOT public.validate_festival_setlist_transition(sl.status,'submitted') THEN RAISE EXCEPTION 'Invalid setlist transition'; END IF; UPDATE public.festival_contract_setlists SET status='submitted',submitted_by_profile_id=public.current_profile_id_safe(),submitted_at=now() WHERE id=sl.id RETURNING * INTO sl; RETURN sl; END $$;
CREATE OR REPLACE FUNCTION public.review_festival_setlist(p_setlist_id uuid, p_action text, p_reason text DEFAULT NULL, p_idempotency_key text DEFAULT gen_random_uuid()::text) RETURNS public.festival_contract_setlists LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE sl public.festival_contract_setlists%ROWTYPE; e public.festival_editions%ROWTYPE; ns public.festival_setlist_status; BEGIN SELECT * INTO sl FROM public.festival_contract_setlists WHERE id=p_setlist_id FOR UPDATE; SELECT * INTO e FROM public.festival_editions WHERE id=sl.edition_id; IF NOT public.can_manage_festival_brand(e.festival_id) THEN RAISE EXCEPTION 'Not authorised'; END IF; ns:=CASE WHEN p_action='approve' THEN 'approved'::public.festival_setlist_status WHEN p_action='request_changes' THEN 'changes_requested'::public.festival_setlist_status ELSE NULL END; IF ns IS NULL THEN RAISE EXCEPTION 'Unsupported setlist action'; END IF; IF ns='changes_requested' AND NULLIF(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Change request reason is required'; END IF; IF NOT public.validate_festival_setlist_transition(sl.status,ns) THEN RAISE EXCEPTION 'Invalid setlist transition'; END IF; UPDATE public.festival_contract_setlists SET status=ns,approved_at=CASE WHEN ns='approved' THEN now() ELSE approved_at END,changes_requested_reason=CASE WHEN ns='changes_requested' THEN p_reason ELSE changes_requested_reason END WHERE id=sl.id RETURNING * INTO sl; RETURN sl; END $$;
CREATE OR REPLACE FUNCTION public.lock_festival_setlist(p_setlist_id uuid, p_idempotency_key text DEFAULT gen_random_uuid()::text) RETURNS public.festival_contract_setlists LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE sl public.festival_contract_setlists%ROWTYPE; e public.festival_editions%ROWTYPE; BEGIN SELECT * INTO sl FROM public.festival_contract_setlists WHERE id=p_setlist_id FOR UPDATE; SELECT * INTO e FROM public.festival_editions WHERE id=sl.edition_id; IF NOT public.can_manage_festival_brand(e.festival_id) THEN RAISE EXCEPTION 'Not authorised'; END IF; IF NOT EXISTS (SELECT 1 FROM public.festival_contracts c WHERE c.id=sl.contract_id AND c.status='active') THEN RAISE EXCEPTION 'Active contract required'; END IF; IF NOT public.validate_festival_setlist_transition(sl.status,'locked') THEN RAISE EXCEPTION 'Invalid setlist transition'; END IF; UPDATE public.festival_contract_setlists SET status='locked',locked_at=now() WHERE id=sl.id RETURNING * INTO sl; RETURN sl; END $$;

CREATE OR REPLACE FUNCTION public.public_festival_lineup_read(p_edition_id uuid DEFAULT NULL)
RETURNS TABLE(edition_id uuid, festival_id uuid, band_id uuid, band_name text, stage_name text, start_at timestamptz, end_at timestamptz, slot_type text, headline boolean, public_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.edition_id,c.festival_id,c.band_id,b.name::text,COALESCE(st.stage_name,c.terms_snapshot->>'proposed_stage_name','TBA')::text,(c.terms_snapshot->>'proposed_start_at')::timestamptz,(c.terms_snapshot->>'proposed_end_at')::timestamptz,c.terms_snapshot->>'proposed_slot_type',COALESCE((c.terms_snapshot->>'headline')::boolean,false),c.status::text
 FROM public.festival_contracts c JOIN public.bands b ON b.id=c.band_id LEFT JOIN public.festival_stage_slots ss ON ss.id=c.stage_slot_id LEFT JOIN public.festival_stages st ON st.id=ss.stage_id
 WHERE c.status='active' AND (p_edition_id IS NULL OR c.edition_id=p_edition_id)
$$;

CREATE OR REPLACE FUNCTION public.band_festival_booking_workspace(p_band_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN NOT public.is_current_band_member(p_band_id) THEN '{}'::jsonb ELSE jsonb_build_object('applications',(SELECT COALESCE(jsonb_agg(to_jsonb(a)-'organiser_notes'),'[]'::jsonb) FROM public.festival_applications a WHERE a.band_id=p_band_id),'offers',(SELECT COALESCE(jsonb_agg(to_jsonb(o) || jsonb_build_object('current_revision',(SELECT to_jsonb(r) FROM public.festival_offer_revisions r WHERE r.id=o.current_revision_id))),'[]'::jsonb) FROM public.festival_contract_offers o WHERE o.band_id=p_band_id),'contracts',(SELECT COALESCE(jsonb_agg(to_jsonb(c)),'[]'::jsonb) FROM public.festival_contracts c WHERE c.band_id=p_band_id),'setlists',(SELECT COALESCE(jsonb_agg(to_jsonb(s)),'[]'::jsonb) FROM public.festival_contract_setlists s WHERE s.band_id=p_band_id)) END
$$;
CREATE OR REPLACE FUNCTION public.organiser_festival_booking_workspace(p_edition_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM public.festival_editions e WHERE e.id=p_edition_id AND public.can_manage_festival_brand(e.festival_id)) THEN '{}'::jsonb ELSE jsonb_build_object('applications',(SELECT COALESCE(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM public.festival_applications a WHERE a.edition_id=p_edition_id),'offers',(SELECT COALESCE(jsonb_agg(to_jsonb(o)),'[]'::jsonb) FROM public.festival_contract_offers o WHERE o.edition_id=p_edition_id),'contracts',(SELECT COALESCE(jsonb_agg(to_jsonb(c)),'[]'::jsonb) FROM public.festival_contracts c WHERE c.edition_id=p_edition_id),'setlists',(SELECT COALESCE(jsonb_agg(to_jsonb(s)),'[]'::jsonb) FROM public.festival_contract_setlists s WHERE s.edition_id=p_edition_id)) END
$$;

ALTER TABLE public.festival_booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_stage_slot_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_contract_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON FUNCTION public.submit_festival_application(uuid,uuid,jsonb,text), public.create_festival_offer(uuid,uuid,uuid,jsonb,text), public.counter_festival_offer(uuid,integer,jsonb,text,text), public.accept_festival_offer(uuid,integer,text), public.sign_festival_contract(uuid,integer,public.festival_booking_side,jsonb,text), public.cancel_festival_contract(uuid,text,text), public.save_festival_setlist_draft(uuid,integer,jsonb,text), public.submit_festival_setlist(uuid,text), public.review_festival_setlist(uuid,text,text,text), public.lock_festival_setlist(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_festival_application(uuid,uuid,jsonb,text), public.create_festival_offer(uuid,uuid,uuid,jsonb,text), public.counter_festival_offer(uuid,integer,jsonb,text,text), public.accept_festival_offer(uuid,integer,text), public.sign_festival_contract(uuid,integer,public.festival_booking_side,jsonb,text), public.cancel_festival_contract(uuid,text,text), public.save_festival_setlist_draft(uuid,integer,jsonb,text), public.submit_festival_setlist(uuid,text), public.review_festival_setlist(uuid,text,text,text), public.lock_festival_setlist(uuid,text), public.band_festival_booking_workspace(uuid), public.organiser_festival_booking_workspace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_festival_lineup_read(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.can_manage_festival_booking(uuid,uuid) IS 'Festival booking authority: active band leader/founder/co-leader/manager or admin only; normal members cannot bind the band.';
COMMENT ON FUNCTION public.public_festival_lineup_read(uuid) IS 'Safe public projection for active festival lineup; excludes fees, deposits, bonuses, rider terms, signatures, organiser notes and private application data.';
COMMENT ON TABLE public.festival_booking_requests IS 'Canonical idempotency records for festival booking mutations. Reused keys must have identical request hashes.';
