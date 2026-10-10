# RockMundo QA audit — Phase 1

Tracking: https://github.com/fowlerontherun/rockmundo-genesis-project/issues/2644

## Generate a route inventory

Run `node scripts/qa/inventory-routes.mjs` from repository root. The generated `qa/route-inventory.json` is a **discovery artifact, not evidence of tests passing**. It uses static extraction from known route/config files and is intentionally conservative.

## Required manual expansion

- Resolve nested routes, redirects, dynamic route parameters and festival-specific route definitions.
- Inventory mobile-only pages, admin-only pages, hidden flows, dialogs and navigation actions.
- Inventory Supabase edge functions, RPCs, migrations, cron jobs and payment/XP/economy workflows.
- Add role, fixture, test case, environment, last tested commit, result and linked GitHub issue for each item.
- Search existing GitHub issues before creating defects. Never create a bug solely because a route has no test.
- Run browser tests only with approved test accounts and safe environments.

## Result definitions

`not-tested`: discovered only; `pass`: executed with evidence; `fail`: reproducible defect; `blocked`: test could not be run; `not-applicable`: justified exclusion.

## Next iteration

Improve parser for nested/array-based route definitions and generate a machine-readable test matrix. Add CI artifact publishing and a GitHub issue deduplication workflow.

## Run the complete discovery suite

From the repository root:

```sh
node scripts/qa/inventory-routes.mjs
node scripts/qa/generate-test-matrix.mjs
node scripts/qa/check-navigation.mjs
node scripts/qa/inventory-backend.mjs
node --test scripts/qa/inventory-routes.test.mjs
```

The dedicated QA GitHub Actions workflow publishes four JSON artifacts:
`qa/route-inventory.json`, `qa/test-matrix.json`,
`qa/navigation-review.json` and `qa/backend-inventory.json`.

Navigation gaps are **candidates for manual review**, not automatically confirmed defects. Backend discovery covers checked-in Edge Function entry points, SQL migrations and SQL tests; it cannot verify deployed database functions, triggers, cron schedules, or live behaviour.

## Prioritisation and issue policy

- **P0**: security compromise, data loss, payment integrity or widespread game outage — escalate immediately.
- **P1**: core gameplay blocked, lost rewards/progression, broken gig settlement or significant economy corruption.
- **P2**: important feature broken with a workaround or meaningful player impact.
- **P3**: minor feature, UX or display problem.
- **P4**: cosmetic or low-impact improvement.

For each **verified** defect, record environment, build/commit, role, fixture, steps, expected/actual result, evidence, affected route/backend surface, impact, priority and an existing-issue search. Do not create duplicates; link to an existing issue when applicable. No issue should be filed solely because a route is untested or a navigation candidate is unmatched.
