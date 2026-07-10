# Phase 1 PR 03 — Direct Message Safety Guards

## Selected recommendation

This PR implements the Phase 1 PR 02 recommendation to migrate the highest-risk existing write flow to shared safety guards. The selected vertical slice is **direct-message sending**.

## Audit evidence

- The audit identifies missing consistent block/mute/report enforcement before messages and invites.
- Direct messages already exist as a shipped player-to-player communication surface.
- Phase 1 PR 01 added `can_profile_receive_dm`; Phase 1 PR 02 expanded `are_profiles_blocked` with dedicated block primitives.

## Problem

Players could initiate one-to-one direct messages through client-side inserts unless each caller remembered to enforce privacy and blocking. That made blocks and DM preferences unreliable in a core social flow.

## Previous behaviour

- The direct-message hook inserted rows into `direct_messages` directly from the client.
- The insert policy verified sender ownership and distinct participants, but did not enforce recipient DM settings or shared block status.
- The UI disabled duplicate sends while pending, but backend safety failures surfaced as raw errors.

## Implemented behaviour

- Adds `send_direct_message(recipient_profile_id, message_body)` as a SECURITY DEFINER RPC with `SET search_path = public`.
- Resolves the sender profile from `auth.uid()` server-side.
- Validates recipient, self-DM, empty body, and 2,000-character message length.
- Enforces `can_profile_receive_dm(sender, recipient)` before insert.
- Updates the direct insert RLS policy so any insert path must use the deterministic channel ID and pass the same DM guard.
- Logs denied privacy/block attempts to the existing social audit log.
- Moves client sending through a small direct-message service with input validation and friendly errors.
- Adds success and error status messages plus accessible labels and a visible character counter to the existing DM thread.

## User flow

1. Player A opens an existing direct-message thread with Player B.
2. The thread shows loading, empty, or existing-message states.
3. Player A writes a message and sends it with the button or Ctrl/Cmd+Enter.
4. The send button and text area are disabled while the request is pending to prevent duplicate submission.
5. The RPC verifies that Player A owns an active profile and Player B can receive the DM.
6. If allowed, the message appears in the existing realtime thread and the UI confirms success.
7. If blocked, privacy-restricted, unauthenticated, invalid, or otherwise denied, Player A sees a friendly error and no message row is created.

## Files changed

- `supabase/migrations/20260710150000_guard_direct_message_sends.sql`
- `src/features/direct-messages/services/directMessages.ts`
- `src/features/direct-messages/__tests__/directMessages.test.ts`
- `src/hooks/useDirectMessages.ts`
- `src/features/social-hub/components/DirectMessageThread.tsx`
- `docs/social/SOCIAL_SYSTEM_AUDIT.md`
- `docs/social/SOCIAL_MMO_EXPANSION_PLAN.md`
- `docs/social/implementation/PHASE_1_PR_03.md`

## Database changes

- Adds the `direct_message_send_denied` audit enum value.
- Adds `send_direct_message(uuid, text)`.
- Replaces the broad DM insert policy with a guarded policy requiring:
  - sender ownership,
  - distinct sender/recipient,
  - deterministic participant channel ID,
  - `can_profile_receive_dm(sender_profile_id, recipient_profile_id)`.

## Permission model

- Sender identity is resolved from `auth.uid()` and `profiles.user_id` in the RPC.
- Recipient access is verified with the shared DM permission helper.
- Blocking takes precedence through `are_profiles_blocked` inside `can_profile_receive_dm`.
- Message reads, mark-read updates, and sender deletes continue using existing participant RLS.
- Unrelated users still cannot read rows because the existing participant select policy remains unchanged.

## Notifications

No new notifications were added in this slice. The flow remains realtime-thread based and avoids duplicate notification concerns until a dedicated DM notification policy is designed.

## Analytics

No new analytics event was added because no narrow existing client analytics helper was identified for this DM flow. Denied backend attempts are recorded in `social_action_audit_log` for safety review.

## Automated tests

Added direct-message service tests for:

- successful primary flow through the guarded RPC,
- invalid recipient input,
- empty input,
- overlong input,
- backend request failures,
- blocked/unauthorized friendly errors,
- unauthenticated friendly errors.

SQL migration validation is covered by applying/parsing the new migration in the standard migration workflow; full RLS integration should be run against a Supabase test database.

## Manual verification

Recommended manual cases:

- Player A messages Player B successfully when B allows DMs.
- Player A cannot message Player B after either profile blocks the other.
- Player A cannot message Player B when B only allows friends and they are not friends.
- Unrelated Player C cannot read A/B messages.
- Unauthenticated visitor cannot send a DM.
- Existing DM thread remains usable on mobile and desktop widths.

## Known limitations

- DM rate limiting remains a follow-up.
- No DM report/evidence UI is added in this PR.
- Existing historical messages are not reprocessed.
- Other write surfaces still need migration: friend requests, social invites, band recruitment, Twaater messages/follows, and realtime chat.
- If a user owns multiple profiles, the RPC currently uses the first profile associated with `auth.uid()`; callers that need explicit active-character routing should be migrated once the repository has a canonical active-profile SQL helper.

## Recommended Phase 1 PR 04

Migrate **friend requests or social invites** to the same server-authoritative safety guard pattern, including block checks, duplicate/cooldown handling, actionable notifications only when needed, and audit records for blocked/unauthorised attempts.
