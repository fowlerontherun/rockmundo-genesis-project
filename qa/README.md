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
