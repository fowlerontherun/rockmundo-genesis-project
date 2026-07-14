
# RockMundo Mobile Experience — Phased Build Plan

This is a large multi-phase build. Because the desktop app has hundreds of pages and dozens of subsystems (bands, gigs, songwriting, recording, festivals, companies, PR, wellness, marketplace, world, employment, awards, tours, achievements, mail, Twaater, friends, characters, wardrobe, inventory, etc.), we won't rewrite every screen in one pass. Instead, we deliver a working mobile shell with the most-used loops first, then layer in additional systems.

Desktop remains untouched at every step.

---

## Architecture

**Detection & routing**
- Add `useIsMobileDevice()` (width < 768px OR `?mobile=1` feature flag, persisted to `localStorage`).
- In `src/components/Layout.tsx`, branch: if mobile → render `<MobileShell>`; else keep existing `<DesktopOnlyGate><FMShell>` untouched.
- Also update `DesktopOnlyGate` to skip its width block on mobile-route users.
- Mobile uses the same React Router routes as desktop so links, deep links, and existing pages continue to work. Mobile-specific screens live under a new `src/mobile/` tree and are chosen via a `<MobileRoute>` wrapper that renders the mobile version when available, and falls back to the desktop page inside a mobile-safe container otherwise.

**Directory layout**
```text
src/mobile/
  shell/            MobileShell, TopAppBar, BottomNav, FabMenu
  components/       Cards, sheets, rings, skeletons, empty states
  hooks/            useMobileNav, useBottomSheet, useSwipeTabs
  pages/            Home, Career (+ tabs), Social, World, Me
  fab/              Action registry, context-aware suggestions
  theme/            Mobile tokens (radii, shadows, type scale)
```

**Reuse rules**
- All data comes from existing hooks (`useGameData`, `useActiveProfile`, `useNotificationsFeed`, wellness/mail/band hooks, etc.).
- No new business logic, no new tables. Quick actions dispatch existing mutations or navigate to existing routes.

---

## Phase 1 — Foundation (this delivery)

Ship the shell + Today dashboard + 5-tab nav + FAB so the mobile experience is usable end-to-end, with unimplemented sections gracefully linking to existing routes.

1. **Detection & shell wiring**
   - `useIsMobileDevice` hook + `MOBILE_FLAG` localStorage toggle.
   - `MobileShell.tsx`: TopAppBar (avatar, title, notifications, mail) → scroll area → BottomNav (Home / Career / Social / World / Me) → FAB.
   - Bypass `DesktopOnlyGate` when mobile.
   - Integrate into `Layout.tsx` behind the flag.

2. **Design tokens**
   - `src/mobile/theme/tokens.css`: mobile-only CSS variables (`--m-radius`, `--m-shadow`, `--m-tap`, type ramp).
   - Dark-first, semantic tokens only. No hardcoded colors.

3. **Core reusable components**
   - `MCard`, `StatCard`, `ProgressRing`, `CountdownCard`, `QuickActionCard`, `NotificationCard`, `EmptyState`, `SkeletonCard`, `BottomSheet` (wraps existing `Sheet` with mobile ergonomics), `SwipeTabs`.

4. **Today (Home) dashboard**
   - Header: greeting, current city, weather chip.
   - Vitals row: Energy, Mood, Health rings (from wellness hooks).
   - Current activity + countdown (active gig / rehearsal / recording / travel from existing data).
   - Upcoming: next gig, next rehearsal, unread mail count, unread notifications.
   - Quick Actions grid: Practice, Write Song, Travel, Jam, Message Band, Post on Twaater, Sleep, Eat, Work, Shop (each routes to existing pages).
   - Notification feed (uses `useNotificationsFeed`).

5. **Bottom nav + section landing pages**
   - Home = Today.
   - Career: swipeable tabs (Band, Songs, Practice, Recording, Gigs, Skills) — each tab renders a compact card list pulling from existing hooks, with "Open full view" linking to the desktop page inside the mobile scroll shell.
   - Social: Friends / Band / Chat / Mail / Twaater — recent-activity cards.
   - World: Current City / Travel / Companies / Marketplace / Charts / Events — card grid.
   - Me: Character / Inventory / Wardrobe / Achievements / Settings — profile card + list.

6. **FAB + Quick Action sheet**
   - Global "+" button opens a bottom sheet with contextual actions based on current route.
   - Registry maps action → route/mutation. Default set: Practice, Travel, Write Song, Jam, Message Friend, Book Studio, Book Rehearsal, Post on Twaater, Sleep, Eat, Buy Items.

7. **Gestures & polish**
   - Horizontal swipe between Career tabs.
   - Pull-to-refresh on Home (invalidates key queries).
   - Loading skeletons + empty states on every card list.

8. **Version bump**
   - Bump `VersionHeader` and add v1.1.520 entry to `VersionHistory`.

---

## Phase 2 — Deep integration (follow-up deliveries)

Not shipped this turn. Called out so the user knows scope:
- Mobile-native detail screens for Gig, Band, Song, Recording session, Travel picker, Studio booking, Friend profile, Mail thread, Twaater composer.
- Context actions on every mobile page (rehearse, invite, book, publish, etc.).
- Long-press quick actions on cards.
- Notification permission + push (Capacitor/PWA path — separate decision).

---

## Technical details

- **No schema changes.** No new tables, no migrations.
- **No desktop file changes** other than the small branch in `Layout.tsx` and a mobile-aware check in `DesktopOnlyGate`.
- **Routing:** existing routes untouched. Mobile pages register at the same paths using a `<MobileRoute>` HOC so `/` renders `MobileHome` on phones and `Landing`/desktop dashboard on desktop — but only inside the authenticated `Layout`; unauthenticated `/` and `/auth` stay as-is.
- **Performance:** lazy-load Career sub-tab content; use React Query's existing caches; no extra fetching loops.
- **Accessibility:** 44px min tap targets, focus rings on all controls, aria-labels on icon-only buttons.

---

## Deliverables this turn

1. Mobile detection + shell + bottom nav + FAB.
2. Today dashboard with real data.
3. Career, Social, World, Me landing pages (card-based, wired to real hooks, with links to existing detail routes).
4. Mobile component library (~12 components).
5. Version bump to v1.1.520 with history entry.

Ready to proceed with Phase 1?
