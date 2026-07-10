# Phase 2 PR 04 — Guarded Band Invitation Creation MVP

## Selected recommendation

Implemented the smallest complete band-recruitment write slice: route band invitation creation through a server-authoritative `send_band_invitation` RPC.

`docs/social/implementation/PHASE_2_PR_03.md` was requested as the source for the exact “Recommended Phase 2 PR 04”, but that file is not present in this checkout. The implementation follows the latest available dependency chain from `PHASE_2_PR_02.md`, which recommends guarded band invitation creation as the next band recruitment write slice.

## Audit evidence

`SOCIAL_SYSTEM_AUDIT.md` marks band recruitment as implemented but partial: `band_invitations` exists, but invitation visibility and authorization are inconsistent, leader checks vary between `bands.leader_id` and band-member roles, and recruitment lacks block/privacy/cooldown-style guards.

## Dependency from PR 03

Because PR 03 documentation is missing, the dependency used here is the prior available recommendation: migrate band invitation creation to a server-authoritative RPC that checks inviter role/permission, target privacy/block state, duplicate pending invitations, active membership, valid band leadership, notification deduplication, and actionable routes.

## Problem

Band leaders could create invitations through direct client inserts. That made invite creation dependent on client-supplied band IDs, invitee user IDs, roles, and messages; produced inconsistent user-facing errors; and left privacy/block checks to fragmented UI behaviour.

## Previous behaviour

- `PlayerProfile` inserted directly into `band_invitations`.
- `InviteFriendToBand` inserted directly into `band_invitations` after loading friends client-side.
- Duplicate pending invites relied on table constraints and produced raw backend errors.
- Target invite privacy and block checks were not part of the band invitation creation path.
- Invitation notifications were not created by a single idempotent backend flow.

## Implemented behaviour

- Added `send_band_invitation(target_profile_id, target_band_id, requested_instrument_role, requested_vocal_role, invite_message)`.
- The RPC resolves the inviter profile from `auth.uid()` and resolves the invitee user from the target profile server-side.
- The RPC authorizes invite creation through `bands.leader_id` or active `band_members` roles of `leader`/`founder`.
- The target must allow band invitations and must not be blocked in either direction.
- Existing pending invites for the same band/player return idempotently instead of creating duplicates.
- Already-member targets are rejected.
- Invitation messages are trimmed and capped at 280 characters.
- A pending-invite unique index prevents duplicate pending invite rows.
- Denied attempts are recorded in the existing social audit log.
- A deduped `band_request` notification points invitees to `/band-manager`.
- Player profile and band manager invite flows now call the guarded service instead of direct table inserts.

## Complete user flow

1. A signed-in band leader or founder opens a player profile or the band manager friend-invite dialog.
2. The UI validates band, target player, role, and message fields before calling the backend.
3. The RPC confirms the authenticated user owns an active profile and is authorised for the band.
4. The RPC checks the target profile, block state, invite opt-in, existing membership, and duplicate pending invitations.
5. The RPC creates or returns a pending invitation and creates a deduped notification.
6. The UI shows success, pending/submitting, disabled, loading, empty, and clear error states.

## Files changed

- `supabase/migrations/20260710230000_guard_band_invitation_creation.sql`
- `src/services/bandInvitations.ts`
- `src/services/__tests__/bandInvitations.test.ts`
- `src/components/band/InviteFriendToBand.tsx`
- `src/pages/PlayerProfile.tsx`
- `docs/social/implementation/PHASE_2_PR_04.md`
- `docs/social/SOCIAL_SYSTEM_AUDIT.md`
- `docs/social/SOCIAL_MMO_EXPANSION_PLAN.md`

## Database changes

A migration is required. It adds:

- `band_invitation_send_denied` audit enum value.
- Message length constraint for band invitations.
- Partial unique index for one pending invite per band/invited user.
- `can_manage_band_invitations` helper.
- `can_receive_band_invitation` helper.
- `send_band_invitation` RPC with safe `search_path`.

## Permission model

- Requires `auth.uid()` and an active profile.
- Client-supplied invitee user IDs are no longer trusted; target user is resolved from `target_profile_id`.
- Client-supplied band IDs are authorized server-side.
- Only band leaders/founders can create invitations.
- Target privacy and block state are enforced server-side.
- Unrelated users and former/non-authorized members cannot create invitations.

## Contribution/progression model

No contribution, chemistry, rewards, achievements, or shared-goal progress are changed in this PR. This keeps the slice informational and abuse-resistant.

## Notifications

The RPC creates one deduped `band_request` notification per invitation with `/band-manager` as the action route. Routine duplicate attempts return the existing pending invite and do not create duplicate notifications.

## Analytics

No new analytics platform was added. Denied invite attempts are recorded in `social_action_audit_log` where the existing social safety infrastructure supports it.

## Automated tests

Added unit tests for:

- valid input normalization;
- invalid target ID rejection before backend calls;
- overlong message rejection;
- successful guarded RPC calls;
- duplicate pending invite as idempotent backend success;
- privacy/authorization error mapping.

SQL migration review covers the RLS/RPC behaviour touched, duplicate prevention, audit logging, and notification deduplication.

## Manual verification

Recommended manual cases:

- Band leader sends an invite from player profile.
- Band leader sends an invite from band manager friend dialog.
- Founder/leader role in `band_members` sends an invite.
- Ordinary member attempts an invite and receives a clear denial.
- Unrelated player attempts an invite and receives a clear denial.
- Target with `allow_band_invites = false` is blocked.
- Blocked target pair is blocked.
- Already-member target is blocked.
- Duplicate pending invite returns success without a second row or notification.
- Former member without current leader/founder role cannot invite.
- Solo player experience remains unchanged.
- Mobile and desktop dialog layouts remain usable.

## Known limitations

- `PHASE_2_PR_03.md` is missing from the repository, so this document records the inferred dependency from PR 02 and the audit.
- Invitation response/acceptance still uses the existing direct update/insert flow and should be migrated separately.
- Application creation/response flows remain a follow-up.
- No rate-limit window beyond duplicate pending invite idempotency is added in this small slice.
- Broader band permission matrices, auditions, and recruitment search remain unresolved.

## Recommended Phase 2 PR 05

Migrate band invitation response/acceptance to a guarded RPC that validates invitee identity, pending status, block state, active membership conflicts, member creation, duplicate membership prevention, notification updates, and idempotent accept/decline/cancel behaviour.
