# Phase 3 PR 02 — Guarded Band Application Submission MVP

## Recommendation source

This PR implements the Phase 3 PR 01 recommendation to move band application creation behind a guarded server RPC before adding auditions, matching, contribution rewards, or broader recruitment redesign.

## Previous submission flow

`BandApplicationDialog` inserted directly into `band_applications` with client-supplied `band_id`, `applicant_profile_id`, instrument/vocal roles, and message. `BandProfile` hid the submit button when `bands.is_recruiting` was false, when the viewer was already in the band, or when any existing application row was found, but those were frontend checks only.

## Problem

Authenticated clients could attempt direct inserts, choose applicant profile IDs, choose status-adjacent fields by bypassing UI defaults, race duplicate clicks, and bypass server-side recruitment, block, message, notification, and audit rules.

## Implemented flow

`submit_band_application(band_id, requested_role, message)` now owns application creation. It resolves the applicant from `auth.uid()`, loads the target band, requires `bands.is_recruiting`, validates the requested instrument role and plain-text message, blocks current active target-band members, checks block relationships against leader/founder recruitment managers, returns an existing pending application on retry, creates one pending row, notifies recruitment managers once, and writes audit records without message contents.

The application dialog calls the RPC through `submitBandApplication`, validates before submit, disables controls while saving, reports backend errors, invalidates application/band queries, and updates the page into an `Application Pending` state after success.

## RPC contract

```sql
submit_band_application(
  band_id uuid,
  requested_role text default 'Guitar',
  message text default null
)
returns public.band_applications
```

The RPC does not accept applicant IDs, user IDs, status, membership role, or band ownership data from the client.

## Eligibility rules confirmed

- Band application submission uses the existing `bands.is_recruiting` flag as the application-open check.
- Existing UI allowed empty messages, so the RPC stores empty/whitespace-only messages as `NULL`.
- Existing one-band global membership rules were not present for applications; this PR preserves that ambiguity and only denies active membership in the target band.
- Existing role-specific vacancy data was not found; requested role remains a preference stored in `instrument_role`.
- Existing application visibility remains applicant self-view plus leader/founder band application view.

## Files changed

- `supabase/migrations/20260710234000_guard_band_application_submission.sql`
- `src/services/bandApplications.ts`
- `src/services/__tests__/bandApplications.test.ts`
- `src/components/band/BandApplicationDialog.tsx`
- `src/components/band/BandApplicationDialog.test.tsx`
- `src/pages/BandProfile.tsx`
- `docs/social/implementation/PHASE_3_PR_02.md`
- `docs/social/SOCIAL_SYSTEM_AUDIT.md`
- `docs/social/SOCIAL_MMO_EXPANSION_PLAN.md`

## Database changes

A corrective migration is required because the historical insert policy allowed direct authenticated inserts. The migration adds submission audit enum values, replaces the broad insert policy with a deny-all insert policy, adds a partial unique index for one pending application per applicant/band, adds an applicant/status lookup index, relaxes the old all-history uniqueness by dropping the table-level `(band_id, applicant_profile_id)` constraint, and adds a message length/trim check.

## Permission model

Only authenticated users with an active profile can execute the RPC. The server resolves the applicant profile from `auth.uid()`, checks target-band recruitment state, rejects target-band active members, validates fields, and checks block relationships against known recruitment managers. Frontend checks remain advisory.

## Notification behaviour

A valid new application creates manager notifications for leader/founder recruitment managers and the band `leader_id` owner profile when present. Notifications route to `/bands/:bandId?tab=applications`, contain application/band/applicant IDs only, and are deduped by `band_application_id`. Retries returning an existing pending application do not create duplicate manager notifications.

## Audit behaviour

Successful submissions, duplicate retries, invalid band attempts, missing bands, closed recruitment, invalid roles, malformed/overlong messages, and block denials are written to `social_action_audit_log`. Application message contents are not logged.

## Rate-limit/cooldown handling

This MVP adds a beta-safe idempotency foundation rather than a broad rate-limit framework: one active pending application per applicant and band, with repeat submissions returning the existing row. No historical rejected/accepted cooldown was invented.

## Automated tests

Service tests cover valid submission, invalid band ID, unsupported role, HTML/overlong message validation, backend failure, empty RPC responses, and the existing response RPC. UI tests cover guarded submission, success state callback, validation feedback, disabled saving controls, and backend error feedback.

## Manual verification

Recommended checks: eligible solo applicant, applicant already in target band, applicant in another band, recruiting open/closed bands, blocked applicant/manager pair, duplicate rapid clicks, valid message, invalid/overlong message, and mobile/desktop dialog layouts.

## Known limitations

- No structured auditions, matching, applicant scoring, reputation, or social rewards were added.
- No role vacancy schema was found, so role-specific capacity is not enforced.
- No global one-band application/member restriction was found; product should decide whether applicants may apply while in another band.
- Application withdrawal remains outside this PR.
- Local database migration validation still requires a Supabase database toolchain.

## Recommended Phase 3 PR 03

Implement safe application withdrawal/cancellation and recruitment manager application views around the guarded submission/response lifecycle, or define explicit role vacancy and one-band membership rules before auditions.
