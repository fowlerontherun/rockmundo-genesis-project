# Backend QA coverage inventory

Run `node scripts/qa/inventory-backend.mjs` to generate the backend inventory.

The scan discovers Edge Function entry points and migration-defined cron schedules; it does **not** inspect live cron activation, validate permissions, execute functions, or claim game systems pass QA.

For each discovered function record: owner, authentication/authorisation, input validation, role-gated behaviour, idempotency, transaction safety, retry/error states, E2E staging evidence, build SHA, known defects and retest outcomes. For cron definitions compare the repository against live scheduler entries and assess overlapping invocations, credentials, job logs and failures.

Issue #2644 must remain open until route, feature, permission, mobile, background worker and gameplay workflow coverage is exercised and recorded. Never mark source discovery as a passing test.
