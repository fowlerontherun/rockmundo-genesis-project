

# Festival Page Enhancement Plan (v1.0.783)

## Summary
Overhaul the festival browse/detail page to show richer festival information, remove the "Perform Now" button (performances should work like gigs -- scheduled, not instant), add festival-specific merch creation for bands, and add a festival-exclusive items shop for attendees.

---

## Changes Overview

### 1. Remove "Perform Now" Button from FestivalCard
- In `FestivalCard.tsx`, remove the "Perform Now" button block (lines 163-173) that allows instant performance
- Replace with a status indicator showing the scheduled performance time (if the player's band has a confirmed slot)
- Performances should happen automatically based on slot scheduling, matching how gigs work

### 2. Enrich the Festival Detail Panel (FestivalBrowser.tsx)
Expand the `FestivalDetailPanel` to display more comprehensive information:

- **Description section** -- show the festival description text
- **Festival stats** -- duration, total stages, genre focus, capacity, ticket sales count
- **Security info** -- show assigned security firm if available
- **Financial summary** -- ticket price breakdown (day vs weekend), savings percentage on weekend passes
- **Schedule grid** -- reorganize lineup by day with time slots visible, not just a flat list
- **Attendance counter** -- show how many people have bought tickets or are attending

### 3. Improve Ticket Purchase Section
- Make the ticket buying UI more prominent with clearer pricing cards
- Show remaining capacity / sold-out indicators
- Add a confirmation dialog before purchase (since it deducts cash)
- Display the player's current cash balance next to the buy buttons so they know if they can afford it

### 4. Festival Merch Creation (for Bands)
Add a new tab/section in the festival detail panel for bands that are performing:

- **New component**: `FestivalMerchCreator.tsx` in `src/components/festivals/merch/`
- Allows the performing band to create festival-specific merchandise (t-shirts, posters, commemorative items) tied to that festival
- Uses the existing `player_merchandise` table with metadata indicating it's festival-specific (`metadata: { festival_id }`)
- Festival merch gets a sales boost from festival attendance
- Reuses patterns from the existing `MerchCatalog` and `ReleaseDesignDialog` components

### 5. Festival-Exclusive Attendee Shop
Add a marketplace for attendees to buy unique festival items:

- **New component**: `FestivalExclusiveShop.tsx` in `src/components/festivals/merch/`
- Available only to players who have a ticket for the festival
- Shows festival-branded items (festival t-shirts, wristbands, commemorative posters, limited collectibles)
- Items are generated based on the festival data (title, genre, location)
- Purchases deduct from player cash and add items to their inventory
- Some items could be "limited edition" with stock counts
- Integrates into the `FestivalDetailPanel` as a new section or tab

### 6. Update Festival Page Tabs
In `Festivals.tsx`, add a third tab for "My Festival Merch" or integrate the shop into the detail panel:

- The detail panel will gain two new collapsible sections:
  - "Festival Shop" (for attendees to buy exclusive items)
  - "Sell Your Merch" (for performing bands to set up their festival merch stand)

### 7. Version Update
- Bump version to `1.0.783` in `VersionHeader.tsx`
- Add changelog entry in `VersionHistory.tsx`

---

## Technical Details

### Files to Modify
| File | Change |
|------|--------|
| `src/components/festivals/FestivalCard.tsx` | Remove "Perform Now" button, add scheduled slot info |
| `src/components/festivals/FestivalBrowser.tsx` | Expand detail panel with description, stats, festival shop, merch stand sections |
| `src/components/VersionHeader.tsx` | Bump to v1.0.783 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

### New Files
| File | Purpose |
|------|---------|
| `src/components/festivals/merch/FestivalExclusiveShop.tsx` | Attendee shop for festival-exclusive items |
| `src/components/festivals/merch/FestivalMerchStand.tsx` | Band merch stand setup for performing bands |

### Data Approach
- Festival-exclusive items will be defined as a static catalog generated from festival properties (no new DB tables needed)
- Purchases will use the existing `player_merchandise` / profile cash deduction pattern
- Band festival merch uses the existing `player_merchandise` table with `festival_id` in metadata
- The `festival_merch_sales` table already exists and can track sales

### Key Patterns Followed
- Uses existing `useFestivalTickets` hook for ticket state
- Uses existing `useFestivalStages` / `useFestivalStageSlots` for lineup data
- Uses existing `useFestivalQuality` for ratings
- Follows the same cash deduction pattern from `useFestivalTickets`
- Reuses `Card`, `Badge`, `Button`, `Separator` UI components consistently

