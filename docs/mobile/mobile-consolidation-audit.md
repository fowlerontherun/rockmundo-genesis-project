# RockMundo Mobile UI Phase 9 Consolidation Audit

## Executive summary

This audit covers the player-facing route table in `src/App.tsx`, the dedicated mobile shell in `src/mobile/shell`, and the current mobile pages in `src/mobile/pages`. Phase 9 consolidates mobile routing around a single route registry and a single shell decision so mobile players no longer receive the desktop FM shell, breadcrumbs, desktop-only gate, or desktop loading frame while authenticated routes resolve.

## Route inventory

### Public / unauthenticated routes

| Route | Mobile behaviour | Notes |
| --- | --- | --- |
| `/` | Public responsive landing | Outside authenticated mobile shell. |
| `/auth` | Public responsive auth | Outside authenticated mobile shell. |
| `/about` | Public responsive content | Outside authenticated mobile shell. |
| `/song/:songId` | Public song detail | Outside authenticated mobile shell. |

### Authenticated dedicated mobile routes

| Route pattern | Section | Component | Bottom nav owner | Shell |
| --- | --- | --- | --- | --- |
| `/mobile` | Home | `MobileHome` | Home | Mobile shell |
| `/mobile/career`, `/mobile/career/:section`, `/mobile/career/:section/:id` | Career | `MobileCareerRoutes` | Career | Mobile shell |
| `/mobile/social`, `/mobile/social/:section`, `/mobile/social/:section/:id` | Social | `MobileSocial` | Social | Mobile shell |
| `/mobile/world`, `/mobile/world/:section`, `/mobile/world/:section/:id` | World | `MobileWorldPhase5` | World | Mobile shell |
| `/mobile/me`, `/mobile/me/:section`, `/mobile/me/:section/:id` | Me | `MobileMe` | Me | Mobile shell |

### Authenticated contained fallback groups

All remaining authenticated player routes continue to use their existing page components, but on mobile they now mount inside `MobileShell` instead of `FMShell`. The fallback groups are tracked in `src/mobile/routeRegistry.ts` and are intentionally owned by a bottom navigation destination:

| Group | Representative route patterns | Bottom nav owner | Fallback status |
| --- | --- | --- | --- |
| Home | `/home`, `/dashboard` | Home | Dedicated or redirect |
| Career/music/live | `/career/*`, `/band/*`, `/gigs/*`, `/songwriting`, `/stage-practice`, `/recording-studio`, `/release-manager`, `/streaming-platforms`, `/music/*`, `/festivals/*`, `/skills`, `/education`, `/jobs` | Career | Contained desktop fallback where no dedicated route exists |
| Social | `/social/*`, `/twaater/*`, `/inbox`, `/community/*`, `/player/*`, `/players/*`, `/gettit`, `/dikcok` | Social | Contained desktop fallback where no dedicated route exists |
| World/business/market | `/world/*`, `/cities/*`, `/venues`, `/world-companies`, `/company/*`, `/gear-shop`, `/housing`, `/casino/*`, `/business/*`, `/labels/*` | World | Contained desktop fallback where no dedicated route exists |
| Me/account/identity | `/character/*`, `/wellness`, `/inventory`, `/achievements`, `/my-character/*`, `/characters/*`, `/legacy`, `/journal`, `/premium-store`, `/blind-boxes/*` | Me | Contained desktop fallback where no dedicated route exists |

Admin routes are deliberately excluded from player-facing mobile coverage; they remain desktop-managed.

## Findings against the required audit checklist

1. Authenticated player routes are enumerated by the central registry groups above.
2. Unauthenticated routes are listed above and remain outside the authenticated shell.
3. Dedicated mobile implementations exist for the five permanent destinations and their nested mobile route families.
4. Remaining desktop components on mobile are documented as `wrapped-desktop` fallback routes and are contained in `MobileShell`.
5. Mixed patterns remain primarily in high-complexity management/detail pages; they are tracked as fallbacks rather than silently leaking desktop shell chrome.
6. Authenticated player mobile routes no longer bypass the mobile shell through `Layout`.
7. The authenticated loading state now uses the mobile background and dynamic viewport height when mobile is active, preventing desktop shell flashes.
8. Direct refresh is supported by route metadata ownership and `Outlet` rendering inside `MobileShell`.
9. Nested route bottom-navigation ownership now comes from registry metadata instead of ad hoc path prefix checks.
10. Browser-back behaviour is unchanged for page routes; transient sheet history remains a follow-up for domain sheets that do not route-link state.
11. Known sheet/dialog history entries are limited to Radix/Vaul UI state and are not intentionally pushed to browser history.
12. The authenticated `Layout` no longer mounts both `FMShell` and `MobileShell` for mobile routes.
13. Hidden desktop tree duplicate requests are reduced by not mounting the desktop shell tree on mobile.
14. Mobile breakpoint detection remains centralized in `useIsMobileDevice`; route ownership is centralized in `routeRegistry`.
15. Horizontal overflow risk remains in contained fallback components and should be tested route-by-route with the smoke journey.
16. Mobile shell content padding accounts for bottom nav, activity bar, and safe-area variables.
17. Keyboard-sensitive composers remain covered by sticky composer classes in dedicated social routes; contained fallback forms need targeted follow-up.
18. Dedicated mobile controls use labelled buttons where audited; fallback controls inherit existing accessibility state.
19. Dedicated mobile pages use shared skeleton/empty/card primitives; fallback pages remain documented.
20. Duplicate real-time subscription risk is reduced by preventing hidden desktop subscriptions from mounting beside mobile pages.
21. Layout shift risk is reduced in shell loading; chart-heavy and media-heavy fallback routes remain follow-up candidates.
22. Shared primitives are already present in `src/mobile/components`; this pass standardizes route and action ownership rather than creating another component set.
23. Visual patterns are documented below for future route work.
24. Common daily actions are centralized in `FabMenu`, ordered by registry section.
25. Development-only fallback warnings now identify contained desktop fallback routes during mobile inspection.

## Mobile page patterns

- **Dashboard pages:** section header, current-status card, summary widgets, quick actions, grouped content, independent loading boundaries.
- **List pages:** compact header, optional search/filter, mobile cards or compact rows, incremental loading, empty state, retry state.
- **Detail pages:** entity header, status, primary information, expandable secondary sections, sticky actions where useful.
- **Step flows:** title, progress, large selectable cards, inline validation, review, server revalidation, safe cancellation.
- **Conversation pages:** compact header, incremental history, keyboard-safe composer, connection state, stable scroll-to-latest behaviour.

## Navigation and shell decisions

- `useIsMobileDevice` remains the only viewport/flag decision hook for the authenticated app.
- `mobileRouteRegistry` owns destination, shell, activity-bar, FAB, fallback, and auth metadata.
- `BottomNav` resolves active state from registry metadata, so nested routes such as `/twaater/notifications`, `/cities/:cityId`, `/release/:id`, and `/character/profile/edit` keep the correct primary destination.
- `FabMenu` orders quick actions by registry destination instead of duplicating section string checks.

## Remaining fallbacks and reasons

High-complexity management, media, business, festival, company, casino, governance, and performance pages still use desktop page components. They are retained because replacing them safely would require domain-specific mobile redesign and fixture-heavy testing beyond this consolidation PR. They are now safely contained inside the mobile shell and produce development warnings when visited on mobile.

## Follow-up recommendations

The next mobile PR should focus on onboarding and returning-player guidance: mobile tutorials, contextual help, returning-player summary, notification-centre improvements, installable PWA behaviour, and mobile engagement polish rather than migrating more core route families.
