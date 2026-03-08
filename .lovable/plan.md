

## v1.0.998 — Health Event Logging: Final Batch (6 Remaining Edge Functions)

This completes 100% coverage of all health-stat-modifying edge functions.

### Remaining Uninstrumented Functions

| Function | Stat Changes | Source Key |
|---|---|---|
| `complete-travel` | morale -1/-3/-6 (travel hazards) | `travel_hazard` |
| `process-company-taxes` | morale -2 (tax stress) | `company_taxes` |
| `process-tour-travel` | morale +2 (tour arrival) | `tour_arrival` |
| `process-daily-updates` | reputation drift ±0.5, sentiment drift ±0.5/±0.8 | `daily_rep_drift`, `daily_sentiment_drift` |
| `simulate-merch-sales` | morale +1 to +4 (merch revenue) | `merch_sales` |
| `process-pr-activity` | sentiment + intensity changes | `pr_activity` |
| `complete-release-manufacturing` | morale + sentiment + intensity | `release_manufacturing` |

**Note**: `process-daily-updates` has 3 separate drift loops (band sentiment, reputation, fan sentiment). The two bulk-processing drift loops update hundreds of bands per tick — logging every drift would flood the table. We'll skip logging for the drift loops (they're small ±0.5 changes) and only log the first sentiment drift section which already inserts into `band_sentiment_events`. This keeps the remaining 6 functions focused on meaningful, player-visible events.

### Approach
Same pattern: after each `.update()` call, insert into `band_health_events` in a try/catch.

### Files to modify (8)
- `supabase/functions/complete-travel/index.ts`
- `supabase/functions/process-company-taxes/index.ts`
- `supabase/functions/process-tour-travel/index.ts`
- `supabase/functions/simulate-merch-sales/index.ts`
- `supabase/functions/process-pr-activity/index.ts`
- `supabase/functions/complete-release-manufacturing/index.ts`
- `src/components/VersionHeader.tsx` → v1.0.998
- `src/pages/VersionHistory.tsx` → changelog entry

