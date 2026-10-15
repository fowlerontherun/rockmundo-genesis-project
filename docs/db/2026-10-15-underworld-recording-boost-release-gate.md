# #4072 — First timed Underworld recording-quality booster (manual release gate)

Scope: the one existing cash-priced **Stolen Studio Time** product (24 hours,
`{"recording_quality_boost":35}`). Other 17 timed boosters, mixed-effect
products, token purchases, collectibles and XP/skill grants remain blocked.

## Current deployed contract / production safeguards

This PR includes a **manual-only** SQL repair in
`supabase/production-repairs/20261015_underworld_recording_quality_boost_first_slice.sql`.
It does **not** run automatically with `supabase db push`. The SQL preserves
the currently deployed 7 safe instant consumables, persistent prison checks,
stable purchase UUID replay, cash-journal correlation, and paid-only arrest.
It snapshots `purchased_duration_hours` and keeps
`underworld_purchases.expires_at` NULL until successful consumption.

Only cash purchases with an exact single integer
`recording_quality_boost` value 1..50 and duration 1..72 hours are accepted.
A profile-owned paid purchase can be consumed once, inserting one active
`player_active_boosts` with `source_purchase_id`. Boosts expire at
consumption time + frozen hours. The partial unique
`underworld_boost_effect_once_per_purchase` prevents repeat grants.

The recording worker uses booked performers' profile IDs, verifies boost
provenance, effect bounds and the interval containing the scheduled
recording end. The strongest single boost is used (no stacking). It enhances
the canonical 0..1000 final-master-quality outcome, capped at 1000, and
persists the applied purchase ID/percentage in the trusted outcome breakdown.
No additional cash or XP is awarded. Previously recorded songs are untouched.

## Release order (no surprise player debits)

1. Verify a production backup and clone/staging environment. Confirm no newer
   RPC overrides. Run the SQL on staging, checking the MD5 preflight and one
   catalog row. If the preflight rejects drift, **rebase the snapshot** rather
   than removing checks.
2. In staging, exercise a real authenticated **test-profile** owner purchase
   and consume, with balances/journal/stock/boost counts before and after.
   Test replay after timeout/remount, concurrent claims, double consumption,
   existing instant consumables, active imprisonment, cross-account denial,
   insufficient funds, malformed effects, gift/legacy records, no stacking
   and expiry. Roll back or clean up test fixtures.
3. Deploy the SQL to production in an approved manual DB window (after
   backup). Then deploy `complete-recording-sessions` and verify the
   35% boost on a controlled test recording with a booked performer.
   Validate quality cap and lack of duplicate XP on retries.
4. Only after backend checks pass, build the frontend with
   `VITE_UNDERWORLD_RECORDING_BOOSTS_ENABLED=true`. This explicit flag is
   **off by default**, so a code merge alone never enables purchases.
5. Observe failed purchase attempts and paid receipts; rollback quickly by
   turning the frontend flag off and disabling the product in the catalog.
   Do not drop columns, delete payments, or retroactively award boosts.

Suggested tests:
`src/pages/__tests__/underworldRecordingQualityBoost.contract.test.ts`,
`src/pages/__tests__/underworldSafePurchaseEligibility.contract.test.ts`,
`supabase/functions/_shared/recordingUnderworldBoost.test.ts`.

**This PR does not claim production deployment, real-player testing or a
completed rollout.** Keep #4072 open for the remaining catalog categories
and migration reconciliation.
