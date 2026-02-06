

# Navigation Audit and Fix Plan

## Problem

Several major features have routes defined in `App.tsx` but are completely missing from the navigation menu in `src/components/ui/navigation.tsx`, making them inaccessible to players. Most critically:

- **Awards** (`/awards`) -- Full award show system with ceremonies, voting, nominations -- zero navigation entry
- **Modeling** -- `ModelingOffersPanel` component exists but is **not imported by any page**, meaning the entire modeling system is orphaned and unreachable
- **Offers Dashboard** (`/offers-dashboard`) -- Sponsorship/contract management page -- no navigation entry

## Full Audit: Missing Navigation Items

### Critical (Major features, completely inaccessible)

| Feature | Route | Status |
|---------|-------|--------|
| Awards | `/awards` | Route exists, no nav item |
| Modeling | *none* | Component exists but no page imports it |
| Offers Dashboard | `/offers-dashboard` | Route exists, no nav item |
| Schedule | `/schedule` | Route exists, no nav item |

### Important (Useful pages, no nav entry)

| Feature | Route | Status |
|---------|-------|--------|
| Song Manager | `/song-manager` | Route exists, no nav item |
| Song Market | `/song-market` | Route exists, no nav item |
| Legacy | `/legacy` | Route exists, no nav item |
| Band Vehicles | `/band-vehicles` | Route exists, no nav item |
| Band Riders | `/band-riders` | Route exists, no nav item |
| World Pulse | `/world-pulse` | Route exists, no nav item |
| Competitive Charts | `/competitive-charts` | Route exists, no nav item |
| Player Search | `/players/search` | Route exists, no nav item |
| Band Browser | `/bands/browse` | Route exists, no nav item |

## Implementation Plan

### Step 1: Create a Modeling Page

Since `ModelingOffersPanel` is not imported anywhere, create a dedicated `/modeling` page that renders it, and add a route in `App.tsx`.

- New file: `src/pages/Modeling.tsx`
- Wire it up with the user's looks/fame from game data
- Add route in `App.tsx`: `<Route path="modeling" element={<Modeling />} />`

### Step 2: Add Missing Nav Items to Navigation

Update `src/components/ui/navigation.tsx` to add entries in the appropriate sections:

**Performance section** (add):
- Awards: `{ icon: Award, labelKey: "nav.awards", path: "/awards" }`

**Home section** (add):
- Schedule: `{ icon: Calendar, labelKey: "nav.schedule", path: "/schedule" }`
- Offers: `{ icon: Handshake, labelKey: "nav.offers", path: "/offers-dashboard" }`

**Music section** (add):
- Song Manager: `{ icon: ListMusic, labelKey: "nav.songManager", path: "/song-manager" }`

**Band section** (add):
- Band Browser: `{ icon: Users, labelKey: "nav.bandBrowser", path: "/bands/browse" }`

**Social section** (add):
- Player Search: `{ icon: UserPlus, labelKey: "nav.playerSearch", path: "/players/search" }`
- World Pulse: `{ icon: Globe, labelKey: "nav.worldPulse", path: "/world-pulse" }`

**Business section** (add):
- Modeling: `{ icon: Sparkles, labelKey: "nav.modeling", path: "/modeling" }`

### Step 3: Add Translation Keys

Add the corresponding translation keys for each new nav item to the translation system so labels render correctly.

### Step 4: Update Version

- Bump version to `1.0.612` in `VersionHeader.tsx`
- Add changelog entry in `VersionHistory.tsx` documenting the navigation additions and modeling page creation

## Files to Create/Modify

- **Create**: `src/pages/Modeling.tsx` (new page wrapping `ModelingOffersPanel`)
- **Modify**: `src/App.tsx` (add `/modeling` route)
- **Modify**: `src/components/ui/navigation.tsx` (add missing nav items)
- **Modify**: `src/hooks/useTranslation.ts` or translation file (add new label keys)
- **Modify**: `src/components/VersionHeader.tsx` (version bump)
- **Modify**: `src/pages/VersionHistory.tsx` (changelog)

