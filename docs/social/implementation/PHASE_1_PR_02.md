# Phase 1 PR 02 — Social Safety Primitives: Blocks, Mutes, Reports, and Audit Logs

## Problem

Phase 1 PR 01 added owner-managed privacy settings and helper functions, but RockMundo still lacked dedicated cross-system safety primitives. Blocking existed only as a friendship status, while mute, report, and abuse-audit records were fragmented or missing for shared social guards.

## Selection rationale

This PR follows the recommended next social PR from `PHASE_1_PR_01.md`: the **Safety schema PR**. It still matches the P0 priorities in the social audit because DMs, friend requests, invites, Twaater, chat, and recruitment need shared block/mute/report/audit foundations before new write-heavy social features are expanded.

## Solution

1. Adds dedicated owner-managed `social_profile_blocks` and `social_profile_mutes` tables.
2. Adds private `social_reports` records for moderator-ready future review.
3. Adds append-only `social_action_audit_log` records for retryable safety actions.
4. Updates `are_profiles_blocked` to honor both dedicated block records and legacy blocked friendships.
5. Adds shared RPCs for block, unblock, mute, unmute, report, and mute checks.
6. Adds a Relationships/Social safety card with loading, empty, error, disabled, duplicate-submit, success, and validation states.
7. Adds frontend service/hook coverage for validation, RPC calls, idempotent actions, status checks, and report submission.

## Files and migrations

- `supabase/migrations/20260710133000_add_social_safety_primitives.sql`
- `src/features/social-safety/services/socialSafety.ts`
- `src/features/social-safety/hooks/useSocialSafety.ts`
- `src/features/social-safety/components/SocialSafetyCard.tsx`
- `src/features/social-safety/__tests__/socialSafety.test.ts`
- `src/pages/Relationships.tsx`
- `docs/social/implementation/PHASE_1_PR_02.md`

## Permissions model

- Owners can manage only their own block and mute records through RLS and `profile_belongs_to_current_user`.
- Reporters can create and read only their own reports in this slice.
- Unrelated users cannot read private block notes, mute notes, reports, or audit logs.
- SECURITY DEFINER RPCs resolve the current profile from `auth.uid()` and use `SET search_path = public`.
- Block/mute/report actions are server-authoritative and do not modify gameplay rewards, reputation, economy, contracts, or roles.

## Known limitations

- Existing DM, friend request, invite, recruitment, Twaater, and chat write flows are not all migrated to call the new RPCs in this PR.
- The UI accepts a target profile ID as a minimal entry point until profile/message/context menus wire direct target actions.
- Admin moderation queues for `social_reports` are intentionally deferred to a later moderation PR.

## Next dependency-aware PR

Migrate the highest-risk existing write flow to the shared safety guards, preferably direct messages or friend requests, so blocked users cannot bypass contact restrictions through an already-shipped social surface.
