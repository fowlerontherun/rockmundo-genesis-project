# Cooking player food stalls — backend release gate

## What is deployed (23 October 2026)

Deployed the *inactive* server-side trading transaction migration after the closed-by-default schema from PR #4548. The database currently exposes three authenticated entrypoints:

- `create_cooking_food_stall_listing(profile, batch, portions, unit_price, expiry, listing_id)` atomically deducts available, fresh seller food into a local-city listing escrow. An identical retry returns the existing listing instead of deducting more food. Maximum 20 portions, 1–1,000,000 per portion and 48-hour listing lifetime, clamped to the original batch expiry.
- `purchase_cooking_food_stall_listing(buyer, listing, portions, request_id)` locks buyer and seller profiles in a deterministic order and the listing row before rechecking availability, current city, expiry and cash. It creates a new owned batch with **unchanged recipe, maker-origin city, quality, preparation time and expiry**. A single transaction transfers buyer cash, credits seller proceeds, deducts unsold escrow, posts the city fee and inserts a unique immutable receipt. Existing profile cash sync trigger writes the financial journal using request-correlated cash context; the established `credit_city_treasury` function handles city income and its ledger. The purchase request UUID is global and repeated successful requests return the prior receipt.
- `cancel_cooking_food_stall_listing(profile, listing)` marks a listing closed and releases unsold escrow back to its original batch **only if that batch remains fresh**. It works even when the trading feature has been switched back off. Already-sold or cancelled listings are idempotently closed.

The privileged functions live in the unexposed `cooking_internal` schema. The public RPCs are `SECURITY INVOKER` wrappers, granted to `authenticated` only. Their internal implementations validate the signed-in, non-anonymous owner against active living profile records and do not use client-provided prices, fees, freshness or ownership beyond revalidated identifiers. The existing listing and sale tables use owner RLS for reads, no direct client writes, and immutable purchase-ID constraints.

### Closed production release controls

`cooking_food_stall_controls.sales_enabled` is **false by default and currently remains false**. It has no public or authenticated table grants. Creation and purchase functions are unusable when the flag is off; an escrow gate trigger independently rejects unverified transitions to an open listing. A separate protected `cooking_food_stall_approved_recipes` whitelist contains exactly the 12 legal starter recipes. An unapproved or newly seeded restricted recipe cannot enter an open listing or complete a sale merely because it exists in the recipe catalogue. No production recipes or NPC market offers were activated, and no actual user trades were committed.

For an emergency pause, switch `sales_enabled` to false using a reviewed privileged migration, then permit existing sellers to cancel/recover unspoiled unsold escrow. Never delete sale receipts, repay completed sales or restore expired food.

## Verification

`supabase/tests/cooking_food_stall_purchase_rollback.sql` was executed against the connected production database using temporary transaction-scoped JWT claims, fixture food and two existing eligible characters in the same city. The test **rolled back all fixture operations** and confirmed:

1. Closed market refused a new listing before activation.
2. Three portions were reserved exactly once; duplicate listing key did not consume stock again.
3. Buyer purchased two portions, kept the exact original batch preparation and expiry and paid the quoted subtotal.
4. Buyer debit = 200, seller credit = 190, city fee credit = 10 at the default 5% rate.
5. Retrying the same purchase ID did not post a second sale; an attempt to oversell was rejected.
6. Cancellation returned one unsold portion to fresh inventory and repeated cancellation was idempotent.
7. Final live counts were **0 listings, 0 sales**; trading and recipes remained disabled.

A read-only privilege audit confirmed unauthenticated users cannot execute the public purchase RPC and the public wrapper is not a `SECURITY DEFINER`. No direct authenticated listing or receipt writes are granted.

## Still blocking a player-facing release

- Configure a completely isolated staging frontend, staging Supabase project, expendable user accounts and preloaded legal food, **not** the live user database.
- Run signed-in browser E2E for list → browse local city → purchase → eat, with expiry, refresh/retry and cancellation, including authorisation denial on a different profile.
- Execute true *two-connection* simultaneous buyer, seller and consumer stress tests (the rollback smoke test is synchronous and does not prove real-world concurrency).
- Add player food stall browse/list/buy/cancel controls and public local-city read policies only after security and UI review; the current RLS intentionally exposes only a player's own listings and sales.
- Add automated expiry sweeps for abandoned listings, live city-by-city legal item restrictions, and other restricted-goods safety rules before wider rollout.
- Run repository CI, TypeScript tests, RLS policy tests and Finance/DB advisors before activating any pilot.

**Do not enable `sales_enabled` or production cooking recipes until all release gates pass.**
