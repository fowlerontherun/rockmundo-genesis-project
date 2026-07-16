-- Repair confirmed canonical festival blockers and expose safe settlement projections.

ALTER TABLE public.festival_expense_ledger ALTER COLUMN currency_code DROP DEFAULT;
ALTER TABLE public.festival_expense_ledger ALTER COLUMN currency_code DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.resolve_festival_stage_edition(p_stage_id uuid)
RETURNS TABLE(edition_id uuid, festival_brand_id uuid, legacy_event_id uuid, resolution_source text, is_ambiguous boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE st public.festival_stages%ROWTYPE; mapped_editions int; mapped_edition uuid; mapped_brand uuid;
BEGIN
  SELECT * INTO st FROM public.festival_stages WHERE id=p_stage_id;
  IF NOT FOUND THEN RETURN QUERY SELECT NULL::uuid,NULL::uuid,NULL::uuid,'missing_stage',true; RETURN; END IF;
  IF st.edition_id IS NOT NULL THEN
    RETURN QUERY SELECT e.id,e.festival_id,CASE WHEN m.legacy_source='game_event' THEN m.legacy_id END,'stage.edition_id',false FROM public.festival_editions e LEFT JOIN public.festival_legacy_mappings m ON m.edition_id=e.id AND m.legacy_source='game_event' WHERE e.id=st.edition_id LIMIT 1; RETURN;
  END IF;
  SELECT count(DISTINCT m.edition_id), min(m.edition_id) INTO mapped_editions, mapped_edition FROM public.festival_legacy_mappings m WHERE m.legacy_source='game_event' AND m.legacy_id=st.festival_id;
  IF mapped_editions = 1 THEN
    SELECT e.festival_id INTO mapped_brand FROM public.festival_editions e WHERE e.id=mapped_edition;
    RETURN QUERY SELECT mapped_edition,mapped_brand,st.festival_id,'festival_legacy_mappings.game_event',false; RETURN;
  END IF;
  RETURN QUERY SELECT NULL::uuid,NULL::uuid,st.festival_id,CASE WHEN mapped_editions > 1 THEN 'ambiguous_legacy_mapping' ELSE 'unresolved_legacy_mapping' END,true;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_festival_stage_slot_consistency()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE resolved record; ed public.festival_editions%ROWTYPE;
BEGIN
  SELECT * INTO resolved FROM public.resolve_festival_stage_edition(NEW.stage_id);
  IF resolved.resolution_source='missing_stage' THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FESTIVAL_SLOT_STAGE_MISSING: slot stage does not exist'; END IF;
  IF resolved.is_ambiguous OR resolved.edition_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FESTIVAL_STAGE_EDITION_UNRESOLVED: repair legacy stage mapping before creating slots'; END IF;
  IF NEW.edition_id IS DISTINCT FROM resolved.edition_id THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FESTIVAL_SLOT_EDITION_MISMATCH: slot edition must match resolved stage edition'; END IF;
  SELECT * INTO ed FROM public.festival_editions WHERE id=NEW.edition_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FESTIVAL_SLOT_EDITION_MISSING: slot edition does not exist'; END IF;
  IF ed.festival_id IS DISTINCT FROM resolved.festival_brand_id THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FESTIVAL_STAGE_FESTIVAL_MISMATCH: resolved stage brand must match edition brand'; END IF;
  IF NEW.start_time IS NULL OR NEW.end_time IS NULL OR NEW.end_time <= NEW.start_time THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FESTIVAL_SLOT_INVALID_TIME: slot end must be after start'; END IF;
  IF ed.start_at IS NOT NULL AND NEW.start_time < ed.start_at THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FESTIVAL_SLOT_OUTSIDE_EDITION: slot starts before edition'; END IF;
  IF ed.end_at IS NOT NULL AND NEW.end_time > ed.end_at THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FESTIVAL_SLOT_OUTSIDE_EDITION: slot ends after edition'; END IF;
  IF NEW.archived_at IS NULL AND EXISTS (SELECT 1 FROM public.festival_stage_slots s WHERE s.stage_id=NEW.stage_id AND s.id IS DISTINCT FROM NEW.id AND s.archived_at IS NULL AND tstzrange(s.start_time,s.end_time,'[)') && tstzrange(NEW.start_time,NEW.end_time,'[)')) THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FESTIVAL_SLOT_OVERLAP: active stage slots cannot overlap'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS festival_stage_slot_consistency_trg ON public.festival_stage_slots;
CREATE TRIGGER festival_stage_slot_consistency_trg BEFORE INSERT OR UPDATE ON public.festival_stage_slots FOR EACH ROW EXECUTE FUNCTION public.enforce_festival_stage_slot_consistency();

UPDATE public.festival_expense_ledger l SET edition_id=e.id FROM public.festival_editions e WHERE l.edition_id IS NULL AND l.festival_id=e.festival_id AND l.edition_number=e.edition_number;
UPDATE public.festival_expense_ledger l SET currency_code=e.currency_code FROM public.festival_editions e WHERE l.edition_id=e.id AND (l.currency_code IS NULL OR btrim(l.currency_code)='');
UPDATE public.festival_expense_ledger SET category = CASE category WHEN 'staff' THEN 'staff_wages' WHEN 'performers' THEN 'artist_guarantee' WHEN 'stage' THEN 'stage_rental' WHEN 'security_cost' THEN 'security' WHEN 'sponsorship' THEN 'sponsor_income' WHEN 'food' THEN 'fnb_income' WHEN 'drinks' THEN 'fnb_income' WHEN 'miscellaneous' THEN 'other' ELSE category END;
INSERT INTO public.festival_operation_migration_issues(source_table,source_id,festival_id,proposed_edition_id,issue_type,severity,evidence)
SELECT 'festival_expense_ledger',id,festival_id,edition_id,'missing_ledger_currency','blocker',jsonb_build_object('currency_code',currency_code,'reason','currency could not be derived; USD was not guessed') FROM public.festival_expense_ledger WHERE currency_code IS NULL OR btrim(currency_code)='' ON CONFLICT DO NOTHING;
INSERT INTO public.festival_operation_migration_issues(source_table,source_id,festival_id,proposed_edition_id,issue_type,severity,evidence)
SELECT 'festival_expense_ledger',id,festival_id,edition_id,'unmapped_ledger_category','blocker',jsonb_build_object('category',category,'reason','category is outside canonical taxonomy') FROM public.festival_expense_ledger WHERE category NOT IN ('staff_wages','security','permits','insurance','stage_rental','equipment_rental','marketing','artist_guarantee','artist_bonus','cleanup','tax','refund','sponsor_income','ticket_income','merch_income','fnb_income','other','utilities','medical','sanitation','transport','deposit','cancellation_liability') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.festival_edition_settlement_readiness(p_edition_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  WITH payload AS (SELECT jsonb_build_object('edition_id',p_edition_id,'readiness', public.festival_edition_operational_readiness(p_edition_id), 'ready_for_settlement', NOT EXISTS (SELECT 1 FROM public.festival_operation_migration_issues i WHERE i.resolution_status='open' AND i.severity IN ('blocker','critical') AND (i.proposed_edition_id=p_edition_id OR i.proposed_edition_id IS NULL)), 'blockers', COALESCE((SELECT jsonb_agg(issue_type) FROM public.festival_operation_migration_issues i WHERE i.resolution_status='open' AND i.severity IN ('blocker','critical') AND (i.proposed_edition_id=p_edition_id OR i.proposed_edition_id IS NULL)),'[]'::jsonb), 'warnings', '[]'::jsonb) AS body)
  SELECT body || jsonb_build_object('readiness_hash', md5(body::text)) FROM payload;
$$;

CREATE OR REPLACE FUNCTION public.prepare_festival_edition_settlement(p_edition_id uuid, p_expected_readiness_hash text, p_idempotency_key text, p_admin_override_reason text DEFAULT NULL)
RETURNS public.festival_edition_settlements LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.festival_editions%ROWTYPE; r jsonb; snap jsonb; h text; s public.festival_edition_settlements%ROWTYPE;
BEGIN
  IF nullif(trim(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'Settlement idempotency key required'; END IF;
  SELECT * INTO e FROM public.festival_editions WHERE id=p_edition_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Edition not found'; END IF;
  IF NOT public.can_manage_festival_brand(e.festival_id) THEN RAISE EXCEPTION 'Not authorised to settle edition'; END IF;
  r := public.festival_edition_settlement_readiness(p_edition_id);
  IF p_expected_readiness_hash IS NOT NULL AND r->>'readiness_hash' <> p_expected_readiness_hash THEN RAISE EXCEPTION 'Readiness hash mismatch'; END IF;
  IF COALESCE((r->>'ready_for_settlement')::boolean,false) IS NOT TRUE AND nullif(trim(coalesce(p_admin_override_reason,'')),'') IS NULL THEN RAISE EXCEPTION 'Edition settlement is not ready: %', r->'blockers'; END IF;
  snap := jsonb_build_object('readiness',r,'edition_id',p_edition_id);
  h := public.festival_settlement_input_hash(snap);
  INSERT INTO public.festival_edition_settlements(edition_id,festival_id,status,settlement_version,currency_code,readiness_snapshot,input_snapshot,input_hash,calculation_config_version,started_by_profile_id,locked_at,idempotency_key)
  VALUES(p_edition_id,e.festival_id,'locked',1,e.currency_code,r,snap,h,'festival_settlement_v1',public.current_profile_id_safe(),now(),p_idempotency_key)
  ON CONFLICT (edition_id,idempotency_key) DO UPDATE SET readiness_snapshot=EXCLUDED.readiness_snapshot RETURNING * INTO s;
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.festival_settlement_report(p_settlement_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE; e public.festival_editions%ROWTYPE; is_admin boolean; is_owner boolean; profile uuid;
BEGIN
  profile := public.current_profile_id_safe(); is_admin := coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false);
  SELECT * INTO s FROM public.festival_edition_settlements WHERE id=p_settlement_id; IF NOT FOUND THEN RAISE EXCEPTION 'Settlement not found'; END IF;
  SELECT * INTO e FROM public.festival_editions WHERE id=s.edition_id; is_owner := public.can_manage_festival_brand(e.festival_id);
  IF NOT (is_admin OR is_owner) THEN RAISE EXCEPTION 'Not authorised to view settlement report'; END IF;
  RETURN jsonb_build_object('settlement',to_jsonb(s),'readiness',s.readiness_snapshot,'effects',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM public.festival_effect_applications x WHERE x.settlement_id=s.id),'[]'::jsonb),'contracts',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM public.festival_contract_settlement_instructions x WHERE x.settlement_id=s.id),'[]'::jsonb),'financialResult',(SELECT to_jsonb(x) FROM public.festival_edition_financial_results x WHERE x.settlement_id=s.id),'events',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at) FROM public.festival_settlement_events x WHERE x.settlement_id=s.id),'[]'::jsonb));
END $$;

REVOKE ALL ON FUNCTION public.resolve_festival_stage_edition(uuid), public.festival_settlement_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_festival_stage_edition(uuid), public.festival_settlement_report(uuid), public.festival_edition_settlement_readiness(uuid), public.prepare_festival_edition_settlement(uuid,text,text,text) TO authenticated;
