# Static navigation review — 2026-10-10

Source: GitHub QA branch `qa/gamewide-audit-phase1`, read-only inspection of `src/App.tsx`, festival route patterns, hub navigation and FM navigation.

## Executed discovery snapshot

- 496 unique candidate paths across JSX declarations and route/navigation configuration.
- 453 candidates with JSX route registration evidence (literal or festival constant).
- 314 candidates containing navigation references.
- 36 candidate navigation mismatches using the earlier direct-path matcher.

These figures were obtained by applying the repository scripts' extraction and matching logic to fetched source content. They are **not** browser test results, GitHub Actions results, or verified defects.

## Candidate groups to investigate

1. **Festival edition views**: applications, finance, live, history. Confirm whether nested routes, redirects, or alternate route mounts handle these links.
2. **Social links**: `/social?tab=...`. Query-string URLs should be matched by pathname. The navigation checker has been adjusted to remove query strings and hash fragments before matching.
3. **Wildcard and parent paths**: `/world/*`, `/performance/gig`, `/company`, `/player`. Verify React Router wildcard, index and redirect behaviour before filing defects.
4. **Company and world hubs**: `/festival-company`, `/companies/festivals`, `/venue-business`, `/university`, `/world-environment`. Confirm navigation target, role, and mounted routes.
5. **Other hub links**: `/fan-management`, `/family`, `/gear-history`, `/release`, `/community`. Check redirects and permission gates.

## Verification requirements

For each remaining mismatch: identify the source navigation control, resolve any nested route parent or redirect, test navigation using the correct account role, capture environment/build and actual outcome, and search existing issues before filing a bug. A missing static match alone does not establish a defect.

## Execution status

The QA workflow has not returned a confirmed run for the latest branch commits. The above snapshot was produced by source inspection rather than GitHub Actions. The static matcher was updated after this snapshot to handle query/hash URLs and wildcard patterns; rerun it before treating 36 as the current candidate count.
