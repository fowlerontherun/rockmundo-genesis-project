# Weekly broadcast schedule for Top of the Pops

A new admin page where you plan the show weeks ahead: which night each episode airs, who presents, what kind of show it is, and the rough running sheet notes for each one — all before the acts are booked.

## What you get

**Page: Broadcast schedule** (linked from the Top of the Pops admin page)

- A week-by-week grid, starting from this week, with a control to move forward or back and to pick how many weeks to show (4, 8 or 12).
- Each week shows its episode card: episode number, air date and time (London), presenter, show type (regular / special / anniversary), city, and how many acts are booked and checked in.
- A status chip per episode: Planned, Scheduled, Locked, Broadcast, Cancelled — plus a "running sheet saved" tick when the sheet for that episode has been stored.
- Empty weeks show an "Add episode" button so gaps are obvious at a glance.

**Planning an episode**
- Add or edit a future episode: air date, air time, check-in time, chart week used, host city, presenter, show type, and maximum number of acts.
- Cancel a future episode (no deletion, so history stays intact).
- Episodes that have already aired are read-only.

**Planning the running sheet in advance**
- Each future episode gets a planning panel: a show theme/title, presenter opening and closing link notes, a list of planned segments (interview, chart rundown, guest slot, etc.) with rough durations, and free-text production notes.
- The plan is saved per episode and is shown on the existing running sheet card, so when the acts are confirmed the sheet is already half written.
- A simple total shows planned running time so you can see if the show overruns the 20-minute target.

## Technical notes

- New table `totp_episode_plans` (one row per episode: theme, presenter link notes, `segments jsonb`, notes, updated_by/at) with grants, RLS and admin-only write via `has_role(auth.uid(), 'admin')`.
- New SECURITY DEFINER RPCs, admin-guarded:
  - `totp_admin_broadcast_schedule(p_from date, p_weeks int)` — episodes in range with act counts, manifest presence and plan presence.
  - `totp_admin_upsert_episode(...)` — insert or update a future episode; refuses dates in the past, refuses duplicate dates, auto-assigns the next `episode_number` on insert.
  - `totp_admin_cancel_episode(p_episode_id uuid)` — sets status `cancelled` for future episodes only.
  - `totp_admin_save_episode_plan(p_episode_id uuid, p_plan jsonb)` and `totp_episode_plan(p_episode_id uuid)`.
- New frontend: `src/features/top-of-the-pops/scheduleApi.ts`, `TotpScheduleWeekCard.tsx`, `TotpEpisodePlanEditor.tsx`, page `src/pages/admin/TopOfThePopsSchedule.tsx`, route `/admin/top-of-the-pops/schedule` in `App.tsx` (admin-gated like the existing admin route) and a link button on `TopOfThePopsAdmin.tsx`.
- `TotpRunningSheetCard.tsx` reads the saved plan and pre-fills presenter link and segment notes when present.
- Week grouping uses Monday-start weeks in Europe/London, matching the existing broadcast clock.
- Tests: schedule week-grouping and plan-duration helpers in `src/features/top-of-the-pops/__tests__`; route render test added to the existing pages test file.
- Version bumped in `VersionHeader.tsx` with a matching `VersionHistory.tsx` entry.
