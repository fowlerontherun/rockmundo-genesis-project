

# Festival System Expansion Plan (v1.0.765+)

This is a major overhaul of the festival system, transforming it from a basic participation feature into a fully interactive, multi-day live event experience with financial simulation, audience interaction, and career progression impact.

---

## Overview

The current festival system uses `game_events` + `festival_participants` tables with basic invite/apply/perform flow. The Festivals page (`/festivals`) is currently a simulation sandbox with no live festival interaction. This plan rebuilds it into a playable, multi-stage, multi-day festival experience.

---

## Phase 1: Database Schema Overhaul

### New Tables

1. **`festival_stages`** - Up to 5 stages per festival
   - `id`, `festival_id`, `stage_name`, `stage_number` (1-5), `capacity`, `genre_focus` (nullable)

2. **`festival_stage_slots`** - 6 slots per stage per day
   - `id`, `stage_id`, `festival_id`, `day_number` (1-4), `slot_number` (1-6), `slot_type` (headliner/support/opener/dj_session)
   - `band_id` (nullable), `is_npc_dj` (boolean), `npc_dj_genre`, `npc_dj_quality` (average range)
   - `start_time`, `end_time`, `payout_amount`, `status`

3. **`festival_tickets`** - Player ticket purchases
   - `id`, `festival_id`, `user_id`, `ticket_type` (day/weekend), `purchase_price`, `day_number` (nullable for weekend), `purchased_at`

4. **`festival_attendance`** - Track which stage a player-attendee is currently at
   - `id`, `festival_id`, `user_id`, `current_stage_id`, `joined_at`, `last_moved_at`

5. **`festival_watch_rewards`** - Rewards earned from watching bands
   - `id`, `festival_id`, `user_id`, `band_id`, `stage_slot_id`, `reward_type` (xp/song_gift/attribute_point), `reward_value`, `created_at`

6. **`festival_finances`** - Financial breakdown per festival
   - `id`, `festival_id`, `ticket_revenue`, `sponsorship_income`, `security_cost`, `stage_costs`, `band_payouts_total`, `festival_tax_rate`, `festival_tax_amount`, `total_profit`, `budget`

7. **`festival_quality_ratings`** - Quality dimensions
   - `id`, `festival_id`, `comfort_rating` (1-5), `food_rating` (1-5), `safety_rating` (1-5), `lineup_rating` (1-5), `overall_rating`

### Modifications to Existing Tables

- **`game_events`**: Add `duration_days` (2-4), `day_of_week_start` (thursday/saturday), `ticket_price`, `max_stages` (1-5), `festival_budget`, `security_firm_id` (FK to security_firms)
- **`security_contracts`**: Add `festival_id` column to link security firms to festival events

---

## Phase 2: Festival Scheduling (Thu-Sun or Sat-Sun)

- Festivals are 2-4 days long
- 2-day festivals run Saturday-Sunday
- 3-day festivals run Friday-Sunday
- 4-day festivals run Thursday-Sunday
- All festival dates align with the game calendar system
- When a band accepts a festival slot, the **entire festival duration** is activity-blocked via `createScheduledActivity`
- Player-attendees who buy tickets also get a schedule block for the days they attend

---

## Phase 3: Stage and Slot Management (Admin)

- Admin creates festivals with 1-5 stages, each with a genre focus or "mixed"
- Each stage has 6 performance slots per day
- Slot types: 1 headliner, 2 support, 3 opener per stage per day
- Payout structure based on festival budget:
  - Headliners: 40-60% of stage budget
  - Support: 20-30% split between 2
  - Openers: 10-20% split between 3
- Festival budget calculated from: `(ticket_price x projected_attendance) + sponsorship_income - security_cost - stage_costs - festival_tax`
- If not enough bands are available, empty slots are filled with **NPC DJ Sessions** using the genre tree, with average-level quality scores

### NPC DJ Sessions
- Auto-generated based on the stage's genre focus
- Named procedurally (e.g., "DJ [Genre] Beats")
- Performance quality in the 40-60 range (average)
- Still generate crowd energy but at reduced levels vs real bands

---

## Phase 4: Security Integration

- Festival admin selects a security firm during setup
- A `security_contract` is created with `contract_type = 'festival'`
- Guards required calculated based on: `stages x 4 + (capacity / 500)`
- Security cost deducted from festival budget
- Security quality affects the festival's `safety_rating`

---

## Phase 5: Career Impact System

When a band performs at a festival:
- **Fame boost**: Based on slot type (headliner: +200-500, support: +80-150, opener: +30-80)
- **Fan growth**: Percentage of festival attendance becomes new fans (headliner: 5-10%, support: 2-4%, opener: 1-2%)
- **Song chart boost**: Top 1-3 performed songs get a streaming/chart boost (re-enter charts or climb positions)
- **Hype generation**: Band's songs get a temporary streaming multiplier for 1-2 game weeks after the festival
- **Real player audience bonus**: If real players are watching, +15-25% bonus to all rewards

---

## Phase 6: Player Attendance Experience

### Ticket Purchase
- Players not performing can buy tickets (day pass or weekend pass)
- Ticket purchase blocks their schedule for those days
- Festival appears on their schedule

### Live Festival View
- Players see all stages with current/upcoming performers
- Can move between stages freely
- Each stage shows the current band performing with the **TextGigViewer** live commentary experience
- Players hear the songs being performed (reusing existing song playback)

### Watch Rewards (per set watched)
- Small XP gain (10-30 XP)
- Rare chance (5%) to receive a "gifted song" (the band's song added to their library/inspiration)
- Rare chance (3%) to gain +1 to a random attribute point
- Watching a full set gives a completion bonus

---

## Phase 7: Voice Chat Integration

- Reuse the `useJamVoiceChat` hook and `JamVoiceChat` component
- Create a `useFestivalVoiceChat` wrapper that connects via `festival-voice-{festivalId}-stage-{stageId}` channels
- Players at the same stage can voice chat
- Moving stages switches voice channel automatically

---

## Phase 8: Festival Quality System

Admin configures quality ratings that affect attendee satisfaction:
- **Comfort** (1-5): Seating, shade, facilities
- **Food** (1-5): Vendor quality and variety
- **Safety** (1-5): Derived from security firm quality
- **Lineup** (1-5): Auto-calculated from average band fame/skill
- **Overall**: Weighted average affecting ticket demand and return attendance

---

## Phase 9: Festival Finances (Admin Dashboard)

A financial overview card showing:
- **Revenue**: Ticket sales + sponsorship income
- **Costs**: Security + stage rental + band payouts + festival tax (15% of revenue)
- **Profit/Loss**: Net result
- Budget determines how much can be spent on bands
- Uses existing `festival_revenue_streams` and `festival_sponsorships` tables

---

## Phase 10: UI Implementation

### Festivals Page Rebuild
Replace the current simulation sandbox with a real festival experience:

1. **Browse Festivals Tab** - Upcoming festivals with stages, lineup, ticket prices
2. **My Festivals Tab** - Festivals you're performing at or attending
3. **Live Festival Tab** - Active festival view with stage switching, live commentary, voice chat

### Admin Section
- Festival creation wizard: name, dates (constrained to Thu-Sun or Sat-Sun), stages, genre focus, ticket price, security firm
- Stage/slot management: assign bands, fill empty slots with NPC DJs
- Financial overview dashboard
- Quality ratings configuration

---

## Technical Notes

- All `supabase` queries use `(supabase as any)` pattern consistent with codebase
- Activity blocking uses existing `createScheduledActivity` from `useActivityBooking.ts`
- Voice chat reuses PeerJS WebRTC from `useJamVoiceChat.ts`
- Live commentary reuses `TextGigViewer` patterns and `enhancedCommentaryGenerator` utils
- Genre matching uses `MUSIC_GENRES` from `src/data/genres.ts`
- Security integration uses existing `security_contracts` table with new `festival_id` column
- Version will be bumped incrementally as phases are implemented

---

## Implementation Order

This will be implemented across multiple prompts due to size:
1. Database migration (schema + seed)
2. Core hooks (festival data, tickets, attendance, finances)
3. Admin UI (create/manage festivals, stages, slots)
4. Player browse and ticket purchase
5. Live festival experience (stage view, commentary, rewards)
6. Voice chat integration
7. Career impact (fame, fans, chart boosts)

