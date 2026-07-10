# Phase 2 PR 02 — Public-Safe Player Profile Detail Migration

## Selected recommendation

Implemented the **Recommended Phase 2 PR 02** from `PHASE_2_PR_01.md`: migrate the public player profile detail route to the same public-safe projection and visibility model used by player search.

## Audit evidence

`SOCIAL_SYSTEM_AUDIT.md` identified player profile detail as a remaining privacy-light read surface after search was migrated. The previous route queried broad `profiles` fields plus city details, band memberships, attributes, and skills directly from the client. That exposed activity-adjacent and gameplay state before recruitment expansion could safely link players to one another.

## Dependency from PR 01

Phase 2 PR 01 added `public_safe_profiles`, `can_view_public_profile_summary`, and the guarded `search_public_profiles` RPC. This PR depends on that foundation and reuses the same projection/helper for profile-detail reads.

## Problem

Players could open another musician's profile and see fields that were not part of the public-safe discovery contract, including current activity/travel/imprisonment badges, health/energy, age/gender, detailed city metadata, total playtime, attributes, and skills.

## Previous behaviour

- `/player/:playerId` queried `profiles` directly from the client.
- The route separately queried `cities`, `band_members`, `player_attributes`, `skill_progress`, and `skill_definitions`.
- Blocking/profile visibility was not enforced by a profile-detail RPC.
- Missing or unavailable profiles used a generic not-found state.

## Implemented behaviour

- Adds `get_public_profile_detail(target_profile_id, viewer_profile_id)` as a security-definer RPC with a safe `search_path`.
- Resolves the viewer profile from `auth.uid()` and rejects unauthenticated or mismatched viewer IDs.
- Reuses `can_view_public_profile_summary` to enforce profile visibility and blocking.
- Returns only public-safe detail fields: profile identity, avatar, bio, level/fame/fans, privacy-allowed city name, joined date, and current band badges.
- Migrates `PlayerProfile` to `src/services/publicProfileDetail.ts` and removes direct broad reads for skills, attributes, private status, vitals, and city metadata.
- Adds loading, unauthenticated, error/unavailable, empty, pending, and disabled states where the route has relevant actions.

## User flow

1. A signed-in player opens `/player/:playerId` from search or another valid player link.
2. The client validates the target and viewer profile IDs.
3. The RPC resolves the authenticated viewer profile using `auth.uid()`.
4. The RPC checks block/profile visibility through the shared helper.
5. The page renders safe public profile details and valid band links, or a clear unavailable state.

## Files changed

- `supabase/migrations/20260710210000_public_safe_profile_detail.sql`
- `src/services/publicProfileDetail.ts`
- `src/services/__tests__/publicProfileDetail.test.ts`
- `src/pages/PlayerProfile.tsx`
- `docs/social/implementation/PHASE_2_PR_02.md`
- `docs/social/SOCIAL_SYSTEM_AUDIT.md`
- `docs/social/SOCIAL_MMO_EXPANSION_PLAN.md`

## Database changes

A migration is required. It adds one guarded RPC and no new tables.

## Permission model

- `auth.uid()` is required.
- The RPC resolves an owned viewer profile server-side.
- Client-supplied viewer IDs are only used to select among profiles owned by the authenticated user.
- Blocked pairs and non-viewable private/friends-only profiles are denied through `can_view_public_profile_summary`.
- Private gameplay fields are not returned.

## Notifications

No notifications are created. This is a read-boundary migration.

## Analytics

No analytics events are added. Existing analytics infrastructure was not expanded for this read-only slice.

## Automated tests

Added service tests for:

- valid ID normalization;
- invalid target ID rejection before RPC calls;
- invalid viewer ID rejection before RPC calls;
- successful RPC mapping with safe defaults;
- blocked/private backend failure mapping;
- empty RPC response mapping to not found.

## Manual verification

Recommended manual cases:

- View a public profile as a signed-in player.
- View a friends-only profile as a friend and as an unrelated player.
- View a blocked player's profile from both sides of the block.
- Open an invalid profile URL.
- Confirm private fields such as health, energy, activity, skills, attributes, and detailed city metadata are not displayed.
- Check mobile and desktop layouts for the hero, stats, and bands card.

## Known limitations

- Existing friend accept/remove and band invitation writes on the page still use legacy direct table operations and need separate guarded lifecycle PRs.
- Richer profile detail for achievements, career history, songs, and recruitment availability remains deferred until explicit privacy-safe projections exist.
- The RPC inherits the current first-owned-profile selection limitation from Phase 1/PR 01.

## Recommended Phase 2 PR 03

Begin the first guarded band recruitment write slice: migrate band invitation creation to a server-authoritative RPC that checks inviter role/permission, target privacy/block state, duplicate pending invitations, active membership, valid band leadership, notification deduplication, and actionable routes.
