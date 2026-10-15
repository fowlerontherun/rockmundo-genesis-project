# RockMundo October 8–15 migration reconciliation — pass 13

**15 October 2026 · production Supabase `yztogmdixmchsmimtent` · tracking issue [#4072](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4072)**.

Continuation of exact-source/live-effect reconciliation across the last seven days. The historical `supabase/migrations` Git tree remains `fe173da71e86cb6e9238594f70158149f2962160` (1,926 migration files). The newer production-repairs tree changed because verified forward-only compatibility repairs were committed. **Do not blanket `supabase db push` the old Oct 8–15 files.**

## Directly applied this pass

- Latest installed version **`20261015212302 rockmundo_20261015_underworld_purchase_cash_journal_request_correlation`**.
- Reviewed SQL source: `supabase/production-repairs/20261015_underworld_purchase_cash_journal_request_correlation.sql`, Git blob **`92c5bb6da4d506f7a42988cda9e0c68c24b29926`**, merged with [PR #4164](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4164).
- Live history now **1,477** entries (prior pass: 1,476). Prior partial underworld shop migration `20261015211043` and request/boost provenance `20261015205606` remain live.
- Fixes cash-journal attribution in the **already-installed** 7-consumable `buy_underworld_product_atomic(uuid,uuid,text,uuid)` without changing catalog access, payments or the 8% paid-only arrest policy. Before the existing `profiles.cash` debit, sets transaction-local `app.player_cash_context`: journal classification `underworld_purchase`, request key `underworld:<uuid>`, original product ID, request ID and server-derived price. The existing wallet trigger writes the financial transaction, rather than adding a second competing ledger writer.
- Source [PR #4164](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4164) also fixes a client-side double-charge retry risk: a `useRef` UUID disappeared when the React hook remounted or the page reloaded. The new shared module keeps pending UUIDs in sessionStorage, keyed by profile/product/payment, with in-memory fallback, and clears them only after confirmed success. Added retry/reload contract and unit tests. **Cross-browser or deliberately cleared session storage is not durable idempotency; the DB remains authoritative.**

## Actual production SQL transaction smoke tests

Only the production Supabase project was connected (there is no independent staging project). Accordingly, each positive smoke test was wrapped in `BEGIN ... ROLLBACK`, used transaction-local JWT claims for an active/living character and locked a valid character profile for the minimum operation. The SQL never committed purchase, cash, inventory, arrest or XP state.

1. Previous scoped production rollback test passed: purchase a canonical $90 consumable, get a normal receipt, retry the same UUID and receive the same receipt with `replayed=true`, verify exactly one financial journal and expected profile/wallet balance, consume the item and reject second consumption.
2. **This pass after the journal migration:** an independent complete transaction-rollback test passed for `Off-Menu Espresso Shot` ($90). It asserted single purchased inventory row/receipt, stable idempotent replay, exactly one matching financial transaction with key `player-cash:<profile>:underworld:<uuid>`, recorded product ID, price and request ID, cash projection matches wallet minor units, use of an already-used key for another product fails, consumption applies energy correctly and marks item used, and a second consumption fails. If the existing 8% arrest policy fired inside the rolled-back test, the character was only released **inside the same never-committed transaction**, allowing consumption assertions to run. Production was unchanged afterwards. This does **not** test the browser end to end, external notifications or concurrent purchases from different clients.
3. Before and after tests and deployment, 4 purchase rows, 2 active boost rows, 0 imprisonment rows, 0 underworld-specific XP ledger entries, **5,238 financial transactions**, 0 persisted `underworld_purchase` journal rows, and aggregate profile cash **1,139,142,664**. All 50 active characters had matching current profile cash and primary financial account balances at preflight. The newly applied function remains SECURITY DEFINER with authenticated/service EXECUTE and no anon EXECUTE.
4. Security Advisor showed no ERROR; pre-existing warnings about public definer functions and mutable search paths remain. On the first CI check after PR #4164 merged, five verification/security/browser/finance jobs were still running: **do not claim green builds without checking the finished workflow result**.

## Migration decisions for the original Oct 8–15 SQL

| Family | Status | Safe decision |
|---|---|---|
| Oct 9 quest XP processors / integrity | **Superseded** by canonical service-only `process_skill_quest_xp_claim`; 23 pending claims worth 9,200 XP, all definitions disabled | Do not replay or activate/unblock payment before staged tests |
| Oct 12 old skill book completion | **Superseded** by canonical wallet-ledger `complete_legacy_skill_book_atomic`; 0 current book rows | Do not replay obsolete `progression_award_action_xp` |
| Oct 12 crafting, education video, AP conversion, atomic streaming and lottery | **Equivalent repairs already installed** | No repeat deployment |
| Oct 13 band governance/recruitment, social privacy/discovery | **Safer installed replacements** | Do not replay original SQL; friend request cooldown and DM consent repaired separately |
| Oct 14 notifications, Oct 15 recording | **Applied or independently superseded**; recording completion worker uses installed claim/release/finalize functions | End-to-end test only |
| Oct 12 underworld buy+consume, Oct 13 arrest | **Partially superseded** by 7-product scoped purchase/consume/paid-only arrest and now traceable cash journal; 46 complex/multi-key catalog products fail closed | Stage and design XP/skill book, booster and collectible semantics, not the malformed historical original |
| Oct 13 achievement event/reward integrity | **Not applicable until canonical criteria/events/rewards foundations restored** | No retroactive rewards or unverified financial settlements |
| Oct 13 character retirement and recovery | **Missing atomic lifecycle dependencies** | Staging inheritance/ownership model first |
| Oct 12 business/subsidiary purchases | **Old client-provided prices are untrusted** | Server-priced rewrite needed |
| Oct 12 sponsorship / payroll / SUM earnings trigger | **Finance-blocked** | Restore-tested backup, ledger reconciliation and writer cutover required |

## Remaining release gates

- Verify GitHub Actions frontend unit/lint/typecheck/build, SQL release gate, browser/axe gate, finance verification and core checks after the PR. New frontend bundle may not yet have deployed to `rockmundo.uk`.
- Test concurrent purchases and network timeout/reload in a disposable nonproduction profile once staging becomes available. Rollback smoke is not a concurrency test and cannot prove real-world successful purchase UX.
- Follow through on the remaining 46 underworld products with trusted, frozen, bounded reward payloads and canonical XP/skill progress, without retroactively changing 4 historical purchases.
- Keep achievements/retirement/business/payroll unrelated to this rollback-tested underworld change. Do not apply old SQL as a batch.

**Production data change this pass:** one function-body migration. No persistent player transactions or financial/journal/inventory/arrest changes.
