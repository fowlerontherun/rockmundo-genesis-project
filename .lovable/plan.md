## Goal

Bring every page in RockMundo to a single Football Manager 2024 look & feel — same chrome, same density, same data/stats/analysis patterns — and guarantee that in-game chat (DMs + thread + presence) is reachable from every screen without leaving the current page.

This plan is execution-only: no design exploration, no new visual direction. The FM24 token set, shell, and primitives already exist (`src/components/fm/*`, `src/index.css`, `fmNavigation.ts`); the work is auditing, migrating, and filling gaps.

## Current state (audit findings)

- **Shell** is in place (`FMShell` = TopStatusBar + ModuleTabs + SubTabs + FMSidebar + main + BottomActionBar) and wraps the authenticated app via `Layout.tsx`.
- **FM primitives** exist: `PanelCard`, `DataTable`, `AttrCell`, `FMFilterBar`, `SubTabs`, `ModuleTabs`, `BottomActionBar`.
- **Global shadcn primitives** (Card, Tabs, Table, Button, PageHeader) have already been re-skinned to FM tokens, so any page using shadcn inherits the look for free.
- **~280 page files** in `src/pages/` (incl. subfolders). Of those, **~145** don't use `PageHeader`/`PageLayout`/`StandardPageLayout` — they roll their own headers, paddings, and stat blocks. They render correctly inside the FM shell but feel inconsistent (oversized titles, rounded cards, ad-hoc spacing, custom KPI tiles, non-dense tables).
- **Chat**: `DirectMessageThread`, `MessagesTab`, and friend presence already exist under `src/features/social-hub/`, but chat is only reachable from `/social` and a few entry points. There is no global, persistent chat affordance.
- **Stats/analysis**: each domain has bespoke KPI tiles, charts, and breakdowns (Finances, BandFinance, Charts, Twaater analytics, Streaming revenue, Awards, Statistics, etc.). Density, label casing, number formatting, and chart styling are not unified.

## Target FM24 standard (the "definition of done" each page is migrated to)

1. **Chrome**: page renders inside `FMShell` (already true) and uses `PageHeader` (40px FM strip) for its own header — no custom title blocks.
2. **Layout**: content sits in `PanelCard`s on a 12px gutter grid; no rounded corners; no max-width clamps; full FM-shell width.
3. **KPI strip**: every domain page exposes a top "KPI bar" of 4–8 compact `AttrCell`s (10px uppercase label + tabular-nums value + delta) — standard for at-a-glance stats.
4. **Filters**: any list/table view sits behind a single `FMFilterBar` (search + pills + right-slot dropdown + reset).
5. **Tables**: lists render through the FM `DataTable` (28px rows, sticky `fm-panel-2` header, zebra, hover wash, column sort, optional pin).
6. **Analysis panel**: numeric/stat pages get an "Analysis" `PanelCard` containing one chart (Recharts, FM-tokened) + a 2-column comparison table. Standard layout — no bespoke chart wrappers.
7. **Footer actions**: primary actions live in `BottomActionBar` (not floating Cards mid-page).
8. **Color & type**: only FM tokens (`fm-bg`, `fm-panel`, `fm-panel-2`, `fm-border`, `fm-fg`, `fm-fg-muted`, `fm-accent`, `fm-good`, `fm-bad`, `fm-warn`). No `bg-white`, `text-white`, raw `purple/indigo`, or gradients.

## Phased rollout

### Phase 1 — Foundation primitives & shared widgets (1 PR, no page edits)
Build the missing pieces so subsequent phases are mechanical migrations.

- `FMKpiBar` — horizontal strip of `AttrCell`s with overflow scroll on narrow shells; props: `items: { label, value, delta?, tone? }[]`.
- `FMSection` — replaces ad-hoc `<section>` blocks: title strip (uppercase 11px) + collapsible body + optional right-slot.
- `FMStatChart` — Recharts wrapper preset to FM tokens (axis color, grid color, tooltip surface). Variants: `line`, `bar`, `area`, `stacked`.
- `FMAnalysisPanel` — composes `FMStatChart` + a side `DataTable` for "compare / breakdown" views.
- `FMPageScaffold` — wrapper enforcing `PageHeader` + KPI strip slot + content slot + bottom actions slot; replaces `StandardPageLayout` over time.
- `FMEmpty`, `FMLoading`, `FMError` — three standardized states.
- Lint guard: add a small ESLint rule (custom or `no-restricted-syntax`) that warns on `bg-white|text-white|from-purple|rounded-2xl` inside `src/pages/`.

### Phase 2 — Always-on in-game chat (1 PR)
Anchor chat in the shell so it follows the player everywhere.

- New `FMChatDock` mounted inside `FMShell` (below `BottomActionBar`, fixed bottom-right, 320px wide collapsible rail).
  - Collapsed state: 32px tab "Chat (n)" with unread badge.
  - Expanded state: friends list (presence dots), unread DMs first, click → opens a stacked `FMChatWindow` (one or two side-by-side, max 360px each).
- `FMChatWindow` wraps existing `DirectMessageThread` so we keep current send/receive logic and Supabase realtime.
- Global hook `useChatDock()` exposes `openThread(profileId)`, `closeThread(id)`, `minimize()` — reused by any page that wants a "Message" button (Friends, BandRoster, PlayerProfile, etc.).
- Reachability rule: dock renders on every authenticated route (inside `FMShell`), suppressed only on `/auth`, `/onboarding`, and modal-only flows like gig viewer fullscreen.
- Push unread counts into `TopStatusBar` (small message icon + count) as a secondary entry point.
- Voice (existing `DirectVoiceChat`) attaches to an open `FMChatWindow` via a header icon — no separate page needed.

### Phase 3 — Module hubs (`src/pages/hubs/*`, 14 files)
Hubs are the player's home for each module — they must be the visual reference for everything below them.

- Migrate all 14 hubs (`CharacterHub`, `MusicHubPage`, `BandHub`, `LiveHub`, `BandLiveHub`, `CareerBusinessHub`, `CareerHub`, `WorldHub`, `WorldSocialHub`, `SocialHub`, `CommerceHub`, `MediaHub`, `EventsHub`, `PremiumStoreHub`) to `FMPageScaffold` + `FMKpiBar` + tile grid using `PanelCard`.
- Standardize tile anatomy: 80×80 image, label, 1-line stat, status dot. No more 10-column custom layouts.

### Phase 4 — Core gameplay loops (high-traffic pages)
Hit the screens players see daily; each phase is a self-contained PR.

- **4a Music loop**: `Dashboard`, `Songwriting`, `RecordingStudio`, `ReleaseManager`, `ReleaseDetail`, `Songs/SongManager`, `MusicVideos`, `SongMarket`, `SongRankings`, `music/charts`, `StagePractice`, `Streaming*` (6 files).
- **4b Band loop**: `BandManager`, `EnhancedBandManager`, `SimpleBandManager`, `BandRepertoire`, `BandRiders`, `BandVehicles`, `BandCrewManagement`, `BandChemistry`, `BandRankings`, `BandFameMap`, `BandFinder`, `BandBrowser`, `BandSearch`, `BandProfile`, `bands/[bandId]/management`.
- **4c Live loop**: `GigBooking`, `PerformGig`, `OpenMicNights`, `PerformOpenMic`, `MajorEvents`, `PerformMajorEvent`, `Festivals`, `FestivalsNew`, `FestivalBrowser`, `FestivalDetail`, `FestivalPerformance`, `TourManager`, `TouringSystem`, `Awards`, `AwardShows`, `HallOfFame`, `HallOfImmortals`, `StagePractice`, `StageSetup`, `StageEquipmentSystem`, `Eurovision`.
- **4d Finance/Career**: `Finances`, `finance/portfolio`, `Sponsorships`, `Employment`, `Education`, `Teaching`, `RecordLabel`, `LabelManagement`, business management pages, `OffersDashboard`, `booking/*`.

### Phase 5 — World, social & commerce
- **5a World**: `WorldMap`, `WorldPulse`, `WorldParliament`, `PoliticalParty`, `PartyStandings`, `PoliticsCareer`, `MayorDashboard`, `City*`, `Travel`, `WorldEnvironment`.
- **5b Social/Media**: `SocialHub` (page), `Relationships`, `Twaater*` (8 files), `DikCok`, `Gettit`, `Inbox`, `PublicRelations`, `Radio*`, `MediaNetworks`, `Journal`, `TodaysNews`.
- **5c Commerce/Identity**: `Gear`, `MyGear`, `EnhancedEquipmentStore`, `ClothingShop`, `ClothingDesigner`, `SkinStore`, `BlindBox*`, `CraftingWorkshop`, `InventoryManager`, `Merchandise`, `commerce/merch`, `TattooParlour`, `AvatarDesigner`, `MyCharacterEdit`, `Characters`, `BuyCharacterSlot`.

### Phase 6 — Stats & analysis standardization (cross-cutting)
The user explicitly called out "details statistics and analysis." This phase rebuilds those surfaces on the new shared widgets.

- `PlayerStatistics`, `statistics/*`, `analytics/*`, `TwaaterAnalytics`, `BlindBoxAnalytics`, `StreamingRevenueDashboard`, `CompetitiveCharts`, `CountryCharts`, `ChristmasCharts`, `Awards`, `music/charts`, `competitive/*`.
- Every analytical page must use: `FMKpiBar` (snapshot), `FMAnalysisPanel` (chart + breakdown), `FMFilterBar` (timeframe/segment), `DataTable` (raw rows), and an export button in `BottomActionBar`.
- Add a `useFmStats(scope)` hook that returns standard timeframes (7d / 30d / season / career) so every page exposes the same range selector.

### Phase 7 — Admin & long-tail (~80 files)
- `Admin*`, `admin/*` (20+ files), `legal/*`, `legacy/*`, `community/*`, `competitive/*`, `culture/*`, `family/*`, `talent/*`, `tours/*`, `side-hustles/*`, `skills/*`, `studio/*`, `wellness/*`, `casino/*`, `events/*`, `dashboard/*`, `media/*`, `business/*`.
- Mostly mechanical — wrap in `FMPageScaffold`, swap KPI tiles for `FMKpiBar`, swap tables for `DataTable`.

### Phase 8 — Cleanup & enforcement
- Remove `PageLayout` / `StandardPageLayout` once unused; keep `PageHeader` as the canonical 40px strip.
- Delete bespoke chart wrappers replaced by `FMStatChart`.
- Promote the ESLint guard from Phase 1 from `warn` to `error`.
- Snapshot pass: capture every top-level route at 1440px to confirm the same shell, KPI strip, panel grid, and chat dock.
- Update `mem://style/*` notes so future work defaults to FM tokens and the FM scaffold.

## Per-page migration checklist (used in every phase)

```text
[ ] Remove custom outer <div>/<section> wrappers
[ ] Wrap in <FMPageScaffold title=... icon=... subtitle=...>
[ ] Replace custom KPI tiles with <FMKpiBar items={...} />
[ ] Replace ad-hoc filter rows with <FMFilterBar />
[ ] Replace shadcn <Table> usage with <DataTable />
[ ] Replace charts with <FMStatChart /> / <FMAnalysisPanel />
[ ] Move primary CTAs to <BottomActionBar />
[ ] Strip non-FM color classes; rely on tokens
[ ] Add "Message" buttons that call useChatDock().openThread(profileId)
```

## Versioning

Each phase ships as one PR and bumps the patch version (1.1.361 → 1.1.36N), with a matching `VersionHistory` entry listing every page touched and every new/changed primitive. No business logic changes — UI/composition only.

## Out of scope

- New gameplay mechanics, balance changes, or schema changes.
- Mobile-specific FM layout (FM24 is desktop-first; mobile retains its existing 360px stack).
- Visual redesign or palette changes — FM24 tokens are locked.
