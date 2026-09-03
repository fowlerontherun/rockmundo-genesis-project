-- Festival admin attendee diagnostics/recovery security and contract smoke checks.

DO $$
DECLARE
  v_acl text;
  v_definition text;
BEGIN
  SELECT p.proacl::text, pg_get_functiondef(p.oid)
  INTO v_acl, v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'admin_festival_attendee_diagnostics'
  LIMIT 1;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'admin_festival_attendee_diagnostics is missing';
  END IF;
  IF v_acl LIKE '%anon=%' THEN
    RAISE EXCEPTION 'diagnostics must not be executable by anon';
  END IF;
  IF v_definition NOT LIKE '%festival_editions_v2%' THEN
    RAISE EXCEPTION 'diagnostics must resolve modern Festival edition authority';
  END IF;
  IF v_definition NOT LIKE '%array_remove%' THEN
    RAISE EXCEPTION 'diagnostic issue arrays must remove null entries';
  END IF;
END $$;

DO $$
DECLARE
  v_acl text;
  v_definition text;
BEGIN
  SELECT p.proacl::text, pg_get_functiondef(p.oid)
  INTO v_acl, v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'admin_reconcile_festival_attendance'
  LIMIT 1;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'admin_reconcile_festival_attendance is missing';
  END IF;
  IF v_acl LIKE '%anon=%' THEN
    RAISE EXCEPTION 'recovery must not be executable by anon';
  END IF;
  IF v_definition NOT LIKE '%festival_attendee_recovery_reason_required%' THEN
    RAISE EXCEPTION 'recovery must require an admin reason';
  END IF;
  IF v_definition NOT LIKE '%_festival_sync_attendance_lifecycle%' OR
     v_definition NOT LIKE '%_festival_complete_attendance_if_expired%' OR
     v_definition NOT LIKE '%_festival_repair_attendance_ticket_used%' OR
     v_definition NOT LIKE '%_festival_ensure_attendance_wristband%' OR
     v_definition NOT LIKE '%_festival_repair_attendance_schedule_lock%' THEN
    RAISE EXCEPTION 'recovery must delegate to bounded canonical attendee helpers';
  END IF;
  IF v_definition NOT LIKE '%festival_company_audit_log%' OR
     v_definition NOT LIKE '%admin_attendee_reconciled%' THEN
    RAISE EXCEPTION 'recovery must write the modern Festival audit stream';
  END IF;
END $$;

DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'admin_modern_festival_editions'
  LIMIT 1;

  IF v_definition IS NULL OR v_definition NOT LIKE '%festival_editions_v2%' THEN
    RAISE EXCEPTION 'modern admin Festival edition catalogue is missing or uses the wrong authority';
  END IF;
END $$;
