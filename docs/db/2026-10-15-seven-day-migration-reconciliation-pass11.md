# RockMundo seven-day DB migration reconciliation — pass 11

**Production:** Supabase `yztogmdixmchsmimtent`. **Date:** 15 October 2026. [Tracking issue #4072](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4072). Extends the original Oct 8–15 exact-SQL and live-object reconciliation, and passes 2–10.

## Changes since pass 10

- Main source `supabase/migrations` subtree unchanged at `fe173da71e86cb6e9238594f70158149f2962160`, **1,926 SQL files**. Do **not** mass-apply the old directory: compatibility repairs supersede it.
- Live production history now has **1,475 records** (up from 1,474). One new forward-only migration applied:
  - **`20261015205606 rockmundo_20261015_underworld_purchase_idempotency_effect_provenance_foundation`**
  - Source: [PR #4162](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4162), `supabase/production-repairs/20261015_underworld_purchase_idempotency_effect_provenance_foundation.sql`, exact source blob `8da0656aa48c1d74171142e87918539bff1a2443`.
- The previous friendship 24h cooldown fix and its scope-correction source [PR #4160](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4160) and audit [PR #4161](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4161) were merged before this pass. The original `20300106160000` social-contact SQL remains **superseded/partially superseded**, not to replay.

## New underworld schema prerequsites now installed

The old underworld SQL does not support reliable retries or multi-key temporary boosts. The new migration is **schema-only**:

1. `underworld_purchases.client_request_id uuid` nullable; unique partial `underworld_purchase_profile_request_once` on `(profile_id,client_request_id)` when request is present; constraint requires a profile for any non-NULL key. The future browser client must create a stable UUID **once per intended purchase** and reuse on network retry. The future buy RPC must check the key and exact product/payment match under a profile lock **before debit**. The index alone does **not** make current purchases retry safe.
2. `player_active_boosts.source_purchase_id uuid` nullable FK to `underworld_purchases(id)`, with a unique `(source_purchase_id,boost_type)` partial index. This supports one boost row per **effect type** per paid purchase without collapsing multi-effect items or duplicating effects on retry.
3. `underworld_purchases.purchased_addiction_type text` nullable with a constrained set of category values. The future buy/gift/consume code must capture it and propagate it so changes to the admin catalog do not change already-purchased item effects.

Existing row data and grants were not modified. Live after migration:
- **4** existing purchase rows, **0** populated request IDs.
- **2** existing boost rows, **0** linked to a purchase ID.
- **0** imprisonment rows, **0** underworld-specific XP ledger rows.
- Profile cash aggregate **1,139,142,664** before and after.
- Both target tables have RLS enabled, and authenticated INSERT/UPDATE remains revoked. Both new unique indexes, three columns, two CHECK constraints and the boost FK were verified against production metadata.

## What was applied, is superseded, or remains missing

| Historical October family | Classification |
|---|---|
| Oct 9 skill-quest XP claim processor and hardeners | **Superseded** by installed service-role-only canonical XP ledger payout function. **23 pending claims**, **0 enabled** definitions, **0 granted** ledger events. No replay, activation or backfill |
| Oct 12 skill-book completion | **Superseded** by compatible authenticated-owner atomic completion function; direct inventory writes locked, book inventory empty; no XP issued |
| Oct 12 crafting, video cooldown, streaming counter, lottery | Existing compatible RPCs and guards verified in passes 2–10; **no replay** |
| Oct 13 AP, band governance, social opt-in/discovery, recruitment | Compatible replacements already applied; **no replay** |
| Oct 14 notifications and Oct 15 recording refunds/unique takes | Exact or narrower secure replacements installed; recording worker v413 references required atomic RPCs; **no replay** |
| Oct 12 underworld buy+consume and Oct 13 arrest | **Still missing.** New source/provenance prerequisites applied, but all three RPC/trigger objects absent. Original timed-effects SQL is syntactically broken, credits obsolete XP fields, fails multi-key boosts; original AFTER INSERT arrest also impacts gifts. Do not replay |
| Oct 13 achievements | Criteria/event/reward foundation absent. Original integrity SQL references missing schema and can issue financial/XP rewards; blocked until new canonical audited architecture |
| Oct 13 character recovery/retirement | Missing atomic lifecycle RPCs; must test profile ownership, recovery/handover and inheritance |
| Oct 12 business/subsidiary purchases | Old client-submitted price assumption untrusted; blocked until server-authoritative prices |
| Oct 12 sponsorship/2030 weekly payroll/earnings SUM | Finance-blocked pending PITR restore, transaction-ledger reconciliation and cohort rollout |

## Underworld next safe release stages

1. **Client/API contract:** optional vs required stable UUID request ID, single intended purchase semantics, false retried-payment mismatch rejection, and no duplicate cash debit. The current React hook calls a missing three-argument `buy_underworld_product_atomic`; it must be updated consistently with the future idempotency contract.
2. **Server purchase:** authenticated active living character, un-imprisoned buyer, catalog-derived nonzero cash/token price, locked stock, trusted payment debit, saved purchase effect+addiction snapshot, canonical wallet/cash journaling, and an authoritative paid-purchase-only arrest flow. Gifts must be exempt from new purchase arrests.
3. **Rewards and consumption:** frozen trusted effects, all keys reviewed for duration/sign/bounds, multiple boost rows attributed to their purchase, canonical `experience_ledger`/`player_xp_wallet` for XP, skill unlock checks, single-use inventory locks, addiction recording in one transaction. Of 53 products, 18 boosters include 12 with multiple effects; 12 consumables include 1 negative-duration item; 15 skill books and 8 collectibles require separate reward semantics. Only **7** consumables have a simple health/energy/fame effect profile, but enabling just those without coordinated arrest and idempotency was intentionally deferred.
4. **Validation before production cutover:** compile+transactional rollback tests in staging for success, insufficient cash, concurrency, duplicate keys, multi-effect grants, gift exemption, poison/invalid effects, rejection without debit and arrest failure rollback. Inventory and account totals must reconcile. Do not backfill or replay four historical purchases.

No purchases, item grants, imprisonment, payment, XP, rewards, cash, existing rows or cron jobs were executed or changed by this schema-only migration.
