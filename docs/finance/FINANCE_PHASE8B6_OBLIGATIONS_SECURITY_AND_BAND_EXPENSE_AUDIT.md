# Finance Phase 8B.6 Obligations Security and Band Expense Audit

## Scope

This audit documents the Phase 8B.6 repair migration and frontend dashboard change. The implementation gates Phase 8C by hardening the universal obligations boundary first.

## Security repairs recorded

- RLS is enabled for the universal obligations, schedule, attempt, event, status-history, debt, collection-event, credit-history and credit-score tables.
- Authenticated direct writes to those tables are revoked; authenticated clients receive read access only through RLS plus narrow RPCs.
- Internal security-definer processors are revoked from `PUBLIC`, `anon` and `authenticated`, then granted to `service_role`.
- Player-facing RPCs derive the player from `current_player_profile_id()` rather than accepting arbitrary owner IDs.
- Company obligations remain fail-closed in direct table policies until the company permission model is explicit enough for owner-specific RLS.

## Correctness repairs recorded

- Schedule rows now carry durable business identity, source version, miss, retry and resolution timestamps.
- Outstanding balance and missed count are reconciled from schedule/debt state instead of being incremented per retry.
- First missed-payment credit events are idempotent per player, schedule and event type.
- Open debts are unique per obligation/schedule line and repeated failures upsert the same debt.
- Retry timing is enforced with `next_retry_at` in the due processor and internal payment processor.
- Processing date and timestamp are passed into the internal payment path for deterministic replay.
- Payment-account owner, currency and active-state validation are performed before posting.

## Band expense funding recorded

- `preview_band_expense_funding(...)` returns a structured, side-effect-free funding preview.
- `confirm_band_expense_funding(...)` revalidates permissions and balances and calls the shared resolver.
- `resolve_and_pay_band_expense(...)` supports `band_only`, `personal_only` and `band_then_personal_shortfall` funding.
- Personal expense funding is recorded in `band_financial_contributions` as `full_expense_payment` or `expense_shortfall` and is marked as trusted workflow metadata on the journal.

## Existing payment paths reviewed

| Area | Existing path | Phase 8B.6 disposition |
| --- | --- | --- |
| Mortgage scheduled payments | `post_mortgage_schedule_payment` | Universal processor delegates mortgage lines to the mortgage handler. |
| Legacy mortgage scheduler | `process_due_mortgage_repayments` | Kept service-only and delegates to `process_due_financial_obligations`. |
| Voluntary band deposits | `contribute_personal_funds_to_band` | Preserved for explicit deposits. |
| Band expense parent/component tables | `band_expense_payments`, `band_expense_payment_components` | Resolver now writes parent/component rows. |

## Executable harness

- `supabase/tests/finance_phase8b6_obligations_security_band_expense_harness.sql` verifies table presence, RLS enablement, wrapper RPC presence and internal processor execute revocation.

## Commands and results

The commands below were run in this workspace during the PR preparation. Supabase local reset and DB tests require Docker/Supabase services; they are listed as required acceptance evidence and should be rerun in CI/local developer environments with Supabase available.

| Command | Result |
| --- | --- |
| `npm ci` | Blocked in this container by npm registry `403 Forbidden` for `@react-three/fiber`; npm config shows no repo/user `.npmrc`, but environment contains proxy config `http-proxy=http://proxy:8080` and `https-proxy=http://proxy:8080`. |
| `supabase db reset` | Blocked: `supabase` CLI is not installed in this container. |
| `supabase db lint` | Blocked: `supabase` CLI is not installed in this container. |
| `supabase test db` | Blocked: `supabase` CLI is not installed in this container. |
| `supabase gen types typescript --local` | Blocked: `supabase` CLI is not installed in this container. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Blocked after the failed install because `@eslint/js` is not present in `node_modules`. |
| `npm run test -- --run` | Blocked after the failed install because `vitest` is not present in `node_modules`. |
| `npm run build` | Blocked after the failed install because `vite` is not present in `node_modules`. |
