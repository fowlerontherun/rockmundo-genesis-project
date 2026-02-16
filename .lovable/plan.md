

# v1.0.743 -- Consolidate Band Songs into Active Repertoire + Archived Songs

## What Changes

The Band Manager page currently has two overlapping tabs: **Songs** and **Repertoire**. These will be merged into a single **Repertoire** tab with two sub-views:

- **Active** -- Songs available for setlists, rehearsals, recordings, and gigs
- **Archived** -- Songs shelved from active use; hidden from all selection dialogs

Songs can be moved between Active and Archived with a single click. Archived songs retain all their data (streams, ownership, quality) but are excluded from being picked for setlists, rehearsals, or recordings.

## How It Works

1. **Remove the "Songs" tab** from the Band Manager page -- only "Repertoire" remains
2. **Add Active/Archived toggle** inside the Repertoire tab (using sub-tabs or a filter toggle)
3. **Add Archive/Unarchive buttons** on each song card
4. **Filter archived songs** from the Rehearsals page song picker (currently missing this filter)
5. The setlist managers already exclude archived songs, so no change needed there

## Technical Details

### Files to modify

1. **`src/pages/BandManager.tsx`**
   - Remove the "Songs" tab and `BandSongsTab` import
   - Remove the "songs" TabsTrigger and TabsContent
   - Adjust the grid from 10 tabs to 9

2. **`src/components/band/BandRepertoireTab.tsx`**
   - Add an Active/Archived sub-tab toggle at the top of the Songs sub-tab
   - Filter the songs query results by `archived` status for each view
   - Add Archive/Unarchive button to each song row (toggle `songs.archived`)
   - Show count badges on the Active/Archived toggles
   - The existing "Remove from Repertoire" (Trash) button stays for fully removing a song from the band

3. **`src/pages/Rehearsals.tsx`** (lines ~142-177)
   - Add `.eq("archived", false)` to both the member songs query and the band-owned songs query so archived songs cannot be selected for rehearsals

4. **`src/components/VersionHeader.tsx`** -- Bump to 1.0.743
5. **`src/components/ui/navigation.tsx`** -- Bump version
6. **`src/pages/VersionHistory.tsx`** -- Add changelog entry

### Already handled (no changes needed)
- `SetlistSongManager.tsx` -- already uses `.neq("archived", true)`
- `EnhancedSetlistSongManager.tsx` -- already filters archived songs
- `BandSongsSection.tsx` (band profile page) -- shows only recorded/released songs, separate from management

### Archive/Unarchive logic
Simple toggle on `songs.archived`:
```typescript
await supabase.from("songs").update({ archived: !currentValue }).eq("id", songId);
```

