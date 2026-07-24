# Festival Company Runtime Gate

## Purpose

The Festival Company Runtime Gate proves the company-founding flow against an executable local Supabase database. It verifies the RPC surface, founding transaction, idempotency, rollback behavior, cleanup path, and deterministic concurrency handling without adding any Festival Configuration Wizard or gameplay scope.

## Requirements

- Docker must be installed and running.
- Supabase CLI must match the pinned CI version (`2.31.8`).
- `psql` must be available.
- Node dependencies must be installed with `npm ci`.

## Local Supabase setup

Start and reset a local Supabase stack before running the gate:

```bash
supabase start
supabase db reset
```

If `SUPABASE_DB_URL` is not already exported, use the local default:

```bash
export SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

## Safety guard

Every destructive festival runtime script sources `scripts/festivals/assert-safe-test-database.sh`. The guard refuses to run unless:

- `FESTIVAL_TEST_DATABASE_CONFIRMED=true` is present.
- A database URL is supplied.
- The host is recognised as local (`localhost`, `127.0.0.1`, `::1`, Docker host aliases, or local Supabase container names).
- The URL does not reference Supabase production hosts, poolers, production-like names, or the known production project reference.

Credentials are never printed by the guard. Production databases are refused because runtime tests insert users, profiles, subscriptions, companies, financial transactions, ledger rows, and rollback fixtures; these operations must only occur in an isolated database that can be reset.

## Commands

Run the safety-guard unit tests without connecting to any database:

```bash
npm run test:festivals:safety-guard
```

Run the complete local runtime gate:

```bash
FESTIVAL_TEST_DATABASE_CONFIRMED=true npm run test:festivals:company-runtime
```

The canonical gate verifies required RPCs, executes the financial correctness harness, and then runs deterministic concurrency verification.

## GitHub workflow

`.github/workflows/festival-runtime-gate.yml` runs on `workflow_dispatch` and `pull_request`. It pins Supabase CLI `2.31.8`, starts local Supabase, resets the database, runs the safety-guard tests, verifies required RPCs, runs the runtime gate, runs concurrency verification, and uploads redacted diagnostics on every run. The workflow has a timeout and concurrency group `festival-runtime-${{ github.ref }}` with cancellation enabled so stale runs do not continue mutating local CI databases.

## Runtime output

The SQL harness emits a `festival_runtime_summary` JSON notice containing balances before and after, available and reserved balances, `profiles.cash`, company/transaction/ledger counts, signed ledger totals, idempotency and rollback results, cleanup status, and assertion totals. The harness exits non-zero if assertions fail or expected summary fields are missing.

## Troubleshooting

- **Docker unavailable:** start Docker Desktop or the Linux Docker daemon, then rerun `supabase start`.
- **Wrong Supabase CLI version:** install or select version `2.31.8`.
- **Safety guard refuses URL:** confirm the URL points to a local Supabase database and set `FESTIVAL_TEST_DATABASE_CONFIRMED=true` only for that isolated database.
- **Migration/RPC failures:** run `supabase db reset`, then `npm run verify:supabase-rpcs` to identify missing RPCs.
- **Concurrency failure:** inspect the uploaded `festival-runtime-diagnostics` artifact or local Supabase DB logs.

## Cleanup

Local cleanup is normally automatic inside scripts and the workflow. To force cleanup after local testing:

```bash
supabase stop --no-backup
```
