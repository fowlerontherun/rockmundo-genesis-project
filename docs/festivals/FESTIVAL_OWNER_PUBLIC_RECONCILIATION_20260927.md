# Festival owner/public integration audit — 27 September 2026

Status: source audit plus read-only production schema verification on 27 September 2026. Production migration reconciliation outstanding.

## Verified production schema blockers\n\nRead-only checks against the active RockMundo Supabase project returned:\n- `to_regclass('public.festival_owner_npc_lineup_acts') = NULL` — curated NPC storage is absent.\n- `to_regclass('public.festival_schedule_revisions') = NULL` — canonical revisioned schedule storage is absent.\n- `to_regprocedure('public.festival_public_projection_v2(uuid)')` and `_festival_simplified_timetable_projection(uuid)` both exist.\n\n**Do not deploy the new NPC public-projection migration until its prerequisite NPC storage migration is applied. Do not enable atomic reorder until the canonical schedule migration and its dependent objects exist.** Verify both migrations against production migration history and schema, then apply in dependency order with an explicit reconciliation/rollback plan. Do not recreate existing production objects blindly.\n\n## Confirmed source gaps
- `festival_public_projection_v2` in `20291220103000_public_festival_pre_event_lineup_sales.sql` builds `lineup` solely from `festival_artist_bookings`. Curated NPC bands and DJs live in `festival_owner_npc_lineup_acts` and appear in `_festival_simplified_timetable_projection`, but not the public `lineup` field. Public views that render `lineup` omit them.
- Public booking times are read from `festival_stage_slots` with public status, whereas the new visual scheduling workspace edits `festival_schedule_items`. A draft or published visual slot is not automatically reflected in the public lineup.
- The simplified timetable assigns starts using 14:00 plus 90-minute ordinal increments; it does not honor the owner's explicit running order and can diverge from public published slots.
- NPC manager previously contained literal `\\n` sequences inside JSX (repaired in this PR); confirm build and route visibility.
- Player artist invitations, confirmed bookings, site-plan stages, legacy stage slots and revisioned visual schedule have separate identifiers and state transitions. The owner cannot yet reliably choose an invitation's exact stage/day/time and see that exact assignment publicly.

- The canonical annual-edition public route currently renders `PublicEditionHistory` from `CanonicalFestivalRoutes.tsx`, which calls settlement history and shows a completed-results empty state for editions without results. Upcoming editions need an edition-aware public overview rather than this history-only destination.\n\n## Required single workflow
1. Owner creates or opens an edition and configures dated stages, opening hours and curfew.
2. Owner invites a band into a proposed stage/day/slot; the invitation carries those proposed terms. Acceptance yields a confirmed booking, not an automatically public or arbitrarily timed performance.
3. Owner selects local NPC bands/DJs from an edition-city-aware catalogue, not only free-text presets; add them to unfilled dated stage slots with duration/changeover.
4. One canonical published schedule projection emits player bookings and curated NPC/DJ acts together with stage, local date, start/end, artist type and public visibility. Unconfirmed invitations and private terms stay private.
5. Public edition detail, attendee timetable, owner planner, performer calendar and gig list all consume the same published assignment IDs. Draft-only changes remain private.
6. Distinguish genuinely unfilled slots from missing data or projection failures. Show readiness diagnostics to owners/admins, not empty public data cards.

## Release gates
- Build/test owner NPC selector and both public route variants.
- SQL fixtures: player invited -> accepted -> exact stage slot -> published; NPC band and DJ assigned to spare slots; cancellation; conflicts, curfew, stale version and visibility.
- Compare owner draft, published projection and attendee timetable for one seeded multi-day edition.\n- Verify public edition URL for both upcoming and completed editions: upcoming should show lineup, stages, tickets and release status; completed should retain history/results.
- Check active route declarations against `routes.ts` rather than relying on historical routing audits.
- Verify migration applied, data backfilled, and live public pages populated before calling this fixed.

## Related in-flight work
- PR #2148: move/retime preview.
- PR #2149: draft atomic stage reorder; must reconcile stage ID/domain and deployment before use.

## Direct production migration execution — 27 September 2026

- Applied `festival_owner_npc_lineup` directly to the active RockMundo Supabase project; verified NPC table, management RPCs and enabled RLS.
- Applied `festival_public_curated_npc_lineup` directly after fixing three literal escaped newlines in the SQL file. Verified `festival_public_projection_v2` executes for the existing company and returns a JSON array containing two confirmed acts. NPC table currently contains zero rows.
- Restored missing `festival_admin_can_operate_edition(uuid,text[])` from the canonical edition operations source as a separate production migration, with restricted EXECUTE grants.
- Attempted `festival_phase2a_visual_scheduling` but it failed atomically. First corrected reserved CTE alias `overlaps` to `stage_overlaps` in-memory; the next failure showed production already has `festival_stage_operating_hours` with `opening_time time`, `curfew time`, `changeover_minutes`, not the proposed `opens_at timestamptz`, `curfew_at timestamptz`, `default_changeover_minutes`. `CREATE TABLE IF NOT EXISTS` cannot reconcile this drift. **The schedule revision tables are not deployed.** Do not run the atomic reorder migration until a deliberate schema-compatible bridge is designed and tested.
- Permission check: NPC management RPCs executable by authenticated/service_role, not anon; public projection executable only by service_role. Existing production data was not altered or festivals rerun.
- Supabase security advisor has pre-existing broad RLS-without-policy notices; inspect [database linter remediation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) separately before treating these as regressions.

### Revisioned scheduler compatibility follow-up

The visual scheduler migration has been corrected on this branch to use its own `festival_schedule_stage_operating_hours` table rather than overwriting the existing canonical `festival_stage_operating_hours`, and to rename the reserved SQL CTE `overlaps` to `stage_overlaps`. A direct production apply of the corrected migration remains **blocked**: existing `festival_schedule_configure_stage_hours(uuid,uuid,date,time,time,integer,integer,text)` and other scheduling RPCs already have parameter defaults, while the migration attempts `CREATE OR REPLACE FUNCTION` with signatures omitting those defaults (`42P13`). Do not drop the live RPCs to force this migration through. Reconcile each existing signature/default and function body, and test in staging before applying the revisioned scheduler or atomic reorder. Failed migration attempts were atomic; `festival_schedule_revisions` remains absent.

## Player experience and ticket-sales verification

- Live Upcoming Gigs error root cause: `get_my_band_festival_appearances()` was missing. Applied the existing `20291220110000_member_festival_appearances.sql` migration directly to production. Verified authenticated EXECUTE=true and anon EXECUTE=false. The Advanced Gig System UI now loads confirmed festival appearances independently, with distinct styling and a nonfatal festival error state; frontend code remains unmerged.
- Live `festival_ticket_sales`: 2 completed player purchase orders, 9 purchased/issued tickets, 1 distinct purchasing player, 42,498 minor currency units in gross recorded orders. These are **actual player purchases**, not modeled demand. Do not infer a population-wide sales trend from one buyer.
- The festival owner ticket demand basis-points function is live and uses price, planning marketing, reputation and marketing upgrades to forecast sell-through. This forecast is **not booked sales**. `get_festival_ticket_sales_summary` currently counts completed orders only. No festival equivalent of the daily `advance-gig-ticket-sales-daily` cron was found. Festival simulated/ambient sales must be designed as separately attributed, capacity-safe, auditable sales before owner summaries may claim gig-equivalent automated sales.


## Next-edition readiness gate — scheduler reconciliation (27 September 2026)

Production read-only checks reconfirmed that `festival_owner_npc_lineup_acts` and `get_my_band_festival_appearances()` exist, but `festival_schedule_revisions` does not. The live `festival_schedule_configure_stage_hours` RPC has default opening/curfew times (12:00/23:00), and the live `festival_schedule_lock` and `festival_schedule_reopen` RPCs default `p_reason` to NULL. The revisioned migration on this branch now preserves those defaults; its other overlapping scheduling RPC signatures were compared with production. **This is a source compatibility fix, not evidence that the migration is deployable.**

Before applying revisioned scheduling or the dependent atomic reorder migration: (1) run the corrected migration in a production-schema-equivalent staging database, (2) check the existing function bodies and dependencies, not just their signatures, (3) exercise configure hours, create draft, move/retime, publish, lock and reopen under an authorised owner identity, (4) verify anon access is denied to privileged RPCs and audit the migration's explicit grants, (5) compare the published schedule with public line-up and performer appearances, and (6) take a rollback-safe backup and confirm the staging checks pass. Do not force production deployment by dropping existing live RPCs.

The next festival edition is gated on the complete published programme, capacity-safe player and simulated ticket sales, automated performances, financial settlement and immutable edition history. Shock Festival's current launch is not to be retroactively assigned simulated sales or rerun as part of scheduler reconciliation.

### Public schedule privacy and publication checks

The revisioned migration now returns only public revision metadata (`id`, `revisionNumber`, `publishedAt`) rather than serialising internal revision notes, owner profile IDs or audit fields. Publishing a schedule now retains each item's explicitly chosen `public_visible` value instead of automatically exposing all assigned items. Staging certification must assert that private soundchecks, technical maintenance and unpublished performer assignments remain absent from the anonymous public projection; explicitly published performances remain visible. The scheduler is still pending staging execution and must not be described as live.

### Festival foundation: setlist approval through stage performance

The band-facing canonical contract editor now offers the band's saved setlists as starting selections. A preset is copied into the contract-specific draft; the original band setlist remains unchanged. The editor rejects preset songs unavailable in the contract repertoire, requires authoritative preflight to complete, and prevents submitting an unsaved selection. A contract setlist must follow the existing draft → submitted → organiser-approved (or changes-requested) → locked workflow. Organisers review but cannot silently replace the band's songs. A new performance session uses the locked canonical setlist and persists an immutable setlist snapshot for deterministic playback and audit.

Integration gates for the next festival edition:
1. Band accepts a confirmed stage-slot contract, selects a saved setlist, adjusts songs, saves, submits, receives changes request, resubmits and obtains organiser approval.
2. Assert the organiser sees the same ordered song IDs, durations, encore flags and approved version; no unpublished setlist leaks into the public timetable.
3. Lock the approved version and create the performance session exactly once; assert its setlist snapshot matches the locked version and cannot change when the band's general saved setlist is edited.
4. Ensure a rejected, unapproved, stale or over-duration setlist cannot start a performance. Verify permissions for another band, another organiser and anonymous callers.
5. Simulate stage call, performance and completion with deterministic replay; check session event idempotency and one settlement record per performance.
6. Test multi-day/multi-stage overlapping sets, late replacements, no-shows and cancellations without silently changing the locked setlist.

Production read-only inventory on 2026-09-27: canonical performance-session storage exists but there are zero performance sessions and zero locked contract setlists; the revisioned visual scheduler table does not yet exist. Only the production Supabase project was available in the connected project list. Do not treat source-level changes as production deployment or claim staging execution without a separate test database.
