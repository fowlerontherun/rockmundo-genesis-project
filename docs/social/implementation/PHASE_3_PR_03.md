# Phase 3 PR 03 — Safe Band Application Withdrawal MVP

## Recommendation source

This PR implements the Phase 3 PR 02 recommendation to close the applicant-side lifecycle gap after guarded band application submission and guarded manager approval/rejection were added.

## Previous lifecycle

Applicants could submit a pending application through `submit_band_application`, and managers could approve or reject through `respond_band_application`. Applicants could see a pending application on the band profile, but there was no safe applicant-owned withdrawal RPC or UI action. Direct table updates were already denied by RLS, so withdrawal was effectively missing rather than safely implemented.

## Implemented withdrawal flow

Applicants now withdraw with `withdraw_band_application(application_id)`. The band profile shows the applicant's application status, band name, submitted date, and requested role. Pending applications owned by the active profile expose a confirmation-protected **Withdraw application** action. Success replaces the pending state with `withdrawn`, invalidates relevant band/application queries, and removes the active withdrawal control.

## Status used

The existing repository vocabulary already uses `withdrawn` for player-initiated withdrawals in adjacent lifecycle tables. This PR extends `band_applications.status` with `withdrawn` rather than inventing a new `cancelled` state. Accepted and rejected rows remain final and historical.

## RPC contract

```sql
withdraw_band_application(application_id uuid)
returns public.band_applications
```

The RPC requires an authenticated user with a profile, resolves the acting profile from `auth.uid()`, locks the application row with `FOR UPDATE`, verifies the row belongs to the acting applicant, requires `status = 'pending'`, updates the status to `withdrawn`, preserves the row, and returns the final application row. It never accepts applicant, band, user, status, or membership data from the client.

## Files changed

- `supabase/migrations/20260710235500_guard_band_application_withdrawal.sql`
- `src/services/bandApplications.ts`
- `src/services/__tests__/bandApplications.test.ts`
- `src/pages/BandProfile.tsx`
- `docs/social/implementation/PHASE_3_PR_03.md`
- `docs/social/SOCIAL_SYSTEM_AUDIT.md`
- `docs/social/SOCIAL_MMO_EXPANSION_PLAN.md`

## Database changes

A corrective migration adds the `withdrawn` band application status, adds narrow withdrawal audit enum values, creates the `withdraw_band_application` `SECURITY DEFINER` RPC with `SET search_path = public`, and grants execution to authenticated users. Existing direct insert/update denial policies remain in place, and the pending-only unique index continues to allow future applications after withdrawal because withdrawn rows no longer satisfy `status = 'pending'`.

## Permission model

Only the applicant who owns the application row can withdraw it. Band leaders, founders, ordinary members, former members, unrelated users, and other applicants are denied by the RPC even if the frontend is bypassed. The RPC does not modify `band_members`, so withdrawal cannot create or remove membership.

## Notification behaviour

Withdrawal does not create a new manager notification. It resolves/updates existing application notifications by marking them read where supported and adding metadata that the application is `withdrawn` and no longer actionable. The private application message is not included in notification metadata.

## Audit behaviour

Successful withdrawal writes `band_application_withdrawn`. Missing-row, wrong-applicant, and final-state withdrawal attempts write `band_application_withdraw_denied` where an actor profile is available. Application messages are never logged.

## Concurrency and idempotency handling

The RPC locks the application row before checking state. Two rapid withdrawal calls result in one transition; a retry against an already withdrawn row returns the withdrawn row without duplicate audit or notification side effects. A race with approval/rejection leaves exactly one final state because both RPCs lock the same row and only pending rows can transition.

## Automated tests

Service tests cover valid withdrawal, invalid application IDs, backend failure, and empty RPC responses. Existing manager UI tests continue to cover final-state rows without approve/reject controls.

## Manual verification

Recommended manual checks: applicant with pending, accepted, rejected, and withdrawn applications; unrelated player; band leader; ordinary member; former member; two rapid withdrawal clicks; near-simultaneous withdrawal and approval; mobile and desktop band profile layouts.

## Known limitations

This PR does not add auditions, role vacancies, matching, recruitment cooldowns, social rewards, broader manager dashboards, or a global one-band membership product rule. Historical manager views remain intentionally minimal.

## Recommended Phase 3 PR 04

Recommended next PR: **Recruitment Notification Actionability and History Polish**. Tighten notification routing/display for final-state application rows and add narrow applicant/manager history presentation without introducing auditions, vacancies, matching, or broader permission redesign.
