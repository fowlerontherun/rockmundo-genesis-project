# Phase 2 PR 05 — Guarded Band Invitation Response MVP

## Selected recommendation

Implemented the `PHASE_2_PR_04.md` recommendation: migrate band invitation response/acceptance to a guarded RPC that validates invitee identity, pending status, block state, membership conflicts, duplicate membership prevention, notification updates, and idempotent accept/decline/cancel behaviour.

## Audit evidence

`SOCIAL_SYSTEM_AUDIT.md` identified band recruitment as implemented but partial. Invitation creation had been migrated to `send_band_invitation`, while invitation responses still used legacy client-side updates and member inserts.

## Dependency from PR 04

PR 04 completed server-authoritative invitation creation and explicitly listed guarded invitation response/acceptance as the next dependency-aware PR.

## Problem

Players could receive invitations, but response was split between direct client updates to `band_invitations` and direct inserts into `band_members`. That made duplicate action retries, stale notifications, blocked pairs, and unauthorized response attempts harder to reason about.

## Previous behaviour

- The pending invitation card queried pending invitations directly.
- Accepting updated `band_invitations` directly, then inserted `band_members` directly.
- Declining updated `band_invitations` directly.
- Notification state was not updated by the response flow.
- Duplicate acceptance could surface raw membership constraint errors.

## Implemented behaviour

- Added `respond_band_invitation(invitation_id, response_status)` for accept/decline.
- Added `cancel_band_invitation(invitation_id)` for leader/founder cancellation.
- The response RPC resolves the active profile from `auth.uid()`, verifies the authenticated invitee, locks the invitation row, enforces pending/final-state transitions, blocks blocked-pair completion, creates membership idempotently, and marks related invitation notifications as read with status metadata.
- The cancel RPC uses the existing `can_manage_band_invitations` helper and only cancels pending invitations.
- Legacy direct invitation-update policies are replaced with a deny-all update policy so response/cancel paths must use the guarded RPCs.
- The band invitation UI now uses the guarded response service, queries invitations by authenticated user id, and shows loading, empty, pending/disabled, success, and error states.

## Complete user flow

1. A signed-in invited player opens Band Manager.
2. Pending invitations appear in the Band Invitations card, including band name, genre, role, and message.
3. The player chooses Accept or Decline.
4. The service validates the invitation id and action before calling the RPC.
5. The RPC authoritatively applies the response, creates membership once when accepted, and updates the invitation notification.
6. The UI disables response buttons while pending, shows toast success or clear errors, and refreshes invitation/member/band queries.
7. A band leader/founder can cancel a pending invitation through the new backend primitive when UI support is added.

## Files changed

- `supabase/migrations/20260710231000_guard_band_invitation_responses.sql`
- `src/services/bandInvitations.ts`
- `src/services/__tests__/bandInvitations.test.ts`
- `src/components/band/BandInvitations.tsx`
- `src/pages/BandManager.tsx`
- `docs/social/implementation/PHASE_2_PR_05.md`
- `docs/social/implementation/PHASE_2_REVIEW.md`
- `docs/social/SOCIAL_SYSTEM_AUDIT.md`
- `docs/social/SOCIAL_MMO_EXPANSION_PLAN.md`

## Database changes

A migration is required. It adds:

- `band_invitation_response_denied` and `band_invitation_cancel_denied` audit enum values.
- `band_members_profile_band_idx` for profile/band membership lookups.
- `respond_band_invitation(uuid, text)` with safe `search_path`.
- `cancel_band_invitation(uuid)` with safe `search_path`.
- A deny-all update policy replacing legacy direct invitation response/cancel update policies.

## Permission model

- Invite responses require `auth.uid()` and an active profile.
- Only the invited authenticated user can accept or decline.
- Only users passing `can_manage_band_invitations` can cancel.
- Blocked inviter/invitee pairs cannot complete pending invitations.
- Unrelated users, ordinary non-manager members, and former members cannot mutate invitations unless they are the invited user for response.

## Contribution/progression model

No rewards, chemistry, achievements, contribution points, or progression currency are added. Accepted invitations only create the membership state required for collaboration.

## Notifications

Related `band_request` notifications are marked read and annotated with `band_invitation_status` when accepted, declined, or cancelled. No routine response-notification fanout is added, avoiding spam.

## Analytics

No new analytics platform was added. Denied response/cancel attempts are recorded in `social_action_audit_log` where existing audit infrastructure supports it.

## Automated tests

Service tests cover:

- valid send normalization;
- invalid target id;
- overlong message rejection;
- guarded send RPC calls;
- valid response normalization;
- invalid response status;
- invalid invitation id before backend calls;
- guarded accept RPC calls;
- backend/final-state error surfacing;
- empty backend response handling;
- guarded cancel RPC calls.

## Manual verification

Recommended manual cases:

- Invited player accepts a pending invitation and appears in the band exactly once.
- Invited player declines a pending invitation.
- Duplicate accept/decline retry returns safe final state or clear final-state error without duplicate membership.
- Unauthenticated user cannot respond.
- Unrelated player cannot respond.
- Former member cannot cancel unless still a current leader/founder by backend rules.
- Ordinary member cannot cancel.
- Leader/founder can cancel pending invites via RPC.
- Blocked inviter/invitee pair cannot complete a pending invite.
- Solo player without invitations sees the empty invitation state.
- Mobile and desktop layouts keep action buttons reachable.

## Known limitations

- The leader cancellation RPC is backend-ready, but existing leader-side pending-invite management UI remains a follow-up.
- Band applications still need a similar guarded response flow.
- Broader recruitment rate limits, auditions, and structured search remain unresolved.
- Invitation select visibility remains broader than ideal in older policies and needs a separate privacy review.

## Phase 2 closure outcome

Phase 2 is **Complete with accepted limitations** for the initial band recruitment, roles, permissions, and collaboration foundations. Invitation creation and response now have guarded server-side primitives; role/permission foundations exist for this flow; broader applications, auditions, richer permission matrices, and collaboration progression remain later work.

## Recommended next phase and PR

Recommended next phase: **Shared band progression**.

Recommended next PR: **Guarded Band Application Response MVP** — migrate band application approval/rejection to a server-authoritative RPC using the same permission, block, duplicate-membership, notification, and idempotency patterns established for invitations.
