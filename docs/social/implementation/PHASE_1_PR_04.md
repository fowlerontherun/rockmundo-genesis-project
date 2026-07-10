# Phase 1 PR 04 — Server-Authoritative Friend Request Safety Guards

## Selected recommendation

This PR implements the Phase 1 PR 03 recommendation to migrate **friend requests** to the shared server-authoritative social safety guard pattern.

## Evidence

- `PHASE_1_PR_03.md` recommends migrating friend requests or social invites next.
- `SOCIAL_SYSTEM_AUDIT.md` identifies friend requests as implemented but missing consistent block integration and database-level anti-spam controls.
- Phase 1 PR 01/02 added privacy and block primitives; Phase 1 PR 03 proved the same migration pattern for direct-message sends.

## Problem

Friend requests are a direct player-contact flow. Before this slice, clients could insert pending friendships directly if they owned the requestor profile, which left block checks, duplicate handling, cooldowns, actionable notifications, and friendly errors inconsistent across entry points.

## Previous behaviour

- Relationship search used the shared friendship integration, but the integration inserted into `friendships` directly.
- Player profile pages also inserted rows into `friendships` directly.
- The insert RLS policy verified requestor ownership only.
- Duplicate, blocked, unauthenticated, and recently declined cases were mostly raw database errors or client-dependent checks.
- Friend-request notifications were not created by the guarded request creation path.

## Implemented behaviour

- Adds `can_send_friend_request(sender_profile_id, recipient_profile_id)` as a shared SQL guard.
- Adds `send_friend_request(target_profile_id)` as a SECURITY DEFINER RPC with `SET search_path = public`.
- Resolves the sender profile from `auth.uid()` server-side.
- Validates missing target, self-request, missing recipient, existing accepted friendship, blocked relationships, and recently declined resend cooldowns.
- Treats an existing pending request as an idempotent success to prevent duplicate actions and duplicate notifications.
- Reopens an older declined friendship as a new pending request after the cooldown window.
- Creates one actionable `notifications` row for the recipient with `/relationships` as the destination, deduped by friendship ID.
- Replaces the friendship insert policy so direct inserts must be pending, owned by the requester, and pass the shared guard.
- Moves profile-page friend requests onto the same integration service used by relationship search.
- Adds friendly client-side validation and error mapping for friend-request sends.

## User flow

1. Player A opens player search or Player B's profile.
2. Player A chooses to add Player B as a friend.
3. The client disables the pending action through existing mutation state and calls `send_friend_request`.
4. The RPC resolves Player A's active profile from `auth.uid()`.
5. The RPC rejects invalid, self, blocked, accepted, or recently declined requests with clear errors.
6. If an identical pending request already exists, the RPC returns it without creating duplicate rows or notifications.
7. If allowed, the RPC creates or reopens a pending friendship and creates one actionable notification for Player B.
8. Player B can open `/relationships` to accept or decline through the existing relationship-management UI.

## Files changed

- `supabase/migrations/20260710170000_guard_friend_request_sends.sql`
- `src/integrations/supabase/friends.ts`
- `src/integrations/supabase/__tests__/friends.test.ts`
- `src/pages/PlayerProfile.tsx`
- `docs/social/SOCIAL_SYSTEM_AUDIT.md`
- `docs/social/SOCIAL_MMO_EXPANSION_PLAN.md`
- `docs/social/implementation/PHASE_1_PR_04.md`

## Database changes

- Adds `friend_request_send_denied` to `social_action_audit_kind`.
- Adds `can_send_friend_request(uuid, uuid)`.
- Adds `send_friend_request(uuid)`.
- Replaces the broad friendship insert policy with a guarded pending-request policy.
- Adds no new tables.

## Permission model

- Sender identity is resolved from `auth.uid()` and `profiles.user_id` in the RPC.
- Clients no longer choose the authoritative requestor for the primary friend-request flow.
- Participant-only friendship read/update/delete policies remain unchanged.
- Direct inserts are still constrained by RLS to pending, owner-created requests that pass the shared guard.
- Dedicated `social_profile_blocks` and legacy `friendships.status = blocked` both deny new requests through `are_profiles_blocked`.

## Notifications

- The recipient receives one actionable `notifications` row per friendship ID.
- The destination is `/relationships`.
- Duplicate pending submissions return the existing friendship and do not create duplicate notifications.
- Blocked or unavailable recipients do not receive notifications.

## Analytics

No new analytics platform or event schema was added. Blocked friend-request attempts are recorded in `social_action_audit_log` as backend safety telemetry.

## Automated tests

Added friend-request service tests for:

- successful guarded RPC flow,
- invalid target profile input,
- backend request failure for blocked/unauthorized attempts,
- duplicate pending request idempotency,
- unauthenticated user friendly error,
- recently declined cooldown friendly error.

RLS/RPC behavior is covered by the SQL migration and should be validated against a Supabase test database as part of migration checks.

## Manual verification

Recommended manual cases:

- Player A sends Player B a friend request from search.
- Player A sends Player B a friend request from Player B's profile page.
- Player A cannot send to Player B after either profile blocks the other.
- Re-clicking while a pending request exists does not create another friendship or notification.
- Player B receives a single notification linking to `/relationships`.
- Unrelated Player C cannot read A/B friendship rows.
- A recently declined request shows the cooldown message.
- Mobile and desktop layouts keep existing search/profile controls usable.

## Known limitations

- Accept, decline, remove, and block lifecycle writes still use existing table update/delete paths and need a future server-authoritative RPC slice.
- The cooldown is fixed at seven days and has no per-user/admin tuning UI.
- Full rate limiting across all social write surfaces remains unresolved.
- If a user owns multiple profiles, the RPC uses the first profile associated with `auth.uid()` pending a canonical active-profile SQL helper.
- Social invites, Twaater interactions, chat, and recruitment still need migration to shared guards.

## Recommended Phase 1 PR 05

Migrate **social invites** to the same server-authoritative guard pattern, including sender ownership, recipient block checks, invite-specific duplicate/expiry handling, actionable notification deduplication, and audit records for denied attempts.
