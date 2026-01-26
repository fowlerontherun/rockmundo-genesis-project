
# Fix Album Charts System

## Overview
Fix the album charts to properly aggregate streams from all songs on an album, display the album name (not individual song names), and show one entry per album instead of entries for every song. This affects both the streaming and combined chart types when viewing the "Album" category.

## Current Problems

1. **Combined album chart not working**: The edge function generates `streaming_album` but never creates `combined_album` entries
2. **Albums show as individual songs**: When viewing album charts, each song on an album appears as a separate entry instead of one unified album entry
3. **Streams not aggregated**: Album streaming/combined totals should sum all songs' streams, but currently each song is displayed individually
4. **Display shows song titles**: Albums should display the album title and total song count, not the lead song's title

## Root Cause Analysis

### Backend Issues (`update-music-charts/index.ts`)
- **Line 265-281**: Creates `streaming_album` entries aggregated by song:scope, not by release
- **Line 450-506**: Creates `combined` entries by song, never generates `combined_album`
- **Missing**: No logic to aggregate streams by release_id for albums (only physical sales in lines 580-618 do this correctly)

### Frontend Issues (`useCountryCharts.ts`)
- **Line 257**: Aggregates by `song_id` key, should use `release_id` for album entries
- **Line 296/374**: Displays `entry.songs?.title` instead of release title for albums

### Display Issues (`CountryCharts.tsx`)
- **Line 172**: Always shows song title, doesn't check `entry_type === "album"` to show release title

## Solution

### Part 1: Backend - Generate Proper Album Chart Entries

Add new logic in the edge function to:
1. Query all songs belonging to albums/EPs and their streaming data
2. Aggregate total streams by `release_id` (album)
3. Create `streaming_album` and `streaming_ep` entries with:
   - `release_id` populated
   - `song_id` set to lead song (track 1) for FK constraint
   - `entry_type = "album"`
   - Total streams = sum of all songs on album
4. Create `combined_album` and `combined_ep` entries similarly

### Part 2: Frontend - Aggregate by Release for Album Views

Update `useCountryCharts.ts`:
1. For album category, aggregate by `release_id` instead of `song_id`
2. Fetch release title from a separate query or include in chart_entries
3. Sum streams across all entries with same `release_id`

### Part 3: Display - Show Album Name

Update `CountryCharts.tsx`:
1. Check `entry.entry_type === "album"` 
2. If album: show `entry.release_title` (or fetch from release)
3. Show song count badge for albums

## Technical Implementation

### File 1: `supabase/functions/update-music-charts/index.ts`

Add new step after Step 2 (streaming) and modify Step 4 (combined):

```text
// NEW STEP 2b: Album/EP streaming aggregation by release
1. Query song_releases joined with release_songs to get release_id
2. Group streams by release_id + release_type (album/ep)
3. For each album:
   - Sum total_streams from all songs
   - Sum weekly_streams from all songs
   - Get lead song_id (track 1)
   - Store release title for display
4. Create streaming_album and streaming_ep entries with:
   - song_id: lead song
   - release_id: the album ID
   - entry_type: "album"
   - plays_count: sum of all song streams
```

**Key changes:**
- Query `releases` joined with `release_songs` and `song_releases`
- Filter for `release_type IN ('album', 'ep')`
- Aggregate streams by release, not by individual song
- Create entries with `chart_type: "streaming_album"` / `"streaming_ep"`
- Include release title in a new column or rely on frontend join

### File 2: `useCountryCharts.ts`

Modify aggregation logic:

```typescript
// For album category, use release_id as aggregation key
const key = releaseCategory === "album" && entry.release_id 
  ? entry.release_id 
  : entry.song_id;
```

Add release data fetching for album entries:
- Join to releases table to get title
- Or store release_title in chart_entries (migration needed)

### File 3: `CountryCharts.tsx`

Update ChartTable display:

```typescript
// In the Song & Artist column
{entry.entry_type === "album" ? (
  <>
    <p className="font-medium truncate">{entry.release_title || entry.title}</p>
    <p className="text-xs text-muted-foreground">
      {entry.artist} • {entry.song_count || "Album"}
    </p>
  </>
) : (
  <>
    <p className="font-medium truncate">{entry.title}</p>
    <p className="text-xs text-muted-foreground">{entry.artist}</p>
  </>
)}
```

### File 4: Database Migration

Add `release_title` column to `chart_entries`:

```sql
ALTER TABLE chart_entries 
ADD COLUMN release_title TEXT;
```

This allows storing the album title directly in chart entries, avoiding complex joins.

## Detailed Edge Function Changes

### New Step 2b: Album Streaming Aggregation

```text
Query structure:
- releases (where release_type = 'album' OR 'ep')
  → release_songs
    → song_releases (where is_active = true)
      - total_streams
      - Get weekly streams from weeklyStreamsMap

Aggregation Map:
  Key: release_id
  Value: {
    releaseId,
    releaseTitle,
    releaseType (album/ep),
    totalStreams (sum all songs),
    weeklyStreams (sum all songs),
    leadSongId (track 1),
    bandName
  }

Output chart entries:
  chart_type: `streaming_${releaseType}` (streaming_album, streaming_ep)
  song_id: leadSongId
  release_id: releaseId
  entry_type: "album"
  plays_count: totalStreams
  weekly_plays: weeklyStreams
  release_title: releaseTitle (new column)
```

### Modified Step 4: Combined Album Chart

Same pattern as streaming:
1. For each release_id where release_type is album/ep
2. Sum all songs' combined scores
3. Create `combined_album` and `combined_ep` entries

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/[timestamp]_add_release_title_to_chart_entries.sql` | Add release_title column |
| `supabase/functions/update-music-charts/index.ts` | Add album streaming/combined aggregation logic |
| `src/hooks/useCountryCharts.ts` | Aggregate by release_id for album views, include release_title in output |
| `src/pages/CountryCharts.tsx` | Display album title when entry_type === "album" |
| `src/components/VersionHeader.tsx` | Bump version to 1.0.526 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

## Version Update
- Bump to **v1.0.526**
- Changelog: "Charts: Fixed album charts to aggregate all song streams, display album names, and show one entry per album instead of per-song entries"
