# Finance A4 — Executable Verification and E2E Closure Audit

## Scope

A4 turns the existing finance workflow into an executable release gate for the completed A1–A3 finance/booking work.

## Gate coverage

The `Finance verification` workflow now requires:

- dependency-lock integrity and clean `npm ci`;
- local Supabase startup and full migration reset;
- database lint;
- all Supabase SQL tests;
- an explicit finance reconciliation gate;
- generated Supabase type parity;
- TypeScript typecheck;
- frontend lint;
- unit tests;
- production build;
- a dedicated finance Playwright browser/contract suite.

The finance-only portions can also be reproduced locally with:

- `npm run test:finance:db` after a local Supabase reset and `SUPABASE_DB_URL` export;
- `npm run test:e2e:finance` for the dedicated Playwright suite.

The database runner treats both SQL exceptions and a false (`f`) contract assertion as failures, so the older finance harnesses cannot silently pass by returning an unsuccessful boolean row.

## Reconciliation checks

`supabase/tests/finance_a4_reconciliation_gate.sql` fails the release gate if it finds:

- impossible band treasury balances/reservations;
- booking refunds larger than their original payment;
- refunds that do not match the original booking, source, amount, or currency;
- duplicate obligation attempt numbers;
- duplicate open debts for one obligation schedule line;
- invalid negative obligation aggregate state;
- stale active mortgage obligation schedule versions.
- loan line component overpayments and invalid payment aggregates;
- loan outstanding principal that differs from the active contract schedule;
- provider receivable, income, fee, or settlement-clearing ledger differences.

## Browser/contract checks

The finance Playwright suite verifies that:

- rehearsal booking presents an explicit payer and authoritative treasury balance;
- readable insufficient-funds and treasury-missing handling remains wired;
- recording uses the atomic booking RPC;
- rehearsal and recording cancellation RPCs remain present;
- refunds remain source-aware and replay-safe;
- obligation retry/idempotency guards remain in the migration contract;
- mortgage schedule-version synchronisation remains wired;
- missing treasury recovery creates only an empty treasury and cannot manufacture funds.

A dedicated `playwright.finance.config.ts` is used because the repository's main Playwright config intentionally scopes tests to `tests/gig-experience`.

## Closure rule

A4 must not be marked `COMPLETE` until the Finance verification workflow on the A4 pull request has completed successfully. Until then the backlog status is `NEEDS VERIFICATION`.
