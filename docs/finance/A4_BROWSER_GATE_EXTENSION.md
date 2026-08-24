# Finance A4 browser gate extension

This change extends the existing Finance A4 Playwright gate so it exercises the supported finance routes in a real browser in addition to retaining the existing source-contract assertions.

Covered browser routes:

- `/rehearsals`
- `/recording-studios`
- `/finance/banking/apply`
- `/finance/mortgages`

Each route must render without exposing missing-RPC/schema-cache failures. The existing Finance verification workflow remains the authoritative closure gate and continues to run clean Supabase reset, database lint/tests, reconciliation, type parity, TypeScript, lint, unit tests, build, and the finance Playwright suite.

A4 should remain `NEEDS VERIFICATION` until the pull-request Finance verification workflow succeeds.
