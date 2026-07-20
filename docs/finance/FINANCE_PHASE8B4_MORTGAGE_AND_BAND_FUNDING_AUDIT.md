# Finance Phase 8B.4 Mortgage and Band Funding Audit

## Scope

This audit records the Phase 8B.4 repair plan and implemented database controls for mortgage posting and band treasury contributions.

## Migration execution evidence

- Dependency installation command attempted: `npm ci`
- Dependency installation failure: npm registry returned `E403 403 Forbidden - GET https://registry.npmjs.org/@react-three%2ffiber`, leaving the dependency tree incomplete.
- Reset command attempted: `npx supabase db reset --debug`
- Reset failure: npm registry returned `E403 403 Forbidden - GET https://registry.npmjs.org/supabase`, so the Supabase CLI could not be fetched through `npx`.
- Environment: local disposable Supabase CLI database from this workspace was requested but could not be started because of the registry/tooling failure above.
- Result: this PR does **not** claim a clean reset.
- Corrective changes made before reset can be retried:
  - Restored journal permission gating while allowing explicitly tagged trusted security-definer workflows.
  - Added `financial_accounts.allow_negative_balance` and removed the broad `owner_type = system` negative-balance exception.
  - Removed production auto-creation of the Aurora development mortgage provider.
  - Added `mortgage_repayment_cash` and `mortgage_origination_clearing` provider roles.
  - Repaired mortgage completion so provider funding cash is debited only once.
  - Repaired mortgage repayment journals so zero-fee payments post no fee line.
  - Added ledger-backed band treasury/contribution tables and contribution RPC.

## Effective finance function signatures

- `post_financial_journal(financial_transaction_category, uuid, char(3), text, jsonb, text, uuid, jsonb) returns uuid`
- `complete_mortgaged_property_purchase(uuid, uuid, uuid, text) returns uuid`
- `post_mortgage_schedule_payment(uuid, text) returns jsonb`
- `get_or_create_band_treasury_account(uuid, char(3)) returns uuid`
- `contribute_personal_funds_to_band(uuid, uuid, bigint, text, text) returns jsonb`

## Accounting model

### Mortgage completion

Mortgage completion now uses three independently balanced journals:

1. Deposit settlement: deposit clearing is debited and the seller is credited.
2. Principal settlement: provider mortgage funding cash is debited once and the seller is credited once.
3. Origination recognition: provider equity/origination offset is debited and mortgage receivable is credited.

This proves the economic result without charging provider funding twice.

### Mortgage repayment

For a schedule payment, borrower cash is debited by `principal + interest + fees`, provider repayment cash is credited by the same total, receivable/equity are reduced for principal, and interest/fee income is credited only when the scheduled component is greater than zero.

### Band contributions

Voluntary band deposits debit the player's selected financial account and credit the band's `band_treasury` account. Contribution records are explicitly marked as contributions, not commercial revenue, loans, grants, gig income, or merchandise income.

## Remaining verification gate

Phase 8B.4 should not be considered accepted until the following commands pass in an environment with Supabase CLI and the npm registry available:

- `npm ci`
- `npx supabase db reset --debug`
- `npx supabase gen types typescript --local > src/integrations/supabase/types.ts`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- Browser E2E suite covering the mortgage and band funding journeys.
