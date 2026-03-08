

## v1.0.996 — Instrument Health Event Logging: Batch 2 (8 More Edge Functions)

### Problem
Only 3 of ~27 edge functions that modify band health stats currently log to `band_health_events`. Players still can't see the majority of stat changes in their event log.

### Batch 2 — 8 High-Traffic Functions

| Function | Stat Changes | Source Key |
|---|---|---|
| `calculate-organic-followers` | morale +1/+2 | `organic_followers` |
| `update-daily-streams` | morale +1 to +4 | `streaming_revenue` |
| `process-radio-submissions` | morale -1 (rejection) | `radio_rejection` |
| `shift-clock-out` | morale ±1/±2 | `work_shift` |
| `complete-recording-sessions` | morale +1/+3/+5 | `recording_session` |
| `process-media-submissions` | morale -1 (rejection) | `media_rejection` |
| `process-studio-bookings` | morale +1 (×2 paths) | `studio_booking` |
| `process-venue-bookings` | morale +1 | `venue_booking` |

### Approach
For each function, after the existing `supabase.from('bands').update(...)` call, insert a `band_health_events` record with the delta, new value, source, and a human-readable description. Non-critical — wrap in try/catch so logging failures don't break the main function.

### Files to modify (10 total)
- `supabase/functions/calculate-organic-followers/index.ts`
- `supabase/functions/update-daily-streams/index.ts`
- `supabase/functions/process-radio-submissions/index.ts`
- `supabase/functions/shift-clock-out/index.ts`
- `supabase/functions/complete-recording-sessions/index.ts`
- `supabase/functions/process-media-submissions/index.ts`
- `supabase/functions/process-studio-bookings/index.ts`
- `supabase/functions/process-venue-bookings/index.ts`
- `src/components/VersionHeader.tsx` — Bump to v1.0.996
- `src/pages/VersionHistory.tsx` — Add changelog entry

