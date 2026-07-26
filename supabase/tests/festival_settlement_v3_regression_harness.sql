\set ON_ERROR_STOP on
BEGIN;

DO $$ DECLARE missing text;
BEGIN
 SELECT string_agg(required,', ') INTO missing FROM (VALUES
  ('plan classification',EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.festival_plan_edition_backfill_audit'::regclass AND attname='plan_classification')),
  ('identity status',EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.festival_plan_edition_backfill_audit'::regclass AND attname='identity_status')),
  ('overtime request link',EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.festival_staff_overtime_approvals'::regclass AND attname='overtime_request_id')),
  ('effect receipts',to_regclass('public.festival_settlement_effect_receipts') IS NOT NULL)
 ) checks(required,ok) WHERE NOT ok;
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'festival settlement v3 schema is incomplete: %',missing; END IF;
END $$;

-- Exercise classification against actual plan/reference rows already present in
-- the migrated database. Every referenced plan must classify as used.
DO $$ DECLARE bad text;
BEGIN
 SELECT string_agg(format('%s:%s',plan_type,plan_id),',') INTO bad
 FROM public.festival_plan_edition_backfill_audit a
 WHERE public._festival_plan_is_used(a.plan_type,a.plan_id) AND a.plan_classification<>'used';
 IF bad IS NOT NULL THEN RAISE EXCEPTION 'referenced plans not classified used: %',bad; END IF;
 IF EXISTS(SELECT 1 FROM public.festival_plan_edition_backfill_audit WHERE plan_classification='used' AND candidate_count<>1 AND identity_status<>'identity_repair_required') THEN
  RAISE EXCEPTION 'ambiguous used plan was not blocked for repair'; END IF;
END $$;

-- Assert output rows rather than SQL source text: every prepared v3 line in the
-- database must balance to its signed component evidence and every decision
-- must identify the exact request it adjudicates.
DO $$ DECLARE bad uuid;
BEGIN
 SELECT l.id INTO bad FROM public.festival_settlement_lines l JOIN public.festival_financial_settlements s ON s.id=l.settlement_id
 WHERE s.settlement_formula_version='festival-settlement-v3' AND l.net_amount_minor IS DISTINCT FROM
  (SELECT coalesce(sum(CASE c.direction WHEN 'credit' THEN c.amount_minor ELSE -c.amount_minor END),0) FROM public.festival_settlement_line_components c WHERE c.settlement_line_id=l.id)
 LIMIT 1;
 IF bad IS NOT NULL THEN RAISE EXCEPTION 'unbalanced v3 settlement line: %',bad; END IF;
 IF EXISTS(SELECT 1 FROM public.festival_staff_overtime_approvals d LEFT JOIN public.festival_staff_overtime_approvals r ON r.id=d.overtime_request_id
  WHERE d.decision<>'requested' AND (r.id IS NULL OR r.decision<>'requested' OR r.staff_checkin_id<>d.staff_checkin_id OR r.requested_minutes<>d.requested_minutes)) THEN
  RAISE EXCEPTION 'overtime decision is not linked to its exact request'; END IF;
END $$;

ROLLBACK;
