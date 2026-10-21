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

## Live database inventory foundation — 21 October 2026

Applied a migration to Supabase project `rockmundo`, and committed an idempotent counterpart to `supabase/migrations/20261021233500_cooking_inventory_foundation.sql`.

- `cooking_ingredient_lots` stores owner profile, ingredient identity, source city, quantity, quality, acquisition and fixed expiry timestamps.
- `cooking_food_batches` stores owner profile, recipe, source city, remaining portions, quality, preparation and expiry, with a unique future crafting session reference.
- Both tables are RLS-enabled. Only the owning signed-in profile may select rows; `authenticated` has **no** direct insert, update or delete privileges. These tables are initially empty and do not create food or XP.
- The migration succeeded on the live database. A verification query confirmed both SELECT policies and no authenticated write privileges.

**Integration gate:** no cooking rewards, purchasing, food consumption, recipe unlocks, trading or mayor spending until explicit atomic, idempotent, server-authorized transactions are added and tested. A future session/ledger must validate original ingredient expiry and compute new batch expiry on the server, not trust the browser. Do not mistake these storage tables for a complete economy.

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
