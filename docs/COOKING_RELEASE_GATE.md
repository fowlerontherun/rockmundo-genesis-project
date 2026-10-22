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
