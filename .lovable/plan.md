

# Weekly In-Game Lottery -- v1.0.697

## Overview

A weekly lottery where players pick **7 main numbers** (from 1-49) and **1 bonus number** (from 1-10). A draw happens once per week (Monday 00:00 UTC, matching the existing week anchor system). Players can check results, see past draws, and claim winnings.

## Game Design

### How It Works

- **Number Selection**: Players pick 7 numbers from 1-49 and 1 bonus number from 1-10
- **Ticket Cost**: $500 in-game cash per ticket (1 ticket per player per week)
- **Weekly Draw**: Every Monday at 00:00 UTC, 7 winning numbers + 1 bonus number are drawn
- **Draw Mechanism**: An edge function runs on a cron schedule to generate winning numbers and calculate payouts

### Prize Tiers

| Match | Prize |
|-------|-------|
| 7 + Bonus | Jackpot: $1,000,000 + 10,000 XP + 5,000 Fame |
| 7 | $250,000 + 5,000 XP |
| 6 + Bonus | $50,000 + 2,000 XP |
| 6 | $10,000 + 1,000 XP |
| 5 + Bonus | $5,000 + 500 XP |
| 5 | $1,000 + 200 XP |
| 4 | $500 + 100 XP |
| 3 | Free ticket next week (refund $500) |

---

## Changes

### 1. Database -- New Tables (Migration)

**`lottery_draws`** -- stores each weekly draw result
- `id` (uuid PK)
- `week_start` (date, unique) -- Monday anchor date
- `draw_date` (timestamptz) -- when the draw was executed
- `winning_numbers` (int[]) -- 7 winning numbers
- `bonus_number` (int) -- the bonus number
- `jackpot_amount` (int, default 1000000)
- `status` (text: 'pending' | 'drawn' | 'paid_out')
- `created_at` (timestamptz)

**`lottery_tickets`** -- stores player entries
- `id` (uuid PK)
- `user_id` (uuid, FK to auth.users)
- `profile_id` (uuid, FK to profiles)
- `draw_id` (uuid, FK to lottery_draws)
- `selected_numbers` (int[]) -- 7 chosen numbers
- `bonus_number` (int) -- chosen bonus number
- `matches` (int, nullable) -- filled after draw
- `bonus_matched` (boolean, default false)
- `prize_cash` (int, default 0)
- `prize_xp` (int, default 0)
- `prize_fame` (int, default 0)
- `claimed` (boolean, default false)
- `created_at` (timestamptz)

**RLS Policies**:
- Players can SELECT their own tickets
- Players can INSERT tickets (with profile ownership check)
- Lottery draws are SELECT-able by all authenticated users
- No direct UPDATE/DELETE by players on draws

### 2. Edge Function -- `lottery-draw`

- Triggered weekly via pg_cron (or manually by admin)
- Generates 7 unique random numbers (1-49) and 1 bonus number (1-10)
- Calculates matches for all tickets in that draw
- Updates ticket records with match count, bonus match, and prize amounts
- Awards prizes (cash, XP, fame) to winning profiles

### 3. New Page -- `src/pages/Lottery.tsx`

Main lottery page with tabs:

- **Play Tab**: Number picker grid (1-49) for main numbers, separate picker (1-10) for bonus. Shows current ticket cost ($500), player's cash balance, and submit button. Displays countdown to next draw.
- **Results Tab**: Latest draw results with winning numbers displayed as colored balls. List of player's past tickets with match highlights.
- **History Tab**: Past draw results table showing dates, winning numbers, and jackpot amounts.

### 4. Hook -- `src/hooks/useLottery.ts`

- `useCurrentDraw()` -- fetches or creates the current week's draw record
- `useMyTickets()` -- fetches player's tickets for current/past draws  
- `useBuyTicket()` -- mutation to purchase a ticket (deducts cash, inserts ticket)
- `useDrawResults()` -- fetches past draw results
- `useClaimPrize()` -- mutation to claim unclaimed winnings

### 5. Navigation & Routing

- Add route `/lottery` in `App.tsx`
- Add nav item under the Social or Career section in `navigation.tsx` with a Ticket/Dice icon
- Link label: "Lottery"

### 6. Version Update

- Bump to `v1.0.697` in `VersionHeader.tsx`
- Add changelog entry in `VersionHistory.tsx`

---

## Technical Details

### Number Picker Component

A grid of clickable number buttons (1-49). Selected numbers are highlighted. Max 7 selections enforced. Separate row for bonus number (1-10). Quick Pick button for random selection.

### Draw Timing

Uses the existing `getUtcWeekStart()` utility from `src/utils/week.ts` to determine the current draw week. Each draw is keyed by its Monday `week_start` date, ensuring one draw per week.

### Edge Function Logic

```text
1. Find the current week's draw record (status = 'pending')
2. Generate 7 unique random ints in [1, 49]
3. Generate 1 random int in [1, 10]
4. Update draw with winning numbers, set status = 'drawn'
5. For each ticket in this draw:
   a. Count matching numbers
   b. Check bonus match
   c. Calculate prize tier
   d. Update ticket with results
   e. Credit profile with cash/xp/fame
6. Set draw status = 'paid_out'
```

### Cron Setup

A pg_cron job calls the `lottery-draw` edge function every Monday at 00:05 UTC.

### Files Created/Modified

- **New**: `supabase/migrations/[timestamp]_lottery_tables.sql`
- **New**: `supabase/functions/lottery-draw/index.ts`
- **New**: `src/pages/Lottery.tsx`
- **New**: `src/hooks/useLottery.ts`
- **New**: `src/components/lottery/NumberPicker.tsx`
- **New**: `src/components/lottery/DrawResults.tsx`
- **New**: `src/components/lottery/TicketHistory.tsx`
- **Modified**: `src/App.tsx` (add route)
- **Modified**: `src/components/ui/navigation.tsx` (add nav link)
- **Modified**: `src/components/VersionHeader.tsx` (bump version)
- **Modified**: `src/pages/VersionHistory.tsx` (add changelog)

