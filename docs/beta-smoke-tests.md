# Beta smoke and regression tests

RockMundo uses Vitest with jsdom for the current beta smoke suite. Playwright is not installed in this repository, so browser journey coverage is represented by deterministic component/helper smoke tests rather than an end-to-end browser runner.

## Commands

- `npm run test:unit` runs the complete Vitest suite.
- `npm run test:smoke` runs the focused beta smoke/regression subset.
- `npm run typecheck`, `npm run lint`, and `npm run build` should still pass before merging.

## Smoke coverage added

The focused smoke suite covers these stable journey contracts:

- Authentication/profile data resolves to loading, ready, empty, or error states without hanging.
- New-player onboarding step generation includes valid routes for character setup, skills, songwriting, and schedule.
- Established players with real progress do not receive inappropriate beginner blockers.
- Manager recommendations remain rules-based and route to recording, release, schedule, wellness, and inbox actions.
- Songwriting empty/error/valid/invalid states are deterministic.
- Recording eligibility shows a clear reason for ineligible songs.
- Release selection includes recorded songs only.
- Band-private access is denied for non-members.
- Schedule display filters fake placeholders and preserves chronological order and 1h/2h/4h durations.
- Resource transactions use idempotency keys to block duplicate awards/charges and report insufficient funds.
- Admin access rejects normal users and allows admins.

## Test data

All smoke data is in-memory fixture data inside Vitest tests. No production data or real credentials are required.

## Remaining gaps

- Browser-level route rendering and console-error checks need Playwright or another E2E runner.
- Local Supabase seeded integration coverage would strengthen RLS and protected RPC assertions.
- Recording, release, booking, resource, and admin flows are currently covered at helper/contract level, not full UI submission level.
