# Music Video Release Workflow Enhancements

## 1. UX Flows & Wireframes

### 1.1 Entry Points
- **Release Manager Tabs**: Extend existing `ReleaseManager` tab layout by adding a third tab labelled **"Music Videos"** alongside My Releases and Sales. The tab opens the video planning workspace and inherits routing from `src/routes` pattern using nested routes (e.g., `/release-manager/videos`). Use the same dynamic route guard applied to the sales tab to ensure permissions are checked prior to render.
- **Create Release Dialog**: Include a CTA in the release summary step that prompts users to "Add Music Video Plan" if none exists. CTA opens the planning wizard directly inside the Release Manager context so users can continue without losing workflow state.
- **Direct Deep Link**: Support `/releases/:id/music-video` for notifications so producers can jump to a specific release plan. The deep link should pre-select the correct tab and load plan data via release route loader.

### 1.2 Primary Flow — Plan New Music Video
```
Release Manager
└── Tabs (My Releases | Sales | Music Videos)
    └── Music Videos Tab
        ├── Overview Header (KPI badges, "Plan Music Video" button)
        ├── Status Filters + Search Bar
        └── Board/List view toggle
```
1. **Landing Overview (Tab Home)**
   - Summary cards of upcoming, in-production, and published music videos with status chips.
   - Status filter pills persist selection via URL query (e.g., `?status=planned`).
   - "Plan Music Video" button triggers modal wizard. If an in-progress draft exists, CTA resumes the draft.
2. **Wizard Steps (Modal with progress indicator)**
   - **Concept & Theme**: Select video theme, art style, narrative outline; optional mood board upload (preview with file validation). Provide suggested combinations based on release genre fetched from `release_profiles` table.
   - **Budget & Quality**: Choose budget range, production quality tier, allocate funds across line items (direction, cinematography, post, marketing). Display running total and variance against budget band in sidebar.
   - **Cast & Crew**: Select cast options, choreography needs, cameo requests; link to `BandCrewManagement` data. Present availability warnings sourced from crew calendar.
   - **Distribution & Metrics**: Configure target platforms (YouTube, MTV, regional TV), set KPI targets and baseline metrics. Allow toggling auto-sync per platform.
   - **Review & Confirm**: Display summary; validation of required fields. Offer "Save Draft" and "Submit Plan" actions.
3. **Post-Plan Workspace**
   - Kanban lanes (Planning, Pre-production, Filming, Post, Released) with drag and drop interactions updating status.
   - Embedded analytics cards (view counts, chart positions) that default to most recent metrics sync.
   - Action bar with "Sync Metrics", "Export Shotlist", "Schedule Promo" plus contextual menu for delete/archive.
   - Timeline section mapping key milestones (shoot date, edit lock, release) using `Timeline` component reused from tour planner.

### 1.3 Wireframe Notes
- Reuse `Tabs`, `Card`, `Badge`, `Button`, `Dialog`, `Stepper`, and `DataTable` components from `components/ui` to maintain visual consistency.
- Grid layout similar to `ReleaseSalesTab` for analytics panels, with responsive two-column layout collapsing to single column under 1024px.
- Kanban column uses `ScrollArea` and `DraggableCard` patterns from existing project management screens (e.g., `src/pages/TourManager.tsx`). Provide placeholder state using `EmptyState` component when no cards exist.
- Modal wizard uses `Dialog` + `Tabs` (vertical) to support revisiting steps. Include progress indicator and step validation messaging below footer buttons.

## 2. Data Models & API Requirements

### 2.1 Tables
Follow Supabase conventions: snake_case table and column names, UUID primary keys defaulting to `uuid_generate_v4()`, timestamps via `created_at`, `updated_at` with `timezone('utc'::text, now())` defaults. Add row-level security mirroring existing release tables with `auth.uid()` comparison on release owner.

| Table | Purpose | Key Columns |
| --- | --- | --- |
| `music_videos` | Core records for each planned or released video | `id uuid PK`, `release_id uuid FK -> releases.id`, `title text`, `slug text UNIQUE`, `status video_status_enum`, `budget_estimate integer`, `quality_tier quality_tier_enum`, `target_release_date date`, `shoot_start_date date`, `shoot_end_date date`, `kpi_view_target integer`, `kpi_chart_target text`, `primary_platform platform_enum`, `sync_strategy sync_strategy_enum`, `created_at`, `updated_at` |
| `music_video_themes` | Catalog of allowed themes | `id uuid PK`, `name text UNIQUE`, `description text`, `visual_motifs jsonb`, `genre_tags text[]`, `created_at`, `updated_at` |
| `music_video_art_styles` | Visual styling options | `id uuid PK`, `name text UNIQUE`, `color_palette jsonb`, `lighting_profile text`, `camera_techniques text`, `moodboard_url text`, `created_at`, `updated_at` |
| `music_video_budgets` | Preset budget bands | `id uuid PK`, `name text`, `min_cost integer`, `max_cost integer`, `default_quality_tier quality_tier_enum`, `currency_code char(3)`, `created_at`, `updated_at` |
| `music_video_quality_tiers` | Quality definitions for production | `id uuid PK`, `tier quality_tier_enum UNIQUE`, `description text`, `expected_turnaround interval`, `crew_size_hint integer`, `created_at`, `updated_at` |
| `music_video_cast_options` | Cast and crew options with cost multipliers | `id uuid PK`, `name text`, `role text`, `cost_multiplier numeric`, `availability jsonb`, `requires_union boolean DEFAULT false`, `created_at`, `updated_at` |
| `music_video_cast_assignments` | Pivot table linking plans to cast | `id uuid PK`, `music_video_id uuid FK -> music_videos.id`, `cast_option_id uuid FK -> music_video_cast_options.id`, `role_override text`, `cost_estimate integer`, `confirmed boolean`, `notes text`, `created_at`, `updated_at` |
| `music_video_platform_targets` | Selected distribution platforms | `id uuid PK`, `music_video_id uuid FK -> music_videos.id`, `platform platform_enum`, `auto_sync boolean DEFAULT true`, `priority integer`, `launch_url text`, `created_at`, `updated_at` |
| `music_video_metrics` | Aggregated metrics per platform | `id uuid PK`, `music_video_id uuid FK -> music_videos.id`, `platform platform_enum`, `views_total bigint`, `likes_total bigint`, `shares_total bigint`, `chart_position integer`, `source text`, `collected_at timestamptz`, `synced_at timestamptz`, `external_reference text`, `import_batch_id uuid FK -> music_video_metric_imports.id` |
| `music_video_metric_imports` | Job tracking for syncs/uploads | `id uuid PK`, `music_video_id uuid`, `platform platform_enum`, `started_at timestamptz`, `completed_at timestamptz`, `status import_status_enum`, `error_message text`, `triggered_by uuid FK -> profiles.id` |
| `music_video_moodboards` | File references for concept step | `id uuid PK`, `music_video_id uuid`, `storage_path text`, `caption text`, `created_at`, `updated_at` |

### 2.2 Supporting Enums
- `video_status_enum`: `draft`, `planned`, `in_production`, `post_production`, `released`, `archived`.
- `quality_tier_enum`: `indie`, `standard`, `premium`, `cinematic`.
- `platform_enum`: `youtube`, `mtv`, `vevo`, `tiktok`, `instagram`, `regional_tv`, `other`.
- `sync_strategy_enum`: `manual`, `scheduled`, `webhook` (controls automated metric jobs).
- `import_status_enum`: `pending`, `processing`, `succeeded`, `failed`, `partially_failed`.

### 2.3 API Endpoints
Expose via REST/RPC functions in Supabase. All endpoints enforce RLS and require JWT with `release_id` access.
- `POST /music-videos`: create new plan with validations on `release_id` ownership, unique `slug` per release, and required wizard fields.
- `PATCH /music-videos/:id`: update status, budgets, assignments, scheduling milestones.
- `GET /music-videos?release_id`: list videos for release with joined theme/style data and aggregated metrics summary.
- `GET /music-videos/:id`: fetch single plan including cast assignments, platform targets, and latest metrics per platform.
- `POST /music-videos/:id/metrics/sync`: trigger backend job to fetch latest metrics (enqueues row in `music_video_metric_imports`).
- `POST /music-videos/:id/cast`: assign cast options (writes to join table `music_video_cast_assignments` with `cast_option_id`, `role`, `cost_estimate`).
- `PATCH /music-videos/:id/cast/:assignment_id`: confirm, update, or remove cast assignments.
- `POST /music-videos/:id/platform-targets`: manage distribution platform selections and sync strategy.
- `GET /music-videos/:id/metrics/history`: paginated list of `music_video_metrics` records grouped by platform and collected_at.
- `GET /music-video-catalogs`: return themes, art styles, budgets, quality tiers, cast options for UI configuration caching (supports `If-None-Match` for caching).

### 2.4 Database Considerations
- Create composite unique index on `music_video_metrics (music_video_id, platform, collected_at)` to prevent duplicates.
- Use check constraint on `music_video_budgets` ensuring `min_cost < max_cost`.
- Add computed column `budget_variance` via view for analytics exports.
- Store large moodboard files in Supabase Storage `music-video-moodboards` bucket with signed URLs.
- Add `trigger set_updated_at` before update for tables to maintain timestamp accuracy.

## 3. External Integration Touchpoints

### 3.1 YouTube View Counts
- **Service Module**: Create `src/lib/services/youtubeMetrics.ts` using `supabase-client` for token storage and fetch job orchestration. Module exposes `fetchYoutubeMetrics(videoId: string, since?: Date)` and `queueYoutubeSync(musicVideoId: string)` functions.
- **Data Flow**: Use cron/edge function to call YouTube Data API v3 `videos.list` endpoint; map `viewCount`, `likeCount`, `commentCount`, `favoriteCount` into `music_video_metrics` with `platform = 'youtube'`. Persist raw payload snapshot in `supabase.storage` for audit.
- **Auth Handling**: store API credentials in Supabase `encrypted_secrets`; refresh tokens via existing service pattern in `src/lib/utils.ts`. Rotate API keys using existing secrets rotation job.
- **Rate Limits**: Batch requests using `videos.list` `id` parameter (50 max). Exponential backoff on quota errors logged in `music_video_metric_imports.error_message`.

### 3.2 Chart Data (Billboard & Regional)
- **Service Module**: `src/lib/services/chartMetrics.ts` to handle scraping/API ingestion similar to chart modules referenced in `src/pages/CompetitiveCharts.tsx`. Provide adapters per source (Billboard API, Spotify charts feed, Apple Music charts).
- **Data Flow**: On scheduled job, fetch chart rankings, store `chart_position`, `source` (billboard, spotify, apple) against metrics entries. Convert ranking numbers to integers and map week start to `collected_at`.
- **Normalization**: Map chart timeframe (week start) into `collected_at`; deduplicate by (video, platform, collected_at). When multiple entries for same week exist, keep best rank and log conflict to `music_video_metric_imports`.
- **Historical Backfill**: Support optional `backfillWeeks` parameter to ingest past data when plan is first created.

### 3.3 MTV/TV View Imports
- **Service Module**: `src/lib/services/broadcastMetrics.ts` interfacing with CSV uploads or partner API. Accepts streaming upload to Supabase Storage then processes via edge function `process_broadcast_metrics`.
- **Workflow**: Release team uploads weekly CSV (fields: `air_date`, `program`, `viewers`); edge function parses and stores aggregated totals. Provide mapping UI for column headers before ingestion, stored in `music_video_metric_imports` metadata column.
- **Manual Overrides**: Admin UI to edit metrics entries when partner data is incomplete. Support rollback by marking import batch status `failed` and soft-deleting metrics rows via `deleted_at` column (add if needed).

### 3.4 Sync Coordination
- Unified `syncMusicVideoMetrics` function orchestrates calling YouTube, chart, broadcast services; triggered by UI button and background schedule. Function emits analytics event `music_video.metrics_synced` for observability.
- Expose `useSyncMusicVideoMetrics` hook that invalidates React Query caches and shows toast notifications. Jobs triggered from UI should poll `music_video_metric_imports` until `status = 'succeeded'`.
- Schedule nightly cron job via Supabase Edge Functions to run `syncMusicVideoMetrics` for all videos with `sync_strategy = 'scheduled'`.

## 4. UI Components, State, and Validation

### 4.1 Components
- **MusicVideoTab** (`src/pages/ReleaseManager/MusicVideoTab.tsx`): wraps layout with `TabsContent`, handles data loaders, and renders `MusicVideoOverview` or `MusicVideoBoard` depending on view toggle.
- **MusicVideoOverview** (`@/components/releases/MusicVideoOverview.tsx`): hero header, KPI badges, filters, and CTA.
- **MusicVideoList** (`@/components/releases/MusicVideoList.tsx`): cards summarizing status and KPIs. Supports virtualization for large datasets.
- **MusicVideoBoard** (`@/components/releases/MusicVideoBoard.tsx`): Kanban board view using `DragDropContext` and `DroppableColumn` subcomponents.
- **PlanMusicVideoDialog** (`@/components/releases/PlanMusicVideoDialog.tsx`): multi-step dialog using `Stepper` pattern or stacked `Tabs` for steps. Includes autosave to Supabase on step change.
- **BudgetAllocator** (`@/components/releases/BudgetAllocator.tsx`): uses `Slider`, `Input`, `Table` for line items; emits `onAllocationChange` events for form state.
- **CastSelector** (`@/components/releases/CastSelector.tsx`): multi-select list using `Command` or `Combobox` component with grouped options by role. Displays availability chips.
- **PlatformTargetPicker** (`@/components/releases/PlatformTargetPicker.tsx`): toggles platform selection, sync strategy, and auto-sync schedule.
- **MetricsPanel** (`@/components/releases/MetricsPanel.tsx`): cards displaying view counts and chart status; includes chart.js sparkline for historical trends.
- **MetricsHistoryDrawer** (`@/components/releases/MetricsHistoryDrawer.tsx`): slide-over to browse sync history grouped by platform.
- **ImportBroadcastDialog** (`@/components/releases/ImportBroadcastDialog.tsx`): handles CSV upload mapping and status feedback.
- **ShotlistExportButton** (`@/components/releases/ShotlistExportButton.tsx`): triggers export script and shows toast.

### 4.2 State Management
- Use React Query (if present) or Supabase hooks for fetching catalog data; fallback to context state with `useState` and `useEffect` for local caching. Create `useMusicVideoCatalog` hook that caches data and updates when admin modifies catalogs.
- Store wizard form state using `react-hook-form` (consistent with existing forms) with Zod schema validation located in `src/lib/validation/musicVideo.ts`. Persist partial state to local storage keyed by release ID to protect against tab close.
- Derived state for budget totals and cost warnings computed via memoized selectors and `useMemo` hooks. Use `useWatch` from `react-hook-form` to update derived totals in `BudgetAllocator`.
- Use `zustand` or existing global store for cross-tab sync (e.g., when metrics sync updates board counts). Provide `MusicVideoStore` with actions `setView`, `setFilter`, `updateCard`.
- Integrate Supabase realtime to push metric updates to clients viewing the board.

### 4.3 Validation Rules
- Required: `title`, `release_id`, `video_theme_id`, `art_style_id`, `budget_band_id`, `quality_tier`, `target_release_date`, at least one `platform_target`.
- Budget total must be within selected budget band range; warn if cast cost multipliers push over `max_cost`. Hard stop if `total_allocation > max_cost + contingency` (set by configuration, default 5%).
- At least one distribution platform selected; YouTube required for metrics integration unless flagged as `promo_only` (new boolean column) to allow non-release concept videos.
- KPI targets non-negative integers; chart target must match recognized chart sources (`billboard_hot_100`, `global_200`, etc.). Provide dropdown to avoid invalid strings.
- Cast availability check to prevent scheduling conflict (call existing scheduling service if available). If conflict exists, show blocking validation with link to view conflict calendar.
- Validate `shoot_start_date <= shoot_end_date` and `shoot_start_date >= today` when plan is submitted (drafts can be in the past).
- File uploads for mood boards must be JPG/PNG under 10MB; enforce via client and server checks.

## 5. Acceptance Criteria & Testing Strategy

### 5.1 Acceptance Criteria
1. Users can open Release Manager, navigate to Music Videos tab, and see existing plans categorized by status with accurate counts in header badges.
2. Starting a new plan prompts the multi-step wizard; form enforces required fields, displays inline validation, and supports saving drafts that can be resumed.
3. Submitting the plan creates `music_videos` record and associated selections (themes, art style, cast assignments, platform targets) within a single transaction; UI shows success toast and updates list without reload.
4. Kanban board reflects status transitions; moving cards updates `status` in database, and realtime updates propagate to other viewers.
5. "Sync Metrics" action populates latest YouTube views, chart data, and TV views into analytics cards within 5 minutes; sync status is visible in import history drawer.
6. Metrics history retains past sync records viewable in Metrics Panel, allowing filtering by platform and date range.
7. Admins can import MTV/TV CSV data and see aggregated results in UI; failed rows are reported with actionable error messages.
8. Analytics reports export (CSV/PDF) includes video metadata, budgets, latest metrics, and variance vs targets.
9. Deep linking to `/releases/:id/music-video` opens tab and highlights the relevant video card or displays empty state if not found.

### 5.2 Testing Strategy
- **Unit Tests**: Validate form schema (Zod), budget calculator utilities, service modules with mocked API responses, and selectors in `MusicVideoStore`.
- **Integration Tests**: Use Supabase test database to ensure API endpoints enforce access control, relational integrity, and transactional creation of dependent records.
- **E2E Tests**: Cypress or Playwright scenarios covering full user journey (tab navigation → plan creation → status update → metrics sync → report export). Include accessibility assertions for keyboard navigation and screen reader labels.
- **Contract Tests**: Mock YouTube, chart, and broadcast API responses to confirm data normalization before persistence and ensure retry logic on transient failures.
- **Load Tests**: Ensure metrics sync handles batches of 100 videos without timeout and board drag/drop remains responsive with 200 cards.
- **Analytics Verification**: Scheduled job test to confirm metrics reconciliation writes expected records for each platform and triggers analytics event ingestion.
- **Security Tests**: Validate RLS prevents cross-release data access and ensure CSV upload sanitization prevents injection.

