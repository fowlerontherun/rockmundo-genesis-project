-- Safe, read-only production daily-event readiness audit.
-- psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/random_event_production_readiness.sql
-- Does not change character stats, event state, or migration history.
SELECT
  (SELECT count(*) FROM public.random_events
   WHERE awards_random_skill_xp AND is_active
     AND skill_xp_min BETWEEN 100 AND 500
     AND skill_xp_max BETWEEN skill_xp_min AND 500) AS active_valid_skill_events,
  (SELECT count(*) FROM public.random_event_skill_xp_grants
   WHERE xp_awarded NOT BETWEEN 100 AND 500) AS invalid_xp_grants,
  has_function_privilege('authenticated',
    'public.submit_random_event_choice(uuid,text)', 'EXECUTE') AS authenticated_can_choose,
  has_function_privilege('authenticated',
    'public.apply_random_event_outcome(uuid)', 'EXECUTE') AS authenticated_can_apply_outcome,
  has_table_privilege('authenticated',
    'public.player_events', 'UPDATE') AS authenticated_can_update_events;

SELECT
  pe.status,
  count(*) AS event_count,
  count(*) FILTER (WHERE pe.profile_id IS NULL) AS missing_character,
  count(*) FILTER (WHERE pe.profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=pe.profile_id AND p.user_id=pe.user_id
  )) AS mismatched_character,
  count(*) FILTER (WHERE pe.status='awaiting_outcome'
                    AND pe.choice_made_at < now()- interval '3 days') AS overdue
FROM public.player_events pe
GROUP BY pe.status ORDER BY pe.status;

-- Historical events without a character reference must not be guessed from
-- user_id when the account has more than one profile.
SELECT
  count(*) AS unassigned_pending,
  count(*) FILTER (WHERE profile_count = 1) AS unambiguous_by_account_count,
  count(*) FILTER (WHERE profile_count > 1) AS ambiguous_multicharacter_count,
  count(*) FILTER (WHERE profile_count = 0) AS no_matching_account_profile
FROM (
  SELECT pe.id, (SELECT count(*) FROM public.profiles p WHERE p.user_id=pe.user_id) AS profile_count
  FROM public.player_events pe
  WHERE pe.status='awaiting_outcome' AND pe.profile_id IS NULL
) s;

-- A no-op RPC smoke check must be safe even in production.
SELECT public.apply_random_event_outcome(
  '00000000-0000-0000-0000-000000000000'::uuid
) AS nonexistent_event_noop;
