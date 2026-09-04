-- Apply and certify the attendee diagnostics/recovery production extension.
\ir ../reconciliation/festival/20260904_festival_attendee_admin_diagnostics.sql

DO $$
DECLARE
  v_rls boolean;
  v_repair_definition text;
  v_diagnostic_definition text;
BEGIN
  IF to_regclass('public.festival_attendee_repair_audit') IS NULL THEN
    RAISE EXCEPTION 'Festival attendee repair audit table is missing';
  END IF;
  SELECT relrowsecurity INTO v_rls FROM pg_class
    WHERE oid='public.festival_attendee_repair_audit'::regclass;
  IF v_rls IS NOT TRUE THEN RAISE EXCEPTION 'Festival attendee repair audit must use RLS'; END IF;
  IF EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.festival_attendee_repair_audit'::regclass) THEN
    RAISE EXCEPTION 'Festival attendee repair audit must not expose browser policies';
  END IF;
  IF has_table_privilege('authenticated','public.festival_attendee_repair_audit','SELECT')
     OR has_table_privilege('anon','public.festival_attendee_repair_audit','SELECT') THEN
    RAISE EXCEPTION 'Festival attendee repair evidence is directly browser-readable';
  END IF;
  IF NOT has_function_privilege('authenticated','public.admin_get_festival_attendee_diagnostics(uuid)','EXECUTE')
     OR has_function_privilege('anon','public.admin_get_festival_attendee_diagnostics(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Festival attendee diagnostic privilege boundary is incorrect';
  END IF;
  IF NOT has_function_privilege('authenticated','public.admin_repair_festival_attendee(uuid,bigint,text,text,uuid,boolean)','EXECUTE')
     OR has_function_privilege('anon','public.admin_repair_festival_attendee(uuid,bigint,text,text,uuid,boolean)','EXECUTE') THEN
    RAISE EXCEPTION 'Festival attendee repair privilege boundary is incorrect';
  END IF;
  IF has_function_privilege('authenticated','public._festival_attendee_admin_diagnostic_row(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Internal Festival attendee diagnostic helper is browser-callable';
  END IF;
  v_repair_definition:=pg_get_functiondef('public.admin_repair_festival_attendee(uuid,bigint,text,text,uuid,boolean)'::regprocedure);
  v_diagnostic_definition:=pg_get_functiondef('public.admin_get_festival_attendee_diagnostics(uuid)'::regprocedure);
  IF position('FOR UPDATE' in v_repair_definition)=0
     OR position('FESTIVAL_ATTENDEE_REPAIR_STALE' in v_repair_definition)=0
     OR position('p_apply' in v_repair_definition)=0 THEN
    RAISE EXCEPTION 'Festival attendee repair lacks preview/concurrency safeguards';
  END IF;
  IF position('ticket_attendance_missing' in v_diagnostic_definition)=0
     OR position('orphanTickets' in v_diagnostic_definition)=0 THEN
    RAISE EXCEPTION 'Festival attendee diagnostics omit orphan admission tickets';
  END IF;
END;
$$;
