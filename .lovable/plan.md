
# Twaater Timeline & Content Enhancement - Implementation Plan

## Problem Summary

Based on investigation, three main issues need to be addressed:

1. **Empty Timeline**: The AI feed edge function returns empty arrays even though there are 2,200+ twaats in the last 7 days and the user follows 49 accounts with active posts
2. **Linked Content Missing Context**: When linking a song/album/gig to a twaat, only the embed appears - no automatic descriptive text is generated
3. **Missing Band Hashtag Integration**: No way to auto-insert band name as a hashtag when composing twaats

## Root Cause Analysis

### Issue 1: AI Feed Returns Empty
The `twaater-ai-feed` edge function:
- Queries twaats correctly (200 posts from last 7 days)
- Sends to AI for ranking
- AI response parsing may fail (JSON.parse on potentially malformed response)
- When AI fails, fallback runs but may return empty if `rankedIds` parsing throws

The fallback chronological feed (`useTwaaterFeed`) works correctly - it just requires switching from AI mode.

### Issue 2: Linked Content Has No Text
When users link a gig/song/album, the `TwaaterComposer`:
- Sets `linkedType` and `linkedId`
- Shows a badge with the title
- BUT does NOT auto-generate descriptive text for the twaat body

### Issue 3: No Band Name Hashtag
The composer has no band awareness - users must manually type their band name as a hashtag.

---

## Implementation Plan

### Part 1: Fix AI Feed + Robust Fallback

**File: `supabase/functions/twaater-ai-feed/index.ts`**

Changes:
1. Add try-catch around AI response JSON parsing
2. Improve fallback algorithm to always return content
3. Add visibility filter (currently missing - should only show public posts)
4. Ensure metrics array handling works (metrics comes as array from join)

Key changes:
```text
- Add .eq("visibility", "public") to twaats query
- Wrap AI response parsing in try-catch
- Fix metrics access: metrics?.[0]?.likes instead of metrics?.likes
- Ensure fallback always returns the sorted twaats slice
```

**File: `src/hooks/useTwaaterAIFeed.ts`**

Changes:
1. Improve error handling when edge function returns empty
2. Add automatic fallback to chronological when AI returns empty

### Part 2: Auto-Generate Link Description Text

**File: `src/components/twaater/TwaaterComposer.tsx`**

Changes:
1. When user selects a link (song/album/gig/tour), auto-insert contextual text
2. Add a "Band" button to insert band name as hashtag
3. Fetch user's band(s) to enable band hashtag feature

New behavior when linking:
| Link Type | Auto-inserted Text |
|-----------|-------------------|
| Single | "Check out my new single '{title}'! 🎵" |
| Album | "My new album '{title}' just dropped! 🎶" |
| Gig | "Catch us live at {venue}, {city}! 📅" |
| Tour | "We're hitting the road! {tour_name} tour kicks off soon! 🎸" |

Band hashtag button:
- Fetches user's bands via `band_members` table
- If one band: inserts `#BandName` (spaces removed, camelCase)
- If multiple bands: shows dropdown to select which band

### Part 3: Profile/Post History Tab

**File: `src/pages/Twaater.tsx`**

The Explore tab already exists and works. The main issue is the AI feed. Once fixed, users will see their timeline.

Additionally, add a "My Posts" filter option to show only the user's own twaats as a quick profile view.

---

## Technical Details

### Edge Function Fix (`twaater-ai-feed/index.ts`)

```typescript
// Current problematic code:
const rankedIds = JSON.parse(aiData.choices[0].message.content)

// Fixed version:
let rankedIds: string[] = []
try {
  const content = aiData.choices[0]?.message?.content || '[]'
  // Clean any markdown code blocks if present
  const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
  rankedIds = JSON.parse(cleaned)
} catch (parseError) {
  console.error('Failed to parse AI response:', parseError)
  // Fall through to fallback algorithm
}

if (!rankedIds.length) {
  // Use fallback algorithm
  ...
}
```

### Composer Link Description Logic

```typescript
const generateLinkText = (type: string, title: string, extra?: any): string => {
  switch (type) {
    case 'single':
      return `Check out my new single "${title}"! 🎵 `;
    case 'album':
      return `My new album "${title}" is here! 🎶 `;
    case 'gig':
      return `Catch us live at ${extra?.venue}! 📅 `;
    case 'tour':
      return `We're hitting the road! ${title} tour is coming! 🎸 `;
    default:
      return '';
  }
}
```

### Band Hashtag Feature

New hook needed: `useUserBands()` (may already exist)

Band hashtag formatting:
```typescript
const formatBandHashtag = (bandName: string): string => {
  // "Big Fowler and the Growlers" -> "#BigFowlerAndTheGrowlers"
  return '#' + bandName
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/twaater-ai-feed/index.ts` | Fix AI response parsing, add visibility filter, improve fallback |
| `src/hooks/useTwaaterAIFeed.ts` | Add fallback when AI returns empty |
| `src/components/twaater/TwaaterComposer.tsx` | Auto-generate link text, add band hashtag button |
| `src/components/twaater/LinkSongDialog.tsx` | Pass extra metadata for text generation |
| `src/components/twaater/LinkReleaseDialog.tsx` | Pass extra metadata for text generation |
| `src/components/twaater/LinkGigDialog.tsx` | Pass venue/city info for text generation |
| `src/components/twaater/LinkTourDialog.tsx` | Pass tour dates info for text generation |
| `src/components/VersionHeader.tsx` | Bump to v1.0.537 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

---

## New Components

### Band Hashtag Button (in Composer)

```text
+------------------------------------------+
| [Single] [Album] [Gig] [Tour] [#Band ▼]  |
+------------------------------------------+
```

When clicked:
- If 1 band: inserts hashtag immediately
- If 2+ bands: shows dropdown to pick one
- Hashtag inserted at cursor position or end of body

---

## Testing Checklist

1. Feed shows posts from followed accounts (switch to Chronological mode works)
2. AI feed returns ranked content (or gracefully falls back)
3. Linking a song auto-inserts promotional text
4. Linking a gig includes venue name in auto-text
5. Band hashtag button appears and works
6. Band name formats correctly as hashtag (no spaces, proper casing)

---

## Version Update

- Version: **1.0.537**
- Changes:
  - Twaater: Fixed AI feed returning empty by improving response parsing and fallback
  - Twaater: Auto-generate promotional text when linking songs, albums, gigs, or tours
  - Twaater: Added band hashtag button to quickly add your band name as a hashtag
  - Twaater: Improved chronological feed fallback for reliable content display
