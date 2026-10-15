# RockMundo October 8–15 database migration reconciliation — pass 7

**Production:** Supabase `yztogmdixmchsmimtent` | **15 Oct 2026** | [Tracking issue #4072](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4072).

This continues the full seven-day Git SHA → executed Supabase SQL comparison and passes 2–6. The `supabase/migrations` subtree is unchanged from the prior pass. The six historically executed source files recovered in PR #4150 and the underworld direct-write lock in PR #4153 are merged. Do not `supabase db push` or blindly apply the original Oct 8–15 source SQL; those scripts can undo later production-specific fixes.

## Newly applied (exactly one production migration)

- Live migration: **`20261015175350 rockmundo_20261015_legacy_skill_book_canonical_completion`**.
- Source: `supabase/production-repairs/20261015_legacy_skill_book_canonical_completion.sql` in [PR #4155](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4155), Git blob `3f3f7eb15a95b0b3156939b0356f0a6cb0878102`.
- Replaces the incomplete `20261012235900_atomic_legacy_skill_book_completion.sql`. The original calls nonexistent `progression_award_action_xp`.
- Preflight required **zero rows** in `player_skill_books`, the existing authenticated direct-write lock, and absence of prior completion RPC.
- Installs `complete_legacy_skill_book_atomic(uuid,uuid)`, an authenticated character-ownership, active/undead-check, book-row-lock and bounded XP transaction against `experience_ledger` + `player_xp_wallet`. Atomic ledger, wallet and completion marker; unique `legacy_skill_book_ledger_inventory_unique` prevents same-book double XP. Authenticated EXECUTE true; anonymous EXECUTE false.
- Postchecks: exactly **0** legacy inventory rows, **0** legacy skill-book ledger grants, canonical total wallet lifetime XP remains **500,503**; no direct authenticated inventory DML privileges. No XP, cash, book purchases or character records mutated during deployment.
- The function intentionally does not change a `skill_progress` level because the legacy book's `skill_focus` is not yet mapped/validated against canonical skill progression. Purchase/provisioning provenance is service-only and currently has no live book rows. End-to-end test requires a legitimately provisioned staging book, not a fabricated live reward.

Live migration history is now **1,470** (up from 1,469).

## Consolidated seven-day migration status

| Source / workstream | Live evidence | Decision |
|---|---|---|
| Oct 9 `process_skill_quest_xp_claim` and two follow-up integrity SQL files | Compatible `process_skill_quest_xp_claim(uuid)` installed as `20261015171019`, service-only; 23 pending XP claims worth 9,200 XP, reward flags disabled, 0 payouts | **Superseded; do not run originals or activate payouts** |
| Oct 12 `atomic_legacy_skill_book_completion` | Compatible RPC + event uniqueness installed this pass, 0 book rows | **Superseded; no original SQL replay** |
| Oct 12 `atomic_legacy_crafting`, education video cooldown, atomic stream totals | Existing compatible functions, locks, tiered skill logic and catalog-verified video rewards; stream totals function already present | **Already applied/effectively superseded** |
| Oct 12 atomic lottery client actions | Corrected live RPCs and draw guard installed `20261015112035` and `20261015112441` | **Superseded** |
| Oct 13 AP conversion, band leadership/leave and private social discovery | Safe live-compatible RPCs, RLS and guard triggers installed | **Superseded** |
| Oct 14 durable notifications | Targeted event idempotency, recipient security, durable offer/game triggers applied | **Partial safer replacements applied; do not replay broad source** |
| Oct 15 recording refund/claim and unique take | Exact SQL installed `20261015151606`; recording worker v413 references new RPCs | **Applied** |
| Oct 12 underworld purchase and consume; Oct 13 arrest | Browser RPCs `buy_underworld_product_atomic` and `consume_underworld_item_atomic` and arrest trigger **still absent**; direct table forgery guarded by `20261015171718` | **Needs a new coordinated compatibility migration**; original timed-effect CASE/regex source incomplete, XP credits noncanonical and trigger separation unsafe |
| Oct 13 character retirement/recovery | Atomic life-cycle functions missing | **Needs tested identity/inheritance changes** |
| Oct 13 achievements integrity | `achievement_criteria`, `achievement_rewards`, `achievement_events` absent | **Needs foundations before rewards** |
| Oct 12 business upgrades and subsidiary purchases | Original scripts trust client-submitted costs | **Blocked; server-authoritative price calculation first** |
| Oct 12 sponsorship, 2030 payroll and earnings SUM-trigger repair | Live `update_band_balance_from_earnings` still uses historical `SUM(amount)`, authenticated band earnings INSERT possible, 44,882 earnings records, 31 treasury projections align, 0 sponsorship payment rows | **Blocked**; require verified restorable PITR, isolated ledger parity/concurrency tests and coordinated earning-writer cutover |

## Direct-to-DB next actions

1. Design a **single trusted underworld purchase/use/arrest transaction** with server-derived cash price, locked stock, character ownership, idempotent inventory settlement, canonical XP ledger and consistent prison/event handling. Validate all 53 catalog products and historical 4 purchase rows without altering old rows. Retain direct client INSERT/UPDATE/DELETE restrictions. Do not apply the broken Oct 12 source unchanged.
2. Test the installed legacy book function using disposable staging inventory with verified purchase provenance; no arbitrary live books or XP awards.
3. Test dormant quest rewards on disposable staging characters with race/retry/rollback conditions; reward definitions remain disabled.
4. Investigate achievement and lifecycle dependencies. Financial payout/SUM trigger work remains isolated until PITR restore and accounting integration tests pass.

These observations are production DDL and data checks, not a substitute for authenticated end-to-end gameplay verification. No financial triggers, rewards, XP balances or cron schedules were modified in the pass 7 deployment.
