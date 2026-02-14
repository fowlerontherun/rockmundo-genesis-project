

# Song Rankings and Cover Song System (v1.0.656)

## Overview

Add a **Song Rankings** page showing all songs in the game ranked by three categories (Quality, Sales, Streams), and a **Cover Song** system that lets bands license songs from the rankings to add to their repertoire. Cover quality is scaled down by the covering band's skill level, preventing low-skill bands from exploiting top-ranked songs.

## How It Works

### Song Rankings

A new page at `/song-rankings` with three ranking tabs:

| Ranking Type | Data Source | Sorting |
|---|---|---|
| Quality | `songs.quality_score` | Highest quality first |
| Sales | `releases.digital_sales + cd_sales + vinyl_sales + cassette_sales` (via `release_songs`) | Total units first |
| Streams | `songs.streams` | Most streamed first |

Each song row shows: rank position, song title, artist/band name, genre, the ranking metric value, and a "Cover This Song" button.

### Cover Song Licensing

When a band selects a song to cover, a dialog presents two payment options:

1. **Flat Fee**: Pay the original band/artist a one-time fee based on song quality (e.g. `quality_score * 10` cash). No ongoing royalty obligations.
2. **Royalty Split**: Pay nothing upfront, but 50% of all revenue earned from performing/streaming the cover goes to the original owner permanently.

### Cover Quality Scaling

This is the key balancing mechanic. When a band covers a song, the effective quality for gigs, streams, and charts is recalculated based on the covering band's average skill level:

```text
coverQuality = originalQuality * skillMultiplier

skillMultiplier = clamp(averageBandSkill / 100, 0.2, 1.0)

averageBandSkill = mean of all band members' relevant skills
                   (vocals, guitar, bass, drums, performance)
```

- A band with average skill 30 covering a quality-80 song gets: `80 * 0.3 = 24` effective quality
- A band with average skill 70 gets: `80 * 0.7 = 56`
- A band with average skill 100+ gets the full `80`

This means covering great songs is still beneficial, but the return is proportional to the band's ability. Low-level bands filling setlists with covers will get modest results, while skilled bands can truly shine with premium covers.

### Cover Songs in Early Game

Covers are strategically important early on because:
- Songwriting skill is low, so original songs have poor quality
- Covering a mid-tier song (quality 40) with skill 30 gives quality 12 -- still better than a skill-30 original (which might be quality 5-10)
- As skills improve, original songs catch up and eventually surpass covers
- This creates a natural progression: covers early, originals later

## Technical Changes

### 1. New Database Table: `song_covers`

```sql
create table song_covers (
  id uuid primary key default gen_random_uuid(),
  original_song_id uuid not null references songs(id),
  covering_band_id uuid not null references bands(id),
  payment_type text not null check (payment_type in ('flat_fee', 'royalty_split')),
  flat_fee_amount numeric default 0,
  royalty_percentage numeric default 50,
  cover_quality numeric default 0,
  skill_multiplier numeric default 0,
  licensed_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(original_song_id, covering_band_id)
);
```

### 2. New Page: Song Rankings (`src/pages/SongRankings.tsx`)

- Route: `/song-rankings`
- Three tabs: Quality, Sales, Streams
- Paginated list (top 50 initially, load more)
- Each row: rank number, song title, artist/band name, genre badge, metric value, "Cover" button
- Search/filter by genre
- Only shows songs with status `released` or `recorded` (not drafts)

### 3. New Component: Cover Song Dialog (`src/components/songs/CoverSongDialog.tsx`)

- Shows original song details (title, artist, quality)
- Two option cards: Flat Fee vs Royalty Split
- Flat fee card shows calculated cost (`quality_score * 10`)
- Royalty card explains the 50% ongoing split
- Shows a preview of cover quality based on band's current skill level
- Confirm button processes the payment and creates the `song_covers` record

### 4. New Hook: `useSongRankings` (`src/hooks/useSongRankings.tsx`)

- Fetches songs with joined band/profile data
- Fetches sales data from `releases` via `release_songs` for the Sales tab
- Supports sorting by quality, sales, or streams
- Includes genre filter and search

### 5. Cover Quality Calculator Utility

Add `src/utils/coverQuality.ts`:
- `calculateCoverQuality(originalQuality, bandMemberSkills)` -- returns the effective quality
- `calculateCoverFee(qualityScore)` -- returns the flat fee cost
- Used by both the dialog (preview) and the gig/streaming systems (effective quality lookup)

### 6. Navigation Updates

- Add "Song Rankings" link to the navigation under a Music/Charts section
- Icon: `Trophy` or `BarChart3`

### 7. Integration with Existing Systems

- When a covered song is used in a gig setlist, the system should use `cover_quality` instead of `quality_score`
- When royalty-split covers earn revenue, 50% is automatically allocated to the original song owner
- Covered songs appear in the band's repertoire with a "Cover" badge

### 8. Version and History

- Bump to **v1.0.656**
- Add version history entry

## Files to Create

- `src/pages/SongRankings.tsx` -- main rankings page
- `src/components/songs/CoverSongDialog.tsx` -- cover licensing dialog
- `src/hooks/useSongRankings.tsx` -- data fetching hook
- `src/utils/coverQuality.ts` -- quality calculation utilities
- Migration for `song_covers` table

## Files to Modify

- `src/App.tsx` -- add `/song-rankings` route
- `src/components/ui/navigation.tsx` -- add nav link
- `src/components/ui/HorizontalNavigation.tsx` -- add nav link
- `src/components/VersionHeader.tsx` -- bump to v1.0.656
- `src/pages/VersionHistory.tsx` -- add changelog entry

