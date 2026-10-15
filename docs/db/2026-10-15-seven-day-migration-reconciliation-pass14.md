# RockMundo October 8–15 migrations — pass 14

**Date:** 15 October 2026 | **Production project:** `yztogmdixmchsmimtent` | **Tracker:** [#4072](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4072).

Continuing passes 1–13, reconcile the last seven days' GitHub migration files against **executed production SQL and current schema effects**, not only filename timestamps. The historical `supabase/migrations` subtree was unchanged as of the initial pass-14 refresh (Git SHA `fe173da71e86cb6e9238594f70158149f2962160`, 1,926 SQL files). An independent **historical migration replay fix** is now proposed in PR #4166, which will change that tree on merge. Do not blindly apply source migrations to production.

## Production: one additional guarded SQL repair actually applied

- Version **`20261015213616 rockmundo_20261015_underworld_consumption_persisted_prison_guard`**.
- SQL source reviewed at Git blob **`278661ed28ccadd28052787427b5f790386e318e`**, file `supabase/production-repairs/20261015_underworld_consumption_persisted_prison_guard.sql`, [PR #4167](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4167).
- **1,478** migrations recorded after installation (1,477 before).
- Live purchase RPC already denied buyers if either `profiles.is_imprisoned` or an active `player_imprisonments` record flagged imprisonment. The consumption RPC checked *only* the profile flag. Changed the existing `consume_underworld_item_atomic(uuid,uuid)` to check persisted `status='imprisoned'` sentences after the owned active-character row lock and before reading/consuming inventory.
- No changes to price, effects, rewards, existing incarceration events, paid-only arrest odds, XP or cron; authenticated RPC EXECUTE retained, anonymous EXECUTE denied.

**Transaction-isolated production verification:** both smoke tests ran entirely inside explicit `BEGIN ... ROLLBACK`.
1. A bought item and a temporary active prison sentence with a deliberately stale `profiles.is_imprisoned=false` flag correctly yielded `42501 UNDERWORLD_CONSUME_IMPRISONED`, left the inventory quantity unused and did not change the character's energy.
2. A new $90 consumable bought for a legitimate active owned character was consumed normally without an active sentence, resulting in one used item, the expected -$90 cash and +30 energy *inside the transaction only*. If the paid-only arrest randomly fired, temporary release was performed only within the same rolled-back transaction. No persistent purchase, sentence, XP, cash, inventory, token, boosts or journal rows resulted.

**Postcheck:** 4 old underworld purchases, 2 booster rows, **0 active imprisonment rows**, 5,238 financial transactions, aggregate character cash **1,139,142,664**, 0 new paid requests, 23 quest claims pending, 0 enabled quest reward definitions. The new persisted-sentence guard and function ACL were verified from `pg_proc`. Security Advisor no ERROR, existing INFO/WARN findings persist.

## Critical newly verified clean-rebuild blocker: older historical migrations

After merged [PR #4164](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4164), its CI checks completed **with failures**, not green:
- **Supabase SQL release gate:** failed on a historical replay at `20260327064907_4b76ce6d-5973-4b8b-8960-5fe066c80669.sql`, SQLSTATE **42P13** (`cannot change return type of existing function`). Previous `20260326103000_character_resurrection_lives.sql` defined `public.resurrect_character(uuid) RETURNS public.profiles`; the following migration tried `CREATE OR REPLACE ... RETURNS void`, prohibited by PostgreSQL.
- **PR #4166** changes only the March 26 migration's temporary RPC declaration to `RETURNS void` and `RETURN;`, aligning with March 27, July, August and October canonical implementations. Adds a contract test. Production's **current** resurrection RPC already returns `void` with coma-specific, owner-restricted logic: **do not replay or deploy the old resurrection migration to production**.
- After that source fix, CI must **replay from a blank database**, as further early-history migration conflicts may be exposed. This fix alone is not a claim that all 1,926 historical files now replay cleanly.
- **Frontend unit/lint/typecheck/build and the combined verify job:** broad ESLint baseline drift (2,923 baseline errors vs 3,081 current, +158; release-focus `src/features/player-model/appearance.ts` unexpected `any` among errors). This failure is not evidence of an underworld transaction test failure.
- **Real browser + axe gate:** Playwright audio-lifecycle timeout and admin accessibility violations.
- **Finance verification:** also failed while attempting the historic replay, including the same March resurrection signature mismatch. These are repository CI blockers and must be resolved separately. The initial audit reporter previously marked jobs in-progress, but they were checked at completion during this pass.

## Seven-day classification after this pass

| Original migration workstream | Status | Decision |
|---|---|---|
| Oct 9 quest-claim XP processor and hardeners | Installed newer canonical service-only compatible version; 23 pending claims/9,200 XP, four definitions disabled and zero paid | **Superseded; do not replay original or enable payout** |
| Oct 12 book completion, crafting, video cooldown, atomic streaming, AP and lottery | Compatible replacements installed, old skillbook inventory empty | **Superseded/already applied** |
| Oct 13 band governance, social privacy/discovery, social messaging and friendship cooldown | Compatible, narrower live replacements | **Do not replay obsolete/2030 source** |
| Oct 14 durable notifications, Oct 15 recording refunds/claims | Installed in previous passes; recording worker uses canonical claim/release/finalize | **Applied / superseded** |
| Oct 12 underworld buy and consume; Oct 13 purchase arrest | Safe cash purchase/use for **7** bounded immediate consumables, request UUID, correct cash journal, paid-only arrest. Current pass also fixes prison sentence authorization | **Partially superseded**; 46 unsupported product catalog records still gated |
| Oct 13 achievements event/reward integrity | `achievement_criteria`, `achievement_events`, `achievement_rewards` foundations absent | **Blocked**, install source foundation before any payouts |
| Oct 13 recovery/retirement | Separate atomic lifecycle implementation missing | **Blocked**, test identity/inheritance |
| Oct 12 business and subsidiaries | Historical SQL trusts caller price | **Blocked**, calculate authoritative server pricing |
| Oct 12 sponsorship / future payroll and SUM band-earnings | Existing finance trigger SUM can overwrite balance; other ledger restrictions | **Finance-blocked**, restore-tested PITR, cohort account reconciliation and writer cutover required |

## Next priorities

1. Restore GitHub **clean migration replay** beyond the March 26/27 return-type mismatch and record each subsequent hard error with its historical source, not by altering working live DB to match stale files.
2. Run CI on PRs #4166 and #4167 and inspect failure details; CI cannot be called green until all required checks pass.
3. Stage-test underworld multi-device concurrency and the seven supported product flows before enabling further timed booster or XP/skill-book categories. The current `player_active_boosts` schema supports sourced multi-key effects, but catalog effect **consumers and budget/stacking behavior** need validation before selling the remaining 46.
4. Do not rewrite the current secure coma-only resurrection function from the March migrations or replay any other superseded October SQL.
