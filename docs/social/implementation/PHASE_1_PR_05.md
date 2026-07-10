# Phase 1 PR 05 — Server-Authoritative Social Invite Safety Guards

## Selected recommendation

This PR implements the **Recommended Phase 1 PR 05** from `PHASE_1_PR_04.md`: migrate social invites to the same server-authoritative guard pattern used for direct-message sends and friend-request sends.

## Evidence

- `PHASE_1_PR_04.md` recommends migrating social invites next with sender ownership, block checks, invite-specific duplicate/expiry handling, notification dedupe, and audit records for denied attempts.
- `SOCIAL_SYSTEM_AUDIT.md` still identified social invites as a direct communication surface without consistent shared block/mute/report enforcement.
- Phase 1 PRs 01–02 added profile privacy and safety primitives; PRs 03–04 proved the pattern for DMs and friend requests.

## Problem

Social invites are a player-to-player direct interaction. Before this slice, clients inserted and updated `social_invites` directly, so duplicate pending invites, block checks, sender/recipient authority, expired invite handling, and user-facing errors were not consistently enforced by the backend.

## Previous behaviour

- `useCreateInvite` inserted rows directly into `social_invites`.
- `useRespondInvite` updated rows directly from the client.
- Insert RLS only checked sender profile ownership.
- Update RLS allowed either participant to write broad status changes.
- Notifications were not created by the invite-send path.
- Duplicate, blocked, expired, unauthenticated, and invalid transitions could surface as raw database/client errors.

## Implemented behaviour

- Adds `can_send_social_invite(sender_profile_id, recipient_profile_id)` as a shared SQL guard.
- Adds `send_social_invite(...)` as a SECURITY DEFINER RPC with `SET search_path = public`.
- Adds `respond_social_invite(invite_id, next_status)` as a SECURITY DEFINER RPC.
- Resolves the actor profile from `auth.uid()` server-side.
- Validates target, kind, self-invites, past scheduled times, missing recipients, and message length.
- Enforces shared block checks before send and response.
- Treats an existing recent pending invite of the same kind and pair as an idempotent success.
- Marks pending past scheduled invites as expired when acted upon.
- Creates one actionable notification for the recipient linking to `/social?tab=invites` and dedupes by invite ID.
- Replaces direct insert policy with a guarded sender policy and removes direct client update access so status changes go through `respond_social_invite`.
- Moves invite create/respond hooks onto the guarded RPC service.
- Improves invite dialog and inbox loading, unauthenticated, empty, error, success, pending, disabled, cancelled, declined, expired, and accessibility states.

## User flow

1. Player A opens an invite dialog for Player B.
2. Player A chooses a type, optional future time, and optional message.
3. The send button disables while pending and the client calls `send_social_invite`.
4. The RPC resolves Player A's active profile and checks whether Player B is valid and not blocked.
5. If an equivalent pending invite already exists, the RPC returns it without creating another row or notification.
6. If allowed, the RPC creates the invite and one actionable notification for Player B.
7. Player B opens `/social?tab=invites` and can accept or decline a pending incoming invite.
8. Player A can cancel a pending outgoing invite.
9. Expired, declined, cancelled, or blocked invites are displayed as terminal states and cannot be advanced through normal actions.

## Files changed

- `supabase/migrations/20260710183000_guard_social_invites.sql`
- `src/features/social-hub/services/socialInvites.ts`
- `src/features/social-hub/__tests__/socialInvites.test.ts`
- `src/hooks/useSocialInvites.ts`
- `src/features/social-hub/components/InviteFriendDialog.tsx`
- `src/features/social-hub/components/InvitesInbox.tsx`
- `docs/social/implementation/PHASE_1_PR_05.md`
- `docs/social/implementation/PHASE_1_REVIEW.md`
- `docs/social/SOCIAL_SYSTEM_AUDIT.md`
- `docs/social/SOCIAL_MMO_EXPANSION_PLAN.md`

## Database changes

- Adds `social_invite_send_denied` and `social_invite_response_denied` audit enum values.
- Adds a message-length check for `social_invites.message`.
- Adds an active pair/kind/status index for duplicate lookup.
- Adds `can_send_social_invite`, `send_social_invite`, and `respond_social_invite`.
- Replaces the broad social invite insert policy with a guarded sender policy and removes the broad client update policy.
- Adds no new tables.

## Permission model

- Sender/respondent identity is resolved from `auth.uid()` and the first owned profile.
- Senders can create pending invites only when the target exists, is not self, and the pair is not blocked.
- Recipients can accept or decline only their own pending incoming invites.
- Senders can cancel only their own pending outgoing invites.
- Unrelated profiles remain unable to read private invite rows through participant RLS.
- Blocked pairs cannot send or continue restricted invite interactions.

## Notifications

- The invite recipient receives one `notifications` row per created invite.
- The route is `/social?tab=invites`.
- Duplicate pending sends return the existing invite and do not create duplicate notifications.
- Blocked, invalid, unauthenticated, or unavailable recipients receive no notifications.

## Analytics

No new analytics platform was added. Denied send/response attempts are recorded in `social_action_audit_log` using existing safety telemetry.

## Automated tests

Added social invite service tests for successful sends, invalid target input, overlong messages, duplicate/idempotent backend success, response RPC calls, invalid status rejection, blocked backend failures, and unauthenticated friendly errors.

## Manual verification

Recommended manual cases:

- Player A sends Player B a social invite.
- Player A repeats the same pending invite and no duplicate notification is created.
- Player B accepts and declines incoming invites from `/social?tab=invites`.
- Player A cancels an outgoing pending invite.
- Player A cannot invite Player B when either profile blocks the other.
- Unrelated Player C cannot read or respond to A/B invite rows.
- An expired scheduled invite is shown as expired when acted upon.
- Mobile and desktop layouts keep invite rows readable and actions reachable.

## Known limitations

- Broad social rate limiting remains unresolved.
- Invite expiration is enforced when acted upon, not by a scheduled cleanup job.
- The RPC uses the first profile owned by `auth.uid()` pending a canonical active-profile SQL helper.
- Twaater follows/messages/mentions, realtime chat, band recruitment, gifts, and friendship lifecycle writes still need guard migration.
- No unified moderator evidence console is added in this slice.

## Phase 1 closure outcome

Phase 1 is **Complete with accepted limitations** for the narrow communication/presence foundation scope delivered by PRs 01–05: profile privacy settings, safety primitives, guarded direct-message sends, guarded friend-request sends, and guarded social-invite sends/responses now exist. It is not complete for the broader Social MMO vision because profile projections, global rate limits, Twaater/chat/recruitment guards, unified moderation, and richer presence/discovery availability remain pending.

## Recommended next PR

Start the next phase with a **public-safe profile projection and profile/search read migration PR**, because privacy/contact settings now exist but profile/search reads still need a clear public-safe boundary before richer discovery and availability features expand.
