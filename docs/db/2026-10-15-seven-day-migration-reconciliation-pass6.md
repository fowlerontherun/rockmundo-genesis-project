# RockMundo Oct 8–15 database migration reconciliation — pass 6

**Production:** Supabase `yztogmdixmchsmimtent` | **Date:** 15 Oct 2026 | **Tracking issue:** [#4072](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4072).

Continuation of the full seven-day exact-SQL history audit and passes 2–5. Do not
`supabase db push` the Oct 8–15 directory or replay its old finance/XP RPCs.
`supabase/migrations` remains at Git tree `fe173da71e86cb6e9238594f70158149f2962160`
(1,926 SQL paths). The prior docs-only reconciliation PR #4152 is still open.
Already-executed six missing-SQL-source files are now merged by PR #4150;
quest-reward source PR #4151 is also merged.

## One new live migration applied and verified

**`20261015171718 rockmundo_20261015_underworld_purchase_token_boost_prison_direct_write_lock`**

Source: `supabase/production-repairs/20261015_underworld_purchase_token_boost_prison_direct_write_lock.sql`,
[PR #4153](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4153), exact blob SHA
`4802cbc38606d5fda0363165c350b661ba8c2e7a`.

**Why:** The current `underworld_purchases` RLS policy allowed a user to insert
or rewrite an owned purchase without any authoritative debit or stock check.
`player_token_holdings` and `player_active_boosts` had owner-only ALL
policies permitting self-credit. `player_imprisonments` had permissive INSERT
and UPDATE policies, including a `WITH CHECK (true)` INSERT policy. All four
tables previously granted data API mutation privileges to both `anon` and
`authenticated`.

**Change:** Revoke only `INSERT`, `UPDATE`, and `DELETE` for `PUBLIC`,
`anon`, and `authenticated` on these four tables. No RLS or SELECT change;
existing postgres-owned SECURITY DEFINER `trade_crypto_token` and
`gift_underworld_item` remain callable, and `service_role` retains all
relevant mutation rights. The production preflight demanded existing RLS and
the two canonical definer RPCs.

**Postcheck:**

| Object | anon/auth INSERT, UPDATE, DELETE | service INSERT/UPDATE | Existing rows |
|---|---|---|---:|
| `underworld_purchases` | All false | Both true | 4 |
| `player_token_holdings` | All false | Both true | 1 |
| `player_active_boosts` | All false | Both true | 2 |
| `player_imprisonments` | All false | Both true | 0 |

RLS remains enabled, table SELECT privileges remain intact for authenticated
queries (subject to RLS), and the Supabase security adviser produced no new
ERROR. There were no balance updates, fabricated items, arrests, purchases,
cron executions, or historical changes. Production history now contains
**1,469** entries.

## Still missing: October 12–13 underworld RPCs

Both `src/hooks/useUnderworldStore.ts` and
`src/hooks/useUnderworldInventory.ts` call missing
`buy_underworld_product_atomic(uuid,uuid,text)` and
`consume_underworld_item_atomic(uuid,uuid)`, respectively. The Oct 13
`underworld_purchase_arrest_trigger()` is also absent. These are **not
applied**, and the client-side underworld purchase/consume experience is still
not restored by the table permission repair alone.

The original `20261012232200_atomic_underworld_transactions.sql` cannot
safely be applied unchanged: its timed reward selector has an incomplete
regular-expression/CASE SQL expression; immediate XP is written to
`profiles.experience` instead of canonical `player_xp_wallet` and
`experience_ledger`; it does not include the arrest trigger; and stock,
payment, addiction and reward idempotency require a consistent transaction.
The `20261013170000_underworld_purchase_arrest.sql` original would introduce
random arrests on INSERT without a verified purchase RPC cutover. Treat the
pair as **unapplied and requiring a live-compatible rewrite**, not a pair to
bulk deploy.

Read-only live catalog preflight: 53 available underworld products, all
cash-priced, none token-priced, 18 timed boosters, 12 consumables, 15 skill
books and 8 collectibles. Four purchases exist already. 79 prisons exist,
zero prison sentences currently. Verify buyer/character identity and
imprisonment state, catalog-derived prices, payment/stock row locks,
supported effect keys and numeric bounds, canonical XP and skill progression,
purchase/consume idempotency, same-transaction arrest decisions, and
`service_role`/admin visibility before deploy. Test using staging only;
do not retroactively process the four historical purchases.

## Remaining Oct 8–15 status

| Historic migration | Status / decision |
|---|---|
| Three Oct 9 quest-reward payout processors | **Superseded.** Service-only canonical processor installed as `20261015171019`; payout disabled and no backfill. |
| Oct 12 crafting, video-reward cooldown, stream totals | **Already implemented or superseded** by existing compatible live RPCs. Do not replay. |
| Oct 13 AP conversion, band leadership/leave, social discovery, mutual friend counts | **Superseded.** Live replacements verified in prior passes. |
| Oct 14 durable notifications, Oct 15 recording refund/unique takes | **Applied / partially superseded**; no replay. |
| Oct 12/13 underworld purchase, use and arrest | **Missing.** New direct-write lock installed, authoritative purchasing still requires rewrite. |
| Oct 12 legacy skill-book completion | **Missing.** `complete_legacy_skill_book_atomic` absent and historical XP-award dependency missing; 0 books in inventory. Do not invent rewards or provenance. |
| Oct 13 achievements canonical reward integrity | **Blocked.** `achievement_criteria` missing and dependent events/rewards schema unresolved. |
| Oct 13 recovery and retirement | **Missing.** Requires staged character-lifecycle tests. |
| Oct 12 sponsorship and 2030-dated payroll | **Finance-blocked.** Destructive earnings SUM trigger still exists; financial account reconciliation and PITR restore needed. |

**Postdeployment invariants:** All 23 skill-quest claims remain pending; all
four reward definitions are disabled; zero `skill_quest_reward` ledger entries.
No quest XP is granted by the new permission migration.

## Next actions

1. Develop server-authoritative underworld buy/consume/arrest **as one
   coordinated change**, including canonical XP, stock, payment and idempotency;
   test staged positive/negative concurrent purchase and use paths.
2. Implement verified legacy book provenance and canonical completion; do
   not install original function that invokes nonexistent
   `progression_award_action_xp`.
3. Test the dormant quest payout processor on disposable staging characters
   before *separately* approving any reward definition activation.
4. Keep original financial batch/earnings triggers blocked pending
   restore-tested backup and all-ledger reconciliation.

All applied changes in this pass were the scoped privilege lock documented
above. This report adds no independent database writes.
