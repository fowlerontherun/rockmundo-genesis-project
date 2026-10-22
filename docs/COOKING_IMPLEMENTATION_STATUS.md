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
