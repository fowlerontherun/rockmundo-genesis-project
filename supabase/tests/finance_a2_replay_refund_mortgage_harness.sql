-- Finance A2 static/executable contract checks.
-- Run after a clean migration reset as part of the finance verification gate.

select to_regclass('public.booking_refunds') is not null
  as booking_refunds_exists;

select coalesce((
  select c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'booking_refunds'
), false)
  as booking_refunds_rls_enabled;

select to_regprocedure(
  'public.cancel_rehearsal_booking_atomic(uuid,text,text)'
) is not null
  as cancel_rehearsal_atomic_exists;

select to_regprocedure(
  'public.cancel_recording_session_atomic(uuid,text,text)'
) is not null
  as cancel_recording_atomic_exists;

select has_function_privilege(
  'authenticated',
  'public.cancel_rehearsal_booking_atomic(uuid,text,text)',
  'execute'
) as authenticated_can_cancel_rehearsal;

select has_function_privilege(
  'authenticated',
  'public.cancel_recording_session_atomic(uuid,text,text)',
  'execute'
) as authenticated_can_cancel_recording;

select not has_function_privilege(
  'authenticated',
  'public._refund_atomic_booking_payment(uuid,text,text)',
  'execute'
) as internal_refund_not_browser_callable;

select to_regprocedure(
  'public.process_financial_obligation_payment_guarded(uuid,text,date,timestamp with time zone)'
) is not null
  as guarded_obligation_processor_exists;

select exists (
  select 1 from pg_indexes
  where schemaname = 'public'
    and indexname = 'financial_obligation_attempt_schedule_number_uq'
) as obligation_attempt_number_unique;

select position(
  'pg_advisory_xact_lock' in pg_get_functiondef(
    'public.process_financial_obligation_payment_guarded(uuid,text,date,timestamp with time zone)'::regprocedure
  )
) > 0 as obligation_replay_lock_present;

select position(
  'next_retry_at' in pg_get_functiondef(
    'public.process_due_financial_obligations(date,integer)'::regprocedure
  )
) > 0 as due_processor_respects_retry_time;

select position(
  'max_attempts' in pg_get_functiondef(
    'public.process_due_financial_obligations(date,integer)'::regprocedure
  )
) > 0 as due_processor_respects_max_attempts;

select to_regprocedure(
  'public.sync_mortgage_financial_obligation_schedule(uuid)'
) is not null
  as mortgage_schedule_sync_exists;

select exists (
  select 1
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'mortgage_schedule_lines'
    and t.tgname = 'mortgage_schedule_sync_financial_obligation'
    and not t.tgisinternal
) as mortgage_schedule_sync_trigger_exists;

select position(
  'source_schedule_version' in pg_get_functiondef(
    'public.sync_mortgage_financial_obligation_schedule(uuid)'::regprocedure
  )
) > 0 as mortgage_sync_tracks_schedule_version;

select position(
  'GREATEST(s.amount_minor' in pg_get_functiondef(
    'public.reconcile_financial_obligation_state(uuid,date)'::regprocedure
  )
) > 0 as reconciliation_uses_schedule_and_debt_state;
