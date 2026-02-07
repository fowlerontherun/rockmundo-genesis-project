

# AI Photo-to-Avatar System

## Overview

Replace the SVG sprite character creator with an AI-powered system where players upload a selfie and receive a stylized cartoon avatar with exaggerated, genre-influenced outfits. The first generation is free; subsequent re-generations cost in-game cash. Players can choose between their AI avatar or the old system.

## How It Works

1. Player uploads a photo (or takes one on mobile)
2. The system fetches their band's primary genre (e.g. "Heavy Metal", "Hip Hop", "Country")
3. An edge function sends the photo to Lovable AI (Gemini image model) with a detailed style prompt that combines the player's likeness with genre-specific exaggerated outfits
4. The generated avatar is stored in the existing `avatars` Supabase Storage bucket
5. The URL is saved to `profiles.avatar_url` for use across the game
6. Players can regenerate with a different genre emphasis or tweak -- subsequent generations cost $500 in-game cash

## Genre-to-Outfit Mapping

The AI prompt will include genre-specific outfit descriptions to create exaggerated, recognizable looks:

| Genre | Outfit Direction |
|-------|-----------------|
| Rock / Modern Rock | Leather jacket, ripped jeans, band tees, Chuck Taylors |
| Heavy Metal / Metalcore | Studded leather, bullet belt, long hair, black everything |
| Punk Rock | Mohawk, safety pins, tartan, combat boots, DIY patches |
| Hip Hop / Trap / Drill | Oversized chains, designer streetwear, snapback, fresh kicks |
| Pop / K-Pop | Bright colors, trendy fits, statement accessories |
| Jazz / Blues | Sharp suit, fedora, vintage vibes |
| Country | Cowboy hat, boots, denim, big belt buckle |
| Reggae | Rastafari colors, relaxed tropical fit, dreadlocks |
| EDM / Electronica | Neon rave gear, LED accessories, futuristic |
| Classical | Formal concert attire, bow tie, tailcoat |
| Goth | All black, Victorian elements, dramatic makeup |
| Latin / Flamenco | Bold colors, ruffles, traditional flair |
| Indie / Bedroom Pop | Vintage thrift store, oversized cardigan, retro glasses |

## Art Style

The prompt will enforce a consistent illustrated/cartoon style: bold outlines, slightly exaggerated proportions (big heads, expressive eyes), vibrant flat colors with subtle shading -- similar to modern mobile game character art. Not photorealistic, not anime -- a distinctive stylized look that works as a game avatar.

## Technical Plan

### Step 1: Database Migration

Add an `avatar_generation_count` column to `profiles` to track free vs paid generations:

```sql
ALTER TABLE profiles ADD COLUMN avatar_generation_count integer DEFAULT 0;
```

### Step 2: Edge Function -- `generate-photo-avatar`

New edge function that:
- Receives the uploaded photo (as a storage path or base64) and the band genre
- Builds a detailed style prompt incorporating the genre outfit
- Calls Lovable AI (`google/gemini-2.5-flash-image`) with the photo as an image input for editing/transformation
- Uploads the resulting avatar to the `avatars` storage bucket
- Updates `profiles.avatar_url` with the new URL
- Increments `avatar_generation_count`
- If count > 0, deducts $500 from player's cash (checks funds first)
- Returns the generated avatar URL

### Step 3: New Frontend Component -- `AiAvatarCreator`

Replaces the `SvgCharacterCreator` on the Avatar Designer page. Features:

- **Upload Zone**: Drag-and-drop or camera capture for the player's photo
- **Genre Display**: Shows the band's primary genre and the outfit style that will be applied (auto-detected from `useUserBand`)
- **Manual Genre Override**: Dropdown to pick a different genre style if desired
- **Generate Button**: Triggers the edge function, shows a loading spinner (10-20 seconds)
- **Preview**: Side-by-side of original photo and generated avatar
- **Regenerate**: Button with cost indicator ("Free" or "$500") 
- **Save**: Confirms the avatar as the player's profile picture
- **Switch to Classic**: Link to fall back to the old SVG creator if preferred

### Step 4: Update Avatar Designer Page

Modify `src/pages/AvatarDesigner.tsx` to show the new `AiAvatarCreator` as the primary option, with a toggle/tab to switch to the legacy SVG creator.

### Step 5: Update Onboarding Appearance Step

Update `AppearanceStep.tsx` to use the new AI creator during onboarding (first generation is always free).

### Step 6: Version Bump

- Bump to `1.0.617`
- Add changelog entry documenting the new AI avatar system

## Files to Create

- `supabase/functions/generate-photo-avatar/index.ts` -- New edge function
- `src/components/avatar-system/AiAvatarCreator.tsx` -- New main component
- `supabase/migrations/[timestamp]_avatar_generation_count.sql` -- DB migration

## Files to Modify

- `supabase/config.toml` -- Add function config with `verify_jwt = false`
- `src/pages/AvatarDesigner.tsx` -- Replace with new AI creator + legacy toggle
- `src/components/onboarding/steps/AppearanceStep.tsx` -- Use new AI creator
- `src/components/VersionHeader.tsx` -- Version bump to 1.0.617
- `src/pages/VersionHistory.tsx` -- Add changelog entry

## Cost Structure

| Action | Cost |
|--------|------|
| First avatar generation | Free |
| Each subsequent regeneration | $500 in-game cash |
| Switching to legacy SVG creator | Free (always) |

