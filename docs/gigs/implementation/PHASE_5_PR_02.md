# Phase 5 PR 02 — Canonical Outcome DTO and Summary Service

## Purpose

Build the first canonical gig outcome read model for Phase 5. The intent is to make one typed DTO the foundation for the current report, future headline result, performance story, detailed report, replay, live viewer, tour history, sharing, and spectator surfaces.

This PR does not redesign the report UI, add Canvas, add replay, rebalance gigs, change rewards, edit historical migrations, or rewrite existing gig calculations.

## Existing loading issues

### Current flow before this PR

1. `PerformGig` loaded `gigs` with `venues`.
2. It separately loaded `gig_outcomes` and nested `gig_song_performances`.
3. It loaded setlists, then counted setlist songs with one query per setlist.
4. It loaded current setlist songs, rehearsals, equipment count, crew count, and band summary fields.
5. It reconstructed `breakdown_data`, `gear_effects`, chemistry aliases, and equipment-cost aliases in the page.
6. `GigOutcomeReport` ran additional compatibility mapping and could refetch song performances if nested rows were absent.
7. Child report cards still owned additional presentation fallbacks and member/reward fetching.

### Problems found

- Outcome data was loaded through multiple paths rather than one canonical report path.
- Page-level transforms rebuilt nested objects from flat outcome columns.
- `safeNumber` semantics hid missing legacy values by converting them to `0`.
- Compatibility aliases existed in both `PerformGig` and `GigOutcomeReport`.
- Missing song data could trigger an extra outcome lookup plus child song query.
- Song and performer data were not represented in one future-proof outcome shape.
- Client-side fallback values were not clearly distinguished from authoritative values.

### Target flow introduced

`PerformGig` now requests `GigExperienceDTO` through `useGigExperience(gigId)`. `GigExperienceService` owns outcome, song, setlist-title, performer, venue, legacy compatibility, normalisation, validation, and report-summary mapping. `GigOutcomeReport` can consume the DTO while retaining the existing visual layout through a temporary adapter.

## Architecture

```text
PerformGig
  └─ useGigExperience(["gig-experience", gigId])
       └─ getGigExperience(gigId)
            ├─ gigs + venue narrow select
            ├─ gig_outcomes narrow select
            ├─ gig_song_performances by outcome id
            ├─ setlist_songs + song titles by setlist id
            └─ gig_performers + profile display fields
                 ↓
              mapGigExperience()
                 ↓
              validateGigExperience()
                 ↓
              GigExperienceDTO
                 ↓
              GigOutcomeReport temporary adapter
```

## DTO diagram

```text
GigExperienceDTO
├─ gig
│  ├─ ids/status/timing
│  ├─ ticketPrice: ReportMetric<number>
│  └─ venue
├─ headline
│  ├─ overallRating/grade/verdict
│  ├─ attendance/capacity
│  ├─ netProfit/fame/fans
│  └─ bestSongTitle
├─ songs[]
│  ├─ position/title/score/crowdResponse
│  └─ contribution metrics
├─ performers[]
├─ finances
├─ progression
├─ analysis
│  ├─ technical factor metrics
│  ├─ stage behavior
│  ├─ gearEffects compatibility mapping
│  └─ warnings[]
├─ lessons
└─ viewer
```

## Interfaces

The DTO interfaces live in `src/features/gig-experience/types.ts`:

- `GigExperienceDTO`
- `GigExperienceGigDTO`
- `GigExperienceHeadlineDTO`
- `GigExperienceSongDTO`
- `GigExperiencePerformerDTO`
- `GigExperienceFinancesDTO`
- `GigExperienceProgressionDTO`
- `GigExperienceAnalysisDTO`
- `GigExperienceValidationError`

No raw database rows are exposed from the DTO.

## ReportMetric

`ReportMetric<T>` supports:

- `available` — authoritative, legacy, or derived value exists;
- `processing` — value is expected but not ready;
- `legacy_missing` — old outcome does not contain this value;
- `not_applicable` — value does not apply to this gig.

An actual zero is represented as `available` with value `0`. Missing data is never silently converted into zero inside the canonical DTO.

## Legacy compatibility

Centralised compatibility in `GigExperienceService` includes:

- flat outcome financial columns mapped into `finances`;
- legacy fan-gain columns combined into one progression metric;
- missing breakdowns represented as `legacy_missing`;
- gear modifier columns mapped into the existing gear-effect presentation shape;
- missing song rows and performer rows surfaced as warnings;
- absent stage behaviour represented as `not_applicable`.

## Query improvements

- Added one `getGigExperience()` query path for report outcome data.
- Uses narrow selects for gig, outcome, song performance, setlist-title, and performer data.
- Batches setlist-title and performer loading rather than putting title/profile lookups in child cards.
- Uses stable React Query key `['gig-experience', gigId]` and `staleTime` for memoised outcome reads.
- The report adapter avoids the previous report-level fallback song fetch when DTO song data is present.

## Validation

`validateGigExperience()` rejects:

- missing gig id;
- invalid venue name/capacity;
- negative attendance;
- attendance greater than venue capacity;
- rating outside `0..25`;
- duplicate performer profile IDs;
- duplicate song positions.

## Files changed

- `src/features/gig-experience/types.ts`
- `src/features/gig-experience/reportMetric.ts`
- `src/features/gig-experience/hooks.ts`
- `src/features/gig-experience/services/GigExperienceService.ts`
- `src/features/gig-experience/components/ReportMetricValue.tsx`
- `src/features/gig-experience/__tests__/GigExperienceService.test.ts`
- `src/pages/PerformGig.tsx`
- `src/components/gig/GigOutcomeReport.tsx`
- `docs/gigs/implementation/PHASE_5_PR_02.md`
- `docs/gigs/ROCKMUNDO_LIVE_GIG_IMPLEMENTATION_ROADMAP.md`
- `docs/gigs/LIVE_GIG_SYSTEM_AUDIT.md`

## Tests

Added unit coverage for:

- current gig outcome mapping;
- legacy missing metrics;
- missing songs;
- missing performers;
- zero attendance;
- sold-out attendance;
- negative profit;
- validation of impossible attendance;
- validation of rating limits;
- duplicate performer IDs;
- duplicate song positions;
- `ReportMetric` rendering semantics.

## Known limitations

- The current report UI is intentionally preserved and still contains legacy card-level fallbacks that should be removed during PR 03.
- Member reward presentation still has legacy child-card behaviour until the information architecture rebuild replaces it with DTO-native sections.
- The DTO has a viewer descriptor but not a canonical event timeline yet.
- Result readiness still relies on existing `completed_at` fields until a future authoritative `result_ready_at` exists.

## Recommended next PR

Phase 5 PR 03 should rebuild the outcome report information architecture around this DTO: headline result first, performance story second, detailed analysis collapsed third, and lessons/actions last.
