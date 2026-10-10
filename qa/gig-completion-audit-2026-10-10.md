# Gig completion and replay — Phase 1 evidence review

Status: **source-reviewed, runtime not tested**. Priority: **P1**. Related issue: **#2158**.

## Existing implementation

- `supabase/migrations/20261008193206_idempotent_gig_consequences.sql` installs an idempotent consequences processor and reconciliation of historical claims.
- `scripts/gigs/post-consequences.test.mjs` exercises both legacy and planned schemas using PGlite, including duplicate claim reconciliation, repeated processing, concurrent worker calls, rollback on injected failure, readiness checks, pre-existing partial evidence and completed claims lacking snapshots.
- `src/features/gig-experience/services/GigExperienceService.ts` reads the gig processing state and consequence snapshots for the report.

These are implementation and test **coverage observations**, not proof the live deployment is healthy.

## Required validation

1. Run `node --test scripts/gigs/post-consequences.test.mjs` in a configured CI environment and capture the result.
2. Verify migration `20261008193206` exists in the **deployed** Supabase migration history. Do not reapply blindly.
3. In a safe staging environment, inspect stuck `gig_post_processing` claims, snapshot counts and the worker schedule; ensure historical reward balances are unchanged.
4. Use an authorised completed gig to open the outcome report and replay viewer; verify report availability, replay compatibility and that replay never re-awards XP or money.
5. Confirm repeated worker runs and page refresh do not duplicate consequences or report a false terminal state.

## Risk

A passing static route audit does not establish gig replay health. Do not mark this journey as passed until deployment state, database behavior and the actual replay UI have been verified.
