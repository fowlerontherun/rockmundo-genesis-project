# Finance Phase 8B.3 Executable Accounting Audit

## Reset evidence

Command attempted:

```bash
supabase db reset
```

Result: not executable in this container because the local Supabase CLI is not installed. The repository now includes a forward-only Phase 8B.3 migration and an executable pgTAP workflow harness so the reset gate can be run unchanged in CI or any disposable Supabase environment with the CLI available.

Database version: unavailable locally for the same reason. The audit harness records assumptions against PostgreSQL/Supabase objects after migration application.

## Migration deployment status

No production deployment metadata or migration checksum registry is present in this checkout. Therefore Phase 8B.3 is implemented as a forward-only corrective migration and does not rewrite the PR #1239-#1241 migration history.

## Effective accounting model

`financial_accounts.currency_code` is the authoritative runtime currency field once Finance Phase 6 has applied. `default_currency_code` remains populated for compatibility, but mortgage accounting validates and posts against `currency_code`.

`post_financial_journal` is the only primitive used by the enabled mortgage posting functions. Its effective signature is:

```sql
post_financial_journal(financial_transaction_category, uuid, char(3), text, jsonb, text, uuid, jsonb) returns uuid
```

Required JSON line shape:

```json
{ "account_id": "uuid", "direction": "debit|credit", "amount_minor": 123, "component": "name", "description": "optional" }
```

Behaviour:

- Debits and credits must balance and be positive.
- Account currencies must match the journal currency.
- Non-system debit accounts require sufficient available balance.
- System accounts may go negative, which is used only for explicit development fixtures such as the world treasury capital source.
- The idempotency key is unique on `financial_transactions`; repeated calls return the existing transaction id.
- The function updates account balances and inserts ledger entries in the same transaction.

## Provider capitalisation

Phase 8B.3 introduces `ensure_development_mortgage_provider('GBP')`. It idempotently creates or repairs the Aurora International development mortgage provider, provisions mortgage account roles, and capitalises `mortgage_funding_cash` from a `world_banking_treasury` system account using one balanced `administrative_adjustment` journal.

Economic source: world banking treasury decreases.

Funding destination: provider mortgage funding cash increases.

No direct provider funding balance update is used by the Phase 8B.3 capitalisation path.

## Effective objects validated by the harness

The SQL harness `supabase/tests/finance_phase8b3_mortgage_accounting_kernel.sql` checks:

- Mortgage categories exist.
- Journal primitive posts balanced entries and is idempotent.
- Development provider and provider mortgage accounts exist.
- Provider funding has a ledger-backed capital source.
- Seller treasury resolution works.
- Deposit reservation and release functions are enabled objects.
- Completion, repayment, retry, and scheduled processor functions are enabled objects with expected return shapes.
- Offer-by-id and eligible-account RPCs exist.

## Known remaining execution requirement

Run the following in CI or a local Supabase environment with Docker and the Supabase CLI:

```bash
supabase db reset
supabase test db supabase/tests/finance_phase8b3_mortgage_accounting_kernel.sql
supabase gen types typescript --local > src/integrations/supabase/types.ts
```
