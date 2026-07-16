-- Behavioural smoke harness for canonical festival admin management.
SELECT has_function('public','admin_festival_catalogue','admin catalogue projection exists');
SELECT has_function('public','admin_create_festival_brand','admin brand creation RPC exists');
SELECT has_function('public','admin_update_festival_brand','admin brand edit RPC exists');
SELECT has_function('public','admin_transition_festival_edition','admin lifecycle transition RPC exists');
SELECT has_function('public','admin_assign_festival_system_act','server system-act assignment RPC exists');
SELECT has_function('public','festival_staff_candidates','deterministic staff candidates exist');
SELECT has_function('public','festival_edition_settlement_readiness','settlement readiness projection exists');
SELECT has_table('public','festival_admin_audit_events','admin audit table exists');
SELECT has_table('public','festival_edition_management_roles','delegated role table exists');
SELECT col_exists('public','festival_stages','edition_id','stages belong to editions');
SELECT col_exists('public','festival_stage_slots','edition_id','slots belong to editions');
SELECT col_exists('public','festival_staff','edition_id','staff belongs to editions');
SELECT col_exists('public','festival_permits','edition_id','permits belong to editions');
SELECT col_exists('public','festival_insurance_policies','edition_id','insurance belongs to editions');
SELECT col_exists('public','festival_expense_ledger','edition_id','ledger belongs to editions');
