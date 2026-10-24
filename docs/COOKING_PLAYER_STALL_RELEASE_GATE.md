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

Set up a *separate* nonproduction Supabase project and frontend with the food-trading release flag on **only in staging**. Create three **different Supabase user accounts**, each with a living current active character in the **same** city. The seller needs at least one fresh, eligible legal recipe batch with **at least two unused portions in the same batch** that is not already listed; each buyer needs at least $150 cash and an otherwise quiet staging account (no concurrent salary or reward processing). Seed whatever standard cooking ingredients and recipes are required by the existing first certification test independently. Leave these secrets and staging write flag absent from normal CI and production.

When `certify_player_stalls` is selected, the test logs in each account through the staging frontend and captures its **real JWT** from its own authenticated browse request. It rejects any browser Supabase requests to unexpected/production projects, confirms all three users are distinct and city-matched, has the seller reserve **exactly one** portion for $150 via the player-facing UI, verifies both buyers can see it locally, then submits two actual checkout requests simultaneously from **separate browser contexts**. Exactly one checkout must succeed. It then retries the winner's original idempotency key and verifies the **single** immutable sale receipt, transferred buyer-only cash, seller proceeds, final sold listing and zero second buyer debit. The test uses dedicated disposable staging accounts and does **not** run as part of everyday cooking CI.

The special Playwright config already blocks `rockmundo.uk` and production Supabase reference `yztogmdixmchsmimtent`. Staging-only credentials are protected by the GitHub environment. The test must be run and reviewed before considering production player trading; a rollback-only SQL fixture is not sufficient to certify real multi-connection races.

**Current gate: NOT EXECUTED.** No separate staging app, Supabase project or disposable three-account credentials were available in the connected environment for this task. Keep `cooking_food_stall_controls.sales_enabled=false` on production.

## Player food trading receipts — 23 October 2026

Added the illustrated, **read-only** `CookingStallHistory` panel beneath the player stalls in Cooking Career. It queries existing owner-RLS-protected `cooking_food_stall_sales` rows twice (buy and sell) and seller-owned `cooking_food_stall_expiry_events` rows. Results are de-duplicated by immutable receipt ID, verified again against the currently selected profile and sorted by transaction time. Tabs filter recent buys, sales and expired listings; a summary displays seller net earnings after city fees, purchase outlay, fresh returned portions and spoiled portions. Quantities come from server receipts rather than local buyer/seller predictions. The component does not call any write RPC or alter any food, money or market availability.

Each source returns at most 30 recent rows. The UI explicitly labels totals as recent, **not lifetime**, preventing misleading historic income displays. The read-only history remains visible after trading pauses, to support seller reconciliation and eventual support cases.

Added Vitest tests for duplicate receipt de-duplication, rejecting unrelated profile rows, filtered history and selected-character query isolation. Frontend CI and real signed-in staging remain mandatory before considering trading release. No new SQL or production feature flags were changed.

## Permanent illustrated receipt provenance — 23 October 2026

After PR #4552 merged the player-facing read-only food trade history, the next slice fixes the missing dish identity in historic sale and expiry receipts.

- Applied `20261023122500_cooking_stall_receipt_food_provenance.sql` to the connected Rockmundo database. The existing `cooking_food_stall_sales` and `cooking_food_stall_expiry_events` tables now store immutable, server-derived `recipe_slug`, `quality`, and `food_expires_at` values. Migration backfills existing rows from the original listed food batch before applying NOT NULL and quality checks; authenticated roles still cannot write these records.
- A single secured BEFORE INSERT trigger derives those values from the source listing and batch, and for sales also checks the buyer's destination batch matches its original recipe, quality and expiry. Supplied client fields cannot forge the metadata. BEFORE UPDATE blocks later changes to food identity and original expiry.
- The initial trigger exposed a real bug in the expired-listing rollback test: PL/pgSQL did not short-circuit an expression that referenced sale-only fields for expiry records. Applied a separate, auditable migration `20261023123000_cooking_stall_receipt_expiry_trigger_fix.sql` using a nested table-specific IF instead. **Both purchase and expiry rollback-only SQL regression tests subsequently passed**, verifying dish provenance and zero persisted trading rows.
- Updated `CookingStallHistory` to read these receipt fields and display the **actual named dish with the corresponding illustrated SVG**, quality, and *original* food expiry for bought/sold/expired entries. No new public write endpoints or gameplay rewards are introduced.
- Added focused UI regression assertions for the correct dish names and freshness details. Full frontend CI remains a separate check and must not be assumed green from SQL tests alone.

The live release flag `cooking_food_stall_controls.sales_enabled` remains false. No actual player receipts, live trade balances, or production recipe/offer flags were changed. Signed-in disposable staging browser certification and genuine multi-connection purchase races are still outstanding.

## Cancellation history and manual expiry audit — 23 October 2026

New server-side migration `20261023131000_cooking_stall_cancellation_receipt_ledger.sql` is deployed, **without activating food trading**. The `cooking_food_stall_cancellation_events` table holds an immutable, original-batch-derived receipt for every successful seller cancellation of an *open and still-fresh* food listing. It records the seller, listing ID, exact unsold portions returned, original recipe, quality, batch expiry and cancellation timestamp. The cancellation RPC already updates stock and listing state atomically; it now inserts this receipt in the **same transaction**. A unique listing constraint plus idempotent cancellation response ensures retries cannot duplicate returned portions or receipts. The new table uses authenticated owner-only SELECT RLS; anonymous access and authenticated DML are denied.

The same cancellation RPC had a history gap if a seller clicked cancel **after the listing deadline or food expiry**. Such manual closures report status `expired` and now write the existing owner-visible food stall **expiry** ledger, distinguishing fresh portions returned from expired portions spoiled. The automatic cron expiry worker is unchanged and profile/listing locks prevent a manual cancellation and cron from both processing the same open listing.

The Cooking Career history panel now offers an additional **Cancelled** filter. It uses the real dish artwork and original expiry for these receipts. The recent *Fresh food returned* summary now includes both cron/manual expirations and seller cancellations. Checkout and cancellation invalidate the history cache on success.

Verification: two transaction-scoped rollback SQL checks passed on the live connected database:
- `cooking_food_stall_purchase_rollback.sql`: completed partial sale, exactly one fresh cancellation refund receipt, repeated cancellation idempotency and immutable receipt tamper rejection.
- `cooking_food_stall_manual_expiry_rollback.sql`: seller closed an expired listing with fresh food (2 portions returned), then a listing with spoiled food (0 returned, 2 spoiled), and verified exactly one expiry receipt per listing, no duplicate cancellation receipts and no revival of spoiled stock.

Both tests rolled back all fixtures and the temporary release flag change. Production currently has **zero sales, listings, cancellation events or expiry events**; live cooking and trade flags remain closed. Real signed-in staging / concurrent connection certification and CI are **still outstanding**.

## Server-enforced city-specific food bans — 23 October 2026

Applied `20261023134500_cooking_stall_city_recipe_restrictions.sql` directly to the connected database (production trading flag **remains OFF**). The new protected table `public.cooking_food_stall_city_recipe_blocks` records a city, dish recipe slug, boolean ban, reason and update time, with a unique city/recipe key. RLS is enabled; only `service_role` has table privileges. This is deliberately **not** a player or mayor write interface. It starts empty, preserving all existing legal recipe behavior.

The existing global **12-recipe legal allowlist** remains mandatory, independent of city blocks. On opening/updating an open food listing, its trusted database trigger now rejects an otherwise legal recipe banned by the listing's city. The authenticated city-browse RPC excludes blocked recipes, including offers listed **before** the restriction took effect. The sale receipt trigger independently rechecks that same city's ban as part of the atomic checkout: it rejects newly restricted goods, rolling back buyer cash, seller proceeds, destination food and treasury fee together. Sellers can still cancel affected listings and recover unspoiled reserved food.

`supabase/tests/cooking_food_stall_city_recipe_ban_rollback.sql` passed on the connected production database inside an explicit `BEGIN ... ROLLBACK` transaction using existing, eligible two-user character identities and disposable prepared food. It verified: anonymous and authenticated roles cannot directly read/write ban settings; a banned recipe cannot be listed or escrow food; removing the ban permits a normal listing; reapplying a ban hides that listing from city browsing; checkout rejects without any cash/portion/receipt change; cancelling still returns two fresh unsold portions and creates a single cancellation receipt. The existing full purchase rollback test also passed after this migration.

**No live city bans or approved food offers were created.** A final read-only check must confirm the block table is empty, trading disabled and no persisted fixtures. City policy will need an audited administrative workflow and a separate signed-in staging certification before mayors or operators are given production controls. Restricted/illegal goods are **not** approved by this migration. Food crafting, ingredient market and live trading stay behind the original release gates.

## Illustrated local food trading rules — 23 October 2026

Added read-only, **character- and current-city-scoped** food-ban notices to `CookingPlayerStalls`. The authenticated `browse_cooking_food_stalls` response now includes `blockedRecipes: [{ recipeSlug, reason }]` for globally approved dishes that the selected character's current city has marked as locally restricted. The existing approved-recipe list prevents exposure of unapproved or illegal new goods. Each notice shows the named meal and a matching built-in SVG `DishIllustration`. The market query uses the existing active-character/city authorization and does not grant direct read privileges on `cooking_food_stall_city_recipe_blocks`. When player trading is disabled, both the offers list and policy-notice list are **empty**. The frontend doesn't display city policy details from inactive or stale cross-character markets.

Two sequential SQL migrations were applied on the connected database:

1. `20261023175500_cooking_stall_city_rules_readonly_browse.sql` exposed the read-only `blockedRecipes` array.
2. **Regression found and fixed:** that first migration redefined the city-browse function from an earlier version, accidentally omitting the newer local-policy filter on available offers. The strengthened rollback test caught this immediately: the banned dish appeared in `listings` even though the `blockedRecipes` warning was correct. `20261023181000_cooking_stall_city_rules_preserve_browse_filter.sql` restores both protections together. The later corrective migration must not be omitted or applied out of order.

The strengthened `cooking_food_stall_city_recipe_ban_rollback.sql` now proves that: (a) the server returns the exact city's approved/blocked recipe and policy reason to an authenticated buyer, (b) the banned listing itself is **not** present, (c) purchase attempts are rejected without charges, (d) disabling player trading hides both listings and restriction notices, and (e) a seller can still cancel and recover fresh escrow during the pause. The existing purchase/accounting and abandoned-stall expiry rollback tests **also passed** after the corrective migration. Tests used transactions and rolled back all fixtures and temporary release controls.

Two focused UI assertions cover illustrated city restrictions when trading is active and no disclosure or clickable trades when the server closes the market. This remains a *read-only player education* feature: it does not grant mayors or players ban-management access and never enables recipes or the marketplace. Full CI and three-user isolated staging certification are still required before release.

**Additional defence-in-depth:** The illustrated stall component filters any offer whose recipe slug is also present in the same response's `blockedRecipes` array. This cannot replace the mandatory backend policy check (stale clients and malicious callers still need server-side rejection), but prevents a misleading Buy button when response fields conflict. A further UI regression test sends a deliberately inconsistent local market response and verifies the banned recipe never renders a purchase control.

## Concurrent seller cancellation / purchase staging gate — 24 October 2026

The opt-in `tests/cooking-staging/food-stall-race.spec.ts` now certifies **two distinct real multi-connection races with the same three signed-in disposable staging accounts**:

1. **Buyer A vs buyer B:** exactly one can buy the first of two available fresh portions for $150; the losing request is denied. The winner's original request ID returns the same immutable receipt and owned destination batch on replay, with exactly one buyer debit, one seller net credit, one city fee and the original recipe/quality/preparation/expiry timestamps.
2. **Seller cancellation vs the losing buyer:** the seller creates a *second, separate* single-portion listing from the **same original fresh batch**. Before racing, the test proves another user cannot cancel the seller's listing, and the seller cannot purchase it from their own account. Independent signed-in RPCs simultaneously attempt seller cancellation and buyer purchase. Exactly one final outcome is permitted:
   - **Purchase wins:** one sale, one new buyer batch, no cancellation receipt or returned stock, seller earns price minus fee; seller cancellation observes `already_closed`.
   - **Cancellation wins:** buyer is rejected, zero sale, exactly one immutable cancellation receipt, one fresh portion returned to the original source batch, no buyer debit or seller credit.
   
   Both outcomes must end in a terminal listing with zero remaining escrow; a replayed buyer purchase ID must not charge again or mint food, and a repeated seller cancellation must never restore another portion.

**Stage fixture requirements:** The seller's **UI-selected eligible original food batch** must contain **at least two unlisted, unexpired portions** and have more than five minutes of freshness remaining. Buyers need distinct Supabase user IDs, same-city active characters and at least $150 in quiet staging cash. The test explicitly verifies the original batch quantities and that the winning buyer's meal keeps the original expiry. No account secrets or production SQL mutations are involved.

The regular `Cooking Gateway Authentication Contract` GitHub workflow additionally performs a **nonexecuting Playwright `--list` discovery/parse** using `.invalid` fake URLs and inert credentials; this ensures newly edited staging test files are syntactically loadable and the two-race test is registered, without starting browsers, making network requests, spending money, or claiming a real staging test has run. The separate manual `Cooking Staging Release Certification` workflow remains opt-in, staging-protected, and requires the explicit `certify_player_stalls` flag.

**Gate remains blocked until an actual isolated staging Supabase project/frontend and disposable signed-in accounts are connected and the real Playwright suite executes successfully.** No production trading, recipes, NPC offers, city bans or user cash were activated by this PR.

**Browser harness repair:** The three-user test originally called `browser.newContext()` without options, but browser-created contexts do not inherit the Playwright test fixture's `baseURL`. As a result, a relative `page.goto('/auth')` could fail before reaching any market test. Each isolated actor now creates their own browser context with an explicit origin from `COOKING_STAGING_BASE_URL`, already checked by the protected Playwright configuration against production hosts. This is a test harness fix; it does not change the app's authentication or market security.

## Staging browser host safety hardening — 24 October 2026

Shared `tests/cooking-staging/stagingNetworkSafety.ts` now validates the staging app and API origins before the opt-in Playwright browser run. Both origins must use HTTPS unless they are localhost/127.0.0.1, must be clean origins without embedded credentials or paths, and must reject known production `rockmundo.uk` hosts and the connected production Supabase project ref. The app must carry a clear staging/test/preview hostname; custom-domain API hosts must also be explicitly named staging/test/preview (while regular `<isolated-project>.supabase.co` API URLs remain supported).

**Custom-domain regression fixed:** previously, staging Playwright's `page.route` intercepted foreign `*.supabase.co` calls but **did not protect equivalent APIs on custom domains**. All three signed-in suites (`signed-in-journey`, `signed-in-techniques`, and `food-stall-race`) now use `forbiddenCookingStagingRequest` to abort any disallowed provider host, known live Rockmundo domain, or off-origin request for API-shaped paths like `/auth/v1`, `/rest/v1`, `/functions/v1`, `/storage/v1`, and `/realtime/v1`. This applies *before sign-in*, preventing accidental credential submission or food-write calls to a foreign backend via an otherwise legitimate-looking preview website. Direct Playwright API requests are constructed only from the validated staging origin.

New `stagingNetworkSafety.test.ts` under the ordinary cooking Vitest suite verifies local, staging and preview origin compatibility, production URL rejection, off-origin API endpoint blocking, and harmless static-asset requests. The existing non-executing staging-spec discovery check still runs in cooking CI. **No browser E2E or concurrency claim is made by unit tests**, and protected independent staging credentials remain required.

This change is tests/CI-only; no live schema, player funds, recipes or feature flags were modified. Production cooking and stalls must remain off until separate genuine signed-in staging certification.

**Service-worker bypass protection:** Playwright's page-level request routing does not intercept requests handled by service workers. The staging config now specifies `serviceWorkers: "block"` for its standard Playwright pages, and the three-account race test passes that option independently into every `browser.newContext()` it creates. This prevents a previously installed frontend service worker from circumventing the custom-domain API guard. The staging suite remains opt-in and network-free in ordinary CI (which only parses/discovers specs).
