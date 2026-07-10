# Phase 2 Review

## Objective

Phase 2 was intended to turn the existing band recruitment and collaboration foundations into coherent, server-authoritative social flows without redesigning the whole band system. The focus was recruitment safety, roles/permissions for invitation management, notification deduplication, and a minimally complete invitation lifecycle that supports future collaboration work.

## PRs Completed

- **PR 01:** Established the first band recruitment safety/documentation slice and confirmed the dependency path for guarded recruitment writes.
- **PR 02:** Advanced profile/privacy and safety dependencies needed before richer recruitment expansion.
- **PR 03:** Continued dependency work for guarded social/band flows; the PR document is not present in this checkout, so details are inferred from later documentation.
- **PR 04:** Added guarded band invitation creation through `send_band_invitation`, including role checks, target privacy/block checks, duplicate pending idempotency, audit logging, and notification deduplication.
- **PR 05:** Added guarded band invitation response/cancellation through `respond_band_invitation` and `cancel_band_invitation`, including invitee identity checks, pending/final-state handling, block checks, idempotent membership creation, notification updates, and UI response states.

## Player-Facing Flows Now Available

Verified working or implemented in this repository evidence:

- **Recruitment:** Band search/browser, recruiting flags, invitation creation, and application records exist.
- **Invitations/applications:** Guarded invitation creation and guarded invitation accept/decline now exist; applications exist but still need equivalent guarded response hardening.
- **Membership lifecycle:** Accepting an invitation creates band membership server-side exactly once for the invited user.
- **Roles and permissions:** Invitation creation/cancellation uses leader/founder checks through `can_manage_band_invitations`; invitation response requires the invited authenticated user.
- **Shared schedule:** Band manager exposes gigs/history and related band operational surfaces, but no new schedule feature was added in Phase 2 PR 05.
- **Collaboration:** Band membership, chat, repertoire, finances, earnings, chemistry, and applications/invitations provide foundations; deeper contribution/goals are not complete.
- **Chemistry:** Existing chemistry display remains available; PR 05 did not change chemistry logic.

## Security and Permissions

- **Current member access:** Current leaders/founders can manage invitation creation and backend cancellation; current invited users can accept/decline their own pending invitations.
- **Former-member access:** Former members do not gain cancel rights unless they still satisfy the current backend manager helper. Former invited users can only respond as the authenticated invited user while the invitation is pending.
- **Unrelated-user access:** Unrelated users cannot respond to invitations because the RPC checks `invited_user_id = auth.uid()`.
- **Role escalation protection:** Accepting an invitation always creates role `member`; client-supplied elevated roles are not accepted by the response RPC.
- **RLS/RPC coverage:** Mutations for invitation send/respond/cancel are server-authoritative RPC paths. Direct update policies for invitation response/cancel are replaced with deny-all update policy coverage.
- **Blocking/privacy behaviour:** Invitation creation checks target opt-in and block state; invitation response blocks completion if inviter/invitee are blocked at response time.
- **Auditability:** Denied sensitive send, response, and cancellation attempts are logged through `social_action_audit_log` where the existing audit enum supports them.

## Remaining Gaps

### P0 beta blockers

- No P0 blocker remains for the minimal invitation lifecycle itself.
- Band application approval/rejection still needs the same guarded server-authoritative treatment before broader beta-scale recruitment.

### P1 high-value gaps

- Private invitation select visibility still needs a dedicated privacy review.
- Broader band permission matrix remains incomplete for finances, bookings, releases, contracts, chat moderation, applications, and announcements.
- Recruitment-specific cooldowns/rate limits beyond duplicate pending invites remain missing.
- Application response, structured auditions, and report/evidence flows remain partial or missing.

### P2 expansion work

- Recruitment search/matching by missing instruments, skill thresholds, city, genre, schedule, language, and availability.
- Canonical membership/audition history for profile and band career timelines.
- Contribution logs, band goals, richer chemistry history, achievements, and collaboration contracts.

### Accepted limitations

- PR 05 does not add rewards, contribution points, achievements, goals, chemistry changes, or a Band HQ redesign.
- Leader-side cancellation UI is not added; the backend primitive is present for a follow-up UI slice.
- Application flows are intentionally not combined into this PR.

## Test Coverage

- **Unit:** Service tests cover input validation, guarded RPC calls, backend errors, empty responses, and cancel calls.
- **Integration:** SQL migration review covers the touched RPC/RLS/idempotency behaviour; no dedicated database integration runner is configured in this checkout.
- **Browser/smoke:** Existing smoke suite should be run; no new browser automation file was added for PR 05.
- **RLS/RPC:** Covered by migration design and service contract tests; live Supabase migration validation depends on local Supabase tooling availability.
- **Untested risks:** Real database concurrency, notification metadata update shape, and blocked-pair edge cases need live database verification.

## Phase Status

**Complete with accepted limitations**

Evidence: guarded invitation creation and response/cancellation now provide an end-to-end server-authoritative invitation lifecycle. Phase 2 foundations for recruitment safety, roles, permissions, notifications, and collaboration entry are coherent enough to close, while applications, auditions, broader permissions, history, and contribution/progression remain explicitly scoped future work.

## Recommended Next Phase

**Shared band progression**

The repository now has safer membership entry points. The next highest-value phase is to make real band activity more visible and meaningful through contribution/progression primitives, while avoiding passive membership rewards.

## Recommended Next PR

- **Title:** Guarded Band Application Response MVP
- **Objective:** Move band application approval/rejection to a server-authoritative RPC.
- **Scope:** Validate leader/founder permission, applicant identity, pending status, block state, active membership conflicts, duplicate membership prevention, notification update/dedupe, audit denied attempts, and UI states for application decisions.
- **Dependencies:** Existing `band_applications`, `band_members`, profile/block/privacy helpers, notifications, and `can_manage_band_invitations` or a generalized band recruitment permission helper.
- **Risk:** Accidentally admitting duplicate members or exposing private applications to unrelated/former users.
- **Acceptance criteria:** Authorized leader/founder can approve/reject exactly once; accepted applicant becomes a member exactly once; unauthorized/ordinary/former/unrelated/blocked users cannot decide; final-state retries are safe; user-facing errors are clear.
- **Tests:** Service validation, successful approve/reject, invalid input, duplicate approval, duplicate membership, unauthenticated, unrelated, ordinary member, leader/founder, former member, blocked pair, notification dedupe, and RPC/RLS migration review.
