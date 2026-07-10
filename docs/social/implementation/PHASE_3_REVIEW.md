# Phase 3 Review

## Objective

Phase 3 was intended to make band recruitment safe enough for beta by moving invitations and applications behind guarded RPCs, preserving applicant and manager history, normalizing recruitment notifications, and proving RLS/RPC access with repeatable automated coverage.

## Recruitment Lifecycle

- **Submission:** Implemented through `submit_band_application`; eligible authenticated applicants can submit to recruiting bands, retries are idempotent, direct inserts are denied, messages are validated, and blocked applicant/manager pairs are denied.
- **Approval:** Implemented through `respond_band_application`; current leader/founder approval transitions a pending application to accepted and creates one safe member-role membership.
- **Rejection:** Implemented through `respond_band_application`; current leader/founder rejection transitions to rejected and creates no membership.
- **Withdrawal:** Implemented through `withdraw_band_application`; applicants can withdraw their own pending rows, final-state retries are safe, and direct updates are denied.
- **Notification state:** Recruitment notifications carry status metadata, do not expose application messages, and final-state notifications are displayed as non-actionable.
- **Applicant history:** Applicants can see their own pending and final applications; pending owned rows expose withdrawal and final rows are read-only.
- **Manager history:** Current leaders/founders can see newest applications for their band; pending rows expose approve/reject and final rows are read-only.

## Security Verification

- **RLS:** The PR 05 harness verifies applicant self-select, current manager select, ordinary/former/unrelated denial, anonymous denial, and direct-write prevention.
- **RPC permissions:** Submission, response, and withdrawal RPCs are exercised with eligible and ineligible roles.
- **Former-member access:** A defect was found and fixed so inactive former leaders no longer inherit manager application visibility.
- **Unrelated-user access:** The harness verifies unrelated authenticated players and managers of other bands cannot read private applications.
- **Direct-write prevention:** Direct insert and direct update attempts are denied.
- **Role escalation protection:** Approval creates a default `member` membership; applicants cannot pass elevated roles to the response flow.
- **Block handling:** Submission and response block checks are verified through deterministic blocked-pair fixtures.

## Test Coverage

- **Unit tests:** Recruitment status mapping and notification route normalization cover pending/final/fallback states, stale routes, missing routes, and invitation preservation.
- **Integration tests:** `supabase/tests/recruitment_rls_harness.sql` covers RLS, guarded RPCs, idempotency, notification dedupe, message privacy, and membership integrity.
- **Browser/smoke tests:** No Playwright authenticated fixture exists; route safety is covered at the notification model layer and existing component tests cover visible recruitment controls.
- **Uncovered risks:** Full browser navigation with live auth, concurrent approval/withdraw races against a real hosted database, and future global one-band product rules remain uncovered.

## Remaining Product Decisions

- One-band membership rule.
- Role-specific vacancies.
- Recruitment cooldowns.
- Auditions.
- Matching.
- Applicant scoring.

## Remaining Gaps

- **P0 beta blocker:** None identified after the former-member RLS corrective migration, assuming the database harness passes in local Supabase.
- **P1 high value:** Browser-level authenticated recruitment smoke tests; explicit global one-band membership/application policy; CI database-test job.
- **P2 expansion:** Vacancies, auditions, matching, cooldowns, applicant scoring, and recruitment rewards.
- **Accepted limitation:** No broad band permission matrix beyond recruitment leader/founder checks.

## Phase Status

Complete with accepted limitations

## Recommended Next Phase

Shared band contribution/progression.

## Recommended Next PR

- **Title:** Band Contribution Event Log MVP
- **Objective:** Start turning band cooperation into visible, server-authoritative contribution history.
- **Scope:** Add contribution event table/RPC helpers for existing band actions, read-only member-visible summaries, and no rewards yet.
- **Dependencies:** Phase 3 guarded recruitment and current band membership checks.
- **Risk:** Medium; contribution data can become politically sensitive if privacy and manager/member visibility are too broad.
- **Acceptance criteria:** Active members can view their band's contribution summary; former/unrelated users cannot; events are written server-side only; no production data dependency; no reward calculations.
- **Tests:** Unit mapping tests, SQL RLS tests for contribution visibility, and component tests for empty/error/read-only states.
