# Festival Expansion + AI Lineup Poster (v1.0.785)

## Overview

This plan covers three major areas:

1. Implementing the previously approved festival enhancement plan (richer details, remove "Perform Now", merch creation, attendee exclusive shop)
2. Adding AI-generated lineup poster functionality via a new admin button. The poster should use the band logo if they have one and if not just the band name.
3. Version bump

---

## 1. Remove "Perform Now" Button

**File: `src/components/festivals/FestivalCard.tsx**`

- Remove the "Perform Now" button block (lines 163-173) that allows instant performance during ongoing festivals
- Replace with a "Scheduled" badge showing the player's confirmed slot time if they have one
- Keep "Apply to Perform" and "Withdraw" buttons as-is (these are for the gig-like workflow)

---

## 2. Enrich Festival Detail Panel

**File: `src/components/festivals/FestivalBrowser.tsx**`

- Add festival description display below the title
- Show festival stats: duration, total stages, genre focus, capacity, ticket count
- Show security firm name if assigned (join on `security_firm_id`)
- Improve ticket section with player's current cash balance shown, and a confirmation step
- Reorganize lineup by day with clearer time groupings
- Add attendance counter (count of tickets purchased)

---

## 3. Festival Merch Creation (for performing bands)

**New file: `src/components/festivals/merch/FestivalMerchStand.tsx**`

- Available to bands with a confirmed slot at the festival
- Allows creating festival-exclusive merchandise using the existing `player_merchandise` table
- Items get a `festival_exclusive` flag and reference the festival ID in metadata
- Uses patterns from existing Merchandise page (design name, item type, pricing)
- Sales tracked via the existing `festival_merch_sales` table

---

## 4. Festival Exclusive Attendee Shop

**New file: `src/components/festivals/merch/FestivalExclusiveShop.tsx**`

- Only visible to players who have purchased a ticket (uses `useFestivalTickets` hook)
- Shows festival-branded collectible items generated from festival data (title, genre, location):
  - Festival wristband, commemorative poster, limited edition t-shirt, festival pin
- Purchasing deducts cash from player profile
- Items are virtual collectibles (no new DB table needed -- stored as profile inventory or simple client-side confirmation with cash deduction)

---

## 5. Integrate Merch Sections into Detail Panel

**File: `src/components/festivals/FestivalBrowser.tsx**`

- Add two new collapsible sections in `FestivalDetailPanel`:
  - "Festival Shop" -- renders `FestivalExclusiveShop` (for ticket holders)
  - "Sell Your Merch" -- renders `FestivalMerchStand` (for performing bands)

---

## 6. AI-Generated Lineup Poster

### Database Migration

- Add `poster_url` column (TEXT, nullable) to `game_events` table

### New Edge Function: `generate-festival-poster`

- **File: `supabase/functions/generate-festival-poster/index.ts**`
- Accepts `festivalId` in POST body
- Fetches festival data + stages + all slots (with band names) from Supabase
- Constructs a detailed prompt describing the festival lineup poster:
  - Festival title, dates, location
  - Each stage with its lineup grouped by day
  - Headliners featured prominently
  - Music festival poster aesthetic
- Calls `ai.gateway.lovable.dev` with `google/gemini-2.5-flash-image` (same pattern as `generate-housing-image`)
- Uploads result to a Supabase storage bucket (`festival-posters`)
- Updates `game_events.poster_url` with the public URL
- Returns the poster URL

### Storage Bucket

- Create `festival-posters` bucket (public) via migration

### Admin UI: "Generate Lineup Poster" Button

**File: `src/components/festivals/admin/FestivalDetailManager.tsx**`

- Add a new tab or a button in the Stages tab header area: "Generate Lineup Poster"
- When clicked, calls the `generate-festival-poster` edge function
- Shows loading state while generating
- On success, displays the poster image in a dialog/card
- The poster URL is persisted on the festival record

### Player-Facing Poster Display

**File: `src/components/festivals/FestivalBrowser.tsx**`

- If `poster_url` exists on the festival, display it as a prominent image in the detail panel header

---

## 7. Version Update

- Bump to `1.0.785` in `VersionHeader.tsx`
- Add changelog entry in `VersionHistory.tsx`

---

## Technical Details

### Files to Create


| File                                                       | Purpose                              |
| ---------------------------------------------------------- | ------------------------------------ |
| `src/components/festivals/merch/FestivalMerchStand.tsx`    | Band merch creation for festivals    |
| `src/components/festivals/merch/FestivalExclusiveShop.tsx` | Attendee exclusive collectibles shop |
| `supabase/functions/generate-festival-poster/index.ts`     | AI poster generation edge function   |


### Files to Modify


| File                                                       | Change                                               |
| ---------------------------------------------------------- | ---------------------------------------------------- |
| `src/components/festivals/FestivalCard.tsx`                | Remove "Perform Now", add scheduled slot badge       |
| `src/components/festivals/FestivalBrowser.tsx`             | Enrich detail panel, add merch sections, show poster |
| `src/components/festivals/admin/FestivalDetailManager.tsx` | Add "Generate Poster" button                         |
| `src/components/VersionHeader.tsx`                         | Bump to v1.0.785                                     |
| `src/pages/VersionHistory.tsx`                             | Add changelog                                        |
| `supabase/config.toml`                                     | Add `generate-festival-poster` function config       |


### Database Migration

- `ALTER TABLE game_events ADD COLUMN IF NOT EXISTS poster_url TEXT;`
- Create storage bucket `festival-posters` with public access

### Dependencies

- No new npm packages needed
- Uses existing `LOVABLE_API_KEY` secret for AI image generation (already configured)
- Follows established pattern from `generate-housing-image` edge function