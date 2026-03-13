
Goal: fix two live issues:
1) Player survey not appearing.
2) Tour travel taking too long and blocking entire days.

What I found from code + runtime data:
- Survey config row is currently `enabled: false` in `game_config` (`player_survey_enabled`), so players won’t see the modal.
- `PlayerSurveyAdmin.tsx` toggle/update uses `upsert(...)` without `onConflict: "config_key"` and without error handling, so writes can fail silently while still showing success UI.
- `usePlayerSurvey.ts` dashboard logic is generally fine; modal visibility depends on enabled config + not completed.
- Tour travel durations are currently very long (live example: 67h in-progress tour leg), causing heavy activity blocking.
- `TourWizard.tsx` Step 6 uses values `auto/manual/tour_bus`, but `useTourWizard`/travel calculations are built around actual transport modes (`bus/train/plane/tour_bus`). This mismatch leads to incorrect/slow behavior.
- `complete-travel` edge function still references non-existent columns (`transport_mode`, `distance_km`) in `player_travel_history`; live logs confirm failures. This breaks normal travel completion flow.

Implementation plan

1) Fix survey admin persistence + visibility reliability
- File: `src/pages/admin/PlayerSurveyAdmin.tsx`
  - Update both survey mutations to:
    - use `upsert(..., { onConflict: "config_key" })`
    - check `error` and throw on failure
    - include `updated_at` update
  - Add proper `onError` toasts (no false “success”).
  - Invalidate both admin and player keys after changes:
    - `["admin-survey-config"]`
    - `["survey-config"]`
- Wrap page with `AdminRoute` (same pattern as other admin pages) so non-admin users can’t interact with controls that RLS will reject.
- File: `src/hooks/usePlayerSurvey.ts`
  - Keep current logic but harden config parse/fallback so malformed config won’t suppress survey silently.
  - Add explicit fallback defaults for missing round/questions_per_session.

2) Fix travel completion function schema mismatch
- File: `supabase/functions/complete-travel/index.ts`
  - Replace `transport_mode` with `transport_type`.
  - Remove `distance_km` from select/use (column doesn’t exist). For hazard scaling, use safe fallback from `travel_duration_hours` or base chance only.
  - Re-test function path to ensure no 42703 column errors.

3) Fix tour travel speed + blocking root cause
- Files: `src/components/tours/TourWizard.tsx`, `src/hooks/useTourWizard.ts`, (if needed) `src/lib/tourTypes.ts`
- Align travel mode model end-to-end:
  - Option A (recommended): keep “Auto / Tour Bus / Manual” UX, but map internally:
    - auto => per-leg optimal mode (train/plane/bus by distance/region)
    - tour_bus => tour_bus
    - manual => do not auto-create blocking travel records
  - Option B: replace Step 6 with explicit transport modes and remove auto/manual.
- In `useTourWizard` leg generation:
  - stop defaulting to slow bus for ambiguous values.
  - compute realistic leg mode + duration for auto.
  - avoid aggressive `Math.ceil` inflation where not required.
- In `process-tour-travel`:
  - handle normalized modes only.
  - ensure created `player_travel_history` and `player_scheduled_activities` durations reflect corrected mode logic.

4) Data correction for already-created bad legs (important)
- Existing tours already contain long/incorrect legs and current in-progress travel.
- Run targeted data repair (data update script, not schema migration):
  - Recalculate upcoming `tour_travel_legs` where mode/duration is invalid.
  - Recalculate active in-progress tour travel for affected users and update `arrival_time`, `travel_duration_hours`, and `profiles.travel_arrives_at`.
- This ensures users feel the fix immediately, not only on newly created tours.

5) Validation checklist
- Survey:
  - Toggle enabled in admin, confirm DB config updates.
  - Login as player without completion record -> modal appears with 10 questions.
  - Skip -> no reward, appears again next login.
  - Complete all 10 -> completion row created + rewards granted once.
- Travel:
  - Invoke `complete-travel` and verify no column errors in logs.
  - Create a new tour with auto travel and verify legs are not bus-slow by default.
  - Confirm travel blocking windows are shorter/realistic and no multi-day lock for normal continent routing.

Technical notes (why this will fix it)
- Survey issue is primarily a write-path bug (wrong upsert usage + silent error handling), not query logic.
- Travel issue is a model mismatch + fallback bug:
  - Wizard values don’t match transport calculation modes.
  - Unknown/ambiguous modes end up treated as bus, producing very long durations.
  - completion function schema mismatch adds additional travel-state failures.
