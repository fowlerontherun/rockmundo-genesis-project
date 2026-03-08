

# Phase 2: Page Layout Standardization — v1.1.000

## Problem
~100+ pages use inconsistent layouts: varying container padding (`p-4` vs `p-6` vs `px-4 py-8`), header sizes (`text-2xl` to `text-4xl`), spacing patterns, and no shared page wrapper. Hub pages are standardized via `CategoryHub` but all other pages are freeform.

## Approach
Rather than editing 100+ page files (too risky, too large), we create a **shared PageLayout wrapper component** and a **standardized PageHeader component**, then migrate pages in batches. This message covers the infrastructure + first batch (most-visited pages).

### New Shared Components

**`src/components/ui/PageLayout.tsx`** — Standard page wrapper
- Container: `container mx-auto px-4 py-6 space-y-6 max-w-6xl`
- Optional `wide` prop removes max-width constraint
- Consistent spacing between all children

**`src/components/ui/PageHeader.tsx`** — Standard page header
- Title: `text-2xl md:text-3xl font-bold tracking-tight font-oswald`
- Optional subtitle: `text-sm text-muted-foreground`
- Optional icon, back button, and action slot (right-aligned buttons)
- Optional breadcrumb showing hub link

### Standard Rules (documented)
- All page titles: `text-2xl md:text-3xl font-bold tracking-tight`
- Body text: `text-sm` (default), `text-base` for descriptions
- Card titles: `text-lg font-semibold`
- Stat values: `text-2xl font-bold`
- Tab triggers: consistent size via shared TabsList
- Container: always use `PageLayout` wrapper
- Colors: only use semantic tokens (primary, muted-foreground, etc.)

### CategoryHub Enhancement
- Add optional `heroImageUrl` prop for hub-specific banner images
- Add sub-section grouping (e.g., "Band Management", "Live Performance" as group headers within tiles)

### First Batch — 15 High-Traffic Pages
These get migrated to use `PageLayout` + `PageHeader`:

1. `Dashboard.tsx`
2. `Songwriting.tsx`
3. `RecordingStudio.tsx`
4. `GigBooking.tsx`
5. `Employment.tsx`
6. `Finances.tsx`
7. `Travel.tsx`
8. `Relationships.tsx`
9. `BandManager.tsx`
10. `Twaater.tsx`
11. `StreamingNew.tsx`
12. `ReleaseManager.tsx`
13. `Merchandise.tsx`
14. `Schedule.tsx`
15. `Inbox.tsx`

### Hub Pages — Add Section Grouping
Update `CategoryHub` to support grouped tiles with section headers:

```text
Band & Live Hub
───────────────
BAND MANAGEMENT
  [Band Manager] [Chemistry] [Finder] [Rankings] [Crew] [Vehicles] [Riders]

LIVE PERFORMANCE  
  [Gigs] [Open Mic] [Jam Sessions] [Busking] [Rehearsals] [Setlists] [Stage Equipment]

EVENTS & COMPETITIONS
  [Festivals] [Awards] [Eurovision] [Major Events]
```

### Files to Create
- `src/components/ui/PageLayout.tsx`
- `src/components/ui/PageHeader.tsx`

### Files to Modify
- `src/components/CategoryHub.tsx` — Add grouped tiles support with section headers
- 15 page files listed above — Wrap in PageLayout, replace ad-hoc headers with PageHeader
- 3 hub files (`BandLiveHub`, `WorldSocialHub`, `CareerBusinessHub`) — Add tile groupings
- `src/components/VersionHeader.tsx` → v1.1.000
- `src/pages/VersionHistory.tsx` → changelog entry

### What This Defers (Phase 3)
- Remaining ~85 pages (can be migrated incrementally)
- Image generation and placement
- Tab layout audit and standardization
- Font/color audit across all components

