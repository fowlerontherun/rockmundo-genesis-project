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

## PR 2 update — shared hub layout and conventions

PR 2 establishes a reusable hub-page pattern without starting the Music consolidation or moving every legacy page. The implementation deliberately keeps the existing React Router v6 `BrowserRouter`/`Routes` table in `src/App.tsx` and the existing FM shell navigation in `src/config/fmNavigation.ts` so future migrations can remain incremental.

### Shared hub pattern

The shared pattern is `HubLayout` in `src/components/hub/HubLayout.tsx`, with concise developer notes in `src/components/hub/README.md`. A hub supplies static typed navigation items from `src/config/hubNavigation.ts` and the layout renders:

- a logical hub breadcrumb trail,
- the existing `PageHeader` visual treatment,
- optional contextual actions,
- optional summary/status content,
- horizontal child navigation for desktop and mobile,
- a content region that preserves child loading, empty and error states.

The layout intentionally does not generate routes. Route declarations remain explicit in `App.tsx` to match the current architecture and avoid circular imports between route definitions, global navigation and page components.

### Route conventions selected

RockMundo will use **Option A** for hub overviews: the stable base route renders the overview directly.

Examples:

- `/character` renders the Character overview.
- `/schedule` renders the Schedule overview.
- Future hubs should prefer `/music`, `/band`, `/world`, `/business`, `/social` and `/career` as render routes once each section is migrated.

`/section/overview` routes may exist only as compatibility aliases that redirect to the base overview. They should not become the canonical route.

### Child-route convention

Future child pages should use predictable hub-owned paths such as `/character/wellness` or `/music/songwriting` when a section is migrated. PR 2 does not move the existing flat pages into all final paths. Instead, it keeps current deep links working and adds a small number of explicit Character aliases:

- `/character/overview` redirects to `/character`.
- `/character/wellness` redirects to `/wellness`.
- `/character/skills` redirects to `/skills`.
- `/character/inventory` redirects to `/inventory`.
- `/character/wardrobe` redirects to `/clothing-shop`.
- `/schedule/overview` redirects to `/schedule`.

These redirects preserve query strings where practical and use `replace` so the browser back button does not bounce between alias and canonical route.

### Selected-route matching rules

Hub navigation items match:

1. their exact canonical path,
2. nested routes below that path,
3. explicit legacy or alias `matchPaths`,
4. paths regardless of query string,
5. paths with trailing slashes normalised.

Only the first matching hub item is treated as current. This prevents unrelated tabs from being highlighted while still allowing aliases such as `/character/wellness` to select Wellness.

### Breadcrumb convention

Hub breadcrumbs are metadata-driven, not raw URL-segment driven. The shared layout renders `Home > Hub label > Child label` using the active hub navigation item. Existing global breadcrumbs remain mounted in `Layout` for non-migrated pages and can be replaced gradually as hubs adopt `HubLayout`.

### Page-title convention

The browser title now uses hub context for migrated hubs:

- overview: `Character | Rockmundo`, `Schedule | Rockmundo`,
- child context: `Wellness | Character | Rockmundo`, `Education | Schedule | Rockmundo`.

Non-migrated pages continue to use route titles derived from FM navigation metadata, with module context added where it is safe to infer.

### Mobile navigation pattern

The shared hub child navigation uses the existing compact button styling and `fm-scrollbar-thin` horizontal overflow pattern already used by FM sub-tabs. This keeps active pages visible, avoids a new drawer/select interaction model, and works with touch, mouse and keyboard focus states.

### Accessibility expectations

Migrated hubs must keep:

- a labelled hub section and logical heading hierarchy,
- `aria-current="page"` on the active child link,
- labelled breadcrumb navigation,
- accessible labels for contextual actions,
- visible focus states from the existing button/link styles,
- non-colour selected-state indicators through button variant and text/icon state,
- no new animation unless it respects reduced-motion preferences.

### Sections migrated in PR 2

1. **Character** — selected because PR 1 made `/character` the canonical overview and the section already had clear existing child pages. Character now uses `HubLayout` and static hub metadata while preserving existing `/wellness`, `/skills`, `/inventory`, `/clothing-shop`, `/legacy` and related links.
2. **Schedule** — selected as the second low-risk vertical slice because `/schedule` already existed as a stable landing page, it has a small set of existing booking child routes, and it does not overlap with the upcoming Music consolidation. The Schedule page now uses `HubLayout` with child links to existing booking flows only.

### Sections still pending

Music, Band, World, Social, Business, Career, Media and the broader Home/dashboard surfaces remain on their existing hub or flat-page patterns. Music consolidation is explicitly deferred to PR 3.

### Deviations from the original plan

The original plan anticipated route metadata replacing segment-derived breadcrumbs more broadly. PR 2 limits metadata-driven breadcrumbs to pages rendered by `HubLayout` so the shared pattern can be reviewed independently without rewriting the global breadcrumb component or sidebar.

### Known legacy routes that remain

The flat Character routes (`/wellness`, `/skills`, `/inventory`, `/clothing-shop`, `/housing`, `/gear`, `/legacy`, `/hall-of-immortals`) remain canonical for now. The existing `/hub/character` tile hub remains available as a legacy route. Schedule booking routes remain under `/booking/*` until a later Schedule/Home slice decides whether to move them under `/schedule/*`.

### Migration guidance for future PRs

For each future hub migration:

1. Add static hub navigation items to `src/config/hubNavigation.ts` using only real existing pages.
2. Render the section overview at the stable base route.
3. Wrap the overview or shared section shell in `HubLayout`.
4. Add explicit aliases only for renamed routes, preserving query strings and avoiding redirect loops.
5. Update page-title metadata if new canonical child paths are introduced.
6. Keep existing deep links until analytics and release notes confirm they can be removed.
7. Add tests for base landing, child selected state, breadcrumbs, redirects and query preservation.

## PR 3 update — Music hub consolidation

PR 3 makes `/music` the stable Music landing route and uses the shared `HubLayout` pattern from PR 2 for the Music Overview. The top-level Music module now opens the overview instead of restoring `/hub/music`, Songwriting, Recording or another last visited child page.

### Final Music hub hierarchy

The Music hub surfaces existing systems only:

- Overview — `/music`
- Songs — `/music/songs` aliasing the existing song manager
- Songwriting — `/music/songwriting` aliasing the existing songwriting page
- Practice — `/music/practice` aliasing stage practice
- Rehearsals — `/music/rehearsals` aliasing existing rehearsals
- Jam Sessions — `/music/jam-sessions` aliasing existing jam-session routes
- Recording — `/music/recording` aliasing the existing recording studio flow
- Releases — `/music/releases` aliasing the existing release manager
- Setlists — `/music/setlists` aliasing existing setlist management

Genres remain available inside the existing song and release flows rather than as a separate hub child because there is no standalone genre page to migrate in this PR. Albums are managed through the release manager, so the hub uses the single player-facing label “Releases” rather than duplicating an Albums tab.

### Route migration table and aliases

| Logical page | Canonical Music route | Existing implementation / preserved legacy route |
| --- | --- | --- |
| Music Overview | `/music` | `/hub/music` and `/music-hub` redirect to `/music` with query strings preserved |
| Songs | `/music/songs` | Redirects to `/song-manager`; public `/song/:songId` remains valid and selects Songs logically |
| Songwriting | `/music/songwriting` | Redirects to `/songwriting`; `/booking/songwriting` remains a Schedule booking route but is matched as a songwriting-related alias |
| Practice | `/music/practice` | Redirects to `/stage-practice` |
| Rehearsals | `/music/rehearsals` | Redirects to `/rehearsals` |
| Jam Sessions | `/music/jam-sessions` | Redirects to `/jam-sessions`; `/jams` remains valid |
| Recording | `/music/recording` | Redirects to `/recording-studio` |
| Releases | `/music/releases` | Redirects to `/release-manager`; `/release/:id` remains valid and selects Releases logically |
| Setlists | `/music/setlists` | Redirects to `/setlists` |

Aliases use explicit redirects rather than duplicate page implementations, preserving browser history expectations and avoiding multiple mounted copies of data-heavy gameplay screens. Query parameters are preserved by the same redirect helper used by PR 2 aliases.

### Page ownership decisions

Music owns the creation and development journey: songs, songwriting, practice, recording, releases and general music development. Rehearsals, jam sessions and setlists remain shared with Band & Live for now because the existing pages are band-context systems, but Music links to them as contextual workflow steps. This avoids a premature Band hub refactor while making the player journey easier to follow.

Recording-studio discovery and business management remain in the existing world/business surfaces. The Music Recording child routes players to the existing booking and recording flow rather than moving studio ownership.

### Music Overview content

The overview composes existing Supabase data without new backend endpoints:

- recent user songs from the existing `user-songs` query key,
- recent recording sessions,
- recent releases,
- summary counts for songs being written, completed songs, songs needing practice and recording-ready songs.

The overview keeps hub breadcrumbs, hub child navigation, loading state, retryable error state and empty list states visible around the content.

### Quick actions

The Music Overview exposes existing working navigation actions only:

- Write a song → `/music/songwriting`
- Practice → `/music/practice`
- Book recording → `/music/recording`
- Create release → `/music/releases`

Action-level gameplay gating is still enforced by the destination pages. This PR does not invent new permission rules or bypass existing booking/confirmation flows.

### Contextual workflow links

The overview adds safe navigational workflow links for the existing creation path:

Songwriting → Practice → Rehearsals → Jam Sessions → Recording → Releases.

The links only move the player to existing pages; they do not perform mutations or skip required booking dialogs.

### Selected navigation and page titles

Music has been added to the shared hub title configuration so `/music` resolves as `Music | Rockmundo` and Music child or legacy paths resolve with the Music context where route metadata can identify the logical child. Hub child selection ignores query strings and maps legacy aliases such as `/songwriting`, `/recording-studio`, `/release-manager`, `/release/:id` and `/song/:songId` to their logical Music child.

### Gating behaviour

Existing restrictions remain owned by the migrated pages: band membership for rehearsals/setlists/jam sessions, recording eligibility and studio booking requirements in Recording, release permissions in Release Manager, and songwriting/practice skill or activity restrictions in their existing flows. The hub does not hide whole systems solely because one action may be unavailable; destination pages continue to show their established no-band, unavailable, loading, empty and error states.

### Known limitations and deferred defects

- The canonical Music child routes currently redirect to the existing flat implementations instead of rendering every child inside `HubLayout`. This keeps PR 3 low-risk and preserves the existing page-level loading/error states.
- Albums are not split from Releases because album creation is implemented through the release manager.
- Genres are not a separate tab because there is no standalone genre management page.
- Broader songwriting backend defects, if any, are deferred unless they are caused by the route consolidation. The new aliases do not rely on navigation state, so direct `/music/songwriting` refreshes redirect to the existing direct-load-safe `/songwriting` page.

### Follow-up

The next planned navigation PR is Band hub consolidation. That work should decide whether rehearsals, setlists, gigs, band recording participation and performance preparation receive band-owned canonical routes while continuing to share implementations with Music where appropriate.
