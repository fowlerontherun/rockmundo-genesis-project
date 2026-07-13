# Navigation and hub refactor plan

## PR 2 shared hub pattern

RockMundo now uses a small reusable `HubLayout` shell for sections that are ready to migrate without rewriting the global navigation. The shell provides a hub title, optional description and icon, contextual actions, logical breadcrumbs, desktop child navigation, mobile scrollable child navigation, status content, loading, error and empty states, and a consistent content wrapper.

A hub declares static typed navigation items with an id, label, path, optional icon, optional alias match paths, optional badge, and optional mobile visibility. This keeps route metadata close to the migrated section while avoiding a registry, plugin framework or dynamic route generator.

Example using real routes:

```tsx
<HubLayout
  title="Character"
  description="Identity, progression, property, relationships, and legacy."
  navItems={[{ id: "overview", label: "Overview", path: "/character" }]}
  breadcrumbs={[{ label: "Character" }]}
/>
```

## Routing conventions

- Hub landing routes use Option A: the stable base route renders the overview directly when possible, for example `/character` and `/schedule`.
- Child routes use predictable paths under the hub base, for example `/character/wellness` and `/character/skills`.
- Existing legacy top-level pages remain functional during migration. Character child routes introduced in this PR redirect to their existing implementations (`/skills`, `/wellness`, `/inventory`, `/clothing-shop`, `/housing`, `/statistics`, `/legacy`) and preserve query strings.
- Temporary aliases are explicit route entries and should be removed only after the destination page has been migrated under the hub path.
- Redirects must use `replace`, avoid redirecting a route to itself, and preserve query parameters where practical.

## Selected-state matching

`HubLayout` normalizes trailing slashes and ignores query strings before matching. A child item is active for its exact path, nested paths below it, and declared legacy aliases. Match boundaries prevent unrelated routes such as `/characters` from matching `/character`.

## Breadcrumbs

Hub breadcrumbs are configured from human-readable metadata instead of raw path splitting. They render a Home link, hub label, and current-page indication. Future entity pages should append entity labels, such as a song, band or company name, supplied by the page.

## Page titles

Browser titles continue to use the existing `PageTitle` logic in `src/App.tsx`. Hub routes should register visible child context in `ROUTE_TITLES`, producing titles such as `Wellness | Character | Rockmundo` while preserving the existing Rockmundo suffix convention.

## Desktop and mobile navigation

Desktop child navigation renders as accessible button links above hub content. Mobile uses a horizontally scrollable button-link row, matching existing compact RockMundo navigation patterns without adding drawers or new animations. Active links use `aria-current="page"`, visible non-colour state, keyboard-focus rings inherited from the design system, and no horizontal page overflow.

## Sections migrated in PR 2

- Character: migrated to the shared hub shell while preserving the existing overview cards and legacy direct page links. `/character` is now the stable overview route; `/hub/character` remains as a legacy alias surface.
- Schedule: selected as the second low-risk section because it already had a stable landing page, limited child booking links, no admin-only policy changes, and no overlap with the upcoming Music consolidation. `/schedule` remains the overview and `/schedule/calendar` redirects back to `/schedule` for compatibility.

## Pending sections

Music, Band, World, Social, Business, Career, media and deeper Schedule booking pages remain pending. Music consolidation is intentionally deferred to the next PR.

## Deviations and known legacy routes

The current repository did not contain the proposed PR 1 document at `docs/navigation-and-hub-refactor.md`, so this PR establishes it from the observed implementation. Existing route definitions are still centralized in `src/App.tsx` with React Router v6. Global desktop and mobile navigation remains in `HorizontalNavigation`; authenticated application pages are nested under `Layout`; admin pages continue to use the existing admin route policy where already implemented.

Known legacy routes retained: `/hub/character`, `/skills`, `/wellness`, `/inventory`, `/clothing-shop`, `/housing`, `/statistics`, `/legacy`, `/booking/education`, `/booking/performance`, `/booking/work`.

## Migration guidance

1. Choose a low-risk section with an existing landing page.
2. Add a stable base route that renders the overview directly.
3. Define static hub nav items once and reuse them for desktop, mobile, breadcrumbs and active matching.
4. Preserve existing deep links with explicit temporary redirects or aliases.
5. Register browser title metadata for the hub and child routes.
6. Keep global navigation unchanged unless a section has fully migrated.
7. Do not create placeholder tabs; include only existing pages.
