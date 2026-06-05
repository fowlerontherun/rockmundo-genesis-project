## Goal
Add an admin-only "World Reset" tool that wipes all gameplay data, archives it first, preserves user accounts/roles and curated catalogs, and rolls the in-game calendar back to the Jan 1, 2026 epoch.

## Scope

**Wipe (gameplay):**
- Characters & profiles, character_skills, attributes, achievements, slots
- Bands, band_members, recruitment, repertoire, rehearsals
- Songs, recordings, releases, charts, distribution, royalties
- Gigs, tours, festivals, schedule, setlists
- Finances: transactions, accounts, payroll, sponsorships, crypto
- Inbox, direct_messages, notifications, twaater posts, dikcok, friendships, relationships
- Companies, businesses, housing, vehicles, gear inventories, modeling, politics, awards history
- Player-owned cosmetics, tattoos, employment history, addictions, health logs

**Preserve:**
- `auth.users`, `user_roles`, `profiles` (auth-side only) — accounts can log back in
- Curated catalogs: cities, venues (template rows), skill_definitions, gear catalog, mentors, universities, radio stations, ticket_operators, genres, season modifiers, game_calendar_config, NPC seed pools, achievement definitions, job listings
- Storage buckets untouched (avatars etc.) unless explicitly attached to wiped rows

**Reset:**
- `game_calendar_config` epoch back to 2026-01-01
- Clear cron-state tables (weekly_chart_runs, daily_processed flags, etc.)

## Safety model
1. `game_maintenance` table with `is_active`, `message`, `scheduled_reset_at`, `initiated_by`.
2. Admin enables maintenance mode → app-wide banner + route guard blocks non-admin gameplay mutations.
3. Countdown (admin-chosen, default 10 min) shown to all users; reset cannot run until countdown elapses.
4. Final execution requires admin role + typing `RESET WORLD` confirmation.
5. All admin actions logged to `admin_audit_log`.

## Archive strategy
- Each reset gets a timestamped schema: `archive_2026_06_05_1234`.
- SECURITY DEFINER function loops the wipe list and does `CREATE TABLE archive_x.<t> AS TABLE public.<t>` before `TRUNCATE ... CASCADE`.
- Keep last 3 archive schemas; older ones auto-dropped.

## Execution
- Single SECURITY DEFINER function `public.admin_world_reset(p_confirm text)` — checks `has_role(auth.uid(),'admin')`, requires `p_confirm = 'RESET WORLD'`, requires maintenance mode active and scheduled time passed.
- Function body: create archive schema → archive each table → truncate in FK-safe order → reseed calendar config → insert audit row → disable maintenance mode.
- Called via `supabase.rpc('admin_world_reset', ...)` from the admin UI — no edge function.

## Technical details

**New migration adds:**
- `public.game_maintenance` (singleton row) + RLS: read = all authenticated, write = admin only.
- `public.admin_audit_log` (action, actor_id, payload, created_at).
- Helper SQL functions:
  - `admin_enable_maintenance(message text, scheduled_at timestamptz)`
  - `admin_disable_maintenance()`
  - `admin_world_reset(p_confirm text)` — the main routine.
  - `admin_list_reset_archives()` / `admin_drop_old_archives()`.
- All gated by `has_role(auth.uid(),'admin')`.

**Frontend (admin only):**
- New page `src/pages/admin/WorldReset.tsx` linked from existing admin nav.
  - Section 1: maintenance toggle with message + countdown picker.
  - Section 2: live list of tables that will be wiped vs preserved (read from a small config constant).
  - Section 3: list of existing archive schemas with row counts.
  - Section 4: red "Execute Reset" panel — disabled until maintenance active & timer elapsed; requires typing `RESET WORLD`.
- New hook `src/hooks/useWorldReset.ts` wrapping the rpc calls + react-query invalidation.
- New `src/components/MaintenanceBanner.tsx` rendered at the app shell when `game_maintenance.is_active` — shows countdown and blocks gameplay routes for non-admins (route guard via existing layout).

**Bump version** in `VersionHeader.tsx` and add entry to `VersionHistory.tsx` per project convention.

## Out of scope
- Per-user opt-out (full server-wide reset only).
- Restoring from an archive (archives are inspect-only for now; can add a `restore_from_archive` follow-up).
- Wiping Supabase Storage objects.

## Open follow-ups for later
- Optional archive download as JSON.
- Selective reset (e.g. only charts) using the same archive pipeline.
