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
