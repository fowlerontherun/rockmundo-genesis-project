

## v1.0.997 — Health Event Logging Batch 3: 8 More Edge Functions

### Coverage So Far
11 of ~25 health-modifying edge functions are instrumented. This batch adds 8 more, bringing coverage to 19/25.

### Batch 3 Functions

| Function | Stat Changes | Source Key |
|---|---|---|
| `process-demo-review` | morale +5 (accepted) / -2 (rejected) | `demo_accepted`, `demo_rejected` |
| `lottery-draw` | morale +3 to +12 based on prize | `lottery_win` |
| `university-attendance` | morale +1 per class / +5 graduation | `university` |
| `book-reading-attendance` | morale +1 per day / +4 book complete | `book_reading` |
| `release-prisoners` | morale +, reputation + on release | `prison_release` |
| `process-prison-events` | morale + (songwriting in prison) | `prison_songwriting` |
| `process-teaching-sessions` | teacher: morale +3, rep +4; student: morale +2 | `teaching_session` |
| `check-player-debt` | morale -15, reputation -10 (debt crisis) | `player_debt` |

### Approach
Same pattern as Batch 2: after existing `.update()` call, store the `newValue` variable, then insert into `band_health_events` wrapped in try/catch.

### Files to modify (10)
- `supabase/functions/process-demo-review/index.ts`
- `supabase/functions/lottery-draw/index.ts`
- `supabase/functions/university-attendance/index.ts`
- `supabase/functions/book-reading-attendance/index.ts`
- `supabase/functions/release-prisoners/index.ts`
- `supabase/functions/process-prison-events/index.ts`
- `supabase/functions/process-teaching-sessions/index.ts`
- `supabase/functions/check-player-debt/index.ts`
- `src/components/VersionHeader.tsx` → v1.0.997
- `src/pages/VersionHistory.tsx` → changelog entry

