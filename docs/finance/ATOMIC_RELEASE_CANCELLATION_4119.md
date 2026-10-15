# #4119 — Guarded, exactly-once release cancellation

**Prepared for review only, 15 October 2026. No production DDL, data, treasury credits, or scheduled job changes performed.**

## Why another repair is necessary

After PR #4154, the release-cancellation dialog no longer posts a *second* direct band-balance refund, but it still made **two independent browser requests**: insert an earnings refund, then set the release to cancelled. Concurrent requests or a partial failure could create duplicate refunds. The client also calculated the refund using `releases.total_cost`, which is **not an authoritative statement of the band's actual payment**.

Read-only production evidence on 15 October:
- Seven existing releases, all already **released**; none is currently eligible for pre-release cancellation.
- Thirty-five release cost receipt rows: 31 band-paid and 4 label-paid; 12 have fractional major-unit costs.
- The 35 receipts have no linked `ledger_transaction_id`, so that reference cannot establish payout provenance by itself.
- Thirty negative `band_earnings` entries with source `release`, of which 28 include a `release_id` reference; two older entries are not linked.
- The live `update_band_balance_from_earnings()` trigger was still the unsafe SUM-based implementation when audited. Installing this RPC alone will not repair that trigger.

## Proposed server authority

SQL: `supabase/production-repairs/20261015_atomic_release_cancellation_MANUAL_ONLY.sql`.

- One authorized call `cancel_release_atomic(p_release_id uuid)` locks the release row and commits its status transition and journal refund in a single transaction, or rolls everything back.
- It requires an authenticated current active character. For band releases, that character must be an active member and either the original account creator or current band leader. It never trusts browser `total_cost`, `band_id`, or a client-supplied refund.
- A previously cancelled release is **idempotent** and cannot pay again. Already released, sold, or completed manufacturing releases are rejected.
- It verifies the band-paid cost receipts against the linked original `band_earnings` charges, refusing mismatches, missing evidence, cent/whole-unit discrepancies, any label-paid or legacy-unknown receipts, or a refund already recorded by the old client.
- It refuses all new payments while the production SUM-based earnings trigger remains in place.
- A partial unique index on `band_earnings` enforces at most one canonical `release_cancellation_refund` for each release, even if another caller attempts a second posting.
- Its security-definer function has `search_path = ''`, explicit `public.` references, `PUBLIC` / `anon` execution revoked, and `authenticated` execution granted.
- The browser calls **only** the RPC and displays the returned verified refund amount. It never independently updates `releases` or `band_earnings`.

## Deliberate fail-closed limitations

1. **Label-funded or mixed-payer releases** require an explicit approved label-refund policy and audited label finance ledger integration before support. Never credit the band's wallet for costs paid by a label.
2. **Fractional cents/major-unit mismatch** or unlinked legacy deductions block automatic refunds. Reconciliation is case-by-case; do not round, approximate, invent missing ledger records, or credit historical balances automatically.
3. Direct authenticated updates to `releases.release_status` and direct inserts into `band_earnings` are still permitted by legacy RLS for some members; a wider authority/RLS migration is needed for complete anti-spoofing. This RPC is not a blanket permission fix.
4. Manufacturing/refund policy remains conservative: cancellation after production completes or sales have begun is disallowed.

## Required staging and release order

1. Verify a restorable PITR/backup and **restore production schema into sanitized staging**, including current financial triggers and helper RPCs. Supabase had no staging branches visible at the prior audit.
2. Resolve merged-PR CI typecheck blocker (#4156), inspect failing baseline SQL stack startup, and run full typecheck/contract suites.
3. Validate and apply the incremental earnings-trigger repair from #4124 **in staging only**, including BOTB single credit, booking-cost preservation, concurrent earnings and rollback/underflow cases.
4. Apply the manual cancellation SQL in staging. Verify authorization with ordinary member, leader, creator, different active character and unauthenticated JWTs; verify no valid client-supplied refund amount can influence settlement.
5. Exercise pre-release manufacturing with exact-matching band receipts, zero-cost drafts, cancelled retries and concurrent requests, already released, completed manufacturing, label-paid, unknown legacy, fractional costs, other-earning sources, previously refunded legacy row and unlinked expense cases. Ensure rejected cases change no money or release status.
6. Only after approval and a production recovery checkpoint: coordinate scheduled writers, install the incremental earnings trigger in one approved transaction and verify. Then install the cancellation RPC SQL while the old UI remains active only in a controlled maintenance window. **Immediately deploy the new UI**, removing the legacy two-request path. Maintain the order: DB RPC before new UI; incremental trigger before RPC.
7. Confirm `to_regprocedure('public.cancel_release_atomic(uuid)')` exists, anon cannot execute, active authenticated users can call within authorized scope, historical release and band balances remain unchanged, and no extra refunds are issued on retry.
8. Keep #4119 open pending broader payroll/treasury unification and security review. Do not enable weekly payroll based solely on this release-cancellation change.

This SQL is a **manual-only forward change** outside the timestamp-collision migration queue. Do not automatically replay through `supabase db push`.
