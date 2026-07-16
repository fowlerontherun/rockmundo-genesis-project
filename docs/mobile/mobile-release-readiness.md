# RockMundo Mobile Release Readiness — Phase 11

## Current implementation audit

1. **Mobile analytics events:** existing mobile events are DOM `CustomEvent`s (`rm-mobile-analytics`) from onboarding/install guidance; social safety uses `rockmundo:analytics`; no external product analytics SDK was found.
2. **Error monitoring:** no Sentry/Bugsnag-style client SDK was found. Recoverable mobile errors use inline error states and now use a shared mobile error taxonomy/reference helper for traceable support copy when a monitoring adapter is added.
3. **Performance monitoring:** no RUM library was found. Existing tooling is Vite build output, Playwright traces, Vitest and manual browser devtools; Phase 11 adds route load/abandon analytics markers.
4. **Mobile route coverage:** `/mobile`, `/mobile/career/*`, `/mobile/social/*`, `/mobile/world/*` and `/mobile/me/*` are dedicated. The route registry also maps major desktop routes into contained mobile shell fallbacks.
5. **End-to-end mobile tests:** Playwright exists for gig experience only, with mobile viewport projects at 360 and 390. Unit/source tests cover mobile route registry, shell, Career, Social, World and Me.
6. **Browser/device config:** Playwright has Chromium desktop, Pixel 5, iPhone 12, iPad and reduced-motion projects. It did not include 320 or 430 viewport projects before this audit.
7. **PWA/service-worker diagnostics:** install prompt and waiting-service-worker detection exist in mobile onboarding. No service-worker error monitor or diagnostics screen was found.
8. **Realtime diagnostics:** Supabase Realtime subscriptions exist in notifications, direct messages, presence and social hooks. No mobile-specific reconnect diagnostics screen was found.
9. **Known mobile issues/open items:** previous mobile docs note route consolidation, fallback containment and no route analytics facility in earlier navigation work.
10. **Highest-complexity routes:** Social messages/conversation/mail/Twaater, World marketplace/venues/travel/companies, Career songs/practice/gigs/booking and Me inventory/wardrobe/skills/settings.
11. **Largest bundles:** routes importing Recharts, Three/Fiber, Mapbox, avatar creator, gig viewer, marketplace media and analytics screens are the likely largest bundles based on dependency/import audit.
12. **Most API requests:** Home dashboard, Social overview, World dashboard/marketplace, Career dashboard and Me overview call multiple hooks/widgets.
13. **Most mutations:** booking, practice start/cancel, travel, marketplace purchase/listing, message send, Twaater post, friend request/response, skill XP spend, inventory use and wardrobe save.
14. **Large/unbounded lists:** songs, marketplace, inventory, mail, conversations, Twaater feed, notifications, venues, companies and rankings.
15. **Keyboard-sensitive routes:** chat, mail, Twaater compose, profile/player search, world/marketplace search, song/band/release naming, job applications and settings inputs.
16. **Timers/live subscriptions:** current activity bar, countdown cards, notifications, direct messages, presence/chat and install/service-worker prompt state.
17. **Privacy safeguards:** existing analytics are event-name based; Phase 11 safe diagnostics explicitly exclude tokens, private message/mail content, private profile fields and request/response bodies.
18. **Development diagnostics:** source tests assert mobile shell routing; Phase 11 adds desktop fallback marker detection.
19. **Feedback tools:** social safety report/block tools exist. No lightweight mobile support diagnostics/feedback entry point existed in Settings before Phase 11.
20. **Previous audit defects:** mobile consolidation audit identified fallback and coverage risks; navigation docs noted no route analytics facility.

## Device and browser test matrix

| Category | Automated check | Manual/physical check required |
| --- | --- | --- |
| Android modern Chrome | Playwright Pixel-style Chromium at 360/390/430 where CI supports | Real current Android Chrome, address bar expanded/collapsed |
| Android lower-end/older | 320 viewport, reduced-motion, no physical claim | Real low-memory Android Chrome performance pass |
| Samsung Internet | Not automated in current CI | Samsung Internet smoke: Home, Social, Marketplace, Settings diagnostics |
| Android installed PWA | Standalone-mode metadata can be simulated | Add-to-Home-Screen launch, auth redirect and update prompt |
| iOS recent Safari | WebKit project recommended when CI browser is installed | Real Safari toolbar/safe-area check |
| iOS small viewport | 320 viewport layout checks | Smaller iPhone keyboard-open flows |
| Foldable/internal | 430+ and wide viewport smoke | Actual foldable internal viewport if available |

Do not record the manual column as complete until run on physical hardware.

## Critical journeys reviewed

- **Daily:** sign in, Home, current activity, quick action, upcoming activity, notifications, return Home.
- **Career:** Career, Band, Songs, song continuation, Practice, Gigs, Gig Preparation.
- **Social:** Social, conversation, send message, inbox, Friends, Twaater, Mail.
- **World:** World, Current City, Venue, Travel, Marketplace, Company/Job.
- **Personal:** Me, Wellness, Inventory, Skills, Education, Settings.
- **Complex transaction:** start booking/purchase, progress steps, background/return, revalidate stale availability, complete/cancel safely.

## Phase 11 fixes shipped

- Added safe mobile route telemetry for view, load-complete, abandon, connection lost/restored and desktop fallback detection.
- Added a mobile diagnostics utility with coarse viewport, browser, PWA mode, connection state, route mapping and app version metadata.
- Added Settings support diagnostics with Copy Diagnostics and explicit privacy copy.
- Added Settings mobile feedback preview for broken layout, confusing screen, failed action, slow page, desktop UI, missing data, navigation and other issue categories.
- Standardised mobile error categories and support reference generation without exposing internal identifiers.
- Added source/unit coverage for safe metadata, analytics sanitisation and desktop fallback detection.

## Performance baselines and budgets

Measured condition: repository audit plus local build/test tooling, not physical-device RUM.

| Area | Current baseline | Budget/guidance |
| --- | --- | --- |
| Initial mobile shell | Dedicated shell plus shared UI primitives | Keep initial mobile route free of gig viewer, avatar creator, Mapbox and chart modules unless route requires them |
| Dashboard requests | Multiple independent hooks per dashboard | No duplicate query keys for same resource; hidden tabs should use `enabled` conditions |
| Lists | Many routes cap visible slices (for example Twaater/social summaries), several desktop lists remain broad | Mobile lists should initially render 20–50 items and paginate/increment beyond that |
| Timers/subscriptions | Activity bar/countdowns plus Supabase realtime hooks | One active subscription per intended scope; no route-specific listener should survive unrelated routes |
| Layout shift | No automated CLS budget | Sticky bars must reserve safe-area/bottom-nav padding; avoid image dimensions without aspect constraints |
| Bundle risk | Chart/3D/map/avatar/gig modules are heavy | Lazy-load heavy modules and do not import desktop-only tools into mobile dashboards |

## Mobile funnel events

Recommended event names through `rm-mobile-analytics`:

- `mobile_route_viewed`, `mobile_route_load_completed`, `mobile_route_load_failed`, `mobile_route_abandoned`
- `mobile_primary_action_selected`, `mobile_quick_action_selected`, `mobile_bottom_navigation_selected`
- `mobile_flow_started`, `mobile_flow_step_completed`, `mobile_flow_abandoned`, `mobile_validation_blocked`
- `mobile_mutation_completed`, `mobile_mutation_failed`, `mobile_retry_selected`
- `mobile_connection_lost`, `mobile_connection_restored`, `mobile_desktop_fallback_detected`
- Funnel labels: `practice`, `travel`, `messaging`, `marketplace_purchase`, `songwriting`

Allowed metadata: route identifier, section, flow id, step number, success/failure category, duration bucket, coarse connection type, viewport category and PWA/browser mode.

## PWA launch readiness

- Start route and mobile shell are present.
- Install and update waiting prompts exist.
- Standalone mode is detected by diagnostics.
- Remaining manual checks: real Add-to-Home-Screen launch on iOS/Android, auth redirect after cold start, deep link handling and service-worker update recovery.

## Accessibility status

Critical mobile primitives expose headings, navigation labels, min-height tap targets and alert roles. Remaining manual checks: screen-reader route announcement, sheet focus trapping, increased text, contrast in all themes and keyboard-only operation with virtual keyboard open.

## Launch-blocking criteria

Block wider rollout for: desktop shell on a mobile route, duplicate high-value mutation, trapped navigation, PWA sign-in/refresh failure, keyboard blocking chat/mail/search/transaction submit, unusable bottom nav, severe horizontal overflow, private data exposure, reconnect duplicating messages/transactions, major accessibility barrier, repeated route crash or update data loss.

Non-blocking: minor spacing, low-priority animation, cosmetic card alignment, optional browser API unavailable with fallback, non-critical copy polish.

## Rollout and rollback

Use existing routing/feature flag practices; do not build a new flag platform. Recommended stages: internal/dev, selected testers, small mobile-session percentage, wider rollout, default mobile. Rollback should route players to the stable mobile shell/fallback mapping, not an uncontained desktop layout.

## Post-release monitoring plan

Review at 24 hours, 72 hours, one week and two weeks: mobile route error rate, desktop fallback detections, mutation failures, duplicate action reports, reconnect failures, message-send failures, booking/purchase abandonment, route load duration, PWA update failures, install prompt acceptance, quick-action use, Home-to-action conversion and support feedback categories.

## Known limitations

- No physical device testing was performed by this automated environment.
- No production analytics/error SDK is present to persist `rm-mobile-analytics` events.
- Screenshots at 320/375/430 and installed PWA mode must be captured by a human or CI job with authenticated fixtures.
- Samsung Internet and iOS standalone behaviours require physical/manual validation.
