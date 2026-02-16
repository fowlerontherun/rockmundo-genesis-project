

# v1.0.744 -- Song Fame, Popularity, and Fan Favourite System

## Overview

Three new song-level metrics that add depth to career simulation:

- **Song Fame** (already exists as a column but is underutilized) -- a cumulative score reflecting how well-known a song is globally
- **Song Popularity** -- a dynamic "hotness" meter that rises with hype and drops with overplay, then recovers when rested
- **Fan Favourite** -- a semi-random flag where certain songs become beloved by fans regardless of quality

These feed into gig performance: famous songs played as encores get a bonus, popular songs boost crowd engagement, and fan favourites trigger special crowd reactions.

---

## New Columns (SQL Migration)

Add to the `songs` table:

```text
popularity         INTEGER DEFAULT 0       -- dynamic hotness (0-1000)
is_fan_favourite   BOOLEAN DEFAULT false   -- randomly assigned flag
fan_favourite_at   TIMESTAMPTZ            -- when it became a favourite
gig_play_count     INTEGER DEFAULT 0       -- how many times played live
last_gigged_at     TIMESTAMPTZ            -- last time played at a gig
```

The `fame` column (INTEGER) already exists.

---

## Song Fame Calculation

Fame grows based on cumulative career exposure. Calculated during daily processing and after gigs:

| Source | Fame Points |
|--------|------------|
| Streams | +1 per 1,000 streams |
| Sales (units) | +1 per 100 units sold |
| Radio plays | +2 per radio play |
| Hype | +1 per 50 hype |
| Countries streamed in | +5 per country |
| Gig plays | +3 per gig played |

Fame only goes up (never decays). A song with fame 500+ is considered "well-known", 1000+ is a "hit".

---

## Song Popularity Mechanics

Popularity is a dynamic value (0-1000) that fluctuates:

**Growth factors:**
- Each gig play: +15 popularity (diminishing: divided by sqrt of gig_play_count)
- Hype increases: popularity tracks hype loosely (+1 per 10 hype)
- Streaming momentum: +1 per 500 new streams

**Decay factors:**
- Overplay penalty: if played in 3+ gigs within 7 days, popularity drops by 20 per extra play
- Natural decay: -2 per day if not played and popularity > 100
- Recovery: if rested for 14+ days AND fame > 200, popularity recovers +5/day up to fame/2

This creates a natural cycle: a song gets hot, gets overplayed, cools off, and can come back later.

---

## Fan Favourite System

After each gig, there's a chance a performed song becomes a fan favourite:

- Base chance: 3% per song per gig
- Bonus if crowd_response was "ecstatic": +7%
- Bonus if song is encore: +5%
- Reduced chance if quality < 40: halved
- Only non-archived, non-fan-favourite songs eligible
- A band can have max 3 fan favourites at a time (oldest can be replaced after 30 days)

Fan favourite status gives:
- +15% crowd engagement when performed
- Special crowd chant moments during gigs
- +10 popularity per gig play (doesn't decay as fast)

---

## Encore Fame Bonus in Gigs

In `gigExecution.ts`, when processing song performances:

- If `is_encore === true` AND `song.fame >= 300`: apply a 1.15x multiplier to performance_score
- If `is_encore === true` AND `is_fan_favourite === true`: apply 1.25x multiplier instead
- Commentary generator gets new encore-specific lines referencing song fame

---

## Technical Details

### Files to create:
1. **`src/utils/songFamePopularity.ts`** -- Core calculation functions:
   - `calculateSongFame(songId)` -- aggregates fame from all sources
   - `updateSongPopularity(songId, event)` -- adjusts popularity based on events
   - `rollFanFavourite(songId, bandId, crowdResponse, isEncore)` -- random roll
   - `applySongPopularityDecay(songs)` -- daily decay/recovery logic
   - `getEncoreFameBonus(fame, isFanFavourite)` -- returns multiplier for gig scoring

### Files to modify:
2. **New SQL migration** -- Add `popularity`, `is_fan_favourite`, `fan_favourite_at`, `gig_play_count`, `last_gigged_at` columns to `songs`
3. **`src/utils/gigExecution.ts`** -- 
   - Fetch `fame`, `popularity`, `is_fan_favourite` alongside song data
   - Apply encore fame bonus to performance scoring
   - After gig: increment `gig_play_count`, update `last_gigged_at`, adjust popularity, roll for fan favourite
4. **`src/utils/enhancedCommentaryGenerator.ts`** -- Add fame-aware and fan-favourite commentary lines
5. **`src/components/band/RepertoireSongCard.tsx`** -- Display fame, popularity, and fan favourite badge
6. **`src/components/band/BandRepertoireTab.tsx`** -- Show fame/popularity columns, fan favourite indicator, allow sorting by popularity
7. **`src/hooks/useSongRankings.ts`** -- Add "fame" as a ranking type
8. **`src/components/VersionHeader.tsx`** -- Bump to 1.0.744
9. **`src/components/ui/navigation.tsx`** -- Bump version
10. **`src/pages/VersionHistory.tsx`** -- Add changelog entry

### Display in Repertoire:
- Fame shown as a flame icon with numeric value
- Popularity shown as a trending arrow (green up / red down / grey neutral)
- Fan favourite shown as a gold star badge with tooltip "Fan Favourite!"
- Songs sortable by fame and popularity

