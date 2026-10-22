# Cooking production release gate

## Purpose

The first manual pan recipe, **Mushroom rice bowl**, must not be enabled just because the underlying SQL functions execute. This gate separates repeatable database integration from a true signed-in browser playthrough. Activation of market offers and cooking recipes is a separate, controlled release action.

## Gate A — Transactional database integration (verified 22 October 2026)

Run `supabase/tests/cooking_purchase_to_eat_full_chain_rollback.sql` in a **controlled, privileged test context** after applying migrations. It uses one seeded, active living character, temporarily enables the existing `rice-bowl` recipe and a set of that character's city offers, simulates the character's JWT claims, then deliberately rolls back the entire fixture. Its final SELECT must show `full_chain_passed = passed` and all persistent counters as **0**:

- Three ingredient purchases: stock, character cash, perishable lots and immutable purchase receipts are consistent
- Repeating a purchase request ID does not deduct cash or stock again
- Changing JWT identity cannot purchase ingredients for someone else's character
- Starting the manual cooking session reserves the three required ingredient lots exactly once
- The server accepts the heat, add, remove and plate sequence with two-group pan capacity
- Replayed server timestamps deliver a 100/100 eligible pan result, two meal portions and exactly one finished batch
- Repeating finalization returns the same batch rather than producing another
- Another user's JWT identity cannot consume the created batch
- Eating consumes exactly one portion, records its fixed-duration, non-stacking `rehearsal` effect and does not change wallet cash
- Repeating the consumption ID returns the receipt without consuming a second portion
- Rollback leaves all live offers disabled, recipes disabled, no new purchases, food, effects or receipts

This **uses synthetic database-local JWT claims** and edited timestamps to test a complete transaction synchronously. It does not prove real signed Supabase JWT validation, Edge Function network behaviour, browser drag/drop or real-time cooking accuracy.

## Gate B — Signed-in staging/browser test (NOT YET VERIFIED)

Use a dedicated staging project, a disposable authenticated user/character, and a populated staging city market. Confirm the real network calls:

1. Open Career → Cooking. Verify the city matches the character's travel location, and inactive offers cannot be purchased.
2. Activate only the staged offers for `mushrooms`, `rice`, and `soy-seasoning`, plus the `rice-bowl` recipe. Check inventory cost, expiry and stock levels.
3. Purchase one of each item; retry a timed-out purchase with the same UUID. Verify only one debit and one ingredient lot.
4. Start a manual cooking session; check that ingredients reserve atomically and that another concurrent start is rejected.
5. Drag two items into the pan, adjust heat, remove when ready, then add the third item. Use keyboard/touch alternatives and verify live colour/texture stages.
6. Reload the page halfway through. Verify the pan, timer, heat and accepted actions reconstruct from the server rather than reset.
7. Finish the dish once, then retry completion. Verify one batch and correct portion count; verify burnt or expired sessions cannot mint food.
8. Eat one portion; retry with the same idempotency UUID; confirm portion count, effect window and no stacking or retroactive benefits.
9. Try buying from the wrong city, using another character's session ID and consuming another player's batch. Confirm authorization denies all three.
10. Confirm booked practice/Active Rehearsal/final songwriting polish use only server-qualified, unexpired or historically valid food receipts, and that all rewards are capped.
11. Run TypeScript, unit tests, targeted lint and the repository's CI gate. Distinguish known global lint baseline failures from new regressions.
12. After the test, disable staging recipe/market offers and remove disposable data.

## Gate C — Controlled launch (BLOCKED)

**Do not activate production cooking markets or recipes until Gate B passes.** For a pilot, open explicitly chosen cities with all three `rice-bowl` ingredients in stock. Audit price and spoilage balance, including ingredient origins and realistic shelf lives. Record the enablement change as a reviewed migration/administrative change; do not blanket-enable 2,526 market offers. Monitor purchase/lot/food-batch receipts, retries, Edge Function errors, timeout cleanup and food bonus outcome ledgers. Provide a rollback procedure that prevents *new* purchases and cooking sessions without undoing legitimate purchases.

The recipe is currently offered as a *preview* only. Other recipe methods (oven baking, simmering, drinks) need their own server-scored cooking mechanics and acceptance tests. Recovery and focus effects are stored but not yet linked to authoritative gameplay settlements.


## Automated signed-in staging certification (added 22 October 2026)

A new Playwright test, `tests/cooking-staging/signed-in-journey.spec.ts`, uses the real game login and API, purchases the three mushroom rice bowl ingredients, drags an ingredient into the pan, verifies touch/keyboard-style placement, reloads and reconstructs a timed pan, plates, finishes and consumes one portion.

It is **intentionally not part of regular CI and has not yet been run**: it requires a separately deployed staging game connected to a separately seeded staging Supabase project. Set these as protected environment variables in the staging runner (do not check secrets into Git):

```bash
COOKING_STAGING_BASE_URL=https://staging.example.invalid
COOKING_STAGING_SUPABASE_URL=https://YOUR-STAGING-PROJECT.supabase.co
COOKING_STAGING_EMAIL=dedicated-staging-account@example.invalid
COOKING_STAGING_PASSWORD='<from-protected-secret-store>'
COOKING_STAGING_ALLOW_WRITES=YES_STAGING_ONLY
npm run test:cooking:staging
```

These are **placeholders**, not real credentials or a configured staging host. The test configuration refuses production `rockmundo.uk` and the live Supabase project ID, and the browser intercepts unexpected Supabase project requests before any mutating call. The staging account must have one active character in a city with active `mushrooms`, `rice` and `soy-seasoning` offers; the `rice-bowl` recipe must be enabled only in staging. The test account needs enough in-game cash, no currently running cooking session and no pre-existing state that interferes with the test. Use a disposable character and clear staging output after test completion.

**Do not run this against production**, because unlike the rollback-only database test, this is a real transaction: it purchases and consumes inventory. Browser test failures must be diagnosed and corrected before enabling any live recipes.

## Abandoned-session release blocker resolved

Migration `20261022173500_schedule_cooking_session_expiry.sql` schedules the existing backend-only, row-locking `expire_cooking_sessions(500)` once **every minute**. This releases active-session uniqueness for attempts that run beyond their 120-second deadline without producing food or refunding reserved ingredients. The cron record was confirmed active. The rollback-only `supabase/tests/cooking_timeout_scheduler_smoke.sql` passed for expired pending and running sessions, a second attempt after expiry, an idempotent sweep and no minted food; no fixture rows remained.



## Pilot emergency shutdown — depletion-safe

The previous release switch validated ingredient stock and recipe readiness on *both* enable and disable. That meant a sold-out ingredient or accidental recipe drift could block a necessary emergency pause after launch.

Migration `20261022162000_cooking_pilot_shutdown_without_stock_preflight.sql` changes the release controller so **enable retains all strict preflight checks**, while **disable always closes the Japan rice-bowl offers and recipe**, even when stock is depleted, the recipe method is changed or the city-count check would otherwise fail. It remains a trusted service-role-only operation, requires a 12–500 character reason, records each real transition and never refunds or changes purchased ingredient lots.

The rollback-only `supabase/tests/cooking_pilot_depleted_stock_emergency_stop.sql` passed against the production database in an isolated subtransaction: enabled the temporary pilot, simulated exhausted rice stock and invalidated the recipe method, verified re-enable was denied, and verified pause closed all offers without changing balances or stock. **Zero recipes, offers or audit records remained enabled/persisted** afterwards. This test does not authorise production activation.

CI now runs `npm run test:cooking` in a distinct step before TypeScript checking and global lint. A real signed-in staging E2E test is still required; the only connected Supabase project is production, so no paid browser test was run against real users.


## Character-bound cooking gateway — 22 October 2026

The JWT-verified `cooking-session` Edge Function now **requires** `profileId` for every `start`, `status`, `heat`, `add`, `remove` and `finish` request. Previously a legacy caller could omit the selected character ID, which could silently act on the server's current character even if the caller intended a different one. Now missing/malformed profile claims receive `400 character_id_required` and a UUID that does not equal the canonical server-selected active character receives `403 active_character_mismatch`. The provided UUID is never used to authorise or construct a privileged RPC: the gateway verifies the user JWT, reads the deterministic current active profile through that user's scoped client, and compares the claim before any service-role operation.

Added `supabase/functions/cooking-session/requestContract.ts` with direct regression coverage in `src/features/cooking/cookingGatewayCharacterContract.test.ts`, plus a separate GitHub CI workflow `Cooking Gateway Authentication Contract` that runs the cooking suite and TypeScript checks without requiring staging credentials. The staging Playwright journey now sends an intentionally wrong and a missing character claim using the **real captured authenticated gateway request**, expecting explicit 403 and 400 errors respectively; the JWT is not logged or committed.

The production Edge Function was deployed with its imported contract module and `verify_jwt=true`. **Deploying this API does not activate any recipe or market offers.** The real browser E2E test still requires an isolated staging environment and must not be run against production player purchases. Previous clients that do not send `profileId` will now get an explicit error rather than silently cooking on a possibly unintended character.

