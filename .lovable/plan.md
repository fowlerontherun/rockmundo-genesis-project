# Shared Page Layout Refactor

## Goal
Create one reusable layout shell so every major page has the same vertical structure, spacing, and responsive behavior. No business logic, queries, mutations, or state changes.

## New shared component

`src/components/ui/StandardPageLayout.tsx` — composes existing primitives (`PageLayout`, `PageHeader`, `Card`) into a single slot-based template:

```text
┌─────────────────────────────────────────┐
│ 1. Header  (title, subtitle, icon, back)│
├─────────────────────────────────────────┤
│ 2. Stats bar  (StatCard grid, optional) │
├─────────────────────────────────────────┤
│ 3. Primary content card  (main slot)    │
├─────────────────────────────────────────┤
│ 4. Secondary actions  (buttons/links)   │
└─────────────────────────────────────────┘
   5. Bottom nav is already global (Layout.tsx)
```

Props:
- `title`, `subtitle?`, `icon?`, `backTo?`, `headerActions?`
- `stats?: ReactNode` (renders inside a bordered bar, hidden if omitted)
- `children: ReactNode` (primary content card body)
- `secondaryActions?: ReactNode` (renders in a muted card at the bottom)
- `wide?: boolean` passthrough to `PageLayout`

The persistent bottom navigation already exists in `src/components/Layout.tsx` (`Navigation` / `HorizontalNavigation`) — no change needed there; the template just guarantees consistent top-down structure above it.

## Pages to refactor (visual structure only)

For each, wrap the existing JSX in `StandardPageLayout`, move the current title/icon into the header prop, lift any KPI tiles into `stats`, keep the main panel as `children`, and move tertiary buttons (e.g. "View history", "Settings", quick-action links) into `secondaryActions`.

1. `src/pages/Index.tsx` (dashboard)
2. `src/pages/hubs/CharacterHub.tsx` (artist page)
3. `src/pages/SimpleAdvancedGigSystem.tsx` (gigs)
4. `src/pages/ReleaseManager.tsx` (releases)
5. `src/pages/SongMarket.tsx` (marketplace)
6. `src/pages/MusicStudio.tsx` (studio)
7. `src/pages/hubs/CareerHub.tsx` (career)
8. `src/pages/Settings.tsx` (settings — confirm path during edit)

If a page name above maps to a different file in the codebase, I'll use the closest equivalent and note it in the version history entry rather than inventing a new page.

## Out of scope
- No data fetching, mutation, routing, permission, or content changes.
- No edits to child cards/components beyond what's needed to slot them into the new template.
- No changes to bottom navigation, theme tokens, or button variants (already standardized in v1.1.333).

## Versioning
Bump banner to **v1.1.334** and add a `VersionHistory.tsx` entry describing the unified page template rollout.

## Verification
- Visit each refactored route in the preview at 411px and 1280px widths to confirm header → stats → content → actions order, no overflow, and bottom nav still present.
- Confirm no TypeScript errors via the harness build.
