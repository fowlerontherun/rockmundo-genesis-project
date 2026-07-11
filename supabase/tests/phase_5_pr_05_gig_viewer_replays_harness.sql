-- Phase 5 PR 05 replay storage/RLS harness (requires seeded Supabase test database).
BEGIN;
SELECT plan(7);

SELECT has_table('public', 'gig_viewer_replays', 'stores canonical replay payloads outside gig_outcomes');
SELECT col_is_pk('public', 'gig_viewer_replays', 'id', 'replay table has uuid primary key');
SELECT has_index('public', 'gig_viewer_replays', 'gig_viewer_replays_one_ready_per_gig_viewer', 'one ready replay per gig/viewer version');
SELECT policies_are('public', 'gig_viewer_replays', ARRAY[
  'gig_viewer_replays_select_matches_outcome_visibility',
  'gig_viewer_replays_deny_insert',
  'gig_viewer_replays_deny_update',
  'gig_viewer_replays_deny_delete'
], 'replay RLS read and mutation-denial policies exist');
SELECT function_privs_are('public', 'claim_gig_viewer_replay_generation', ARRAY['uuid','uuid','integer'], 'anon', ARRAY[]::text[], 'anon cannot claim replay generation');
SELECT function_privs_are('public', 'claim_gig_viewer_replay_generation', ARRAY['uuid','uuid','integer'], 'authenticated', ARRAY[]::text[], 'authenticated cannot claim replay generation');
SELECT function_privs_are('public', 'claim_gig_viewer_replay_generation', ARRAY['uuid','uuid','integer'], 'service_role', ARRAY['EXECUTE'], 'service role can claim replay generation');

SELECT * FROM finish();
ROLLBACK;
