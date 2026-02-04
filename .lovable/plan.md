
# Plan: Major Festival System Expansion - v1.0.598

## Overview

This plan transforms festivals from a supplementary feature into a **core gameplay pillar** with deep integration across performances, tours, reputation, and revenue systems. The expansion covers:

1. **Festival Performance System** - Live "Perform Now" minigame with real-time scoring
2. **Festival History & Analytics** - Track all past performances with detailed metrics
3. **Enhanced Festival Discovery** - Festival map view, attendance projections, and tour routing
4. **Festival Sponsorships** - Brand partnerships that affect rewards and audience reception
5. **Festival Rivalry System** - Compete against other bands for best performance
6. **Post-Performance Reviews** - Critic reviews and fan reactions that affect reputation
7. **Festival Merch & Revenue** - Detailed merch sales tracking per festival
8. **Database & Edge Function Updates** - New tables and automated processing

---

## Part 1: Live Festival Performance System

### New "Perform Now" Minigame

Create an interactive performance loop when clicking "Perform Now":

**Performance Phases:**
1. **Soundcheck Phase** (1 min) - Quick-time events to tune/prepare
2. **Opening** - Energy building, crowd warming
3. **Main Set** - Core performance with song execution
4. **Crowd Interaction** - Fan engagement moments
5. **Climax/Encore** - High-energy finale

**Scoring Factors:**
- Song familiarity percentage (from rehearsals)
- Band chemistry level
- Equipped gear quality
- Setlist energy flow
- Crowd energy management
- Random event responses (technical issues, crowd surfers)

**UI Components:**
```
src/components/festivals/performance/
  FestivalPerformanceLoop.tsx     - Main minigame container
  PerformanceSoundcheck.tsx       - Soundcheck phase UI
  PerformanceSongExecution.tsx    - Song-by-song performance
  CrowdEnergyMeter.tsx           - Real-time crowd visualization
  PerformanceEventHandler.tsx    - Random events during set
  PerformanceScoreBreakdown.tsx  - Post-performance scoring
```

---

## Part 2: Festival Performance History

### New Database Table: `festival_performance_history`

```sql
CREATE TABLE festival_performance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participation_id UUID REFERENCES festival_participants(id),
  band_id UUID REFERENCES bands(id),
  festival_id UUID REFERENCES game_events(id),
  user_id UUID REFERENCES auth.users(id),
  
  -- Performance Metrics
  performance_score INTEGER DEFAULT 0,
  crowd_energy_peak INTEGER DEFAULT 0,
  crowd_energy_avg INTEGER DEFAULT 0,
  songs_performed INTEGER DEFAULT 0,
  setlist_id UUID REFERENCES setlists(id),
  
  -- Rewards Earned
  payment_earned INTEGER DEFAULT 0,
  fame_earned INTEGER DEFAULT 0,
  merch_revenue INTEGER DEFAULT 0,
  new_fans_gained INTEGER DEFAULT 0,
  
  -- Reviews
  critic_score INTEGER, -- 0-100
  fan_score INTEGER,   -- 0-100
  review_headline TEXT,
  review_summary TEXT,
  
  -- Highlights
  highlight_moments JSONB DEFAULT '[]',
  
  -- Context
  slot_type TEXT,
  stage_name TEXT,
  performance_date TIMESTAMPTZ,
  attendance_estimate INTEGER,
  weather_conditions TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Festival History UI

Create a new tab in the Festival Browser showing performance history:

```
src/pages/FestivalHistory.tsx        - Dedicated history page
src/components/festivals/history/
  FestivalHistoryCard.tsx            - Single performance summary
  FestivalHistoryStats.tsx           - Aggregated career stats
  FestivalComparisonChart.tsx        - Compare performances over time
```

**Career Festival Stats to Track:**
- Total festivals performed
- Average performance score
- Total earnings from festivals
- Highest-rated performance
- Most fans gained at single festival
- Headline slots achieved
- Unique festivals played

---

## Part 3: Festival Discovery & Map View

### Festival Map Component

Interactive map showing festivals with:
- Geographic location markers
- Travel cost calculations from player's current city
- Distance and travel time estimates
- Filter by date/genre/capacity
- Tour routing suggestions (if multiple festivals nearby)

```
src/components/festivals/discovery/
  FestivalMapView.tsx          - Interactive map with festival markers
  FestivalRouteOptimizer.tsx   - Suggest efficient tour routing
  FestivalTravelCost.tsx       - Show travel costs to each festival
  FestivalGenreMatch.tsx       - Show genre compatibility percentage
```

### Attendance Projections Integration

Connect `FestivalCrowdProjections` component to actual festival data:
- Pull real genre match from band profile
- Calculate attendance based on historical data
- Show competitor bands in same time slots
- Recommend optimal slot based on band's draw power

---

## Part 4: Festival Sponsorship System

### New Database Table: `festival_sponsorships`

```sql
CREATE TABLE festival_sponsorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id UUID REFERENCES game_events(id),
  brand_id UUID REFERENCES sponsorship_brands(id),
  sponsorship_type TEXT CHECK (sponsorship_type IN ('title', 'presenting', 'stage', 'category')),
  
  -- Financial
  sponsorship_amount INTEGER DEFAULT 0,
  revenue_share_percent NUMERIC DEFAULT 0,
  
  -- Impact
  crowd_mood_modifier INTEGER DEFAULT 0, -- Positive or negative
  merch_sales_modifier NUMERIC DEFAULT 1.0,
  fame_modifier NUMERIC DEFAULT 1.0,
  
  -- Exclusivity
  is_exclusive BOOLEAN DEFAULT false,
  required_mentions INTEGER DEFAULT 0, -- Stage mentions during set
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### How Sponsorships Work

**For Performers:**
- Some sponsors boost certain genres (+10% rock crowd at energy drink sponsor)
- Brand alignment affects crowd reception
- Meeting mention requirements provides bonus payment
- Sponsor conflicts (competing brands) can reduce rewards

**Sponsor Tiers:**
| Tier | Example Brands | Modifier Effect |
|------|---------------|-----------------|
| Title | Red Bull, Heineken | +15% fame, +20% merch |
| Presenting | Spotify, Apple Music | +10% fame |
| Stage | Gibson, Fender | +10% performance (matching gear) |
| Category | Monster Energy, Budweiser | +5% crowd energy |

---

## Part 5: Festival Rivalry System

### Rivalry Objectives

When multiple bands play the same festival, introduce competition:

**New Table: `festival_rivalries`**
```sql
CREATE TABLE festival_rivalries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id UUID REFERENCES game_events(id),
  band_a_id UUID REFERENCES bands(id),
  band_b_id UUID REFERENCES bands(id),
  
  rivalry_type TEXT CHECK (rivalry_type IN ('genre_clash', 'fame_battle', 'crowd_favorite', 'critical_acclaim')),
  
  winner_band_id UUID REFERENCES bands(id),
  band_a_score INTEGER,
  band_b_score INTEGER,
  
  fame_stakes INTEGER DEFAULT 500, -- Loser loses this, winner gains
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Rivalry Types:**
- **Genre Clash**: Similar genre bands compete for same audience
- **Fame Battle**: Close fame levels compete head-to-head
- **Crowd Favorite**: Most audience engagement wins
- **Critical Acclaim**: Best critic score wins

**UI Component:**
```
src/components/festivals/rivalry/
  FestivalRivalryCard.tsx     - Show rivalry matchups
  RivalryScoreboard.tsx       - Live scoring during festival
  RivalryOutcome.tsx          - Post-festival rivalry results
```

---

## Part 6: Post-Performance Reviews System

### Enhanced Review Generation

Expand beyond the current mock reviews in `FestivalPerformanceOutcome`:

**New Table: `festival_reviews`**
```sql
CREATE TABLE festival_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_id UUID REFERENCES festival_performance_history(id),
  band_id UUID REFERENCES bands(id),
  
  reviewer_type TEXT CHECK (reviewer_type IN ('critic', 'fan', 'industry', 'blog')),
  publication_name TEXT,
  
  score INTEGER, -- 0-100
  headline TEXT,
  review_text TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  
  -- Reputation Effects
  fame_impact INTEGER DEFAULT 0,
  genre_cred_impact INTEGER DEFAULT 0,
  
  -- Visibility
  is_featured BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  
  published_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Review Sources:**
| Source | Weight | Fame Impact Range |
|--------|--------|-------------------|
| Major Critic (NME, Pitchfork) | High | -500 to +1000 |
| Industry Blog | Medium | -100 to +300 |
| Fan Forum | Low | -50 to +150 |
| Social Media Buzz | Variable | -200 to +500 |

### Review UI
```
src/components/festivals/reviews/
  FestivalReviewCard.tsx       - Individual review display
  ReviewAggregator.tsx         - Combined review score
  ReviewReputation.tsx         - Show reputation effects
```

---

## Part 7: Festival Merch & Revenue Integration

### Detailed Merch Tracking

Connect festival performances to merch sales:

**New Table: `festival_merch_sales`**
```sql
CREATE TABLE festival_merch_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_id UUID REFERENCES festival_performance_history(id),
  band_id UUID REFERENCES bands(id),
  festival_id UUID REFERENCES game_events(id),
  
  -- Sales Data
  tshirts_sold INTEGER DEFAULT 0,
  posters_sold INTEGER DEFAULT 0,
  albums_sold INTEGER DEFAULT 0,
  other_items_sold INTEGER DEFAULT 0,
  
  gross_revenue INTEGER DEFAULT 0,
  festival_cut INTEGER DEFAULT 0,
  net_revenue INTEGER DEFAULT 0,
  
  -- Context
  merch_booth_location TEXT,
  weather_impact NUMERIC DEFAULT 1.0,
  performance_boost NUMERIC DEFAULT 1.0, -- Based on performance score
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Revenue Formula:**
```typescript
const merchRevenue = baseMerchSales 
  * (1 + performanceScore / 200)     // Good performance = +50% max
  * (1 + crowdEnergy / 100)          // High energy = +100% max
  * festivalAttendanceMultiplier     // Larger festivals = more sales
  * sponsorMerchModifier;            // Sponsor boosts
```

---

## Part 8: Database & Edge Function Updates

### New Tables Summary

| Table | Purpose |
|-------|---------|
| `festival_performance_history` | Track all performances with detailed metrics |
| `festival_sponsorships` | Brand partnerships per festival |
| `festival_rivalries` | Band competitions at festivals |
| `festival_reviews` | Critic and fan reviews |
| `festival_merch_sales` | Merch revenue tracking |

### Enhanced Columns for Existing Tables

**`festival_participants`** additions:
```sql
ALTER TABLE festival_participants ADD COLUMN IF NOT EXISTS
  setlist_id UUID REFERENCES setlists(id),
  stage_name TEXT,
  performance_time TIME,
  soundcheck_time TIME,
  tech_rider_approved BOOLEAN DEFAULT false,
  is_confirmed_attendance BOOLEAN DEFAULT false,
  arrival_confirmed_at TIMESTAMPTZ;
```

**`game_events`** additions for festivals:
```sql
ALTER TABLE game_events ADD COLUMN IF NOT EXISTS
  festival_status TEXT DEFAULT 'draft',
  total_stages INTEGER DEFAULT 1,
  headliner_count INTEGER DEFAULT 1,
  venue_id UUID REFERENCES venues(id),
  weather_forecast TEXT,
  attendance_projection INTEGER,
  sponsor_ids JSONB DEFAULT '[]';
```

### Edge Function: `complete-festival-performance`

Process festival performances:

1. Calculate final performance score
2. Generate reviews based on score
3. Calculate merch sales
4. Distribute payments
5. Update fame/fans
6. Resolve rivalries
7. Store performance history
8. Send inbox notifications

---

## Part 9: UI Enhancements

### Enhanced Festival Browser

Update `FestivalBrowser.tsx` with new tabs:

```typescript
<Tabs>
  <TabsTrigger value="browse">Discover</TabsTrigger>
  <TabsTrigger value="map">Map View</TabsTrigger>       // NEW
  <TabsTrigger value="my-festivals">My Festivals</TabsTrigger>
  <TabsTrigger value="history">History</TabsTrigger>    // NEW
  <TabsTrigger value="offers">Offers</TabsTrigger>
</Tabs>
```

### Festival Detail Page

Create dedicated festival detail page:

```
src/pages/FestivalDetail.tsx
```

Shows:
- Full lineup with stages and times
- Attendance projections
- Sponsor information
- Genre match analysis
- Travel cost from current location
- Rivalry matchups
- Weather forecast

---

## Part 10: Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/components/festivals/performance/FestivalPerformanceLoop.tsx` | Main performance minigame |
| `src/components/festivals/performance/CrowdEnergyMeter.tsx` | Real-time crowd visualization |
| `src/components/festivals/performance/PerformanceScoreBreakdown.tsx` | Post-performance scoring |
| `src/components/festivals/discovery/FestivalMapView.tsx` | Interactive festival map |
| `src/components/festivals/history/FestivalHistoryCard.tsx` | Performance history display |
| `src/components/festivals/rivalry/FestivalRivalryCard.tsx` | Rivalry matchups |
| `src/components/festivals/reviews/FestivalReviewCard.tsx` | Review display |
| `src/pages/FestivalDetail.tsx` | Dedicated festival page |
| `src/pages/FestivalHistory.tsx` | Performance history page |
| `src/hooks/useFestivalPerformance.ts` | Performance minigame logic |
| `src/hooks/useFestivalHistory.ts` | Fetch performance history |
| `supabase/functions/complete-festival-performance/index.ts` | Process performances |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/FestivalBrowser.tsx` | Add Map and History tabs |
| `src/hooks/useFestivals.ts` | Add history queries |
| `src/components/festivals/FestivalCard.tsx` | Add rivalry/sponsor badges |
| `src/components/festivals/FestivalPerformanceOutcome.tsx` | Connect to real data |
| `src/App.tsx` | Add new festival routes |
| `src/components/VersionHeader.tsx` | Version bump |
| `src/pages/VersionHistory.tsx` | Changelog entry |

---

## Implementation Sequence

### Phase 1: Database Foundation
1. Create new tables with RLS policies
2. Add columns to existing tables
3. Create indexes for performance

### Phase 2: Performance History
1. Create history tracking tables
2. Build `useFestivalHistory` hook
3. Create history UI components
4. Update performance mutation to store history

### Phase 3: Enhanced Performance Loop
1. Build `FestivalPerformanceLoop` component
2. Add crowd energy visualization
3. Create scoring breakdown UI
4. Connect to existing setlist system

### Phase 4: Discovery & Map
1. Create map view component
2. Add travel cost calculations
3. Build genre match display
4. Integrate with existing city data

### Phase 5: Sponsorships & Rivalries
1. Seed sponsor data
2. Create rivalry detection logic
3. Build rivalry UI components
4. Connect to performance scoring

### Phase 6: Reviews & Merch
1. Create review generation logic
2. Build review display components
3. Add merch tracking
4. Update revenue calculations

---

## Technical Notes

### Performance Score Formula
```typescript
function calculateFestivalPerformanceScore(
  songFamiliarity: number,      // 0-100, from rehearsals
  gearQuality: number,          // 0-100, from equipment
  bandChemistry: number,        // 0-100, from chemistry system
  setlistFlow: number,          // 0-100, calculated from energy curve
  crowdManagement: number,      // 0-100, from minigame performance
  eventResponses: number        // 0-100, how well handled random events
): number {
  const weights = {
    songFamiliarity: 0.25,
    gearQuality: 0.15,
    bandChemistry: 0.20,
    setlistFlow: 0.15,
    crowdManagement: 0.15,
    eventResponses: 0.10
  };
  
  return Math.round(
    songFamiliarity * weights.songFamiliarity +
    gearQuality * weights.gearQuality +
    bandChemistry * weights.bandChemistry +
    setlistFlow * weights.setlistFlow +
    crowdManagement * weights.crowdManagement +
    eventResponses * weights.eventResponses
  );
}
```

### Crowd Energy Curve
```typescript
// Energy should flow: Build -> Peak -> Sustain -> Climax
function calculateSetlistFlow(songs: Song[]): number {
  const idealCurve = [0.3, 0.5, 0.7, 0.8, 0.85, 0.9, 0.85, 0.95, 1.0];
  const actualCurve = songs.map(s => s.energy_level / 100);
  
  // Compare curves and score similarity
  return calculateCurveSimilarity(idealCurve, actualCurve);
}
```

---

## Expected Outcomes

- **Meaningful Festival Choice**: Players strategically select festivals based on genre match, travel cost, and rivalry opportunities
- **Engaging Performance Loop**: Active gameplay during festival performances rather than passive simulation
- **Career Tracking**: Complete history of all festival performances with metrics
- **Reputation Integration**: Reviews and rivalries directly affect band reputation
- **Economic Depth**: Merch sales, sponsorships, and payouts create revenue strategy
- **Map Exploration**: Visual discovery of festivals encourages tour planning

---

## Version

**v1.0.598** - Festival System Major Expansion
