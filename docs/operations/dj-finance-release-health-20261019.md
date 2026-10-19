# Service-only DJ escrow release-health diagnostics — 19 October 2026

## Applied migration
`20261019130414_dj_escrow_finance_release_health_service_only_20261019` was applied directly to production Supabase project `yztogmdixmchsmimtent`. Its exact SQL has been committed from `supabase_migrations.schema_migrations`.

## Function
`public.dj_finance_release_health()` is **read-only**, `STABLE SECURITY INVOKER`, with `EXECUTE` revoked from `PUBLIC`, `anon` and `authenticated`. Only `service_role` can execute it. It returns aggregated operational counters, **no user names, financial account identities, song files, actor IDs or individual balances**. It does not alter bookings, escrow, rewards or flags.

The diagnostic covers:
- Total owner-funded DJ offers and cash currently held in offered/accepted/booked state
- Offers whose original `fund` movement differs from the promised fee
- Impossible combinations of payout/refund/held state and mismatched financial conservation
- Offers with invalid canonical booking references or contradictory terminal booking statuses
- Offered/accepted holds more than 30 minutes past expiry
- Offered/accepted resident gig holds left more than 30 minutes after the signed residency ended

The result includes `finance_invariants_clear` only as a **financial-subsystem check**, and explicitly sets `feature_flags_verified=false` and `requires_independent_media_and_release_gate=true`. It is **never a declaration that DJ/nightclub production release is ready**; it does not test audio rights, the real WebGL stage, live browser compatibility, cron jobs, fan accounting, feature-flag configuration or race conditions.

For a trusted operator with service-role access, invoke this RPC through a server-admin path or Supabase SQL dashboard. Do not expose a service key in the game client.

## Production rollback-only tests
- `supabase/tests/dj_escrow_finance_health_invariant_harness.sql`: synthetic receipt-verified owner and second DJ; held $100 escrow, exact retry, simulated **$99 funding receipt mismatch** detected as an alarm, restore $100 and return to clean health; DJ accept/cancel and second $125 offer automatically expired/refunded; health remains clear. Entire fixture `BEGIN/ROLLBACK`.
- `supabase/tests/dj_escrow_finance_health_service_role.sql`: actual Postgres `service_role` can execute and receives valid aggregate shape, `authenticated` cannot execute the RPC; public/anon grants checked. `BEGIN/ROLLBACK`.

Both tests passed directly against the live database and are now part of `scripts/gigs/run-db-gate.sh`.

## Distinct release blocker
PR #4444 repairs duplicate-university timestamp trigger and overloaded equipment COMMENT historical migration problems that prevented CI resets *before these finance tests could execute*. #4265 requires the full fresh-reset, Finance, UI, audio, WebGL and mobile sign-off before any scheduled or funded booking release flags can be enabled. This diagnostic exists to make future financial drift measurable; it is not an automatic rollout or payout mechanism.
