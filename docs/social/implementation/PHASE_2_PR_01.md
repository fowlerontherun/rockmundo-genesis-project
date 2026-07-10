# Phase 2 PR 01 — Public-Safe Profile Projection and Player Search Migration

## Selected Phase 2 recommendation

Phase 1 review recommends starting the next foundation phase with a **public-safe profile projection and profile/search read migration PR** before richer availability, recruitment metadata, hiring profiles, recommendations, or social matchmaking.

## Audit evidence

`SOCIAL_SYSTEM_AUDIT.md` identifies raw profile/search reads as privacy-light and broad: profile/search surfaces expose identity, city, activity-adjacent state, band history, progression, and social action entry points without a dedicated safe projection. It also flags the lack of privacy-safe profile/search APIs as a security and discovery blocker before recruitment expansion.

## Problem

Players searching for bandmates or collaborators were querying the broad `profiles` table directly from the client. That made discovery depend on raw profile fields instead of the privacy settings and block primitives added in Phase 1.

## Previous behaviour

- `PlayerSearch` queried `profiles` directly.
- City and playtime-style fields could be displayed from raw profile data.
- Blocked/private profiles were not filtered by a server-authoritative profile/search read guard.
- Band memberships were fetched with a second direct client query.

## Implemented behaviour

- Adds `public_safe_profiles`, a narrow projection for profile/search discovery.
- Adds `can_view_public_profile_summary(viewer_profile_id, target_profile_id)`.
- Replaces `search_public_profiles` with a server-authoritative RPC that resolves the actor profile from `auth.uid()`, validates input, filters blocked pairs, honors public/friends/private profile visibility, and returns only safe summary fields plus current public band badges.
- Migrates `PlayerSearch` to call the RPC through `src/services/publicProfileSearch.ts`.
- Adds loading, empty, error, disabled, and success states around the migrated search flow.

## Full user flow

1. A signed-in player opens Player Search.
2. The player enters at least two characters.
3. The client validates and normalizes the query.
4. The RPC resolves the authenticated player profile server-side.
5. The RPC filters results through block and profile-visibility checks.
6. The page renders only public-safe summary fields: name, handle, avatar, bio, fame, fans, level, privacy-allowed city, and current band badges.
7. Existing profile, friend, and message actions remain visible only through existing UI state and backend guards.

## Files changed

- `supabase/migrations/20260710200000_public_safe_profile_search.sql`
- `src/services/publicProfileSearch.ts`
- `src/services/__tests__/publicProfileSearch.test.ts`
- `src/pages/PlayerSearch.tsx`
- `docs/social/implementation/PHASE_2_PR_01.md`
- `docs/social/SOCIAL_SYSTEM_AUDIT.md`
- `docs/social/SOCIAL_MMO_EXPANSION_PLAN.md`

## Database changes

A migration is required. It adds a projection view and replaces the search RPC. No new tables are added.

## Permission model

- The RPC requires `auth.uid()` and resolves the owned actor profile server-side.
- Client-supplied viewer profile IDs are treated only as a selector among profiles owned by the authenticated user.
- Blocked profile pairs are excluded.
- Public profiles are discoverable, friends-only profiles are discoverable to accepted friends and self, and private profiles are discoverable only to self.
- City is shown only when `city_visibility = 'public'`.

## Notifications

No notifications are created. This is a read-boundary and search migration slice.

## Analytics

No analytics events are added. This slice does not introduce a new analytics platform.

## Automated tests

Added service tests for input normalization, invalid input, RPC invocation, safe result mapping, and friendly backend error mapping.

## Manual verification

Recommended manual cases:

- Search as a band leader.
- Search as an ordinary member.
- Search as an unrelated player.
- Search while blocked from another player and confirm that profile is excluded.
- Search for a private profile and confirm only the owner can see it.
- Search on mobile and desktop.

## Known limitations

- `PlayerProfile` detail pages still need migration to safe profile-detail reads.
- Band recruitment applications/invitations are not modified in this slice.
- Broad social rate limiting and unified moderation remain unresolved.
- The RPC uses the first owned profile until a canonical active-profile SQL helper is added.

## Recommended Phase 2 PR 02

Migrate the public player profile detail route to the same public-safe projection/visibility model, then begin the first guarded band recruitment write slice after profile/search reads no longer depend on raw profile access.
