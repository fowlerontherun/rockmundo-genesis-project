

# Phase 1: Navigation Consolidation — v1.0.999

## Goal
Reduce 12 navigation sections (~80 items) to 5 streamlined sections. Navigation menu only shows key items per section; full access is via hub tile pages.

## New Navigation Structure

```text
SECTION           NAV ITEMS (max 4-5 each)         HUB PAGE (full access)
─────────────────────────────────────────────────────────────────────────
Home              Dashboard, Inbox, Schedule,       /dashboard
                  News, Journal

My Music          Songwriting, Recording,           /hub/music
                  Releases, Streaming

Band & Live       Band Manager, Gigs,               /hub/band-live
                  Rehearsals, Festivals

World & Social    Cities, Travel, Twaater,          /hub/world-social
                  Relationships

Career & Business Employment, Finances,             /hub/career-business
                  Companies, Merchandise

Admin (if admin)  Admin Panel                        /admin
```

**Removed from nav** (still accessible via hub tiles): Skin Store, Tattoos, Legacy, Statistics, Education, Teaching, Music Videos, Song Market, Song Rankings, Stage Practice, Band Chemistry, Band Finder, Band Rankings, Band Crew, Band Vehicles, Band Riders, Open Mic, Jam Sessions, Busking, Setlists, Stage Equipment, Awards, Eurovision, Major Events, Tours, World Pulse, Housing, DikCok, Gettit, Player Search, Underworld, Lottery, Sponsorships, Record Labels, Modeling, Clothing Designer, PR, Offers, Venues, Producer Career, Inventory, all Media sub-pages, Radio Player.

## Hub Page Merges
- **Band & Live Hub** (`/hub/band-live`): New combined hub merging Band, Live, and Events tiles
- **World & Social Hub** (`/hub/world-social`): New combined hub merging World, Social, and Media tiles
- **Career & Business Hub** (`/hub/career-business`): New combined hub merging Career and Commerce tiles

Keep existing individual hubs (`/hub/character`, `/hub/music`) but update their tiles to match.

## Files to Modify

### Navigation (both nav components)
- `src/components/ui/navigation.tsx` — Rewrite `navSections` to 5 sections, ~4-5 items each
- `src/components/ui/HorizontalNavigation.tsx` — Same restructure

### New/Updated Hub Pages
- `src/pages/hubs/BandLiveHub.tsx` — New combined hub (Band + Live + Events tiles)
- `src/pages/hubs/WorldSocialHub.tsx` — New combined hub (World + Social + Media tiles)
- `src/pages/hubs/CareerBusinessHub.tsx` — New combined hub (Career + Commerce tiles)
- Delete or redirect old hubs: `BandHub.tsx`, `LiveHub.tsx`, `EventsHub.tsx`, `SocialHub.tsx`, `WorldHub.tsx`, `CommerceHub.tsx`, `MediaHub.tsx`, `CareerHub.tsx`

### Routing
- `src/App.tsx` — Update hub routes, add redirects from old hub paths

### Version
- `src/components/VersionHeader.tsx` → v1.0.999
- `src/pages/VersionHistory.tsx` → changelog entry

## Bottom Bar Update
Keep 5 shortcuts: Home, Music, Band, World, More (hamburger for full nav)

## What This Does NOT Change (Phase 2+)
- Page layout standardization (headers, text sizes, spacing)
- Image generation and placement
- Tab layout consistency
- Color scheme standardization across pages

