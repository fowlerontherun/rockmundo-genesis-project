-- Finance A1 static database contract checks.
-- These run after a clean local migration reset in the Finance verification gate.

select to_regclass('public.booking_payments') is not null
  as booking_payments_exists;

select coalesce((
  select c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'booking_payments'
), false)
  as booking_payments_rls_enabled;

select not has_table_privilege('authenticated', 'public.booking_payments', 'select')
  as booking_payments_not_directly_readable;

select to_regprocedure(
  'public.confirm_rehearsal_booking_atomic(uuid,uuid,integer,uuid,uuid,timestamp with time zone,text,text)'
) is not null
  as rehearsal_atomic_rpc_exists;

select to_regprocedure(
  'public.confirm_recording_session_atomic(uuid,uuid,text,uuid,integer,text,text,text,integer,timestamp with time zone,timestamp with time zone,text,text)'
) is not null
  as recording_atomic_rpc_exists;

select to_regprocedure(
  'public._confirm_recording_session_atomic_unchecked(uuid,uuid,text,uuid,integer,text,text,text,integer,timestamp with time zone,timestamp with time zone,text,text)'
) is not null
  as internal_recording_authority_exists;

select has_function_privilege(
  'authenticated',
  'public.confirm_rehearsal_booking_atomic(uuid,uuid,integer,uuid,uuid,timestamp with time zone,text,text)',
  'execute'
) as rehearsal_rpc_authenticated_execute;

select has_function_privilege(
  'authenticated',
  'public.confirm_recording_session_atomic(uuid,uuid,text,uuid,integer,text,text,text,integer,timestamp with time zone,timestamp with time zone,text,text)',
  'execute'
) as recording_rpc_authenticated_execute;

select not has_function_privilege(
  'authenticated',
  'public._confirm_recording_session_atomic_unchecked(uuid,uuid,text,uuid,integer,text,text,text,integer,timestamp with time zone,timestamp with time zone,text,text)',
  'execute'
) as internal_recording_authority_not_publicly_callable;

select exists (
  select 1
  from pg_indexes
  where schemaname = 'public'
    and indexname = 'band_rehearsals_funding_idempotency_key_uq'
) as rehearsal_idempotency_index_exists;

select exists (
  select 1
  from pg_indexes
  where schemaname = 'public'
    and indexname = 'recording_sessions_funding_idempotency_key_uq'
) as recording_idempotency_index_exists;

select position(
  'band_song_ownership' in pg_get_functiondef(
    'public.confirm_recording_session_atomic(uuid,uuid,text,uuid,integer,text,text,text,integer,timestamp with time zone,timestamp with time zone,text,text)'::regprocedure
  )
) > 0 as recording_rpc_checks_band_repertoire;

select position(
  'song_not_recordable_by_caller' in pg_get_functiondef(
    'public.confirm_recording_session_atomic(uuid,uuid,text,uuid,integer,text,text,text,integer,timestamp with time zone,timestamp with time zone,text,text)'::regprocedure
  )
) > 0 as recording_rpc_checks_song_authority;
