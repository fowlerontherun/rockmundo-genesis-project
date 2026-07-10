# Phase 3 PR 05 — Recruitment RLS and Route Verification Harness

## Recommendation source

This PR implements the Phase 3 PR 04 recommendation to add repeatable verification for guarded band recruitment RLS, RPC permissions, history visibility, notification metadata, and stale route normalization before moving to larger social-MMO collaboration features.

## Test strategy

The repository already had Vitest unit coverage, Supabase migrations, service-role style SQL migrations, and UI/service tests. It did not contain pgTAP, Playwright, or an existing SQL policy-test framework. PR 05 therefore adds the smallest layered harness:

1. **Unit tests** for shared recruitment status mapping and notification route normalization.
2. **Database harness** in `supabase/tests/recruitment_rls_harness.sql` using deterministic fixtures, local Supabase roles, RLS-aware role switching, and explicit assertions.
3. **Documentation-only browser scope** for this PR: route behavior is covered at the shared model layer because the repository does not include Playwright authenticated fixtures.

## Actors and fixtures

The SQL harness seeds disposable deterministic identities for an applicant, second applicant, band leader, distinct founder, ordinary member, former inactive member, unrelated authenticated player, blocked applicant, and anonymous role. It creates a recruiting band, non-recruiting band, unmanaged band, pending/accepted/rejected/withdrawn application rows, active and inactive memberships, a block relationship, and recruitment notifications produced by the guarded RPCs.

## RLS cases covered

Covered by `supabase/tests/recruitment_rls_harness.sql`:

- Applicant can read own pending, accepted, rejected, and withdrawn history.
- Applicant cannot read another applicant's private application or message.
- Leader and founder can read applications and private messages for their current band.
- Ordinary members, former/inactive members, unrelated users, managers of another band, and anonymous users cannot read private application history.
- Direct inserts and direct updates are denied to authenticated clients.

## RPC cases covered

Covered by the SQL harness:

- `submit_band_application` succeeds for an eligible authenticated player.
- Anonymous, current-member, non-recruiting-band, blocked-pair, unsupported-role, overlong-message, and direct-insert paths are denied.
- Duplicate pending submission remains idempotent.
- `respond_band_application` approval/rejection succeeds for leader/founder and is denied for ordinary, former, unrelated, and self-approval actors.
- Duplicate approval creates one active membership with safe `member` role.
- Rejection creates no membership.
- `withdraw_band_application` rejects accepted/rejected applications and treats withdrawn retries safely.

## Route cases covered

Vitest route/model coverage confirms:

- Applicant application notifications route to `/bands/:bandId`.
- Manager application notifications normalize stale `/bands/:bandId?tab=applications` destinations to `/bands/:bandId`.
- Final-state recruitment notifications keep status labels and valid routes.
- Missing/deleted band destinations degrade to no action instead of inventing a broken route.
- Invitation notifications still route to `/band-manager`.

## Defects found

The harness review found that the historical manager select policy on `band_applications` used case-sensitive role checks and did not require active membership. That meant inactive/former leaders could retain private application-history visibility and lowercase founders could be missed.

## Corrective migrations

`supabase/migrations/20260711000000_tighten_band_application_select_policy.sql` replaces the old manager select policy with the existing guarded helper `can_manage_band_invitations(band_id, auth.uid())`, which already requires the current user to be the band leader or an active leader/founder member.

## Commands

Local fast checks:

```bash
npm run typecheck
npm run lint
npm run build
npm run test:unit -- src/lib/recruitmentStatus.test.ts src/lib/notificationModels.test.ts src/services/__tests__/bandApplications.test.ts
```

Local database checks require Supabase CLI and a disposable local database:

```bash
supabase db reset
export SUPABASE_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
npm run test:recruitment:db
```

## CI integration

The recruitment database harness is intentionally separate from fast unit tests because it requires Supabase CLI, PostgreSQL access, and a resettable database. It is documented through `npm run test:recruitment:db` but not added to default CI until the database tooling is stable in CI.

## Known limitations

- No Playwright authenticated fixture exists, so browser route/history checks remain unit/model and component-test scoped.
- The SQL harness is designed for local Supabase and is not safe to run against production.
- No auditions, vacancies, matching, scoring, cooldowns, or rewards are included.
- The product decision about global one-band membership remains open.

## Phase 3 closure recommendation

Phase 3 should be considered **Complete with accepted limitations**: the guarded recruitment lifecycle exists and now has repeatable RLS/RPC/route verification, but browser-level authenticated journeys and future product rules remain outside scope.

## Recommended next phase and PR

Recommended next phase: **shared band contribution/progression**.

Recommended next PR: **Band Contribution Event Log MVP**. Add server-authoritative contribution events for existing band actions, read-only contribution summaries, and tests proving members only see data for active bands they belong to. This builds on secure recruitment without introducing vacancies or auditions yet.
