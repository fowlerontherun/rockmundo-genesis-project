# Cooking implementation status

## First implementation slice

The design is recorded in [ROCKMUNDO_COOKING_AND_MARKETS_PLAN.md](ROCKMUNDO_COOKING_AND_MARKETS_PLAN.md). The first implementation introduces a free practice kitchen at `/cooking`, accessible from Career. It includes pan drag-and-drop, touch/keyboard select-and-place alternatives, independent ingredient timing, heat controls, ingredient-specific colour/texture changes, doneness labels, plating, irreversible burning, quality feedback, slower timing and bounded sessions. It creates no inventory, buffs, XP or currency transactions. No database changes are required by this slice.

This is the first part of phase 1. It does **not** complete phase 0's live database audit or the production crafting/economy acceptance gate. The tutorial's browser clock is only a local simulation and must never authorize rewards. Manual attempts reset when the page unmounts; focus/background catch-up works while mounted. Cross-device restore belongs to the server session implementation.

## Repository integration review

| Existing area | Observed integration | Next implementation requirement |
| --- | --- | --- |
| `src/hooks/useCraftingSystem.ts` | Material catalogue, profile-owned materials, recipes, crafting sessions, blueprints and equipment-oriented craft results | Add food lots, portion counts, expiry and authoritative cooking sessions without changing existing instrument selection or equipment result contracts |
| `src/hooks/useActiveProfile.ts` | Existing active-character identity | Derive ownership from the authenticated active profile; validate server-side for every inventory action |
| `src/hooks/useUnderworldInventory.ts` | Existing inventory listing and `consume_underworld_item_atomic` RPC | Review the live consume transaction before integrating; food must not become an unrelated duplicate wallet or an unvalidated browser reward |
| `src/pages/InventoryManager.tsx` | Existing general inventory page with multiple item sources | Add a food section with batches, portions and exact expiry after authoritative storage exists |
| `src/hooks/useWellnessState.ts` and `useWellnessLifestyle.ts` | Existing profile wellness and lifestyle data | Define food effect eligibility/caps and use existing health rather than adding a competing health model |
| `src/App.tsx`, `src/config/fmNavigation.ts`, `src/pages/CareerOverview.tsx` | Authenticated game routes, Career sidebar and Career actions | Practice kitchen is registered at `/cooking`; existing mobile companion primary navigation stays focused on its supported activities |

The review above is of repository callers, not a claim about the live schema. Before adding production inventory or SQL, inspect current database objects, ownership/RLS rules, schedule/job infrastructure, mayor treasury transactions and every intended buff integration point.

## Follow-up implementation: recipe-book preview

The Cooking Career page now displays a browsable 12-recipe legal starter catalogue with regional ingredient lists, food families, portions, base shelf life and **proposed** temporary effects. Category filters are client-only; the catalogue does not authorize cooking, grant recipe ownership, consume ingredients or confer buffs. A separate unit test checks unique recipe IDs and bounded yields/expiry.

The practice reducer also enforces a two-group pan capacity, requires tray-to-pan before plating and rejects invalid movement. Additional tests cover these cases. Live database work remains blocked on auditing profile ownership, food and treasury schema, and reward idempotency; no migrations were applied.

## Perishable food domain slice (21 October 2026)

Added pure TypeScript `foodBatchRules.ts` and focused tests. A future server transaction can use the same invariants, but only the database may authorize supply and rewards. Finished batch expiry is capped by **both** the recipe's configured shelf life and the earliest consumed ingredient lot expiry; expired ingredient lots invalidate production. Expiry is inclusive (food becomes unusable at the exact timestamp). Portion use requires fresh stock and a positive integer amount no larger than the remaining portions. Sorting for inventory presentation does not alter batch ownership, identity or expiry.

This does not create inventory tables, RLS, RPCs, background spoilage processing or live consumable foods. Do not use browser-evaluated eligibility as an authorization check. Before production, add transactional lot reservation, audited batch output, idempotent consumption and concurrent purchase coverage at the database layer.

## Live database inventory foundation — 21 October 2026

Applied a migration to Supabase project `rockmundo`, and committed an idempotent counterpart to `supabase/migrations/20261021233500_cooking_inventory_foundation.sql`.

- `cooking_ingredient_lots` stores owner profile, ingredient identity, source city, quantity, quality, acquisition and fixed expiry timestamps.
- `cooking_food_batches` stores owner profile, recipe, source city, remaining portions, quality, preparation and expiry, with a unique future crafting session reference.
- Both tables are RLS-enabled. Only the owning signed-in profile may select rows; `authenticated` has **no** direct insert, update or delete privileges. These tables are initially empty and do not create food or XP.
- The migration succeeded on the live database. A verification query confirmed both SELECT policies and no authenticated write privileges.

**Integration gate:** no cooking rewards, purchasing, food consumption, recipe unlocks, trading or mayor spending until explicit atomic, idempotent, server-authorized transactions are added and tested. A future session/ledger must validate original ingredient expiry and compute new batch expiry on the server, not trust the browser. Do not mistake these storage tables for a complete economy.

## Server-owned cooking recipe definitions — 21 October 2026

Applied and committed `20261021235000_cooking_recipe_catalogue.sql`. The live database now contains 12 inactive starter recipes and 39 ingredient requirements with server-controlled quantities, method, yield and shelf life. Recipe tables have RLS, owner-independent read policies for active recipes, and no direct authenticated writes. Verification returned 12 recipes, 39 requirements, zero active and authenticated INSERT denied. Recipes remain deliberately inactive pending atomic crafting and ingredient supply.

## Atomic server-only completion — 21 October 2026

Deployed `complete_cooking_batch(profile_id, recipe_slug, session_id)` on the live database. It is deliberately callable only by `service_role` (not `anon` or `authenticated`). It locks a profile before checking the idempotency key; selects the active recipe and its server-controlled requirements; locks available fresh ingredient lots in expiry order; deducts quantities; calculates weighted ingredient quality and an expiry capped to the earliest consumed ingredient; and inserts a unique finished batch in one transaction. Missing ingredients cause a full transaction rollback. Reusing the same session key returns the prior batch and refuses a different owner/recipe.

Live verification: authenticated EXECUTE denied, anonymous EXECUTE denied, service_role EXECUTE allowed, zero enabled recipes and zero finished food batches. **No player-facing cooking endpoint is enabled**: authenticated manual sessions, server timestamped game actions, server-certified execution grade, inventory purchasing and rewards are not implemented. Before activating recipes, an audited trusted backend must validate a real session and call this function. Do not pass arbitrary client-generated session IDs directly through a privileged backend.

## Persistent cooking session tables — 21 October 2026

Applied `20261022000500_cooking_sessions_foundation.sql` to live Supabase. `cooking_sessions` stores owner, recipe, mode, lifecycle timestamps, optional execution score and linked result. `cooking_session_actions` stores ordered, timestamped pan actions, with per-session unique sequence. A partial unique index permits only one pending/running session per profile. Tables are owner-readable under RLS; ordinary authenticated and anonymous clients have no write privileges. Verified RLS enabled, one read policy per table, authenticated SELECT enabled and INSERT/UPDATE denied.

This is a storage and audit foundation, **not** a completed server session processor. The backend must validate each action, enforce monotonic server timestamps/sequence and expiry, reserve lots transactionally and transition each session to a final state exactly once. Recipes remain inactive; no production crafting, offline completion or buff rewards are available.

## Backend cooking session expiry — 22 October 2026

The live database now contains `expire_cooking_sessions(limit)`, a service-role-only idempotent cleanup function. It locks and marks overdue pending/running cooking sessions `timed_out` without minting food or awarding rewards. A capped batch size and `SKIP LOCKED` permit concurrent cleanup workers. Access verification confirmed authenticated/anonymous execution denied and service-role execution allowed. No expired active sessions existed at inspection time.

**Not yet scheduled:** no cron job has been installed in this slice. A trusted worker must invoke the sweep on a cadence. Server-authoritative session creation and action timing/replay are still required before recipes can be activated.

## Server-validated manual cooking actions — 22 October 2026

Applied `20261022010000_record_cooking_action.sql` to live Supabase. The `record_cooking_action(session_id, action_type, ingredient_slug, heat)` function is service-role-only. It locks each session, rejects expired/inactive/non-manual attempts, validates action shapes, confirms required recipe ingredients, prevents removal before addition, prevents duplicate consecutive additions, caps the pan at two ingredient groups, appends a unique ordered action sequence with a **server timestamp**, and updates the running session in a single transaction.

Verified that anonymous and authenticated clients cannot invoke this function; only the service role can. There were no actual session/action records to exercise a complete run. The function does not calculate doneness, validate player identity itself, create an ingredient reservation, finalize a batch or issue rewards. A trusted API must authenticate the player, verify their active profile and session ownership, enforce accepted action replays, and call this function only after that authorization. No recipes are enabled yet.

## Transactional ingredient reservations and guarded completion — 22 October 2026

Live migrations `20261022070000_cooking_ingredient_reservations.sql` and `20261022071000_guard_cooking_completion.sql` are deployed. `begin_cooking_session(profile_id, recipe_slug, session_id)` is service-role-only: it serializes starts on the profile, rejects other active sessions, expires stale sessions, checks the **server-owned active recipe**, deducts fresh ingredient stock in FIFO expiry order, and persists immutable per-session reservations inside a single transaction. Retrying the same key returns the same session and does not deduct ingredients again. Aborted or timed-out manual sessions do not refund ingredients, in line with the disclosed plan. Each 120-second attempt is initially manual only.

`complete_cooking_batch` is now fail-closed: it checks the session's owner/recipe, status, freshness, non-null authoritative execution score, terminal validated finish event and fully plated recipe components. It validates the exact reserved input amounts and uses those snapshots instead of deducting inventory for a second time. It writes a unique batch and finalizes its session together; repeated calls return the same batch. Ingredient quality and score currently use a conservative provisional blend and must be balanced with the wider skill/equipment system before recipes are enabled.

**Verification:** Live privileges confirmed authenticated clients cannot execute either function or insert reservations; service role can execute; RLS is enabled for the reservation table. A rollback-only SQL smoke test successfully exercised first reservation, idempotent retry, a second-session rejection and fail-closed completion, leaving zero test recipe/ingredient rows. Supabase security advisers reported no new cooking-specific findings.

**Still blocked:** the trusted HTTP/Edge Function that validates logged-in active character ownership is absent. Manual action replay/quality scoring and a validated terminal finish event are absent. Recipes are intentionally inactive, so the player UI must not expose production cooking or grant food yet. Add trusted backend and end-to-end tests before enabling real crafting.

## Server-authoritative manual pan replay and authenticated gateway — 22 October 2026

Deployed `20261022084500_cooking_manual_replay.sql`, `20261022085500_cap_cooking_actions.sql`, and `20261022090500_cooking_window_read_policy.sql` to live Supabase. A fixed timing catalogue covers 26 currently seeded ingredient identifiers. The manual scorer reconstructs heat exposure from **server-recorded action timestamps** and each ingredient's pan/plate transitions; raw, missing or burnt essential components fail. It validates ordered action sequences, two-group pan capacity, server session lifetime and configurable ready/overdone/burnt windows. Only pan-method recipes are supported by this live scorer; oven, simmer and drink workflows remain unimplemented.

`finalize_manual_cooking(session_id)` locks the profile and session, scores from the stored server actions, appends exactly one finish event, marks failed/expired sessions appropriately and invokes the idempotent reserved-batch completion only for a valid edible result. A rollback-only SQL integration test exercised a perfect 100-point batch, repeat finalization returning the same batch and burnt food producing no batch. Fixture records were removed automatically; production recipes remain inactive.

Deployed JWT-verified Supabase Edge Function `cooking-session`, with request actions `start`, `status`, `heat`, `add`, `remove` and `finish`. It authenticates the user, resolves their active living character and validates session ownership **before** using server-side privileged RPCs. The browser never receives the service key. The gateway and SQL function limits reject malformed or excessive action requests; the action log remains read-only to players.

**Verification:** Function deployment is active with `verify_jwt=true`. Anonymous/authenticated roles cannot execute replay or finalization; service-role access is allowed. The recipe catalogue has zero enabled recipes and zero production batches, and the Supabase security advisers currently flag no cooking-specific findings. The timing-table read policy exposes only active-recipe guidance without allowing writes.

**Not yet complete:** No real authenticated browser-to-Edge integration test or UI wiring has been performed. Players cannot yet purchase ingredients, enable recipes, receive cooking rewards/XP, consume cooked food or trade items. Manual timing tests used controlled timestamps in rollback-only SQL fixtures, not physical real-time cooking or concurrent real-user sessions. Connect and validate the frontend against the authenticated gateway, then implement a safe ingredient supply economy and method-specific recipe interaction before activation.

## Client cooking gateway integration — 22 October 2026

The Cooking Career route now renders `CookingLiveKitchen` above the free practice experience. It queries activated `pan` recipes and each player's currently active session. **All recipes remain inactive**, so no player can start real crafting during this rollout. If recipes are activated later, the UI selects one, sends a UUID-keyed `start` request through the already JWT-verified `cooking-session` Edge Function and restores active sessions by character after page reloads.

The pan interface implements draggable ingredient tiles plus selected-item pan/plate controls for touch/keyboard use, current heat controls, server action confirmation, live countdown, refresh/recovery and explicit finish. Each action waits for a server response before the accepted event log is used to project visuals. The read-only `liveCookingView.ts` animation and tests reconstruct temperature exposure and Raw/Ready/Overdone/Burnt stages from server action timestamps. This is visual guidance only: no local calculations mint food, buffs or XP. The gateway was updated to include `finished_at` so successful outcomes stop visually cooking. Edge version 2 deployed with JWT enforcement.

Deployed `20261022094500_prevent_plated_reentry.sql`: once an ingredient has been plated, it cannot be returned to the pan. A rollback-only SQL test confirmed the invalid action was rejected and no fixtures remained. The UI likewise prohibits that transition.

**Verification outstanding:** the frontend branch requires TypeScript, unit-test, browser drag-drop and authenticated Edge integration CI. No enabled production recipe, market ingredient purchase, food consumption or buffs exist. Manual production should not be activated before these tests and a trusted actor audit of the Edge gateway.

## Regional ingredient markets and atomic purchases — 22 October 2026

Deployed `20261022113000_cooking_city_markets.sql`, `20261022114500_purchase_cooking_market_ingredient.sql`, and `20261022120000_cooking_city_specialities.sql` to live Supabase. The new ingredient catalogue covers all 26 server-recipe ingredients; city market stock is seeded differently by local country specialities and deterministic city-level variations. Verified **2,526 offers across all 180 cities**, including 550 local-speciality offers. Prices, source cities, quality and stock are database-owned and immutable to direct clients. All market offers are **closed by default**, so no player has spent game currency on the unreleased cooking economy.

`purchase_cooking_market_ingredient(profile_id, offer_id, quantity, request_id)` is an authenticated, carefully restricted `SECURITY DEFINER` RPC that checks an active living character owned by the JWT user, verifies the character's **current** city, server-owned offer price/quality and stock, and locks their cash and offer stock in one transaction. It decrements stock and cash, creates one expiring ingredient lot, and saves a purchase receipt. It tags the existing profile-cash double-entry journal with an idempotency key; replays return the original receipt without additional stock or cash changes. The RPC permits 1–20 units per request, while anonymous access and client INSERT/UPDATE on stock, lots and receipts are denied.

The rollback-only live SQL purchase test covered closed offers, exact cash and stock deductions, idempotent duplicate calls, conflicting request reuse and out-of-city rejection. It left **zero purchases and zero open market offers**. Existing finance journaling was exercised inside the rolled-back transaction. Security advisor flags the authenticated `SECURITY DEFINER` RPC as privileged; this is intentional and subject to continued security review before opening offers. Other cooking tables are RLS-protected.

A new `CookingCityMarket` panel in Career → Cooking shows the character's current city, local products, quantities, quality, unit prices, specialities and spoilage times, plus a disabled purchase button while offers are closed. Once an offer is authorised for sale, purchases use a stable request ID through the authenticated RPC and refresh profile cash and inventory.

**Still gated:** market availability activation, first pan recipe activation, real authenticated browser purchase/cook E2E, sustainable restocking, mayor-controlled market upgrades, player trading, food consumption and timed buffs. Do not turn on payment buttons until these are verified. No production cash or ingredient purchases were recorded in this slice.

## Mayor market improvements and daily replenishment — 22 October 2026

**Live migrations:** `20261022121500_cooking_mayor_market_upgrades.sql`, `20261022122500_cooking_market_restock.sql`, `20261022123500_private_mayor_market_upgrade.sql` and `20261022124500_private_cooking_market_purchase.sql` are deployed in Rockmundo Supabase.

Every city has a `cooking_city_market_levels` record (180 cities, initially level 1). Once market offers are activated in a city, its current elected mayor can invest **the city treasury** in the market. Each upgrade is validated against the authenticated active character and current mayoral term, serialized with a city row lock, capped at level 5, and restricted to one upgrade every seven days. Server-priced tier costs are $20,000, $40,000, $80,000 and $160,000. The transaction adjusts stock capacity and produce quality, adds two otherwise unavailable varieties, and records an immutable investment, treasury ledger debit and mayor action log. Retries use a UUID request key to avoid duplicate charges. The Cooking City Market UI now displays levels, upgrade costs, available treasury budget, cooldown and mayor-only upgrade controls. No upgrades can charge a city whose market has not yet opened.

`restock_cooking_city_markets` is restricted to the backend and replenishes only **active** market offers with depleted stock, in bounded batches, without opening closed offers or minting character inventory. The database cron `rockmundo_cooking_market_daily_restock` runs at **04:15 UTC**. With all offers closed, a direct restock verification returned zero replenishments.

**Privileges and security:** The public purchase and mayor-upgrade RPCs are now `SECURITY INVOKER` wrappers into a private `cooking_internal` schema. Their privileged implementations retain existing server-side ownership, mayoral-term, location, funds, stock and idempotency checks. The Supabase security adviser reported no cooking-specific findings following the refactor. Frontend clients have no direct permission to update market levels, treasury, purchases or stock.

**Verified:** The rollback-only mayor SQL test passed for a level-one-to-two upgrade, exact single $20,000 treasury deduction, same-key retry, seven-day cooldown, two new varieties, treasury ledger and stock restock, with **zero fixture changes retained**. It was repeated successfully after moving the mayor function to the private schema. All 180 markets remained at level 1, with zero investments and zero activated offers. The market purchase function was moved without changing its business logic, but its separate authenticated purchase smoke test **was not rerun** after the schema refactor because the execution environment blocked that test. The stored SQL test remains available for controlled CI. Frontend compilation, unit tests and CI are not yet independently verified for this branch.

**Remaining before launch:** Market activation and first pan-recipe launch decisions, trusted authenticated purchase/cook end-to-end certification, rolling stock observability and food consumption/buff balance. Do not open markets merely because daily restock is scheduled.

## Prepared food consumption and timed-effect storage — 22 October 2026

Deployed `20261022131000_cooking_food_consumption.sql` and `20261022132000_cooking_consumption_receipt_integrity.sql` to live Supabase. All **12 starter recipes** now have server-owned benefit definitions (recovery, practice XP, rehearsal effectiveness, songwriting polish or focus; 2–3 hours; maximum +5%). A player's finished food batch is consumed **one portion at a time** using `consume_cooking_food_atomic(profile_id,batch_id,request_id)`. The trusted implementation is in non-exposed `cooking_internal`, with an authenticated invoker RPC in public. Each request validates the logged-in, active, living owner, locks the character and food batch, rejects expired/empty/invalid batches, decrements one portion, and saves an immutable receipt atomically. Retrying an uncertain response with the same request UUID returns the original receipt and never consumes a second portion. A request collision for another batch/profile fails.

The benefit value is **derived from recorded batch quality and the server-owned recipe**, never from browser arguments. Quality below 40 produces no timed benefit; otherwise the boost scales up to the recipe's 5% maximum. `cooking_active_food_effects` stores one effect slot per character and type with a bounded start/end time. Eating while the same type is already active still consumes the meal but **does not extend or stack** the effect. `get_active_cooking_food_percent` returns the current unexpired percentage via RLS for eventual settlement integration. No gameplay XP/recovery calculation yet consumes this value; the saved timer is not by itself a reward.

The Cooking inventory UI now has `Eat 1 portion` controls on unexpired prepared food, a response-safe retry key, remaining-portion feedback and read-only active effect windows. Buttons are disabled for spoiled or empty food. Inventory and benefit queries refresh after a confirmed action. The UI explicitly warns that XP/recovery settlement wiring is still outstanding rather than falsely promising active bonuses.

**Live verification:** Security adviser reports zero cooking-specific findings. Unauthenticated purchase/consumption is denied; authenticated players cannot insert consumption receipts or update effects directly. Twelve definitions, zero actual consumption receipts/active effects, zero produced food batches, zero enabled recipes or market offers as inspected. A rollback-only positive-path SQL integration harness is committed at `supabase/tests/cooking_food_consumption_smoke.sql` but **has not been executed against a disposable authenticated test instance yet**. The code is not production-certified or populated with player food until a safe browser and test-database end-to-end run is complete.

**Next:** Verify the consumption harness and browser handling in CI. Integrate the effect lookup into real XP, rest, rehearsal and songwriting settlement paths (server-authoritative, bounded, tested) before describing timed buffs as active gameplay. Activate markets/recipes only after fully authenticated purchase → cook → eat certification.

## Timed-food practice XP settlement — 22 October 2026

Deployed `20261022141000_cooking_food_practice_xp_settlement.sql` directly to live Supabase. The existing **service-role-only** `complete_skill_practice(activity_id)` reward path now checks immutable `cooking_food_consumptions` receipts for a legitimate, non-stacking `practice_xp` benefit that covered **the whole scheduled practice hour**. Checking the original receipt, rather than currently active timers, makes delayed cron processing deterministic; eating during or after the practice hour cannot retroactively increase that session's reward. The entire existing unlock/level cap, scheduled-activity status and idempotent reward ledger logic is otherwise retained.

Fractional bonuses are accumulated in `cooking_practice_xp_carry` by character. Because base practice rewards are only 5 XP, an eligible +5% bonus is 0.25 XP; exactly four such practices now accumulate +1 extra whole XP instead of yielding nothing due to rounding. The carry is serialized transactionally with the ledger and skill update, and the reward ledger records `food_bonus_percent`, `food_bonus_xp` and the total actual XP. Replaying the same completed activity returns its **recorded actual award** without applying the food effect or carry twice.

**Live verification:** Migration applied. An isolated read-only SQL smoke test passed the four-practice rounding invariant, whole-slot eligibility and role-access checks; verified the installed reward function now reads immutable food receipts, uses fractional carry and awards `v_total_reward`. Authenticated clients cannot call `complete_skill_practice` directly or update XP carry; service role can. Supabase security adviser reported no new cooking-specific findings. No player carry or bonus reward rows existed at inspection. A deeper rollback-only seeded integration fixture is in `supabase/tests/cooking_practice_xp_settlement_integration.sql`, but it has not been executed on a disposable authenticated test database.

**Scope limit:** This activates the *practice XP settlement calculation* only when an authentic consumed meal receipt covers the practice. Food markets and recipes are still disabled, so ordinary players cannot acquire these food bonuses yet. Rehearsal, songwriting, recovery and focus settlement paths do not yet consume the food-effect catalogue. Full purchase → cook → eat → practice end-to-end, migration regression, and browser tests must pass before production recipe activation.

## Rehearsal food bonus integration — 22 October 2026

Deployed `20261022144500_cooking_rehearsal_familiarity_bonus.sql` to live Supabase. The existing authenticated `submit_active_rehearsal_session` reward function now checks the character's trusted `cooking_active_food_effects` row for an unexpired, non-stacking `rehearsal` benefit. It caps the effect at +5% of **earned familiarity minutes**, after the existing 10-session daily cap and diminishing-return calculation. Food bonuses do **not** affect band cohesion, bypass the daily cap, change player-submitted beat grade validation or override the 360-minute max familiarity for the active-rehearsal pathway.

Because most small rehearsal sessions earn fewer than 20 minutes, percentage bonuses would otherwise round to zero. A `cooking_rehearsal_minute_carry` table now tracks hundredths of a minute per character, locked and updated in the same transaction as the existing rehearsal reward. For example, five valid 8-minute sessions at +5% accumulate exactly two extra familiarity minutes. The `active_rehearsal_sessions` receipt stores `food_bonus_percent` and `food_bonus_minutes` to explain the reward. The UI toast displays the actual extra minutes or that fractional progress was saved, and kitchen inventory explains that only practice XP and active rehearsal familiarity have gameplay settlement integration so far.

**Verification:** Migration deployed, no direct authenticated inserts/updates to the carry table, and the live installed function references server-owned food-effect records and fractional carry. `supabase/tests/cooking_rehearsal_food_bonus_smoke.sql` is a read-only arithmetic/permission test executed successfully on live Supabase. No active rehearsal food effects or actual food bonus sessions were present. The Supabase security advisor reported no new cooking-specific issues during initial verification. Actual authenticated rehearsal mini-game end-to-end and synthetic seeded transition tests have not been executed; no player records were modified during this development pass.

**Scope caveat:** The active rehearsal mini-game still accepts player-submitted hit grades and computes its server score from those counts; independent anti-cheat validation of the real-time rhythm actions is a separate requirement before considering the entire mini-game tamper-proof. Scheduled **band rehearsals** and other familiarisation paths are not modified by this slice. Recovery, songwriting polish and focus timed effects remain stored but are not yet connected to those game systems. Market offers and recipes remain intentionally inactive.

## Timed food bonuses for final songwriting polish — 22 October 2026

Deployed `20261022163000_cooking_songwriting_polish_bonus.sql` directly to Rockmundo's live Supabase. The migration preflights the exact existing `private.rockmundo_resolve_songwriting_polish` function checksum and preserves its deterministic success roll, project locking, single-use session, quality cap (1,000), historical duplicate response, cron processor and scheduled activity completion behaviour. Only when the normal polish succeeds can an immutable **songwriting_polish** meal receipt that covers the whole **scheduled** polish hour increase the gained quality by up to 5% (maximum ten points); the quality cap still applies. The session audit now records `food_bonus_percent` and **actual** `food_bonus_quality`, and the project `completion_quality_breakdown` and RPC response include the same numbers. The songwriting project card displays an earned bonus only after resolution.

The new server-only function `cooking_internal.food_effect_percent_for_window(profile_id,effect_slug,start,end)` supports approved cooking-effect types and reads only immutable, effect-applied food consumption receipts spanning the entire scheduled interval. This fixes asynchronous completion discrepancies and is reusable by a future authoritative recovery settlement job. It is not executable by anonymous or authenticated clients. **This helper does not itself award any recovery benefits.**

**Verification:** Migration deployed successfully. Rollback-only fixture test `supabase/tests/cooking_songwriting_polish_effect_smoke.sql` passed: +5% valid polish window, +4% valid recovery eligibility, retroactive food rejection, expired effect rejection, invalid effect rejection and 1,000 maximum quality. Fixture rolled back with zero live food consumption records. Verified backend-only helper privilege and installed resolver references `food_bonus_quality`. No existing player song/project records were changed during the fixture. A true completed/songwriting-polish end-to-end playthrough on a disposable test character is still outstanding, as are browser CI checks.

**Remaining:** Recovery and focus are presently *stored food effect windows only*; much existing recovery handling is a UI forecast, not a trusted server-award path. Do not display them as applied until such a path is verified and tested. Market offers and recipes remain intentionally inactive.

## Rollback-only full cooking purchase → eat certification — 22 October 2026

PR adds `supabase/tests/cooking_purchase_to_eat_full_chain_rollback.sql` and the explicit [Cooking release gate](COOKING_RELEASE_GATE.md). The integrated test was executed successfully against the live schema using a **synthetic database-local authenticated identity**, with recipe and city-offer activation isolated to a nested subtransaction that always rolls back. The result exposed `full_chain_passed=passed` and verified persistent totals of **zero** purchases, food batches, consumption receipts, active market offers and active recipes.

It exercised three player-wallet purchases, purchase retries, cross-player purchase denial, exact ingredient reservation, the accepted pan action sequence, deterministic server replay scoring at **100/100**, one finished two-portion batch, duplicate finalization, cross-player food-consumption denial, one-portion eating, persistent rehearsal effect calculation and consumption retry idempotency. It includes no changes to the production gameplay functions or release flags.

**Not a public release signoff:** Edited cooking timestamps and synthetic auth claims do not exercise a real signed JWT, Edge gateway, physical elapsed time, browser drag/drop, network retries or player workflow. Gate B requires those staging/browser tests before any production market offer or recipe activation. The database continues to have **zero** enabled offers and recipes.

## Live kitchen identity and reconnect hardening — 22 October 2026

Deployed **Cooking Edge Function v3** with JWT verification enabled. Status responses now include a server-clock anchor, and requests that include an explicit character ID are checked against the **server-resolved active, living and non-deleted profile**, rejecting mismatches before any privileged cooking RPC. The optional claim remains backward-compatible with previously installed clients during the rollout. The client selection service also excludes soft-deleted active characters.

The live kitchen React component now keys its state by the active profile, automatically discarding the prior character's session ID, event projection, selected ingredient and in-flight start idempotency key when the player switches characters. The new client includes `profileId` on all signed cooking gateway requests. It projects pan readiness and time-left from `serverNow` rather than relying on an accurately set device clock; it still does **not** mint client-side food or XP. Food artwork now includes colour-changing rice and soy seasoning (alongside mushrooms), so every ingredient in the initial mushroom rice bowl has visible cooking stages.

Added targeted unit/component tests for signed request character IDs, switching between two active characters, skewed device clocks, and visual colour shifts for the first live recipe ingredients. The free practice kitchen and its separate Playwright fixture remain unchanged.

**Release limit:** This hardening is live only for the compatible Edge gateway; the frontend changes require merging this PR. Unit tests and typecheck should be confirmed by CI. There remains no true authenticated browser → Edge network end-to-end test using a staging user, and all production recipes and market offers remain inactive. See [COOKING_RELEASE_GATE.md](COOKING_RELEASE_GATE.md) for certification requirements.

## Next slices

1. Validate the practice interaction and timing on desktop, touch and keyboard; refine ingredient visuals and recipe steps from playtesting.
2. Complete the live schema/integration audit; implement server-authoritative action timestamps, resume, timeout and exactly-once completion. Reuse the tested timing rules, but never trust client-supplied quality.
3. Add ingredient lots, recipes and food batch storage with atomic consumption/production, fixed expiry and character ownership checks; verify rollback/concurrency and live schema effects.
4. Connect real cooking, inventory consumption and bounded buffs; complete the 12-recipe legal cooking slice.
5. Add regional markets, player trading and mayor upgrades; introduce restricted goods after the legal economy is stable.

## Verification of this slice

- `npm run test:cooking`: timing, full plating journey, burning, keyboard controls, background catch-up, session timeout and Career navigation coverage.
- `npm run test:cooking:e2e`: real Chromium drag-and-drop, raw-to-ready colour changes, burning, plating, and narrow touch layout with no horizontal overflow. The fixture mounts the production practice component without an account and is excluded from production build entry points.
- `npm run build`: production build passes.
- Targeted ESLint passes for the cooking implementation and changed navigation/page files.
- Broader repository checks have unrelated blockers: the navigation-polish test expects `/world` while the current base route is `/world-map`; the full typecheck reports a canvas-context mock type error in `src/features/shareable-moments/profilePhotoCapture.test.ts`. These files/behaviors were not changed by this slice.
