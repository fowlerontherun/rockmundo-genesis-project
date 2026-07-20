# Finance Phase 8B.8 Rehearsal Funding Execution Audit

Date: 2026-07-20

## Workflow inspection

The finance verification workflow existed but was not proven successful locally before this PR. This PR records the executable intent and tightens reproducibility:

- Node is pinned to `20.19.0`.
- Supabase CLI is pinned to `2.31.8` instead of `latest`.
- Generated Supabase types are generated to `/tmp/supabase-types.ts` and compared against `src/integrations/supabase/types.ts`.
- The finance browser E2E rehearsal spec is mandatory; a missing `tests/finance/rehearsal-funding.spec.ts` fails CI.

## Current path audit

The legacy client path in `useRehearsalBooking` created `band_rehearsals` from browser-provided cost, then debited band funds separately. That meant the browser supplied the rehearsal amount and the booking/payment sequence was not atomic.

The Phase 8B.8 database path adds server-side rehearsal funding RPCs:

1. `preview_rehearsal_booking_funding` derives room, duration, price, currency, destination account and balances server-side.
2. `confirm_rehearsal_booking_with_funding` recalculates the descriptor, posts funding through `resolve_and_pay_band_expense_internal`, creates the rehearsal, links payment rows, and returns the booking/payment identifiers.
3. `resolve_and_pay_band_expense_internal` now accepts only a trusted descriptor id, not browser amount/currency/destination input.

## Local command results

Commands run during this PR are recorded in the PR summary. Supabase reset/lint/db tests require the local Supabase stack and Docker to be available.
