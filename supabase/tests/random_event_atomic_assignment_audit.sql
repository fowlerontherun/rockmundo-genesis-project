-- Read-only production safety audit for atomic random-event assignment.
select
  to_regprocedure('public.assign_random_event_if_available(uuid,uuid,uuid,uuid,text)') is not null as assignment_function_present,
  has_function_privilege('authenticated','public.assign_random_event_if_available(uuid,uuid,uuid,uuid,text)','EXECUTE') as client_can_assign,
  has_function_privilege('service_role','public.assign_random_event_if_available(uuid,uuid,uuid,uuid,text)','EXECUTE') as worker_can_assign,
  (select count(*) from (select user_id from public.player_events
    where status='pending_choice'
      or (status='awaiting_outcome' and choice_made_at >= timestamptz '2026-10-09 00:00:00+00')
    group by user_id having count(*)>1) duplicate_accounts) as existing_duplicate_accounts;
