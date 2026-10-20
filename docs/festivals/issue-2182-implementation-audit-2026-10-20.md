# Issue #2182 — festival sponsor / staffing implementation audit (20 October 2026)

Issue: https://github.com/fowlerontherun/rockmundo-genesis-project/issues/2182

## Verified current live database observations

Read-only inspection of the connected Rockmundo Supabase project established:

- `sponsorship_brands`: 465 active, funded fictional brands; 465 missing logo references before the backfill.
- The existing repository migration `20260928160000_backfill_canonical_sponsorship_brand_logos.sql` had **not** been applied in migration history.
- The canonical legacy brand selector table exists; the newer `festival_sponsorship_plans`, `festival_sponsor_contracts` and `festival_sponsor_slot_readiness` do **not** exist on the connected live database.
- `festival_staffing_requirements` exists but contains no rows; there are two records in `festival_editions_v2`. Do not interpret empty staffing rows as proven readiness or zero costs.

## Safe repairs completed

1. Applied the exact existing logo-backfill function and data UPDATE against live brands. It does not replace any nonblank custom logo. A follow-up query counted **465 SVG placeholders and zero missing logos**.
2. Applied forward-only `20261020211000_festival_active_brand_logo_guard.sql` directly against the connected DB, including its idempotent missing-logo repair; verified `sponsorship_brands_active_logo_not_blank` exists and `convalidated=true`.
3. Updated Brand Administration so editing an active brand cannot remove its image reference, and seeded SVG identities are visibly classified as requiring artwork review. Added DOM/source regressions and a rollback-only SQL harness for isolated DB verification.

**Generated monograms are fallback identities, not signed-off custom logos.** Rights/licensing, brand-by-brand approval, upload workflows and historical visual snapshots remain outstanding.

The direct DB changes were not added to `supabase_migrations.schema_migrations` automatically. The idempotent migration is committed in source; reconcile actual schema and source history before further migration deployment. Do not mark related missing sponsor-contract migrations as applied.

## Required before issue closure

- Reconcile and test the absent edition-bound sponsorship schema in an isolated restored database before deploying sponsor contract and slot rules to live. The existing per-company plan approach is not yet proof of per-edition isolation.
- Implement a verified automatic **named** NPC main-sponsor fallback (or explicit readiness blocker), respecting signed player contracts; keep projected sponsorship budget distinct from signed/received funds.
- Enforce one main, max four support, duplicate canonical-brand prevention, industry exclusivity and completed-edition immutability under concurrent acceptances.
- Publish launch identity and commercial snapshots through public festival pages, ticketing, announcements and deterministic 3D gig replay.
- Finish staffing coverage/cost authority: derived headcounts, minimum safety coverage, setup/show/teardown, 11 upgrade levels, activation costs, settled payroll idempotency and margin tests.
- Verify migration replay, RLS, concurrency, historical contracts, edition isolation, real-edition and browser smoke tests (including Shock Fest). Run staging and CI gates before closure.

## Release decision

**Open / partial implementation.** The direct brand-repair work is verified, but #2182 is a broad multi-phase feature and its own acceptance contract forbids closing it until the remaining schema, finance, staffing, artwork and end-to-end requirements have been certified.


## Continuation — edition sponsor identities (20 October 2026)

**Additional source migration:** `20261020214500_festival_edition_npc_sponsor_identity.sql`.

- Directly created `festival_edition_sponsor_assignments` on the connected live database. It references existing `festival_editions_v2` and `sponsorship_brands`, **not** a second brand catalogue or a parallel commercial contract.
- Unique partial indexes enforce one active main and unique active brand per edition. A transaction-serialized trigger caps supporting sponsors at four and enforces mutual category exclusivity.
- Name, logo, category and region are snapshotted from the canonical brand at assignment, never trusted from client input. Completed/cancelled/locked/published annual editions cannot be modified.
- `ensure_festival_edition_npc_main_sponsor` is owner-authorised, deterministic and idempotent. It prefers selected brands and region/vibe affinity, has conservative funding/reputation eligibility, and refuses to allocate if the advanced explicit-contract table is later installed without reconciliation.
- `get_festival_edition_sponsor_identities` returns an owner-authorised compact 1+4-slot snapshot. These identities **never post cash or in-kind revenue**; the simplified automatic budget remains authoritative.
- A compact Tickets and budget owner section displays the main logo, four supporting slots, and an explicit option to allocate an NPC identity. A typed model rejects a response that implies extra revenue or duplicates brands.
- Live schema/readiness verification: table and two unique indexes present; RLS enabled; anon SELECT / authenticated direct INSERT forbidden; both owner RPCs installed; zero pre-existing assignment rows changed and both Shock Festival editions retained their original statuses. Unauthenticated owner-RPC calls were rejected.
- The rollback-only SQL harness and TypeScript model tests have been committed but **not** run on an isolated restored database, and browser acceptance remains pending.

**Next required integration:** the simplified publication transaction still needs to call the allocator atomically and snapshot the identity with the public projection; otherwise a main sponsor is not yet guaranteed on launch. Advanced explicit player contracts are not deployed, supporting sponsors are not selectable via owner contracts, and staffing/settlement certification is still outstanding. **Keep #2182 open.**

Migration source was deployed directly but not marked as an applied row in Supabase migration history; reconcile schema/migration history before any future replay.
