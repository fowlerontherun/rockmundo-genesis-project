# RockMundo October 8–15 live database migration reconciliation — pass 12

**Production:** Supabase `yztogmdixmchsmimtent`. **Date:** 15 October 2026. **Tracking:** [#4072](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4072). Continue the exact-SQL and live-object reconciliation in passes 1–11. Do not run `supabase db push` on the historical directory or replay old, now incompatible reward/finance functions.

## Main Git and Supabase refresh

- The original `supabase/migrations` source tree remains `fe173da71e86cb6e9238594f2962160` with 1,926 SQL files. No historical seven-day additions appeared since pass 11.
- Previous direct live migration `20261015205606 rockmundo_20261015_underworld_purchase_idempotency_effect_provenance_foundation` was applied with source [merged PR #4162](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4162).
- **Newly directly applied** `20261015211043 rockmundo_20261015_underworld_safe_consumables_atomic_paid_only_arrest`. Exact reviewed SQL blob **`4e6390b4dc26e958e14e3a848574431345711d59`**, source `supabase/production-repairs/20261015_underworld_safe_consumables_atomic_paid_only_arrest.sql` in [PR #4163](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4163). Production migration count: **1,476**.

## What was applied

**Partially supersedes the two unusable original files** `20261012232200_atomic_underworld_transactions.sql` and `20261013170000_underworld_purchase_arrest.sql`, but only for a narrow, statically checked first release.

- `buy_underworld_product_atomic(uuid,uuid,text,uuid)`: new required **client request UUID**. Authenticated owner and active/living/not-jailed character. Profile FOR UPDATE lock, replay check **before** jail gate (because successful purchase can arrest buyer), existing `(profile_id,client_request_id)` unique index, mismatched-key rejection. Catalog-derived positive cash price, product FOR UPDATE lock, stock decrement (where configured) and wallet debit in the same SQL transaction. Standard profile cash trigger automatically journals the cash change. Saves the purchased effect and addiction snapshots.
- **Only 7 current products qualify:** cash-priced consumables with no duration and integer-valued `health`, `energy`, and/or `fame` effects (each bounded to ±1,000). A DB `underworld_safe_instant_effects` validator rejects **all** XP, skill, multiplier, timed, malformed or unknown JSON reward keys. All other **46** catalog products, including skill books, collectibles, boosters, five mixed-effect consumables, and negative-duration products, reject before payment.
- `consume_underworld_item_atomic(uuid,uuid)`: same owner/living/jail guard, profile and purchase FOR UPDATE locks, single-quantity consumption, frozen and validated effect keys, applies only bounded health/energy/fame and calls the existing `record_addiction_exposure` function transactionally when a verified paid original has a category snapshot. Existing historical purchases without a new trusted request key are not retroactively consumed. Direct gifts from new paid purchases can be consumed with the original payment provenance; arbitrary legacy gift chains remain gated.
- `underworld_purchase_arrest_trigger()`: one AFTER INSERT trigger on purchases; **excludes gifts, legacy/migrated purchases with no trusted request key and non-paid rows**. Matches the historical 8% base purchase-risk policy, selecting an existing prison, setting sentence/bail and fame penalty in the same transaction. Any prison persistence failure aborts the purchase/debit/stock event. This was installed but **never invoked by this audit**.
- Frontend `useUnderworldStore.ts` now sends/sticks to a stable UUID per intended profile/product/payment request until confirmed success. The product card, checkout and mutation use a shared client eligibility function; unsupported items show **Coming Soon**. Unit/contract tests added for safe catalog classes and SQL idempotency, rejection and paid-only arrest guards.

**No crypto, XP, skill XP, collectible, skill-book or multi-effect timed reward grants were enabled.** A fully controlled broader implementation remains outstanding.

## Direct production verification (no paid-player simulation)

| Check | Result |
|---|---|
| 4 SQL functions exist | `buy_underworld_product_atomic`, `consume_underworld_item_atomic`, `underworld_purchase_arrest_trigger`, `underworld_safe_instant_effects` |
| Function ACLs | Authenticated gets buy/consume. **Anon gets none**. Internal arrest/validator are service only; trigger works through its SECURITY DEFINER owner |
| Trigger | `underworld_purchase_arrest` enabled on `underworld_purchases` |
| Catalog validator | Accepts simple and mixed bounded health/energy/fame, rejects XP, temporary boost keys, JSON strings, empty JSON and out-of-range values |
| Products | **7 enabled / 46 gated / 53 total** |
| Rows before/after | **4** underworld purchases, **2** booster rows, **0** imprisonments, **0** underworld XP entries, **0** new request-id values |
| Aggregate character cash | **1,139,142,664**, unchanged |
| Unauthenticated test calls | Both buy and consume reject with `42501`, without any writes |

**Explicit limit:** No real-money in-game purchase, consume or random arrest was triggered in production to test. Authenticated, staged end-to-end and concurrent/retry/failure tests against disposable characters are still required before interpreting the feature as completely tested, particularly cash journaling and effects/penalty rollback. Frontend source is in PR #4163 and must merge/deploy for the new 4-argument RPC to work from the website. Existing three-argument clients will continue to fail safely until deployment.

## Seven-day original migration classifications

| Original migration family | Decision |
|---|---|
| Oct 9 quest XP processor/hardening | **Superseded by live service-only wallet/ledger processor.** 23 pending claims (9,200 XP), reward definitions disabled, zero XP payouts |
| Oct 12 legacy book completion | **Superseded by live canonical ledger-compatible completion RPC**, zero existing books; do not backfill awards |
| Oct 12 atomic crafting, education video cooldown, streaming totals, lottery | **Installed equivalent/safe compatible RPCs**; do not replay |
| Oct 13 AP conversion, band governance and privacy-safe social discovery | **Installed safe compatible RPCs**; do not replay |
| Oct 14 notifications and Oct 15 recording refund/claims | **Applied or safely superseded**; recording worker references installed claim/release/finalize functions |
| Oct 12 underworld purchase/consume and Oct 13 arrest | **Partially superseded** by current 7-product server-priced and paid-only arrest cutover. Other 46 catalog products remain BLOCKED pending canonical XP/skill progression, boosters, gifts, reward schemas and tests |
| Oct 13 achievements criteria/events/rewards | **Missing canonical foundation**; incompatible reward settlement could double credit. Do not replay |
| Oct 13 character retirement/recovery | **Still missing**; identity and inheritance semantics require staging |
| Oct 12 business and subsidiary buys | **Still untrusted price**; must replace with server-calculated values |
| Oct 12 sponsorship and 2030 payroll / band earnings SUM | **Finance-blocked** until PITR restore, cash-ledger/treasury parity, and controlled writer cutover; do not replay |

## Next safe step

Staging test the 7-product purchase/consume/paid-only arrest path, wallet journal parity, duplicate request retries and concurrency. Then implement booster multi-key timing and supported XP+skill-book progression using a canonical source-ledger and strong idempotency gates; do not silently award old purchases. Keep sponsorship, payroll, achievements and lifecycle changes isolated from this cutover. Update the frontend deployment state separately: production SQL alone cannot prove the website has deployed PR #4163.
