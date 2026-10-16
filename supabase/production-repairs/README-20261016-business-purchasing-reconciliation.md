# Business purchase migration reconciliation — 16 October 2026

Production Supabase project: `yztogmdixmchsmimtent`.

## Historical migrations: DO NOT replay unchanged

- `20261012225000_atomic_business_hiring_upgrades.sql` — **superseded**, because client-controlled employee properties and fleet pricing / random ledger request keys allowed unsafe outcomes. Replacement functions were installed incrementally and are tracked below.
- `20261012230500_atomic_subsidiary_purchases.sql` — **superseded**, because many charges and upgrade effects were caller-supplied. Its nine purchase kinds were progressively replaced with server-authoritative functions, without applying the unsafe original SQL.

## Production migration receipts (already applied)

| Production migration version | Functionality |
| --- | --- |
| `20261015222945` | Server-priced logistics and security firm upgrades |
| `20261015224409` | Fleet vehicle catalogue price/type/capacity, idempotent purchase |
| `20261015224549` | Server-authoritative driver and merchandise worker hires |
| `20261015234918` | Label staff role salary, starting skill and deduplicated hiring |
| `20261016053201` | Server-priced venue, recording, rehearsal subsidiary upgrades |
| `20261016065642` | Server-authoritative venue, recording, rehearsal, security staff hires |
| `20261016082337` | Catalogue-priced recording/rehearsal equipment purchases, stock deduction, idempotency |

All archive SQL files are in `supabase/production-repairs/`. They record direct-to-production changes and must **not** be blindly replayed as migrations.

## Equipment purchasing design

`buy_subsidiary_asset_atomic(text,uuid,jsonb)` accepts `recording_equipment` and `rehearsal_equipment` only if the client passes a valid `catalog_id` from `equipment_catalog` and a stable per-attempt `request_id`. The database ignores user-supplied price, brand, model, rental rate, equipment type and vintage status.

- Purchases are owner-authorised and derived from an admin-managed catalogue with RLS.
- The owner row and catalogue row are locked; company debit, stock deduction, equipment creation and request ledger insert share one transaction.
- Catalog category/subcategory are mapped through a whitelist; unsupported categories fail closed.
- Equipment purchases reuse the stable request ID to prevent recharging on retries.
- UI prices and rental rates are informational only; the database remains authoritative.
- The private request table has RLS enabled and no direct client privileges.

## Unresolved tests and risks

- End-to-end signed-in **successful** purchase, debit ledger, stock decrement and repeated request tests must be run in an isolated staging environment. No live paid purchase was triggered as part of this review.
- CI, frontend deployment and the PR merge must complete before declaring the changed equipment interfaces released.
- Monitor inventory, company ledger, stock, and catalog availability after rollout. If there are discrepancies, audit per request ID before retrying.
- Achievement reward migration `20261013184000_achievement_event_reward_integrity.sql` remains blocked on missing prerequisite tables.
- Sponsorship installment migration `20261012213100_atomic_sponsorship_installments.sql` remains blocked until the band earnings recomputation trigger is safely repaired.

This note does not assert that all migrations created in the last seven days were reconciled. It covers the two specific historical business migration files and their production repairs.
