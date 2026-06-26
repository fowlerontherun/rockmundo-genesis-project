## Broken links audit

I scanned every `<Link to=…>`, `<a href=…>`, and `navigate(…)` call in `src/` and cross‑referenced them against the routes registered in `src/App.tsx`. After filtering out documentation/API path strings (`StageEquipmentSystemPlan.tsx`, `data/festivals.ts`), **15 unique in‑app paths are broken**. Three categories:

### A. Stale/typo links — repoint to existing route (no new pages)

| Broken link | Used in | Correct existing route |
|---|---|---|
| `/avatar` | `MyCharacterEdit.tsx` | `/avatar-designer` |
| `/band-manager` | `BandCreationForm.tsx`, `SetlistManager.tsx` | `/band` |
| `/bands` | `SimpleBandManager.tsx` | `/bands/browse` |
| `/media` | `ReleaseDetail.tsx` | `/hub/media` |
| `/perform-gig` | `fm/BottomActionBar.tsx` | `/gigs` (list — no gigId in context) |
| `/recording` | `social/SharedSpacesPresence.tsx` | `/recording-studio` |
| `/songs` | `MusicStudio.tsx` | `/song-manager` |
| `/tours` | `twaater/LinkedContentEmbed.tsx` | `/tour-manager` |
| `/in-game-market` | `hubs/CommerceHub.tsx` | `/song-market` |
| `/random-events` | `news/RandomEventsNews.tsx` | remove the link (no player‑facing page; only `/admin/random-events` exists) |
| `/library` | `travel/TravelProgressOverlay.tsx` | `/education` |

### B. Page component exists but isn't routed — just mount it

| Broken link | Existing component | Action |
|---|---|---|
| `/prison` | `src/pages/Prison.tsx` (already lazy‑imported in `App.tsx`) | Add `<Route path="prison" …>` |
| `/music-studio` | `src/pages/MusicStudio.tsx` | Lazy‑import and add `<Route path="music-studio" …>` |
| `/skills` | `src/pages/SkillsPage.tsx` | Lazy‑import and add `<Route path="skills" …>` |

### C. No page exists — create a stub

| Broken link | Used in | Plan |
|---|---|---|
| `/jobs` | `prison/DebtWarningBanner.tsx` | Create `src/pages/Jobs.tsx` that redirects to `/booking/work` (closest existing surface — work bookings are how jobs are taken). Keep the URL stable so the banner CTA continues to make sense. |

### Technical details

1. Edit the 11 source files in category A to point at the correct path. Pure string swaps — no logic changes.
2. In `src/App.tsx`:
   - Add lazy imports for `MusicStudio` and `SkillsPage`.
   - Register three new routes inside the existing authenticated route block: `prison`, `music-studio`, `skills`.
3. Create `src/pages/Jobs.tsx` as a `<Navigate to="/booking/work" replace />` component and register `<Route path="jobs" …>`.
4. Bump version in `src/components/VersionHeader.tsx` to **v1.1.416** and add an entry to `src/pages/VersionHistory.tsx` describing the broken‑link sweep.

### Out of scope

- The `/admin/equipment/*`, `/equipment/*`, and `/festival/*` strings flagged by the scan are API endpoint documentation in `StageEquipmentSystemPlan.tsx` and `data/festivals.ts`, not navigation links. Untouched.
- Deeper rework of the prison/jobs/skills surfaces (their content, not their routing) is a separate task.
