-- Finance Phase 8B behavioural smoke checks. Run after applying migrations in a local Supabase test database.
\set ON_ERROR_STOP on
BEGIN;
SELECT plan(10);
SELECT has_table('public','properties','persistent property inventory exists');
SELECT has_table('public','mortgage_contracts','persistent mortgage contracts exist');
SELECT has_table('public','mortgage_schedule_lines','durable mortgage schedule lines exist');
SELECT has_table('public','property_security_interests','enforceable security interests exist');
SELECT has_function('public','list_eligible_mortgage_products',ARRAY['uuid'],'eligible product RPC exists');
SELECT has_function('public','create_mortgage_application',ARRAY['uuid','uuid','integer','bigint','character','text'],'application RPC prevents client-supplied income');
SELECT has_function('public','complete_mortgaged_property_purchase',ARRAY['uuid','uuid','uuid','text'],'atomic completion RPC exists fail-closed');
SELECT ok(EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='property_reservations_one_active'),'two buyers cannot reserve same property via active reservation unique index');
SELECT ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='properties_prevent_direct_secured_transfer'),'active security blocks direct property owner transfer');
SELECT is_empty('SELECT * FROM public.mortgage_reconciliation_exceptions','mortgage reconciliation starts clean');
SELECT * FROM finish();
ROLLBACK;
