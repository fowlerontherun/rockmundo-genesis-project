## FM24-Style Desktop-Only Overhaul

Football Manager 2024 references: dark navy/slate chrome, persistent top status bar (manager/club/date/cash), persistent bottom action bar (Continue + notifications), left sidebar for module sections, top tabs for the active module with a secondary sub-tab strip, and dense data tables with color-coded attribute cells. We replicate that shell and convert our major pages to the same idiom.

### Phase 1 — Desktop gate (block under 1440px)

- New `src/components/DesktopOnlyGate.tsx`: full-screen branded message ("RockMundo is desktop-only. Please use a browser at 1440×900 or larger.") shown whenever `window.innerWidth < 1440`. Listens to resize.
- Mount inside `src/App.tsx` above all routes so even `/auth` is gated.
- Remove `src/hooks/use-mobile.tsx` consumers' mobile branches (sidebar Sheet, horizontal nav). Delete `HorizontalNavigation` mobile sheet path. Keep `useIsMobile` file but unused.
- Set viewport meta in `index.html` to `width=1440` (no user-scalable) so accidental mobile loads still see the gate.
- Strip Capacitor/PWA mobile install hints if present.

### Phase 2 — FM24 app shell

New `src/components/fm/` directory:

- `FMShell.tsx` — replaces `Layout.tsx` render tree. Grid:
  ```text
  ┌─────────────────────── TopStatusBar (h-12) ───────────────────────┐
  ├──────────┬──────────────── ModuleTabs (h-10) ────────────────────┤
  │ Sidebar  ├──────────────── SubTabs (h-9) ─────────────────────────┤
  │ (w-56,   │                                                        │
  │ collap-  │              <Outlet /> page content                   │
  │ sible    │                                                        │
  │ to w-12) │                                                        │
  ├──────────┴──────────────── BottomActionBar (h-12) ────────────────┤
  └────────────────────────────────────────────────────────────────────┘
  ```
- `TopStatusBar.tsx` — character avatar + name, active band, game date + season, cash, fame, energy/health pips, quick search, settings.
- `ModuleTabs.tsx` — primary modules across the top: Overview, Music, Band, Live, Career, World, Social, Business, Admin. Active module is highlighted FM-style (lit underline).
- `SubTabs.tsx` — secondary strip driven by the current module's route children (e.g. Music → Songwriting / Recording / Releases / Charts).
- `FMSidebar.tsx` — collapsible left rail with grouped sections for the current module's deep links + global pinned items. Uses shadcn `Sidebar` with `collapsible="icon"`, default expanded, persisted.
- `BottomActionBar.tsx` — Continue (advance day) button on the right, notifications inbox bell, pending events count, and contextual quick actions.
- `src/config/fmNavigation.ts` — single source of truth: modules → subtabs → sidebar groups → route. Drives all three nav surfaces.

### Phase 3 — Dense data table primitive

- `src/components/fm/DataTable.tsx` — wraps shadcn `Table` with: zebra rows, 28px row height, sortable headers, sticky header, optional row click handler, color-coded attribute cell (`<AttrCell value={n} />` green ≥15, yellow 8–14, red <8 on the 0–20 scale).
- `src/components/fm/AttrCell.tsx`, `StatBar.tsx`, `PanelCard.tsx` (FM-style flat panel with thin header bar).

### Phase 4 — Convert major pages to FM idiom

Each page rebuilt around `PanelCard` grids and `DataTable`:

1. **Dashboard / Overview** (`src/pages/Index.tsx`) — 3-column FM overview: left = character vitals, center = inbox + next gig + active project, right = band morale, finances mini, top songs.
2. **Band** (`EnhancedBandManager.tsx`) — member roster as `DataTable` with skill attr cells, cohesion bar, role; right panel = selected member detail.
3. **Finances** (`Finances.tsx`) — KPI strip + income/expense table by category + weekly trend panel.
4. **Schedule** (`Schedule.tsx`) — FM calendar grid (week view) + activity table.
5. **Gigs** (`SimpleAdvancedGigSystem.tsx`) — upcoming/past tables with payout, venue, audience attr cells.
6. **Songs** (`MusicHub.tsx` repertoire) — sortable song table: quality, plays, revenue, last release.
7. **Education** (`Education.tsx`) — courses table with progress bar attr cell.

Other pages keep current internals but render inside `FMShell` and `PanelCard` wrappers so chrome is consistent.

### Phase 5 — Theme

- Add FM-flavored tokens to `index.css` and `tailwind.config.ts`:
  - `--fm-bg: 220 25% 8%`, `--fm-panel: 220 22% 12%`, `--fm-panel-2: 220 20% 15%`, `--fm-border: 220 15% 22%`, `--fm-accent: 200 90% 55%` (cyan), `--fm-good: 145 65% 45%`, `--fm-warn: 45 90% 55%`, `--fm-bad: 0 70% 55%`.
- Keep existing semantic tokens; FM tokens are additive for the shell + tables.

### Out of scope

- Per-page gameplay logic changes (purely UI/chrome rewrap).
- Mobile/PWA support (explicitly removed).
- Animation/sound polish beyond hover/active states.
- Translating every minor page — only the seven listed get full FM table treatment; others get shell-only.

### Version

Bump to **1.1.355**, add VersionHistory entry summarizing desktop-only gate + FM24 shell + table conversions.

### Risk notes

- Many pages currently assume `useIsMobile`; we'll leave the hook returning false (gate prevents true) so no runtime errors.
- `Layout.tsx` keeps its background hooks (`useAutoGigStart`, calendars, etc.); only the render tree is replaced.
