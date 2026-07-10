# Phase 2 PR 03 — Guarded Band Invitation Creation

## Selected recommendation

Implemented the **Recommended Phase 2 PR 03** from `PHASE_2_PR_02.md`: migrate band invitation creation to a server-authoritative RPC that checks inviter permission, target privacy/block state, duplicate pending invitations, active membership, valid leadership, notification deduplication, and actionable routes.

## Audit evidence

`SOCIAL_SYSTEM_AUDIT.md` identified band recruitment as present but only partially guarded. Existing invitations supported roles, messages, statuses, and invitee responses, but the audit flagged broad invitation visibility, inconsistent leader checks, missing block awareness, missing anti-spam foundations, and incomplete recruitment safety before auditions or richer recruiting could be added.

## Dependency from PR 02

Phase 2 PR 02 completed public-safe profile detail reads. That made it safe to use player profile links as recruitment entry points without exposing broad raw profile state. This PR builds on that by guarding the first recruitment write: creating a band invitation.

## Problem

Band leaders and managers needed a reliable way to invite another musician without trusting client-supplied inviter IDs, band IDs, target user IDs, duplicate invite state, privacy settings, or block state. The old client insert path could attempt invitations directly against `band_invitations` and did not consistently dedupe notifications or centralize permission checks.

## Previous behaviour

- `PlayerProfile` inserted directly into `band_invitations` with client-supplied `band_id`, `inviter_user_id`, and `invited_user_id`.
- `InviteFriendToBand` inserted directly into `band_invitations` from the client.
- Friend selection hid existing members and pending invitees in the UI, but the backend was not the authoritative guard.
- Invitation notification creation depended on realtime listeners rather than an idempotent creation step tied to the write.

## Implemented behaviour

- Adds `can_manage_band_invitations(target_band_id, actor_profile_id)` to centralize the first invite-permission check around band leadership and existing manager/officer roles.
- Adds `send_band_invitation(...)` as a `SECURITY DEFINER` RPC with a safe `search_path`.
- Resolves the actor from `auth.uid()` and the active profile server-side.
- Accepts a target profile ID and resolves the invitee user ID server-side.
- Validates band, target player, instrument role, optional vocal role, and optional message length.
- Checks inviter permission, target invite opt-in, shared block state, current band membership, and duplicate pending invites.
- Returns an existing pending invite for retry/idempotency instead of creating duplicate rows.
- Creates a single actionable `band_invitation` notification with `/band` as the destination and metadata keyed by invitation ID.
- Replaces direct client inserts in `PlayerProfile` and `InviteFriendToBand` with the guarded service/RPC.
- Adds client-side normalization and validation before RPC calls.
- Improves friend-invite copy and message character feedback.

## Complete user flow

1. A band leader, founder, manager, or officer opens a band invitation UI from a public-safe profile or the band friend-invite dialog.
2. The client validates UUIDs and role/message length before sending.
3. The RPC resolves the signed-in actor's active profile from `auth.uid()`.
4. The RPC verifies the actor can manage invitations for that band.
5. The RPC resolves the target profile to its user ID, checks invite privacy/block state, and rejects current members.
6. If a pending invite already exists, the RPC returns it without creating duplicate participation, rewards, or notifications.
7. Otherwise the RPC inserts one pending invitation and one deduped actionable notification.
8. The UI shows a success toast, resets the form, and leaves response handling to the existing invitation inbox/band flow.

## Files changed

- `supabase/migrations/20260710220000_guard_band_invitation_creation.sql`
- `src/services/bandInvitations.ts`
- `src/services/__tests__/bandInvitations.test.ts`
- `src/components/band/InviteFriendToBand.tsx`
- `src/pages/PlayerProfile.tsx`
- `docs/social/implementation/PHASE_2_PR_03.md`
- `docs/social/SOCIAL_SYSTEM_AUDIT.md`
- `docs/social/SOCIAL_MMO_EXPANSION_PLAN.md`

## Database changes

A migration is required. It adds validation constraints, a pending-invite index, the `band_invitation_send_denied` audit kind, `can_manage_band_invitations`, `send_band_invitation`, execute grants, and replaces the direct insert policy with a guarded-RPC-only insert path.

## Permission model

- Actor identity is resolved from `auth.uid()` and active `profiles` rows.
- Client-supplied inviter user IDs are ignored.
- Target invitee user IDs are resolved from the target profile server-side.
- Band invite creation is allowed for the band leader profile and existing `leader`, `founder`, `manager`, or `officer` band member roles.
- Target players who disabled band invites or are blocked in either direction cannot be invited.
- Existing band members cannot be invited again.
- Direct client inserts into `band_invitations` are blocked; creation must use the RPC.

## Notifications

The RPC creates one `notifications` row per new invitation with:

- category: `relationship`
- type: `band_invitation`
- action path: `/band`
- metadata: invitation ID, band ID, inviter profile ID

Existing pending invites returned idempotently do not create duplicate notifications.

## Analytics

No new analytics platform was added. Denied invitation attempts are recorded through the existing `social_action_audit_log` infrastructure for permission, privacy, and block failures.

## Automated tests

Added service tests for:

- successful input normalization;
- invalid target ID rejected before RPC;
- invalid role rejected before RPC;
- successful guarded RPC call and parameter mapping;
- backend permission/privacy failure surfacing;
- empty backend response handling.

The SQL RPC is documented for migration validation/manual database checks because the local repository does not include a Supabase test harness for RLS execution.

## Manual verification

Recommended cases:

- Band leader invites an available player from profile detail.
- Band leader invites an available friend from Band Manager.
- Manager/officer invite if that role exists in current data.
- Ordinary member attempts invite and receives a permission error.
- Unrelated player attempts invite and receives a permission error.
- Target with `allow_band_invites = false` cannot be invited.
- Blocked pair cannot invite either direction.
- Existing band member cannot be invited.
- Duplicate pending invitation returns success without a second row or notification.
- Former member without active role cannot invite.
- Solo player is unaffected unless invited.
- Mobile and desktop dialogs remain usable with keyboard navigation and clear disabled states.

## Known limitations

- Invitation response/acceptance still uses the legacy client-side update/member insert flow and should be migrated next.
- Band applications remain a separate legacy recruitment write surface.
- This PR does not add rate limits beyond duplicate pending invite idempotency.
- This PR does not change band role/economy balance or add invite rewards.
- Existing read policies for invitations are not fully redesigned in this slice.

## Recommended Phase 2 PR 04

Migrate band invitation response/acceptance to a server-authoritative RPC that validates the invitee, pending status, block state, active membership, band capacity, duplicate member rows, notification cleanup, and idempotent accept/decline/cancel outcomes.
