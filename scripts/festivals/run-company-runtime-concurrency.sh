#!/usr/bin/env bash
set -euo pipefail
if ! command -v psql >/dev/null; then echo "psql is required for concurrency verification" >&2; exit 127; fi
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then echo "SUPABASE_DB_URL is required after supabase start/db reset" >&2; exit 2; fi
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
fixture="$workdir/fixture.sql"
call1="$workdir/call1.sql"; call2="$workdir/call2.sql"; out1="$workdir/out1.json"; out2="$workdir/out2.json"
cat >"$fixture" <<'SQL'
BEGIN;
SET LOCAL ROLE service_role;
SET LOCAL app.allow_test_fixtures = 'true';
INSERT INTO auth.users(id,email,role) VALUES ('81290000-0000-0000-0000-000000000001','festival-concurrency@example.test','authenticated') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles(id,user_id,username,display_name,cash,is_active,is_vip) VALUES ('81290000-0000-0000-0000-000000000101','81290000-0000-0000-0000-000000000001','festival_concurrency','Festival Concurrency',10000000,true,true) ON CONFLICT (id) DO UPDATE SET cash=10000000,is_active=true,is_vip=true;
INSERT INTO public.vip_subscriptions(user_id,status,subscription_type,starts_at,expires_at) VALUES ('81290000-0000-0000-0000-000000000001','active','test',now()-interval '1 day',now()+interval '30 days') ON CONFLICT DO NOTHING;
SELECT public.get_or_create_primary_financial_account('player','81290000-0000-0000-0000-000000000101','Concurrency player cash','USD');
UPDATE public.financial_accounts SET current_balance_minor=1000000000, available_balance_minor=1000000000 WHERE owner_type='player' AND owner_id='81290000-0000-0000-0000-000000000101' AND is_primary;
UPDATE public.game_config SET config_value = config_value || '{"new_festival_system_enabled":true,"festival_company_creation_enabled":true,"festival_company_management_enabled":true,"festival_configuration_enabled":false,"company_limit":3}'::jsonb WHERE config_key='festival_company_creation';
COMMIT;
SQL
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$fixture" >/dev/null
make_call(){ local outfile=$1; cat >"$outfile.sql" <<SQL
\\t on
\\pset format unaligned
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL app.allow_test_fixtures = 'true';
SET LOCAL app.festival_foundation_pause_after_lock = 'on';
SET LOCAL request.jwt.claim.sub = '81290000-0000-0000-0000-000000000001';
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"81290000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT public.found_festival_company('Concurrency Proof Fest','Concurrency Proof LLC','overlap','runtime-concurrency-key')::text;
COMMIT;
SQL
 psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$outfile.sql" >"$outfile"; }
make_call "$out1" & pid1=$!
sleep 0.2
make_call "$out2" & pid2=$!
wait "$pid1"; wait "$pid2"
r1_json="$(cat "$out1")"
r2_json="$(cat "$out2")"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
DECLARE r1 jsonb := '$r1_json'::jsonb; r2 jsonb := '$r2_json'::jsonb; fc uuid := (r1->>'festivalCompanyId')::uuid; c uuid := (r1->>'companyId')::uuid;
BEGIN
  IF r1->>'companyId' <> r2->>'companyId' OR r1->>'festivalCompanyId' <> r2->>'festivalCompanyId' THEN RAISE EXCEPTION 'concurrency responses returned different ids'; END IF;
  IF NOT ((r1->>'idempotent')::boolean = false AND (r2->>'idempotent')::boolean = true OR (r2->>'idempotent')::boolean = false AND (r1->>'idempotent')::boolean = true) THEN RAISE EXCEPTION 'expected one original and one idempotent response'; END IF;
  IF (SELECT count(*) FROM public.companies WHERE id=c) <> 1 THEN RAISE EXCEPTION 'expected one company'; END IF;
  IF (SELECT count(*) FROM public.festival_companies WHERE id=fc AND company_id=c) <> 1 THEN RAISE EXCEPTION 'expected one festival extension'; END IF;
  IF (SELECT count(*) FROM public.company_shareholders WHERE company_id=c) <> 1 THEN RAISE EXCEPTION 'expected one shareholder'; END IF;
  IF (SELECT count(*) FROM public.festival_company_founding_requests WHERE idempotency_key='runtime-concurrency-key') <> 1 THEN RAISE EXCEPTION 'expected one request'; END IF;
  IF (SELECT count(*) FROM public.financial_transactions WHERE transaction_category='festival_company_founding_fee' AND idempotency_key='festival-company-founding:runtime-concurrency-key') <> 1 THEN RAISE EXCEPTION 'expected one transaction'; END IF;
  IF (SELECT current_balance_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id='81290000-0000-0000-0000-000000000101' AND is_primary) <> 800000000 THEN RAISE EXCEPTION 'wallet did not move from 1000000000 to 800000000'; END IF;
  IF (SELECT count(*) FROM public.festival_company_audit_log WHERE festival_company_id=fc) <> 2 THEN RAISE EXCEPTION 'expected exactly two audit rows'; END IF;
  RAISE NOTICE 'two-session concurrency verified: company %, festival %, balance 800000000, one transaction', c, fc;
END \$\$;
SQL
