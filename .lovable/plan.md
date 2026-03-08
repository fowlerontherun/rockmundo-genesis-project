

# Phase 3: Migrate Remaining Pages to PageLayout/PageHeader — v1.1.001

## Current State
- `PageLayout` and `PageHeader` components exist but **no pages actually import them**
- 13 pages were updated inline with standard classes (`container mx-auto px-4 py-6 space-y-6 max-w-6xl`) but still don't use the shared components
- ~18 pages still use `text-4xl font-bold` headers instead of the standard `text-2xl md:text-3xl`
- ~200 files use `container mx-auto` with wildly varying padding/spacing patterns (`p-4`, `p-6`, `px-4 py-8`, `space-y-6 p-4 md:p-6`, etc.)

## Approach
Migrate pages in 3 batches across this and future messages. This message tackles **Batch A: 25 high-visibility pages** — wrapping them in `<PageLayout>` and replacing ad-hoc headers with `<PageHeader>`.

## Batch A — 25 Pages to Migrate

**Already using standard classes (just need component swap):**
1. `Dashboard.tsx` — swap inline classes for `<PageLayout>` + `<PageHeader>`
2. `Songwriting.tsx`
3. `GigBooking.tsx`
4. `Employment.tsx`
5. `Finances.tsx`
6. `Travel.tsx`
7. `Relationships.tsx`
8. `BandManager.tsx`
9. `Merchandise.tsx`
10. `RecordingStudio.tsx`
11. `Schedule.tsx`
12. `ReleaseManager.tsx`
13. `StreamingNew.tsx`

**Need full standardization (wrong header sizes, padding, etc.):**
14. `Awards.tsx` — needs container + header fix
15. `Housing.tsx` — needs container + header fix
16. `Education.tsx` — custom layout, different padding
17. `Lottery.tsx` — needs container wrap
18. `DikCok.tsx` — `text-4xl` → standard
19. `SongMarket.tsx` — `text-4xl` → standard
20. `StreamingPlatforms.tsx` — `text-4xl` → standard
21. `HallOfFame.tsx` — `text-4xl` → standard
22. `RecordLabel.tsx` — `text-4xl` → standard
23. `FestivalsNew.tsx` — `text-4xl` → standard
24. `MusicStudio.tsx` — `text-4xl` → standard
25. `Twaater.tsx` — custom layout, needs PageLayout

## Pattern
Each page migration follows the same pattern:

```tsx
// BEFORE
<div className="container mx-auto p-6 space-y-6">
  <h1 className="text-4xl font-bold">Page Title</h1>
  <p className="text-muted-foreground">Description</p>
  ...content...
</div>

// AFTER
<PageLayout>
  <PageHeader 
    title="Page Title" 
    subtitle="Description"
    icon={SomeIcon}
    backTo="/hub/relevant-hub"
    backLabel="Back to Hub"
  />
  ...content...
</PageLayout>
```

## Files to Modify
- 25 page files listed above
- `src/pages/Inbox.tsx` — also needs migration (was in batch 1 but not done)
- `src/components/VersionHeader.tsx` → v1.1.001
- `src/pages/VersionHistory.tsx` → changelog entry

## What This Achieves
- All 25+ most-visited pages use the shared layout system
- Consistent headers, spacing, and max-width across all migrated pages
- Back-to-hub navigation on every sub-page
- Single point of control: changing `PageLayout` or `PageHeader` updates all pages at once

