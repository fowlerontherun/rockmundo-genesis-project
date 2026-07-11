-- Harness assertions for phase 2 gig crew/equipment preparation constraints.
BEGIN;

SELECT plan(5);

SELECT has_table('public', 'gig_crew_assignments', 'gig crew assignments table exists');
SELECT has_table('public', 'gig_equipment_loadouts', 'gig equipment loadouts table exists');
SELECT has_check('public', 'gig_crew_assignments', 'gig_crew_exactly_one_worker', 'crew assignment requires exactly one worker source');
SELECT has_function('public', 'save_gig_crew_assignment', ARRAY['uuid','text','text','uuid','uuid','uuid','text'], 'server-side crew assignment RPC exists');
SELECT has_function('public', 'process_gig_preparation_costs_and_rewards', ARRAY['uuid'], 'idempotent cost/reward processor exists');

SELECT * FROM finish();
ROLLBACK;
