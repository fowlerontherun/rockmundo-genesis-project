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

## PR 4 update — Band hub consolidation

PR 4 makes `/band` the stable Band landing route. The top-level Band & Live navigation now opens the Band overview instead of the legacy category hub or a narrow management tab. The implementation reuses `HubLayout` and keeps existing gameplay components for membership, roles, repertoire, finances, chemistry, history and settings.

### Final Band hub hierarchy

The Band hub surfaces existing systems only:

| Hub item | Canonical route | Implementation / ownership |
| --- | --- | --- |
| Overview | `/band` | Existing band overview, status, current member count, invitations and quick actions. |
| Members & Roles | `/band/members` | Existing member cards, invitations, applications, touring members and role management controls. |
| Fame & Fans | `/band/fame` | Existing fame/fans overview from the band manager. |
| Repertoire | `/band/repertoire` | Existing band repertoire tab; setlist aliases continue to the shared setlist manager. |
| Rehearsals | `/band/rehearsals` | Alias to the existing rehearsal page so booking and attendance rules remain unchanged. |
| Gigs | `/band/gigs` | Alias to the existing gigs page and gig-preparation flow. |
| Tours | `/band/tours` | Alias to the existing tour manager; vehicle and rider legacy links remain compatible. |
| Equipment & Crew | `/band/equipment` | Alias to existing band crew/stage equipment entry points. |
| Finances | `/band/finances` | Existing band finance tab. |
| Chemistry | `/band/chemistry` | Existing chemistry display. |
| History | `/band/history` | Existing gig history tab. |
| Settings | `/band/settings` | Existing permission-gated settings tab. |

### Canonical Band route model

`/band` is the canonical active-band overview. Child routes under `/band/*` either render the existing band-management tab in the shared hub shell or redirect with query parameters preserved to the existing shared implementation. Direct profile/entity routes such as `/band/:bandId` and `/bands/:bandId/management` remain in place for public profiles and deep management links.

### Active-band context behaviour

The Band hub preserves the existing `getUserBands(profileId)` selection model. It selects the first active band, then the first non-disbanded band if no active band exists. When a player belongs to multiple bands, the existing selector remains visible in the hub header and switches the selected band without inventing a new global active-band store. No-band players stay on `/band` and see invitations, create-band, browse-band and find-musician actions instead of being redirected to an error page.

### Route migration table and legacy aliases

| Legacy / alternate route | PR 4 behaviour |
| --- | --- |
| `/hub/band-live`, `/hub/band`, `/hub/live` | Treated as Band overview aliases for selection/title purposes; existing hub route compatibility remains. |
| `/band/overview` | Redirects to `/band`. |
| `/chemistry` | Remains valid and selects the Band Chemistry item. |
| `/setlists` | Remains the shared setlist manager and selects Band Repertoire/Setlists when viewed in Band context. |
| `/rehearsals`, `/jam-sessions`, `/jams` | Remain shared activity pages and select Band Rehearsals/Jam Sessions aliases. |
| `/gigs`, `/gig-booking`, `/gigs/perform/:gigId` | Remain existing gig and performance routes and select Band Gigs. |
| `/tour-manager`, `/band-vehicles`, `/band-riders` | Remain existing tour/support routes and select Band Tours. |
| `/stage-setup`, `/stage-equipment`, `/band-crew` | Remain existing preparation/support routes and select Equipment & Crew. |

### Music and Band ownership decisions

Music continues to own songwriting, practice, recording, releases, albums and the general song catalogue. Band owns member management, roles, chemistry, band-specific preparation, repertoire, rehearsals in a band context, gig preparation, tours, equipment, crew, finances, settings and history. Shared rehearsals, jam sessions, setlists, recordings and releases are not duplicated; Band links to existing shared routes and preserves the underlying booking, attendance, setlist, recording and release permission rules.

### Band Overview content, alerts and quick actions

The overview uses the existing band overview component and real selected-band data: identity, genre, logo, status, member count, leader state, invitations, status banners, repertoire and performance summaries exposed by the existing components. Quick actions link to existing member invitation, rehearsal and gig-preparation entry points. Hiatus/reactivation alerts and permission handling remain owned by the existing band status and settings components.

### Permission behaviour

Leader-only actions such as accepting applications, inviting members, adding touring members, removing members and editing restricted settings still use the existing `isLeader` checks. The hub shell remains visible for non-leaders so read-only areas such as overview, members, chemistry, history and finances can continue to use their established access treatment.

### Known limitations and deferred work

PR 4 intentionally does not add a new active-band persistence layer, does not redesign rehearsal or gig-preparation services and does not merge public band profiles into the private Band hub. Some shared pages still render their legacy page shell after the Band alias redirects; this keeps the PR low-risk while preserving deep links and existing loading/error states.

### Follow-up

The next planned navigation PR is World and Travel hub consolidation. World consolidation is not started in PR 4.

## PR 5 update — World and Travel hub consolidation

PR 5 makes `/world` the stable World landing route and moves player-facing discovery of places, travel and world activity into the shared `HubLayout` pattern. The top-level World module now opens the World Overview instead of restoring the legacy tile hub, Travel, Cities, World Pulse or another previously visited child route.

### Final World hub hierarchy

The World hub surfaces existing systems only:

- Overview — `/world`
- Current City — `/world/current-city` redirects to the active city detail when the authoritative profile city exists, otherwise to Cities.
- Travel — `/world/travel` aliases the existing travel booking flow.
- Cities — `/world/cities` aliases Global Cities, with `/world/cities/:cityId` rendering city details directly.
- Venues — `/world/venues` aliases the existing venue surface.
- Studios — `/world/studios` aliases the existing recording-studio discovery/booking entry point; Music still owns recording workflow.
- Companies — `/world/companies` aliases the World Companies public directory; Business still owns management.
- Events — `/world/events` aliases existing major events.
- Festivals — `/world/festivals` aliases the festival browser, with `/world/festivals/:festivalId` rendering festival details directly.
- World Pulse — `/world/pulse` aliases the existing World Pulse dashboard.
- Leaderboards — `/world/leaderboards` links to existing public rankings rather than moving chart systems.
- Treasuries — `/world/treasuries` aliases the existing City Treasuries page and is hidden from compact child navigation.

### Canonical route model and aliases

| Canonical World route | Existing route preserved | Behaviour |
| --- | --- | --- |
| `/world` | `/hub/world`, `/hub/world-social` | Legacy hub links redirect to the World Overview with query strings preserved. |
| `/world/current-city` | `/cities/:cityId` | Resolves from the current profile city; falls back to `/cities` when no valid city is available. |
| `/world/travel` | `/travel` | Redirect alias preserving destination query parameters. |
| `/world/cities` | `/cities` | Redirect alias preserving filters. |
| `/world/cities/:cityId` | `/cities/:cityId` | Direct render alias for city detail deep links. |
| `/world/venues` | `/venues` | Redirect alias to existing venue management/discovery page. |
| `/world/studios` | `/recording-studio` | Redirect alias to existing studio surface. |
| `/world/companies` | `/world-companies`, `/companies/directory` | Redirect alias to the public company directory. |
| `/world/events` | `/major-events` | Redirect alias to existing global events. |
| `/world/festivals` | `/festivals` | Redirect alias to existing festival browser. |
| `/world/festivals/:festivalId` | `/festivals/:festivalId` | Direct render alias for festival detail deep links. |
| `/world/pulse` | `/world-pulse` | Redirect alias to the full lazy-loaded World Pulse dashboard. |
| `/world/leaderboards` | `/band-rankings` | Redirect alias to existing comparative ranking surface. |
| `/world/treasuries` | `/cities/treasury` | Redirect alias to existing city treasury data. |

### Current-location behaviour

The World Overview reads current city from existing authoritative game/profile data via `useGameData()` and cross-checks travel state with `useTravelStatus()`. It does not assign a fallback city on the client. When no valid location is available, the overview shows a recoverable empty/error message and links to existing Cities and Travel flows.

### Travel-in-progress behaviour

When the existing travel status hook reports active travel, the overview presents the destination, arrival time and transport type when available. It avoids adding a new timer system and keeps the existing 30-second travel-status polling behaviour in `useTravelStatus()`.

### World Overview content

The overview uses real existing data only: current city, travel status, nearby venues, nearby city studios, local companies, upcoming local gigs, upcoming festivals, featured cities and quick links into existing child routes. Local sections are omitted or shown empty when the current city or underlying data is unavailable.

### Ownership boundaries

- World owns discovery of cities, venues, studios as places, public company profiles, festivals, events, travel entry points and World Pulse discovery.
- Music owns recording preparation, eligible songs, recording sessions, releases and song development.
- Band owns gig preparation, rehearsals, tours, performance readiness, crew and band equipment workflows.
- Business owns company ownership, staff, finances, contracts and management pages; World only links to public company discovery.
- Social consolidation is deferred to PR 6 and was not started here.

### Contextual workflow links

The World Overview links to Current City, Travel, Cities, Venues, Studios, Companies, Events, Festivals, World Pulse and existing leaderboards without bypassing existing booking, application or management flows. City and festival entity IDs are preserved on direct World aliases.

### Mobile and accessibility considerations

The World Overview uses the shared hub child navigation, semantic breadcrumbs, visible text location status, `aria-current` selected child links and responsive card grids. It does not add maps, animations, duplicate live subscriptions or a World-specific navigation pattern.

### Known limitations and deferred defects

- Existing child pages still mostly render their legacy page scaffold after redirect; a later polish PR can wrap each migrated child page directly in `HubLayout` once risk is acceptable.
- Venue details and studio details remain limited to the currently implemented pages; no placeholder detail pages were added.
- World Pulse remains lazy-loaded on its own dashboard route, so the overview does not subscribe to or render the full live dashboard.
- Follow-up PR 6 is Social hub consolidation.

## PR 6 update — Social hub consolidation

PR 6 makes `/social` the predictable Social landing route and renders a real Social Overview with the shared `HubLayout` pattern. The Social top-level navigation now opens the overview rather than restoring a nested friends, messages or Twaater page.

### Final Social hub hierarchy

Only implemented Social surfaces are exposed:

- `/social` — Social Overview.
- `/social/friends` — existing relationships/friends surface.
- `/social/players` — existing player search and discovery surface.
- `/social/messages` — existing friend direct-message surface.
- `/social/twaater` — alias to the existing Twaater application at `/twaater`.
- `/social/recruitment` — existing band-finder/recruitment discovery surface.
- `/social/invitations` — existing social invites inbox.

Forums are not added because no complete forum route exists in the current route table. Gettit remains an existing community platform link, but it is not duplicated as a generic Social feed because Twaater already owns the primary social activity/feed experience.

### Canonical route model, aliases and migrations

| Legacy or existing route | PR 6 route treatment | Notes |
| --- | --- | --- |
| `/social` | Canonical overview render route | Stable Social landing page. |
| `/hub/social` | Redirects to `/social` preserving query strings | Legacy tile-hub entry remains bookmark-safe. |
| `/social/overview` | Redirects to `/social` preserving query strings | Compatibility alias only. |
| `/relationships` | Redirects to `/social/friends` preserving query strings | Existing friends implementation is retained. |
| `/players/search` | Redirects to `/social/players` preserving query strings | Player search query state now uses `q` where supplied. |
| `/player/:playerId` | Remains canonical profile route | Social navigation metadata treats direct profile links as Players context. |
| `/twaater` and nested Twaater routes | Remain canonical Twaater routes | `/social/twaater` redirects to `/twaater`; post, hashtag, handle, analytics and notification routes remain intact. |
| `/twaater/messages` | Remains a Twaater-specific message route | Social Messages uses the existing friend direct-message surface; Twaater messages remain available for Twaater account DMs. |
| `/bands/finder`, `/bands/browse`, `/bands/search`, `/band/:bandId` | Remain canonical band discovery/profile routes | Social Recruitment links to the finder without moving Band management workflows. |
| `/social/invitations` | Canonical social-invite review route | Uses the existing social invites inbox and realtime invalidation. |

### Ownership boundaries

- **Social owns** finding other players, friends, player discovery entry points, friend direct messages, Twaater entry, social invitations and recruitment discovery.
- **Character owns** the authenticated player’s self-management, skills, wellness, inventory, wardrobe, family timeline and personal settings.
- **Band owns** active-band management, member roles, applicant review, rehearsals, gigs, equipment, finances and settings.
- **Music owns** songs, songwriting, practice, recording and releases.
- **Business/Career** consolidation is explicitly deferred to PR 7.
- **Global Notifications** remain global; Social only summarises social invite/request state and keeps Twaater notifications in Twaater.

### Social Overview content

The overview uses existing query hooks and data only:

- accepted-friend count and pending friend-request count from the relationships cache,
- pending social-invite count from `social_invites`,
- Twaater trending-topic count and topic chips from the existing Twaater trending query,
- quick links to player search, messages, friends, Twaater, recruitment and invitations when relevant.

No fake online status, recommendations, forum posts, activity metrics or placeholder community data are introduced.

### Messaging terminology and live updates

The hub uses **Messages** for the existing friend direct-message experience because that is the player-facing label already used in the Social tab. Twaater account DMs remain labelled and routed as Twaater Messages. PR 6 does not add another message service or SSE subscription; it reuses existing relationship-message components and keeps the invite realtime hook scoped to the Social hub.

### Recruitment and invitations

Social owns discovery of bands and musicians through the existing finder/search routes. Band continues to own applicant management, invitations from band officers, member roles and settings. The Social Invitations page surfaces existing social invites without forcing band, job, transfer or collaboration workflows into one incompatible request screen.

### Player profiles, privacy, blocking and moderation

Direct player profiles remain stable at `/player/:playerId`; Social owns discovery and interaction entry points rather than moving self-character pages. Existing profile privacy, blocked-user visibility, friendship permissions, message permissions, Twaater moderation states and server-side RLS remain authoritative because PR 6 reuses the existing services and components instead of changing backend rules.

### Mobile and accessibility considerations

The Social hub uses shared `HubLayout` child navigation, including horizontal mobile scrolling, `aria-current` selected states, metadata-driven breadcrumbs and existing button/link focus styles. Overview cards use text labels rather than colour-only state, and child failures remain scoped to their own existing components where practical.

### Known limitations and deferred defects

- No forums tab is exposed because there is no complete forum implementation in the current route table.
- Global Notifications are not moved into Social.
- Twaater account DMs and friend direct messages remain separate systems to avoid a risky messaging rewrite.
- Recruitment application-management screens remain in Band.
- Business and Career consolidation is the planned next navigation PR.
