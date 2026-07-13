# Navigation and hub refactor plan

## Scope of this PR

PR 1 is intentionally narrow: document the current routing/navigation architecture and make Character open a predictable overview page instead of restoring or defaulting to Wellness. Broader hub consolidation is deferred to later PRs.

## Repository evidence audited

- Primary routes are declared in `src/App.tsx` inside the `BrowserRouter`/`Routes` tree.
- Authenticated game pages are children of `src/components/Layout.tsx`, which wraps content in `FMShell`, `CharacterGate`, global breadcrumbs and game-wide automation hooks.
- Desktop/module navigation is configured in `src/config/fmNavigation.ts` and rendered by `src/components/fm/ModuleTabs.tsx`, `SubTabs.tsx` and `FMSidebar.tsx`.
- Breadcrumbs are segment-based in `src/components/ui/Breadcrumbs.tsx`.
- Admin visibility in the primary module tabs is controlled by `useUserRole()` in `ModuleTabs.tsx`; route components themselves are not consistently wrapped with `AdminRoute` in `App.tsx`.
- Last-module-path restoration is implemented by `ModuleTabs.tsx` through `getLastModulePath()`/`recordModulePath()` from `src/lib/fmHistory.ts`.
- The default post-login path currently resolves through `src/pages/Index.tsx`, which navigates authenticated players with a living character to `/dashboard`.

## Current navigation inventory

### Top module tabs

Current FM modules are:

1. Overview (`/dashboard`)
2. Character (was `/hub/character`; PR 1 changes it to `/character`)
3. Music (`/hub/music`)
4. Band & Live (`/hub/band-live`)
5. Career & Business (`/hub/career-business`)
6. World (`/hub/world`)
7. Social (`/social` and `/hub/social` surfaces both exist)
8. Media & Fun
9. Admin (`/admin`, visible only for admins in module tabs)

### Character entries before PR 1

Character-owned paths in the module configuration included `/hub/character`, `/characters`, `/my-character`, `/avatar-designer`, `/wellness`, `/skin-store`, `/tattoo-parlour`, `/gear`, `/gear-shop`, `/inventory`, `/clothing-shop`, `/housing`, `/personal-vehicles`, `/family`, `/legacy` and `/hall-of-immortals`.

Before this PR the Character top-level module root was `/hub/character`, a tile hub, while Wellness was a Character subtab and sidebar item. Because primary module clicks restored the last path for inactive modules, a player who last visited `/wellness` could click Character and be returned to Wellness instead of a stable Character landing page.

## Current route inventory by observed route families

The repository currently has many flat authenticated routes rather than nested hub routes. Important route families observed in `src/App.tsx` include:

- Home/overview: `/home`, `/dashboard`, `/inbox`, `/schedule`, `/todays-news`, `/statistics`, `/advisor`, `/journal`.
- Character: `/character` (added in PR 1), `/hub/character`, `/characters`, `/characters/new`, `/my-character`, `/my-character/edit`, `/avatar-designer`, `/wellness`, `/skills`, `/education`, `/inventory`, `/clothing-shop`, `/skin-store`, `/tattoo-parlour`, `/gear`, `/gear-shop`, `/housing`, `/personal-vehicles`, `/family/timeline`, `/legacy`, `/hall-of-immortals`.
- Music: `/hub/music`, `/music`, `/music-hub`, `/songwriting`, `/stage-practice`, `/recording-studio`, `/release-manager`, `/release/:id`, `/music-videos`, `/streaming-platforms`, `/streaming/:platformId`, `/song-manager`, `/song-market`, `/song-rankings`, `/music/charts`, `/country-charts`, `/christmas-charts`, `/competitive-charts`.
- Band/live: `/hub/band-live`, `/band`, `/band/repertoire`, `/bands/:bandId/management`, `/bands/browse`, `/bands/search`, `/bands/finder`, `/band/:bandId`, `/chemistry`, `/setlists`, `/rehearsals`, `/jams`, `/jam-sessions`, `/gigs`, `/gig-booking`, `/gigs/perform/:gigId`, `/performance/gig/:gigId`, `/open-mic`, `/busking`, `/tour-manager`, `/festivals`, `/major-events`, `/events/eurovision`, `/awards`, `/stage-setup`, `/stage-equipment`, `/band-crew`, `/band-riders`, `/band-vehicles`.
- World: `/hub/world`, `/world`, `/world-map`, `/world-pulse`, `/cities`, `/cities/:cityId`, `/cities/treasury`, `/travel`, `/venues`, `/landmarks`, `/nightclubs`, `/nightclub/:clubId`.
- Business/career: `/hub/career-business`, `/my-companies`, `/world-companies`, `/companies/directory`, `/company/:companyId`, `/labels`, `/labels/:labelId/manage`, `/finances`, `/jobs`, `/employment`, `/sponsorships`, `/modeling`, `/producer-career`, `/clothing-designer`, `/record-label` redirect.
- Social: `/social`, `/hub/social`, `/gettit`, `/twaater`, `/twaater/messages`, `/twaater/notifications`, `/relationships` redirect, `/players/search` redirect, `/player/:playerId`.
- Media/fun: `/hub/media`, `/media/radio`, `/radio/:stationId`, `/media/tv-shows`, `/media/newspapers`, `/media/magazines`, `/media/podcasts`, `/media/films`, `/acting`, `/casino`, `/lottery`, `/premium-store`, `/blind-boxes`.
- Admin: many `/admin/*` routes declared in `App.tsx`.

## Redirects and index/default routes observed

- `/streaming` redirects to `/streaming-platforms`.
- `/community/feed` redirects to `/gettit`.
- `/radio` and `/radio-stations` redirect to `/media/radio`.
- `/relationships` redirects to `/social?tab=friends`.
- `/players/search` redirects to `/social?tab=discover`.
- `/hub` redirects to `/dashboard`.
- Legacy hub aliases redirect: `/hub/band`, `/hub/live`, `/hub/events`, `/hub/world-social`, `/hub/career`, `/hub/commerce`.
- `/record-label` redirects to `/labels`.
- PR 1 adds `/character/overview` redirecting to `/character`.

## Problems found

- Top-level Character restored the last Character route, so Wellness could become the effective Character landing page.
- Character had a tile hub at `/hub/character` but no canonical `/character` overview route.
- Many routes are flat and are grouped only by navigation config, so breadcrumbs often reflect URL segments rather than product hierarchy.
- Music creation routes are split across Music and Band & Live contexts (`/songwriting`, `/stage-practice`, `/rehearsals`, `/recording-studio`, `/release-manager`, `/gigs`).
- Social has multiple entry points (`/social`, `/hub/social`, `/gettit`, `/twaater`, redirects from relationships/search).
- World/city/travel/venue routes are partially grouped by module but still live as independent top-level paths.
- Admin module visibility is gated in navigation, but the route table should be audited in a later PR for consistent `AdminRoute` coverage.
- Breadcrumb labels are maintained separately from module labels, increasing drift risk.

## Proposed target hierarchy

Target modules should evolve toward: Home, Character, Music, Band, World, Business, Social, Schedule, Career and Admin. The current repository has enough existing surfaces to support this target without inventing placeholder features, but it should be migrated gradually.

## Route migration map

| Existing route(s) | Target owner | PR |
| --- | --- | --- |
| `/character`, `/my-character`, `/characters`, `/skills`, `/wellness`, `/inventory`, `/clothing-shop`, `/avatar-designer` | Character | PR 1 starts with overview/default only |
| `/songwriting`, `/stage-practice`, `/recording-studio`, `/release-manager`, `/song-manager`, `/song-market` | Music | PR 3 |
| `/band`, `/band/repertoire`, `/chemistry`, `/rehearsals`, `/setlists`, `/gigs`, `/tour-manager`, `/band-crew` | Band | PR 4 |
| `/world`, `/cities`, `/travel`, `/venues`, `/world-pulse`, `/festivals` where world-facing | World | PR 5 |
| `/social`, `/gettit`, `/twaater`, `/twaater/messages`, `/relationships` alias | Social | PR 6 |
| `/my-companies`, `/company/:companyId`, `/labels`, `/finances`, `/jobs`, `/employment` | Business | PR 7 |
| `/awards`, `/competitive-charts`, `/statistics`, `/legacy`, fame/fans surfaces | Career | PR 7 |
| `/schedule`, `/booking/*`, current activity surfaces | Schedule | PR 8 |
| `/dashboard`, `/home`, `/inbox`, `/todays-news`, recommendations/widgets | Home | PR 8 |

## Backwards compatibility requirements

- Preserve existing deep links during migration.
- Prefer redirects/aliases over removing routes.
- Preserve query parameters when redirecting search/social/schedule routes in later PRs.
- Avoid redirect loops by keeping canonical overview routes as render routes, not redirects to child pages.
- Keep authorization behaviour unchanged in PR 1.

## Mobile and responsive considerations

The current shell is wrapped in `DesktopOnlyGate`, while module navigation itself uses horizontally scrollable tab bars and a collapsible sidebar. PR 1 uses responsive grids and existing cards/buttons so the Character Overview remains usable if mobile access is enabled later. Later PRs should revisit the desktop-only gate and mobile navigation parity as a dedicated slice.

## Accessibility considerations

PR 1 uses existing semantic page states, visible `h1`, labelled navigation links, non-icon-only controls and status cards with text labels. Future PRs should test keyboard focus order across module tabs, subtabs, sidebar collapse controls and hub quick actions.

## Risks

- Some admin routes may be reachable by direct URL if page-level guards are missing; this PR does not change admin protection.
- Navigation history restoration remains for non-Character modules and may need product review.
- Breadcrumbs remain segment-derived and may not match future logical hubs until a shared route metadata model exists.
- Route consolidation could break bookmarked URLs if aliases are removed too early.

## PR sequence

1. **PR 1 — Navigation audit and Character landing fix.** Add this audit, add Character Overview, make `/character` canonical, keep `/hub/character` and `/wellness` working, and add navigation tests.
2. **PR 2 — Shared hub layout and route conventions.** Standardise hub overview conventions, route metadata, page titles and breadcrumbs.
3. **PR 3 — Music hub consolidation.** Group songwriting, songs, practice, recording and releases with workflow links.
4. **PR 4 — Band hub consolidation.** Group band members, chemistry, rehearsals, setlists, gigs, tours, equipment and finances.
5. **PR 5 — World and Travel consolidation.** Group city, travel, venues, studios, shops, events and festivals.
6. **PR 6 — Social hub consolidation.** Group friends/messages/Twaater/forums/recruitment where implemented.
7. **PR 7 — Business and Career consolidation.** Split company/business routes from career/reputation/charts/awards surfaces.
8. **PR 8 — Schedule and Home improvements.** Make schedule defaults predictable and improve the home dashboard using existing widgets.
9. **PR 9 — Navigation polish and cleanup.** Responsive behaviour, accessibility, route alias cleanup and stale navigation removal.

## Explicit non-goals for PR 1

- No rewrite of the routing library or shell.
- No database changes.
- No broad Music/Band/World/Social/Business/Career migration.
- No removal of existing deep links.
- No redesign of the global navigation visual system.
