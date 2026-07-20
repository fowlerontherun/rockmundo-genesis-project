BEGIN;
SELECT plan(12);

SELECT has_function('public', 'get_band_treasury_dashboard', ARRAY['uuid']);
SELECT has_function('public', 'preview_my_band_contribution', ARRAY['uuid','uuid','bigint']);

SELECT like(pg_get_functiondef('public.get_band_treasury_dashboard(uuid)'::regprocedure), '%canViewBalance%', 'dashboard exposes canViewBalance');
SELECT like(pg_get_functiondef('public.get_band_treasury_dashboard(uuid)'::regprocedure), '%view_band_balance%', 'dashboard enforces balance permission');
SELECT like(pg_get_functiondef('public.get_band_treasury_dashboard(uuid)'::regprocedure), '%current_active_player_profile_id%', 'dashboard uses active profile');
SELECT like(pg_get_functiondef('public.get_band_treasury_dashboard(uuid)'::regprocedure), '%canViewDetails%', 'dashboard exposes detail permission');

SELECT like(pg_get_functiondef('public.preview_my_band_contribution(uuid,uuid,bigint)'::regprocedure), '%treasuryWillBeCreated%', 'preview exposes first-contribution marker');
SELECT like(pg_get_functiondef('public.preview_my_band_contribution(uuid,uuid,bigint)'::regprocedure), '%make_voluntary_contributions%', 'preview enforces contribution permission');
SELECT like(pg_get_functiondef('public.preview_my_band_contribution(uuid,uuid,bigint)'::regprocedure), '%current_active_player_profile_id%', 'preview uses active profile');
SELECT unlike(pg_get_functiondef('public.preview_my_band_contribution(uuid,uuid,bigint)'::regprocedure), '%RAISE EXCEPTION ''band_treasury_missing''%', 'preview does not unconditionally block missing treasury');

SELECT lives_ok($$SELECT 'view_band_balance'::public.band_finance_permission$$, 'view_band_balance enum value exists');
SELECT has_function('public', 'is_bank_account_eligible_for_outgoing_payment', ARRAY['uuid','bigint','character']);

SELECT * FROM finish();
ROLLBACK;
