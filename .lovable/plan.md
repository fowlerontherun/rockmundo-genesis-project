
## Goal

Make the inbox feel alive, get random events firing for far more characters, and stop releases from being auto-loss by fixing the distribution math and surfacing projected P/L in the wizard.

---

## 1. Random events — loosen the activity window

**File:** `supabase/functions/trigger-random-events/index.ts`

- Change the active-player filter from `updated_at >= 7 days` to `updated_at >= 30 days`. Currently only 14 / 140 profiles qualify; 30 days unlocks the long tail.
- Bump `TRIGGER_CHANCE` from `12` (~8.3%) to `6` (~16.7%) per run so each active player averages multiple events per week instead of one every ~6 days.
- Keep the existing craving (1/5) path for addicted players unchanged.
- Add a log line summarising `playersEligible / playersRolled / eventsTriggered` so future debugging is easy.

No schema changes; cron jobs already fire correctly (verified in `cron.job_run_details`).

---

## 2. Inbox — verify existing writes + add system messages

### 2a. Audit the existing writers (no behaviour change expected)
Confirm these three flows actually insert into `player_inbox`:
- `supabase/functions/process-event-outcomes/index.ts` (random event resolution)
- `supabase/functions/choose-event-option/index.ts` (immediate event choice)
- Gig completion path that produced the 113 `gig_result` rows

If any silently swallow the insert error, switch to `.throwOnError()` so failures surface in the function logs.

### 2b. Add new system inbox generators
Create a new edge function `generate-system-inbox` (run daily at 06:00 UTC via pg_cron) that, for every profile with `updated_at >= 30 days`, writes:

| Trigger | Category | Priority | Title |
|---|---|---|---|
| First time the profile is seen by the job | `system` | `normal` | "Welcome to Rockmundo" |
| Cash balance < $1,000 | `financial` | `high` | "Low cash warning" |
| A release crossed a sales milestone (1k / 10k / 100k / 1M units) since last run | `financial` | `normal` | "Sales milestone reached" |
| Weekly summary (Monday only): plays, gigs, net cash change last 7 days | `system` | `low` | "Your week in review" |

De-dupe via a unique `(user_id, related_entity_type, related_entity_id, category)` key for milestones; for weekly/welcome use `metadata.week_of` / `metadata.kind='welcome'` checks before inserting.

Schedule via `cron.schedule` (insert tool, not migration, per cron-job rules).

---

## 3. Release P/L — verify distribution math + show projected P/L

### 3a. Fix the distribution-fee source of truth
**File:** `supabase/functions/generate-daily-sales/index.ts`

Today the function reads the rate from `game_config` (digital 30%, vinyl 15%, cd 20%, cassette 15%) regardless of what the wizard saved on `release_formats.distribution_fee_percentage`. That's why a cassette row stored at `0%` still gets charged 15% in production.

Change the resolver to:
```
rate = release_formats.distribution_fee_percentage ?? salesConfig[`${format_type}_distribution_rate`] ?? defaultByFormat
```
and clamp to `[0, 50]`. No double-application — the row already excludes the fee from `net_revenue`; nothing downstream should subtract it again.

### 3b. Audit for double-charging
Grep all daily-sales / streaming-revenue / label-payout functions and confirm distribution fee is only ever subtracted **once**, at the row insert in `generate-daily-sales`. Note this in the version history.

### 3c. Show projected P/L in the release wizard
**File:** `src/components/releases/FormatSelectionStep.tsx` (and the wizard summary step)

Add a live "Projected P/L per format" panel that, for each selected format, shows:
- Manufacturing cost = `quantity × unit_manufacturing_cost`
- Expected gross = `quantity × retail_price × expected_sell_through_pct(format, hype, fame)`
- − sales tax (from `game_config`)
- − distribution fee (from format row)
- − label cut % (if signed)
- = projected band net
- A red badge "Likely loss" when projected band net < manufacturing cost, with tooltip "Reduce quantity or raise price"

`expected_sell_through_pct` heuristic (frontend-only estimate, no DB write):
- digital/streaming: cap at 100%
- physical: `min(0.9, 0.05 + hype/500 + fame/1000)` — i.e. a brand-new band realistically sells ~5–10% of pressed units, a famous band with high hype can approach 90%.

This is a UI/presentation change only — does not change actual sales math.

### 3d. Soft cap in the wizard (warning only, not block)
If `quantity > 10 × expected_units`, show an inline warning under the quantity input: "You're pressing 10× more than projected sales — this release will likely lose money." User can still proceed.

---

## 4. Version + history

- Bump version banner (likely `v1.1.287`).
- Add a Version History entry grouping these as: Random events trigger more often; Inbox now has welcome/financial/milestone/weekly messages; Release wizard shows projected P/L; Distribution fees now respect per-format overrides.

---

## Out of scope

- No changes to RLS policies (already correct).
- No retroactive recalculation of past `release_sales` rows.
- No changes to the underlying random-event catalog (just trigger frequency).

## Technical notes

- All cron schedules must be inserted via the **insert tool**, never the migration tool (per project rules).
- All currency math stays in cents with `Math.round(dollars * 100)` (per Core memory).
- `useInbox` already subscribes to realtime — new system messages will appear without a refresh.
- The new edge function uses `verify_jwt = false` (default) since it runs from cron with the service role key.
