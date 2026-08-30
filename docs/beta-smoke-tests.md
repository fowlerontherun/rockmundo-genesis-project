# Critical beta journey test gate

RockMundo uses a focused Vitest gate for the player and operator journeys that must remain healthy for beta. The gate exercises production components, hooks, services, workflows, route contracts, and SQL contracts; it does not rely on parallel test-only implementations of gameplay rules.

## Commands

- `npm run test:critical-journeys` validates the journey manifest and runs its test files.
- `npm run test:smoke` is retained as a compatibility alias for the same gate.
- `npm run test:unit` runs the complete Vitest suite.
- `npm run typecheck`, `npm run lint:ci`, and `npm run build` remain part of CI verification.

## Gate design

[`src/testing/critical-journeys.json`](../src/testing/critical-journeys.json) is the source of truth. Each entry names a required journey, the regressions it protects, and one or more production-facing test files. [`scripts/run-critical-journeys.mjs`](../scripts/run-critical-journeys.mjs) rejects missing journeys, duplicate identifiers, empty regression coverage, invalid test paths, and missing files before invoking Vitest.

The CI workflow runs this focused gate immediately after static checks and before the complete unit suite. This keeps the beta contract visible in job output and prevents unrelated broad-suite failures from masking the critical result.

## Journey inventory

| Journey | Protected behavior |
| --- | --- |
| Signup, login and session recovery | Session hydration, canonical email confirmation redirect, password recovery |
| Character creation | Authoritative `create_character_profile` RPC and visible failures |
| Dashboard and next action | New-player guidance and established-player release progression |
| Songwriting | Resilient loading, character isolation, and scheduled activity authority |
| Recording | Persisted workflow compatibility and invalid transition rejection |
| Release | Finance recovery contracts and recorded release costs |
| Gig completion | Outcome mapping and post-gig consequences |
| Band basics | Founder membership and private-band permissions |
| Low health and energy recovery | Recovery forecasts and recovery activity availability |
| Inbox and notifications | Duplicate suppression and multi-character scoping |
| Mobile dashboard and quick actions | Daily loop, companion routes, and scroll ownership |
| Admin bug visibility | Open blocker visibility, investigation notes, and admin route protection |

## Test data and database use

Component and hook tests use deterministic in-memory fixtures with the Supabase client boundary mocked. Existing SQL contract tests read repository SQL directly. The gate requires no production credentials and does not mutate a database.

## Remaining gaps

- Route-by-route browser rendering, loading/empty/error matrices, and history navigation belong to backlog PR P4.
- Seeded local-Supabase integration coverage can further strengthen RLS and protected-RPC verification.
