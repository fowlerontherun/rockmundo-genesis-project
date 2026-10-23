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

## Continued implementation — 23 October 2026

**Migration and repository alignment:** The original #4549 was merged to the already-merged feature branch behind #4548. The resulting live database changes were not represented by files on main. This replacement main-based branch restores #4549's three deployed migration files, rollback smoke test and release-gate document so future builds and migrations do not drift from deployed production.

**Automatic abandoned-stall expiry:** Deployed `20261023080000_cooking_food_stall_expiry_sweep.sql` with a service-role-only `expire_cooking_food_stall_listings(100)` function and verified an **active every-minute cron job**. The sweep locks seller profile → listing → source batch, rechecks database-clock expiry, returns unsold portions if the food remains fresh, otherwise counts them as spoiled, marks the listing terminal and records immutable `cooking_food_stall_expiry_events`. Retries cannot revive portions. Authenticated/anonymous users have no EXECUTE privilege. A controlled rollback-only SQL test exercised one fresh-listing expiration, one spoiled-batch expiration and a repeated no-op sweep. Final production counts were zero listings/sales/expiry events; release remained OFF.

**Local browsing and same-account protection:** Deployed `20261023082000_cooking_food_stall_local_browse_and_alt_protection.sql`. Its authenticated public invoker wrapper delegates to privileged `cooking_internal.browse_cooking_food_stalls`, which resolves the signed-in active character's actual city, caps results to 50, excludes expired/illegal offers, shows only server-authorised seller names and hides same-account offers. Reimplemented the existing purchase function so a second character owned by the same user cannot buy their own listing. The browsing RPC returns an explicitly disabled empty response while trading is OFF. A rollback-only SQL test exercised disabled browsing, city-scoped visibility, owner exclusion, expired-listing filtering and cross-account ownership rejection.

**Player-facing presentation:** New `CookingPlayerStalls` panel on Cooking Career uses the existing illustrated dish catalogue for regional marketplace cards, permits server-confirmed listing/reservation, purchase and cancellation when enabled, and always allows an owner to cancel an old open listing if sales are paused. It shows expiry/quality, remaining portions, unit prices, seller names and server-confirmed totals. Browser retries retain request UUIDs for the current tab across reloads; the database remains the authority for charges, stock and receipts. A query failure never unlocks purchase controls. **No signed-in browser testing has been run.**

### Outstanding gates

Run TypeScript, lint and cooking UI tests in CI. Connect an isolated staging database and disposable two-user test accounts. Certify list, same-city browse, buy, concurrent consumers, expiry, disconnect and cancellation through real signed-in app sessions. Verify the annualized game economy/treasury journal and city restriction policy in staging. No production food stall listing creation, live recipe unlocking or market activation is authorised by rollback-only SQL testing.

## Opt-in three-account concurrent trading certification — 23 October 2026

Added `tests/cooking-staging/food-stall-race.spec.ts` to the existing isolated Playwright staging suite and an additional **off-by-default** `certify_player_stalls` input to the manual **Cooking Staging Release Certification** GitHub Actions workflow. This is a harness, not an assertion that a real staging backend currently exists or that the test has passed.

The protected `cooking-staging` environment must supply **six additional secrets**: `COOKING_STAGING_STALL_SELLER_EMAIL`, `COOKING_STAGING_STALL_SELLER_PASSWORD`, `COOKING_STAGING_STALL_BUYER_A_EMAIL`, `COOKING_STAGING_STALL_BUYER_A_PASSWORD`, `COOKING_STAGING_STALL_BUYER_B_EMAIL`, and `COOKING_STAGING_STALL_BUYER_B_PASSWORD`. Keep the existing staging app/Supabase URLs, staging cooking credentials and explicit acknowledgement. Do not store passwords or access tokens in code, PRs or artifact names.

Set up a *separate* nonproduction Supabase project and frontend with the food-trading release flag on **only in staging**. Create three **different Supabase user accounts**, each with a living current active character in the **same** city. The seller needs at least one fresh, eligible legal recipe batch with unused portions that is not already listed; each buyer needs at least $150 cash and an otherwise quiet staging account (no concurrent salary or reward processing). Seed whatever standard cooking ingredients and recipes are required by the existing first certification test independently. Leave these secrets and staging write flag absent from normal CI and production.

When `certify_player_stalls` is selected, the test logs in each account through the staging frontend and captures its **real JWT** from its own authenticated browse request. It rejects any browser Supabase requests to unexpected/production projects, confirms all three users are distinct and city-matched, has the seller reserve **exactly one** portion for $150 via the player-facing UI, verifies both buyers can see it locally, then submits two actual checkout requests simultaneously from **separate browser contexts**. Exactly one checkout must succeed. It then retries the winner's original idempotency key and verifies the **single** immutable sale receipt, transferred buyer-only cash, seller proceeds, final sold listing and zero second buyer debit. The test uses dedicated disposable staging accounts and does **not** run as part of everyday cooking CI.

The special Playwright config already blocks `rockmundo.uk` and production Supabase reference `yztogmdixmchsmimtent`. Staging-only credentials are protected by the GitHub environment. The test must be run and reviewed before considering production player trading; a rollback-only SQL fixture is not sufficient to certify real multi-connection races.

**Current gate: NOT EXECUTED.** No separate staging app, Supabase project or disposable three-account credentials were available in the connected environment for this task. Keep `cooking_food_stall_controls.sales_enabled=false` on production.
