# City Scene Challenges — Phase 0 Source Audit

**Reviewed:** 2026-10-27  
**Status:** Partial source audit and initial code foundation; live gameplay NOT enabled.

## Verified directly against current RockMundo Supabase schema (read-only)

- `public.cities.id` and `public.bands.id` are UUIDs.
- `public.profiles.id`, `public.profiles.user_id`, and `public.profiles.current_city_id` are UUIDs.
- `public.social_activities` has `id`, `city_id`, `status`, `completed_at` and `host_player_id`.
- Existing feature-specific challenges are in `dikcok_challenges`, `dikcok_challenge_entries`, and `jam_session_challenges`. Those are distinct from city-wide community challenges; do not repurpose them without a data-contract review.
- Existing social activity completion and attendance tables provide a plausible trusted source, **not yet an authorised scoring adapter**.

## Repository reuse contracts

| System | Existing evidence | Decision |
|---|---|---|
| Social activities | `docs-social-activities.md`, `social_activities`, `social_activity_participants` | Candidate first adapter after checking server-owned finalisation and attendance |
| Jam sessions | `docs/band-jam-sessions.md`, `JamSessionsEnhanced.tsx` | Await completed-session and participant authority audit |
| Rehearsals | `src/pages/Rehearsals.tsx`, `src/components/performance/RehearsalsTab.tsx` | Do not score booked sessions; verify completion quality |
| Gigs | Existing gig processors, including historical stuck jobs | Do not score until settled/completed and actual participants confirmed |
| City projects | `src/types/city-projects.ts` | Reuse city identity, keep mayor-funded projects separate |
| Progression/rewards | `skill_quest_reward_claims` and `experience_ledger` | No payout until reviewed authoritative idempotent grant path |
| Social/privacy | `docs/social/SOCIAL_SYSTEM_AUDIT.md` | Public board must not expose raw contribution or account ledger |

## Commits in this foundation branch

- Original 3 design files under `docs/features/city-scene-challenges/`.
- `20261027070000_city_scene_challenges_foundation.sql`: seven isolated tables, per-account daily affiliation, event deduplication, read-only public aggregate metadata and owner-only private rows, no client writes.
- `sceneRules.ts`: deterministic UTC cycle bounds, population target calculation, objective distribution and poster reveal stage.
- `ScenePoster.tsx`: visual asset-free poster component with 25/50/75/100 mural milestones and accessible progress.
- Scoped rules and migration contract tests.

## Safety / deployment decisions

1. Schema migration is committed to Git only; it has **not** been applied to live Supabase.
2. The migration includes no source scoring RPC, no scheduler and no reward processor.
3. No challenge templates are active; accounts cannot mint contribution records from their browser.
4. The visual component is a reusable foundation, **not yet a navigable game page**.
5. The migration needs staging dry-run, advisor review and deployed migration-order verification before rollout. In particular, existing migration drift and lint baseline issue #4569 must be reported separately, not hidden.

## Next delivery slice (PR 2)

1. Validate actual completion events and permission boundaries with live read-only examples.
2. Create idempotent UTC cycle reconciliation using the existing trusted scheduler (after cron ownership audit).
3. Seed 3 daily / 3 weekly / 1 monthly curated objectives with source-health checks.
4. Build private server-only contribution adapter, using one verified completed activity type.
5. Add board read RPC and city view once data can be served truthfully.
6. Test duplicate event replay, alt characters, travel, period rollover, RLS and partial failures.

## 27 October continuation — actual implementation

- Added a City Scene Board page under `/cities/:cityId/scene-challenges`, linked from the city page, with daily/weekly/monthly tabs, server totals, personal point counts and live-data mural visuals.
- Added `get_city_scene_board` aggregate RPC and `get_my_city_scene_progress` owner-only RPC.
- Added service-role-only UTC cycle reconciliation and poster milestone persistence. No automatically scheduled job is installed.
- Added a jam adapter requiring finalisation + independently recorded resolved slot participation by >=2 distinct player accounts. Production snapshot: no matching finalisations yet; controlled staging fixtures required.
- The initially proposed social hangout adapter is deliberately non-scoring because current completion marks accepted invitees as attended without independently verified participation.
- Fixed weekly/monthly player point caps to apply to the whole cycle instead of resetting daily; serialise credit by account + cycle.
- Added `scene-challenges-processor` with dedicated secret, an explicit enable flag, dry-run by default, bounded candidate scans and milestone reconciliation. A truncated scan is not production-ready pagination.
- Added frontend and migration contract tests; CI remains unverified for new commits, and lint baseline issue #4569 remains a separate blocker.
- See [PROCESSOR_RUNBOOK.md](PROCESSOR_RUNBOOK.md). Nothing has been applied to the live database or made claimable.
