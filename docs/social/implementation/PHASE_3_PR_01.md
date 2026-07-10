# Phase 3 PR 01 — Guarded Band Application Response MVP

## Recommendation source

This PR implements the Phase 2 review recommendation to harden band application approval/rejection before shared band progression work begins. Phase 2 closed the invitation lifecycle with guarded RPCs and identified applications as the remaining recruitment prerequisite.

## Current application flow

Before this PR, players submitted applications directly into `band_applications` from the application dialog. The manager list selected pending applications by `band_id` and `status = pending`. Approving directly updated `band_applications.status`, inserted `band_members` from the client, then performed a second client query/update to backfill `user_id`. Rejecting directly updated the application row. No server-authoritative approval/rejection RPC guarded pending status, role authorization, block state, duplicate membership, notifications, or audit logging.

## Problem

The previous response path trusted client-side band/application/member data and split approval across multiple writes. Rapid clicks, stale data, ordinary-member access, blocked pairs, existing membership conflicts, and final-state retries could produce raw errors or inconsistent state.

## Implemented flow

`respond_band_application(application_id, decision)` now owns application approval and rejection. It resolves the acting profile from `auth.uid()`, locks the application row, verifies the application exists and is pending, checks that the actor can manage recruitment for the band, rejects applicant self-approval, checks block state, verifies the applicant profile maps to a user, creates exactly one safe default `member` membership on approval, updates the application final state atomically, sends one applicant notification, and records audit entries.

The UI now calls the guarded service instead of direct table updates/inserts, shows current status, disables controls while saving, keeps final-state rows read-only, and invalidates application/member/band data after success.

## RPC contract

```sql
respond_band_application(application_id uuid, decision text)
returns public.band_applications
```

Accepted decisions are `approve`, `approved`, `accept`, `accepted`, `reject`, and `rejected`; the frontend sends only `approve` or `reject`. Approval maps to existing status `accepted`; rejection maps to existing status `rejected`.

Controlled errors are returned for unauthenticated users, invalid IDs, invalid decisions, missing applications, non-pending conflicting final states, unauthorized actors, self-approval attempts, blocked applicant/manager relationships, missing applicant users, duplicate active band membership, and membership creation failures. Repeating the same final-state decision returns the final row without duplicating membership or notifications.

## Files changed

- `supabase/migrations/20260710232000_guard_band_application_responses.sql`
- `src/services/bandApplications.ts`
- `src/services/__tests__/bandApplications.test.ts`
- `src/components/band/BandApplicationsList.tsx`
- `src/components/band/BandApplicationsList.test.tsx`
- `docs/social/implementation/PHASE_3_PR_01.md`
- `docs/social/SOCIAL_SYSTEM_AUDIT.md`
- `docs/social/SOCIAL_MMO_EXPANSION_PLAN.md`

## Migration and database changes

A corrective migration is required because historical policies allowed direct leader updates and no guarded response RPC existed. The migration adds narrow application-response audit enum values, application/member lookup indexes, tightens `can_manage_band_invitations` so inactive/former membership rows do not grant recruitment power, creates `respond_band_application` with `SECURITY DEFINER` and `SET search_path = public`, grants execute to authenticated users, and replaces direct application update policy with a deny-all update policy so decisions must use the RPC.

No historical migration was edited. Existing lifecycle statuses are preserved: `pending`, `accepted`, and `rejected`.

## Permission model

- Authenticated users with an active profile are required.
- Band `leader_id`, current leader membership, and current founder membership may decide applications.
- Ordinary members, inactive/former members, unrelated users, unauthenticated users, and applicants themselves cannot decide applications.
- The RPC does not trust client-supplied band IDs, applicant IDs, status, role, or membership data.
- The frontend still hides controls behind the existing manager context, but backend checks are authoritative.

## Notification behaviour

Approval creates one `band_request` notification telling the applicant they joined the band and routes to `/bands/:bandId`. Rejection creates one respectful declined notification with the same route. Notification dedupe uses the application id and final status in metadata, so repeated same-state calls do not create duplicate notifications.

## Audit behaviour

Approved and rejected outcomes are recorded in `social_action_audit_log`. Denied unauthorized/self/block attempts and duplicate same-state retries are also logged with minimal metadata. Application messages and private profile details are not logged.

## Automated tests

Service tests cover valid approval, valid rejection, invalid application IDs, invalid decision values, backend failures, and empty backend responses. UI tests cover application details, approval and rejection calls, saving/disabled controls, error toast feedback, and final-state rows without active controls.

The SQL migration is designed to cover permission, integrity, notification, audit, and RLS/RPC acceptance criteria; live database concurrency requires Supabase migration validation in an environment with the local database toolchain available.

## Manual verification

Recommended scenarios:

- Band leader approves and rejects pending applications.
- Band founder approves and rejects pending applications.
- Ordinary member, former member, unrelated player, unauthenticated user, and applicant cannot decide.
- Blocked manager/applicant pair cannot decide.
- Applicant already in the band cannot be approved again.
- Two rapid approval actions create one membership and one notification.
- Mobile and desktop member-tab layouts keep controls reachable and final-state rows read-only.

## Known limitations

- Application creation remains a direct insert path and should receive a separate guarded submission RPC before broader scale.
- Structured auditions, recruitment cooldowns/rate limits, advanced matching, and contribution/progression rewards remain out of scope.
- Broader band permission matrices for non-recruitment systems remain unresolved.
- Live concurrency behaviour should be verified against a real Supabase database.

## Recommended Phase 3 PR 02

Recommended next PR: **Guarded Band Application Submission MVP**. Move application creation into a server-authoritative RPC that validates recruiting/applications-open state, applicant eligibility, privacy/block state, duplicate pending applications, message length, role values, notification dedupe for managers, and rate-limit hooks without adding auditions or matching.
