

# Rockmundo Daily News - Newspaper Redesign

## Overview
Revive and expand the `/todays-news` page into a proper daily newspaper called **"The Rockmundo Times"** with a newspaper-style layout, masthead, columns, and diverse content sections pulled from across the game world. Add a prominent link from the dashboard/navigation.

## Design Concept
- **Masthead**: "The Rockmundo Times" with the game date, season, edition number (based on game day), and a tagline
- **Newspaper columns**: CSS multi-column layout for desktop, single column on mobile
- **Serif fonts** for headlines (font-serif), monospace date line — classic broadsheet feel
- **Sections** organized like a real paper: Front Page, Entertainment, Business, Sports/Charts, Classifieds, Weather

## Content Sections (New + Existing)

### Front Page (Hero)
- **Top Story**: Auto-generated headline from the biggest event of the day (highest fame band activity, biggest chart mover, or major deal). Rotates daily using a seeded random based on the date
- **Breaking News Ticker**: Scrolling banner of recent events (new bands, releases, deals)

### Entertainment Section
- **Last Night's Gigs** (existing `LastNightGigs`)
- **New Releases Today** (existing inline query, extract to component)
- **Chart Movers** (existing `ChartMoversSection`)
- **Top Tracks** (existing `TopTracksNews`)
- **Festival News** (existing inline query)
- **Interview Results**: Pull from `interview_results` table — "Band X sat down with Magazine Y"
- **Music Reviews**: Pull from `festival_reviews` / `producer_session_reviews`

### Gossip & Drama Column
- **Band Drama**: Query `band_drama_events` and `social_drama_events` for juicy headlines
- **Romantic Events**: Query `romantic_events` for celebrity relationship news
- **Fashion Events**: Query `fashion_events` for style stories
- **Scandals**: Query `reputation_events` for negative reputation changes framed as scandals

### Business Section
- **Deal Announcements** (existing `DealAnnouncements`)
- **New Bands Formed** (existing inline query)
- **Label Signings**: From `artist_label_contracts`

### Your Column (Personal)
- **Personal Updates** (existing `PersonalUpdates`)
- **Player Gains** (existing `PlayerGainsNews`)
- **Band Gains** (existing `BandGainsNews`)
- **Earnings** (existing `EarningsNews`)
- **Merch Sales** (existing `MerchSalesNews`)
- **Random Events** (existing `RandomEventsNews`)

### Milestones & Achievements
- Existing `MilestoneNews`

### Weather & Classifieds (Flavor)
- **Weather Report**: Pull from `seasonal_weather_patterns` for current city weather
- **Classifieds**: Band invitations styled as classified ads, gig offers as "help wanted"

### Trending
- Existing `TrendingHashtags` styled as a sidebar widget

## "Fresh Each Day" Mechanics
- Use the current date as a seed for a deterministic random to pick headline styles, taglines, and column ordering
- Rotate "Quote of the Day" from a curated list using date-based index
- Show different "Editor's Pick" emphasis based on what data actually exists that day
- Empty sections are hidden, so the paper always looks full

## Navigation
- Add a "News" link with a `Newspaper` icon to the hub navigation in `HorizontalNavigation.tsx`

## Technical Plan

### Files to Create
1. **`src/components/news/NewspaperMasthead.tsx`** — Masthead with title, date, edition, weather
2. **`src/components/news/GossipColumn.tsx`** — Queries `band_drama_events`, `romantic_events`, `fashion_events`, `reputation_events`
3. **`src/components/news/WeatherReport.tsx`** — Queries `seasonal_weather_patterns` for current city
4. **`src/components/news/ClassifiedAds.tsx`** — Restyled band invitations and gig offers as classifieds
5. **`src/components/news/BreakingNewsTicker.tsx`** — Scrolling ticker component
6. **`src/components/news/InterviewNews.tsx`** — Queries `interview_results` for recent interviews
7. **`src/components/news/TopStoryHero.tsx`** — Picks the biggest story of the day

### Files to Modify
1. **`src/pages/TodaysNews.tsx`** — Complete rewrite with newspaper layout
2. **`src/components/ui/HorizontalNavigation.tsx`** — Add News link
3. **`src/components/VersionHeader.tsx`** — Bump version
4. **`src/pages/VersionHistory.tsx`** — Add changelog entry

### No Database Changes Required
All data sources already exist in the database.

