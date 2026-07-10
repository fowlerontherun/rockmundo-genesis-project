# Phase 1 Review — Communication and Presence Foundation

## Phase 1 objective

Establish the smallest safe foundation for social visibility, direct communication, and presence-adjacent discovery before expanding into recruitment, hiring, contracts, mentoring, or reputation-heavy MMO systems.

## PRs completed

1. **PR 01 — Profile Privacy Settings Slice:** owner-managed social privacy/contact preferences and shared helper functions.
2. **PR 02 — Social Safety Primitives:** profile blocks, mutes, reports, safety audit logs, and shared block/mute/report RPCs.
3. **PR 03 — Direct Message Safety Guards:** server-authoritative guarded direct-message send RPC and client service.
4. **PR 04 — Friend Request Safety Guards:** server-authoritative guarded friend-request RPC, duplicate/cooldown handling, and recipient notification dedupe.
5. **PR 05 — Social Invite Safety Guards:** server-authoritative guarded invite send/respond RPCs, duplicate/expiry handling, and recipient notification dedupe.

## Player-facing flows now available

- Players can configure first-slice profile privacy/contact settings.
- Players can create blocks, mutes, and reports from the Relationships/Social safety UI.
- Direct-message sends respect DM permissions and block status server-side.
- Friend requests respect block status, duplicate pending state, declined cooldowns, and recipient notification dedupe.
- Social invites respect block status, duplicate pending state, invite status transitions, expired scheduled invites, and recipient notification dedupe.

## Systems still partial

- Public profile/search reads still use broad profile fields rather than a dedicated safe projection.
- Friend accept/decline/remove/block lifecycle writes are still not fully migrated to dedicated RPCs.
- Twaater DMs/follows/mentions and realtime chat still need shared block/mute/report enforcement.
- Band recruitment and company hiring/contact flows still need privacy/block integration.
- Presence remains count-oriented and not a privacy-aware per-player availability system.
- Notifications are improved for friend requests and invites but remain fragmented across systems.
- Rate limiting is still broad and incomplete.

## Systems still broken or not safe enough for expansion

- There is no unified moderation/evidence queue for non-Twaater social reports.
- There is no repository-wide social rate-limit service for DMs, invites, chat, follows, mentions, or recruitment.
- There is no global mute suppression layer for notifications, feeds, chat, or search.
- There is no active-profile SQL helper for multi-profile users; Phase 1 RPCs use the first owned profile.

## Security/privacy status

Improved. Core direct contact writes for DMs, friend requests, and social invites now resolve actor identity server-side and check shared block/privacy guards where applicable. However, profile/search read privacy and several older social write surfaces remain partial.

## Moderation/blocking status

Dedicated block, mute, report, and audit primitives now exist. Blocking is enforced for the three migrated high-risk direct-contact writes. Unified moderation review and evidence tooling remains pending.

## Analytics coverage

No new analytics platform was added. Backend safety telemetry records denied actions in `social_action_audit_log` for migrated flows. Client flow analytics remain limited.

## Test coverage

Automated service tests cover the new client-side validation, friendly errors, guarded RPC calls, duplicate/idempotent success paths, and status-transition inputs for the Phase 1 direct-contact slices. Full RLS integration tests require applying migrations against a Supabase test database.

## Known limitations

- Broad rate limiting is unresolved.
- Public-safe profile projection is not implemented.
- Twaater, chat, recruitment, gifts, and lifecycle relationship operations still need migration.
- Presence/availability flags are still not implemented.
- Invite expiration has no scheduled cleanup job.
- Multi-profile active identity selection remains approximate.

## Phase 1 status

**Complete with accepted limitations.**

## Exact reason for status

The planned Phase 1 safety foundation for the selected direct communication surfaces is in place: privacy preferences, safety primitives, DM send guards, friend request guards, and social invite guards are implemented. The status is not simply based on five PRs; it is based on the repository now having reusable server-authoritative primitives for the core direct-contact flows identified in PR 04. Limitations are accepted because broader Social MMO requirements—profile projections, rate limiting, unified moderation, Twaater/chat/recruitment guards, and rich presence/discovery availability—are intentionally deferred and remain documented.

## Recommended next phase and first PR

Proceed to the next foundation phase with a **public-safe profile projection and profile/search read migration PR**. That should define and enforce safe read boundaries for profile and discovery surfaces before adding richer availability flags, recruitment metadata, hiring profiles, recommendations, or social matchmaking.
