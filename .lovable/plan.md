

# Navigation Simplification + AI Image Hub Tiles — v1.1.002

## Changes

### 1. Navigation: Headings Only (No Dropdowns/Sub-items)

Both `navigation.tsx` and `HorizontalNavigation.tsx` will be simplified so each section is just a clickable heading that navigates directly to its hub page. No dropdown menus, no collapsible sub-items.

**Desktop horizontal nav**: A single row of clickable headings — Home, Music, Band & Live, World & Social, Career & Business (+ Admin if admin). Clicking goes straight to the hub.

**Sidebar (mobile sheet + desktop sheet)**: Same — just a list of hub links, no collapsible sections. Each heading is a button navigating to the hub page.

**Bottom bar (mobile + desktop)**: Keep as-is (5 icon shortcuts + More).

### 2. Hub Tiles: AI-Generated Images Instead of Icons

Update `CategoryHub` to support an optional `imageUrl` on each tile. Create an edge function that generates tile images using Lovable AI (gemini-2.5-flash-image) and stores them in a Supabase storage bucket.

**Approach**: 
- Add `imageUrl?: string` to the `HubTile` interface in `CategoryHub.tsx`
- When `imageUrl` is present, render an image card instead of the icon circle
- Create a storage bucket `hub-tile-images` for the generated images
- Create an edge function `generate-hub-image` that takes a prompt, generates via Lovable AI, and uploads to storage
- Build a small admin utility or one-time script to generate all ~45 tile images
- Each tile card shows: image (aspect-ratio 16:9, rounded top), label below

**Tile card design**:
```text
┌─────────────────┐
│  [AI Image]     │
│  16:9 ratio     │
│                 │
├─────────────────┤
│  Songwriting    │
└─────────────────┘
```

### 3. Layout Fit Fixes

Audit and fix text overflow, button sizing, and tab fitting issues:
- Tile grid: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4` (reduce from 5 on large screens to give images room)
- Card content: ensure text truncation with `truncate` or `line-clamp-2`
- Group headers: proper spacing
- PageLayout/PageHeader: verify no overflow on mobile

### Files to Create
- `supabase/functions/generate-hub-image/index.ts` — Edge function for AI image generation + storage upload
- SQL migration for `hub-tile-images` storage bucket

### Files to Modify
- `src/components/CategoryHub.tsx` — Add imageUrl support, new image-based tile card layout, adjust grid
- `src/components/ui/navigation.tsx` — Remove all sub-items, nav sections become direct hub links
- `src/components/ui/HorizontalNavigation.tsx` — Same simplification
- `src/pages/hubs/MusicHubPage.tsx` — Add imageUrl to tiles (initially empty, populated after generation)
- `src/pages/hubs/BandLiveHub.tsx` — Same
- `src/pages/hubs/WorldSocialHub.tsx` — Same
- `src/pages/hubs/CareerBusinessHub.tsx` — Same
- `src/pages/hubs/CharacterHub.tsx` — Same
- `src/components/VersionHeader.tsx` → v1.1.002
- `src/pages/VersionHistory.tsx` → changelog entry

### Image Generation Strategy
The edge function will generate images on-demand. Each hub page will call the function for tiles missing images, storing results in the bucket. Prompts will be themed (e.g., "Rock music songwriting scene, cartoon style, vibrant colors" for the Songwriting tile). Images are generated once and cached via public bucket URLs.

### Version
v1.1.002 — "Navigation simplified to hub headings only; hub tiles upgraded with AI-generated images; layout fit fixes throughout"

