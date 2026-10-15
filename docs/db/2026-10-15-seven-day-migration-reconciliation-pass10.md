# RockMundo — October 8–15 migration reconciliation, pass 10

**Production project:** `yztogmdixmchsmimtent` | **Date:** 15 October 2026 | **Tracking:** [issue #4072](https://github.com/fowlerontherun/rockmundo-genesis-project/issues/4072).

## Live Git and database results

- The main `supabase/migrations` subtree remains at `fe173da71e86cb6e9238594f70158149f2962160`, containing 1,926 SQL files; no original seven-day migration files were added since pass 9.
- Production history rose from **1,472 to 1,474**, after **two** directly applied, source-controlled, forward-only migrations.
- Source [merged PR #4160](https://github.com/fowlerontherun/rockmundo-genesis-project/pull/4160), in `supabase/production-repairs`:
  - `20261015204607 rockmundo_20261015_friendship_decline_cancel_remove_cooldown_live_compat`, Git blob `5372753b57a62700e230abacbc6b3bcd8f12c1a1`.
  - `20261015204723 rockmundo_20261015_friendship_connection_state_parameter_scope_fix`, Git blob `e6c09aeb77925a1196e700106ce483ddf696c32a`.
- **Do not replay** `20300106160000_enforce_social_contact_consent_and_request_cooldowns.sql` as a whole: its direct-message consent slice is separately live via `20261015203638`; its friendship code requires nonexistent `public.friendship_settings` and would replace working auth/relationship functions.

## Implemented: friendship request cooldown and cancellation audit

Prior status:
- `send_friend_request` checked only a recently **declined** request in one direction.
- `cancel_friend_request` **deleted** pending relationships without recording a cancellation in `social_relationship_audit`.
- `respond_to_friend_request` already wrote `friend_request_cancelled` on its cancellation route and `friendship_removed` (not `friend_removed`) on removal.
- `get_connection_state` did not report a `request_cooldown` state, although the frontend already supports that state.

New live protection:
1. A SECURITY DEFINER BEFORE INSERT / relevant UPDATE `guard_friendship_pair_cooldown` rejects a new pending friendship if either side declined, cancelled or removed the relationship within 24 hours. This guards *table inserts from any future RPC writer*, not only the older sender RPC, and accepts both `friendship_removed` and `friend_removed` spellings. It preserves accepted relationships and existing pending records.
2. `cancel_friend_request(uuid,uuid)` validates owned requester, locks the pending row, inserts `friend_request_cancelled`, then deletes the friendship atomically. `social_relationship_audit.friendship_id` is an ON DELETE SET NULL FK: the historical audit row remains, with actor/target/time intact; it does not keep a deleted friendship ID.
3. `get_connection_state(uuid,uuid)` preserves active friendship, outgoing/incoming pending and block states and now returns `request_cooldown` when the pair has a recent terminal audit event. The follow-up statement `20261015204723` explicitly disambiguates the PL/pgSQL `target_profile_id` parameter from `social_relationship_audit.target_profile_id`.
4. Both client-callable functions are restricted to authenticated and service role; the trigger function has no anon/auth direct EXECUTE.

## Verification and rollout evidence

- Verified enabled trigger and exact function permissions; **no SQL-trigger or SECURITY DEFINER view ERROR** appeared in Supabase Security Advisor.
- First transaction-scoped smoke test surfaced an actual ambiguous-parameter failure in the connection-state function. Installed the forward-only disambiguation fix, then the **rolled-back** test succeeded: a recent synthetic cancellation returned `request_cooldown` and blocked a direct pending friendship INSERT with `FRIEND_REQUEST_COOLDOWN_24H`.
- Separate **rolled-back** test used an existing pending request and owner-matching auth JWT context: `cancel_friend_request` removed the row inside the transaction, inserted a cancellation audit event, and returned `request_cooldown`. Audit `friendship_id` becomes NULL on deletion as designed. Transaction rollback restored both objects.
- Final persisted counts **unchanged**: 122 friendships (108 pending, 14 accepted), 105 audit rows (0 terminal cooldown rows), 23 pending quest claims, 0 enabled reward definitions, 0 quest XP awards, 4 existing underworld purchases. No user cash, XP, inventory, social contacts or cron schedules changed.

These tests simulate a legitimate signed-in sender through transaction-local JWT claims but are not browser end-to-end tests. Staging should cover concurrent requests and private profiles before treating every UX pathway as complete.

## Current decisions across the past seven days

| Migration family | Status and next action |
|---|---|
| Social discovery, profile privacy, direct messaging, friendship cooldown | **Compatible live replacements applied**. No replay of older SQL; full historical `friendship_settings` extension remains intentionally absent |
| Quest reward XP and legacy skill-book completion | **Canonical ledger-compatible RPCs installed**; 23 pending XP claims/9,200 XP with all reward definitions disabled. No payout; stage-test before enabling |
| Crafting, AP conversion, video reward cooldown, atomic stream totals, lottery, band governance/recruitment | **Applied / superseded by proven live equivalents**; do not blanket db-push originals |
| Recording refund/unique take and completion worker | **Applied**; live completion worker v413 references atomic completion RPCs; stage-test one real recording |
| Underworld gift and client inventory write guards | **Applied**; gift provenance and atomic transfer installed; no direct client financial/inventory writes |
| Underworld buy/consume/arrest | **Still missing and blocked**. Original SQL malformed for timed effects, obsolete XP writes, and arrest trigger would include gifted rows. Need paid-only coordinated price/stock/inventory/XP/boost/arrest replacement tested against 53 products |
| Achievements foundational criteria/events/reward tables | **Missing**, must add canonical schema and idempotent event processing before any backfill or rewards |
| Character retirement/recovery, business/subsidiary price authority | **Missing/blocked**, require identity-safe and server-price-specific rewrites |
| Sponsorship/weekly payroll/band earnings SUM trigger | **Finance-blocked** pending restorable PITR, all-ledger reconciliation, negative/positive concurrency and writer cutover |

**No migration in the history before `20261015204723` should be re-run merely because its original file has no exact matching history timestamp.** Do not execute the original seven-day migration directory wholesale.
