-- Stabilise canonical festival operations introduced by 20291212090000.
-- This migration is intentionally defensive: it records ambiguous historical data instead of
-- silently mapping incompatible ID domains, currencies or edition scopes.

CREATE OR REPLACE FUNCTION public.resolve_festival_stage_legacy_domain(p_stage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE st public.festival_stages%ROWTYPE; brand_match uuid; game_event_match uuid; edition_match uuid;
BEGIN
  SELECT * INTO st FROM public.festival_stages WHERE id=p_stage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('resolution','missing_stage');
  END IF;
  IF st.edition_id IS NOT NULL THEN
    RETURN jsonb_build_object('resolution','canonical_edition_stage','edition_id',st.edition_id,'festival_id',st.festival_id);
  END IF;
  SELECT id INTO brand_match FROM public.festivals WHERE id=st.festival_id LIMIT 1;
  SELECT edition_id INTO game_event_match FROM public.festival_legacy_mappings WHERE legacy_source='game_event' AND legacy_id=st.festival_id LIMIT 1;
  SELECT id INTO edition_match FROM public.festival_editions WHERE id=st.festival_id LIMIT 1;
  IF game_event_match IS NOT NULL AND brand_match IS NULL AND edition_match IS NULL THEN
    RETURN jsonb_build_object('resolution','legacy_game_event_stage','edition_id',game_event_match,'legacy_id',st.festival_id);
  ELSIF brand_match IS NOT NULL AND game_event_match IS NULL THEN
    RETURN jsonb_build_object('resolution','canonical_brand_stage','festival_id',brand_match);
  ELSIF edition_match IS NOT NULL AND brand_match IS NULL THEN
    RETURN jsonb_build_object('resolution','canonical_edition_stage_id_in_legacy_field','edition_id',edition_match);
  END IF;
  RETURN jsonb_build_object('resolution','unresolved_hybrid_stage','festival_id',st.festival_id,'brand_match',brand_match IS NOT NULL,'game_event_match',game_event_match IS NOT NULL,'edition_match',edition_match IS NOT NULL);
END $$;

INSERT INTO public.festival_operation_migration_issues(source_table, source_id, festival_id, issue_type, severity, evidence)
SELECT 'festival_stages', st.id, st.festival_id, 'unresolved_stage_legacy_domain', 'blocker', public.resolve_festival_stage_legacy_domain(st.id)
FROM public.festival_stages st
WHERE st.edition_id IS NULL AND public.resolve_festival_stage_legacy_domain(st.id)->>'resolution' = 'unresolved_hybrid_stage'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_festival_stage_slot_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=public
AS $$
DECLARE st public.festival_stages%ROWTYPE; ed public.festival_editions%ROWTYPE;
BEGIN
  SELECT * INTO st FROM public.festival_stages WHERE id=NEW.stage_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FESTIVAL_SLOT_STAGE_MISSING: slot stage does not exist'; END IF;
  IF NEW.edition_id IS DISTINCT FROM st.edition_id THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FESTIVAL_SLOT_EDITION_MISMATCH: slot edition must match stage edition'; END IF;
  SELECT * INTO ed FROM public.festival_editions WHERE id=NEW.edition_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FESTIVAL_SLOT_EDITION_MISSING: slot edition does not exist'; END IF;
  IF st.festival_id IS DISTINCT FROM ed.festival_id THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FESTIVAL_STAGE_FESTIVAL_MISMATCH: stage festival must match edition festival'; END IF;
  IF NEW.start_time IS NULL OR NEW.end_time IS NULL OR NEW.end_time <= NEW.start_time THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FESTIVAL_SLOT_INVALID_TIME: slot end must be after start'; END IF;
  IF ed.start_at IS NOT NULL AND NEW.start_time < ed.start_at THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FESTIVAL_SLOT_OUTSIDE_EDITION: slot starts before edition'; END IF;
  IF ed.end_at IS NOT NULL AND NEW.end_time > ed.end_at THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FESTIVAL_SLOT_OUTSIDE_EDITION: slot ends after edition'; END IF;
  IF NEW.archived_at IS NULL AND EXISTS (
    SELECT 1 FROM public.festival_stage_slots s WHERE s.stage_id=NEW.stage_id AND s.id IS DISTINCT FROM NEW.id AND s.archived_at IS NULL AND tstzrange(s.start_time,s.end_time,'[)') && tstzrange(NEW.start_time,NEW.end_time,'[)')
  ) THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='FESTIVAL_SLOT_OVERLAP: active stage slots cannot overlap'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS festival_stage_slot_consistency_trg ON public.festival_stage_slots;
CREATE TRIGGER festival_stage_slot_consistency_trg BEFORE INSERT OR UPDATE ON public.festival_stage_slots FOR EACH ROW EXECUTE FUNCTION public.enforce_festival_stage_slot_consistency();

ALTER TABLE public.festival_expense_ledger ALTER COLUMN currency_code DROP DEFAULT;

REVOKE ALL ON FUNCTION public.resolve_festival_stage_legacy_domain(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_festival_stage_legacy_domain(uuid) TO authenticated;
