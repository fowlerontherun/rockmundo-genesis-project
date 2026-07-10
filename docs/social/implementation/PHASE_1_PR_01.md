# Phase 1 PR 01 — Social Permission Design: Profile Privacy Settings Slice

## Problem

The Phase 0 audit found that RockMundo exposes rich profile and social metadata without a clear repository-wide privacy/contact model. That blocks safer delivery of DMs, profile discovery, recruitment, recommendations, and richer social MMO systems.

## Audit evidence

- Privacy controls were rated **Low** readiness and called a core blocker.
- Player profiles expose identity, city/location, activity-like state, band history, songs, achievements, skills, and social entry points without an explicit visibility matrix.
- Blocking exists only as fragmented friendship state, so future communication/recruitment flows need shared helper semantics before new write-heavy social features are added.
- The recommended next PR sequence starts with a **Social permission design PR** before safety schema, profile projections, communication guards, recruitment metadata, and unified moderation.

## Solution

This PR implements the first independently releasable slice of the audit recommendation:

1. Adds `profile_privacy_settings` with safe defaults for profile visibility, city visibility, activity visibility, online status visibility, relationship visibility, DM permission, and invite opt-ins.
2. Adds owner-only RLS policies for private settings.
3. Adds a narrow `public_profile_privacy_settings` view exposing only contact/discovery preferences intended for future guards.
4. Adds shared SQL helper functions:
   - `profile_belongs_to_current_user(profile_id)`
   - `are_profiles_blocked(first_profile_id, second_profile_id)`
   - `can_profile_receive_dm(sender_profile_id, recipient_profile_id)`
5. Adds a Social Privacy Settings card to the existing Relationships/Social page rather than creating a new hub.
6. Adds validation, loading, empty, error, success, changed/unchanged, and duplicate-submit disabled states.

## Files and migrations

- `supabase/migrations/20260710120000_add_profile_privacy_settings.sql`
- `src/features/social-privacy/services/socialPrivacySettings.ts`
- `src/features/social-privacy/hooks/useSocialPrivacySettings.ts`
- `src/features/social-privacy/components/SocialPrivacySettingsCard.tsx`
- `src/features/social-privacy/__tests__/socialPrivacySettings.test.ts`
- `src/features/social-privacy/__tests__/SocialPrivacySettingsCard.test.tsx`
- `src/pages/Relationships.tsx`
- `docs/social/SOCIAL_SYSTEM_AUDIT.md`
- `docs/social/SOCIAL_MMO_EXPANSION_PLAN.md`

## Permissions model

- Private settings are owner-managed through RLS by joining `profile_privacy_settings.profile_id` to `profiles.id` and requiring `profiles.user_id = auth.uid()`.
- Unauthenticated and unrelated users cannot select/update private settings through `profile_privacy_settings`.
- The public view intentionally exposes only coarse preferences future read/write guards need: profile visibility, DM permission, band invite opt-in, and company invite opt-in.
- `can_profile_receive_dm` denies self-DMs, blocked pairs, and recipients whose DM preference is `none`; `friends` requires an accepted friendship.
- Blocking still takes precedence over contact preferences.

## Tests

Automated coverage added for:

- Successful owner load and save.
- Safe defaults when no row exists.
- Invalid input validation before backend writes.
- Failed backend requests.
- Unauthorized save failure propagation.
- Unrelated/public-safe preference reads.
- Unauthenticated/empty UI state.
- Loading failure UI state.
- Duplicate submission prevention while a save is pending.

## Known limitations

- Existing profile/search/DM/band/company surfaces are not yet fully migrated to enforce every privacy setting.
- No new rewards, XP, money, reputation, or progression are attached to privacy settings.
- No unified report queue or moderation console is added in this slice.
- The public-safe profile projection remains the next dependency before broad profile/search reads should be changed.
- Former band/company member write access was reviewed as not applicable to this owner-profile settings slice.

## Next dependency-aware PR

Implement the audit’s **Safety schema PR**: dedicated block/mute/report/audit primitives with minimal UI exposure, then migrate DMs, friend requests, invites, Twaater follows/messages, and recruitment writes to shared guard functions.
