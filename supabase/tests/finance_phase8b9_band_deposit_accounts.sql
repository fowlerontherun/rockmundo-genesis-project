-- Finance Phase 8B.9 band deposit account-selector assertions.
BEGIN;
SELECT plan(8);

SELECT has_function(
  'public',
  'get_my_eligible_band_contribution_accounts',
  ARRAY ['uuid', 'character'],
  'eligible contribution account RPC exists'
);
SELECT has_function(
  'public',
  'contribute_my_personal_funds_to_band',
  ARRAY ['uuid', 'uuid', 'bigint', 'text', 'text'],
  'current-player contribution wrapper exists'
);
SELECT isnt_empty(
  $$SELECT 1 FROM pg_proc WHERE proname='get_my_eligible_band_contribution_accounts' AND pg_get_functiondef(oid) LIKE '%current_player_profile_id%'$$,
  'eligible account RPC derives the profile from the session'
);
SELECT isnt_empty(
  $$SELECT 1 FROM pg_proc WHERE proname='get_my_eligible_band_contribution_accounts' AND pg_get_functiondef(oid) LIKE '%not_band_member%'$$,
  'eligible account RPC returns a structured non-member status'
);
SELECT isnt_empty(
  $$SELECT 1 FROM pg_proc WHERE proname='get_my_eligible_band_contribution_accounts' AND pg_get_functiondef(oid) LIKE '%no_personal_accounts%'$$,
  'eligible account RPC returns a structured no-account status'
);
SELECT isnt_empty(
  $$SELECT 1 FROM pg_proc WHERE proname='get_my_eligible_band_contribution_accounts' AND pg_get_functiondef(oid) LIKE '%currency_mismatch%'$$,
  'eligible account RPC returns a structured currency mismatch status'
);
SELECT isnt_empty(
  $$SELECT 1 FROM pg_proc WHERE proname='contribute_my_personal_funds_to_band' AND pg_get_functiondef(oid) LIKE '%available_balance_minor < p_amount_minor%'$$,
  'contribution wrapper checks available personal balance before posting'
);
SELECT isnt_empty(
  $$SELECT 1 FROM pg_proc WHERE proname='contribute_my_personal_funds_to_band' AND pg_get_functiondef(oid) LIKE '%contribute_personal_funds_to_band(p_band_id, p_bank_account_id, p_amount_minor, p_idempotency_key, p_note)%'$$,
  'contribution wrapper calls the existing RPC with the effective parameter order'
);

SELECT * FROM finish();
ROLLBACK;
