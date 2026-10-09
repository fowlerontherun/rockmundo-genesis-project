-- Read-only validation for historical event closure safeguards.
select
 to_regclass('public.random_event_legacy_resolutions') is not null as ledger_exists,
 has_function_privilege('authenticated','public.close_quarantined_random_event(uuid,text)','EXECUTE') as player_can_close,
 has_function_privilege('service_role','public.close_quarantined_random_event(uuid,text)','EXECUTE') as service_can_close,
 (select count(*) from public.player_events where status='awaiting_outcome'
    and choice_made_at < timestamptz '2026-10-09 00:00:00+00') as quarantined_count,
 (select count(*) from public.random_event_legacy_resolutions) as reviewed_resolutions;
select public.close_quarantined_random_event(
  '00000000-0000-0000-0000-000000000000'::uuid,
  'nonexistent-event contract check'
) as nonexistent_event_noop;
