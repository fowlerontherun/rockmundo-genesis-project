# RockMundo October 8–15 migration reconciliation — pass 8

Supabase project: yztogmdixmchsmimtent. Tracking: https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4072. Date: October 15, 2026.

## Git and database status

- The main supabase/migrations tree remains fe173da71e86cb6e9238594f70158149f2962160 (1,926 SQL files). No new historical migration files were added since pass 7.
- Live migration history now contains **1,471** entries. One newly installed repair: 20261015201829 rockmundo_20261015_underworld_gift_provenance_and_atomic_transfer.
- Source: PR #4158, supabase/production-repairs/20261015_underworld_gift_provenance_and_atomic_transfer.sql, Git SHA 1c61df7863dbd10d596a45ca094b3f0c56d4ab0a. Source-control copy of SQL already directly applied; do not replay.

## Applied: underworld gifting

The existing SECURITY DEFINER gift_underworld_item RPC inserted paid_with='gift', but underworld_purchases_paid_with_check permitted only cash and crypto. Existing gifting could not succeed. The function had anonymous EXECUTE and no source inventory row lock.

The forward-only repair extends the payment-type CHECK to include 'gift', adds a nullable gifted_from_purchase_id self-FK and partial index, and replaces the function with an atomic one-unit transfer using a FOR UPDATE source lock, active/owner sender and recipient identity checks, mutual block check, remaining item quantity, category and expiry guard, and copied purchase effects. Anonymous execution is revoked. Authenticated character owners and service_role still have EXECUTE. No direct anonymous/authenticated table DML was re-enabled.

Postchecks: constraint, FK column, index, transfer guards and grants present. Exactly four pre-existing purchases remain; zero gift rows, zero prison records and no XP/cash mutation from installation. An actual gifting transaction and two-account concurrent replay must be tested in staging before calling this end-to-end validated.

## Underworld purchase/consumption/arrest — original migration still BLOCKED

Client hooks useUnderworldStore and useUnderworldInventory call buy_underworld_product_atomic(uuid,uuid,text) and consume_underworld_item_atomic(uuid,uuid), both absent in production. The underworld_purchase_arrest_trigger is absent too.

DO NOT APPLY 20261012232200_atomic_underworld_transactions.sql as-is: its timed-effect CASE/regex selection is malformed, it writes immediate XP to profiles.experience rather than the canonical player_xp_wallet + experience_ledger, and it fails to cover multiple-effect item catalogs. DO NOT APPLY 20261013170000_underworld_purchase_arrest.sql alone: its AFTER INSERT trigger has no check that a row is a paid purchase, so a successful gift could generate a random new arrest.

Read-only catalog verification: 53 available cash-priced products and zero crypto-priced products. There are 18 boosters (12 multi-effect), 12 consumables (11 multi-effect, one negative-duration, five with untimed boost effects), 15 skill books (all 15 slugs in skill_definitions), eight collectibles (two general XP and four untimed boost effects), four old purchase rows, 79 prisons, zero imprisonment rows and no underworld-specific XP ledger events.

Next SQL needs a coordinated, staged-testable purchase/use/arrest design: authoritatively priced locked cash and product rows; no client-supplied reward, cost or stock; canonical bounded XP/skill progression ledger, multi-key timed boost semantics, reliable inventory quantity and effect provenance, addiction exposure and paid-only arrest. Test retry/idempotency, multi-device concurrent purchase/consume, insufficient funds, expired inventory, blocked recipient and rollback on prison persistence failure. Do not retroactively reprocess the four historic purchases.

## Applied or superseded — no replay

- October 9 quest XP processor/hardeners: compatible service-role-only canonical function installed; 23 pending claims, 9,200 XP, all four reward definitions disabled and zero payouts.
- October 12 legacy skill-book completion: canonical wallet/ledger replacement installed as 20261015175350; zero inventory books and no awarded XP.
- October 12 crafting, video rewards, stream counter and lottery: compatible production fixes installed.
- October 13 AP conversion, band governance, safe friend suggestions, private social discovery and recruitment: newer compatible repairs installed.
- October 14 notifications and October 15 recording refund/claim: partial/safe replacements and exact executed SQL recorded; no replay.

## Still needs dependency-safe SQL

- Character retirement and recovery atomic RPCs remain absent.
- Canonical achievement criteria/events/reward tables remain absent; reward settlement requires a tested foundation and no blind historical payout.
- Business/subsidiary purchases need server-side price verification.
- Sponsorship and weekly payroll remain finance-blocked while legacy earnings SUM trigger and direct earnings INSERT remain; require restore-tested backup, accounting parity and staged concurrency before cutover.

**Result:** Only the gifting compatibility migration was directly installed this pass. No user finance, token, XP, inventory, prison or cron writes were performed. Avoid blanket supabase db push.