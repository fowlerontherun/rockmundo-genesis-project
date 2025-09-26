# Studio Booking & Session Production

This document describes the game systems that power studio bookings, recording sessions, and song progress.

## 1. Core Concepts
- **Studios are city-bound.** Each studio belongs to a specific city, so travel time, local economies, and availability influence planning.
- **Daily structure.** Every studio offers two daily slots—morning and evening—that are booked on a first-come, first-served basis.
- **Studio attributes.**
  - `quality` (1–100) drives the baseline output of recordings.
  - `engineer_rating` (1–100) affects mixing efficiency.
  - `equipment_rating` (1–100) influences technical fidelity.
  - `cost_per_day` is charged upfront during booking.
- **Booking duration.** Bands can reserve from 1 to 7 consecutive days per booking. All slots within that window lock for the band.

## 2. Booking Flow
1. **Pick a studio.** Filter by city, then review each studio's quality, engineer rating, equipment rating, cost/day, and calendar availability.
2. **Choose dates and slots.** Select 1–7 days and specify the desired morning and/or evening slots.
3. **Session setup.**
   - Pick songs (new or in-progress) to work on.
   - Add session musicians:
     - NPCs charge a flat daily fee that scales with their skill tier.
     - Player characters with the Session Artist skill can be invited.
   - Pick the band's recording mood:
     - **Professional** – higher throughput, but increased fatigue.
     - **Party Animals** – morale boost, reduced efficiency.
     - **Chilled** – steadier pace, lower fatigue, slower progress.
4. **Production role.**
   - A band member with the Producer skill can self-produce.
   - Alternatively hire another character as a producer for a negotiated fee.

## 3. Data Model
All tables live in the `public` schema.

### `studios`
| Column | Notes |
| --- | --- |
| `id` | Primary key |
| `city_id` | FK to the owning city |
| `name` | Studio display name |
| `quality` | Integer 1–100 |
| `cost_per_day` | Daily booking fee |
| `engineer_rating` | Integer 1–100 |
| `equipment_rating` | Integer 1–100 |

### `studio_bookings`
Tracks each reservation window for a band.

| Column | Notes |
| --- | --- |
| `id` | Primary key |
| `studio_id` | FK to `studios` |
| `band_id` | FK to the booking band |
| `start_date` / `end_date` | Inclusive booking window |
| `mood` | Enum: `professional`, `party`, `chilled` |
| `producer_id` | Nullable FK to the assigned producer profile |
| `status` | Enum: `pending`, `confirmed`, `in_progress`, `completed`, `cancelled` |
| `total_cost` | Aggregated upfront booking and musician fees |

### `studio_booking_slots`
Represents the two daily slots for every booking.

| Column | Notes |
| --- | --- |
| `id` | Primary key |
| `booking_id` | FK to `studio_bookings` |
| `slot_date` | Specific day inside the booking window |
| `slot` | Enum: `morning`, `evening` |
| `is_booked` | Boolean lock flag |
| _Unique_ | `(booking_id, slot_date, slot)` |

### `studio_booking_artists`
Associates characters to a booking.

| Column | Notes |
| --- | --- |
| `id` | Primary key |
| `booking_id` | FK to `studio_bookings` |
| `character_id` | FK to the participating character profile |
| `role` | Enum: `band_member`, `session_musician`, `producer` |
| `daily_cost` | Snapshot of per-day compensation |
| _Unique_ | `(booking_id, character_id, role)` |

### `studio_booking_songs`
Stores progress snapshots per song worked during the booking.

| Column | Notes |
| --- | --- |
| `id` | Primary key |
| `booking_id` | FK to `studio_bookings` |
| `song_id` | FK to the tracked song |
| `progress_start` | Progress % (0–100) entering the session |
| `progress_end` | Progress % (0–100) after the session |
| `momentum` | Rolling streak bonus applied during calculations |
| _Unique_ | `(booking_id, song_id)` |

### Status & Mood Reference

- **Booking Status**
  - `pending` → awaiting payment confirmation.
  - `confirmed` → locked on the calendar and ready for sessions.
  - `in_progress` → currently running.
  - `completed` → all scheduled slots processed.
  - `cancelled` → released slots and refunded as applicable.
- **Moods** remain the same as outlined above; stored via the `studio_session_mood` enum.

### Access Control

Row Level Security (RLS) ensures:

- Studios are publicly readable but only service/admin roles may manage them.
- Bookings, slots, artists, and song progress are visible to the booking band's leader, members, invited participants, and privileged roles.
- Only band leaders (or privileged roles) can mutate booking-related tables, keeping scheduling conflicts in check.

## 4. Session Mechanics
At the end of each booked slot, compute recording progress.

```
progress_per_slot = (
  BaseEfficiency * BandSkillScore * ProducerFactor * MoodModifier * Momentum
) - SongDifficulty
```

- **BaseEfficiency** = average of the studio's quality, engineer rating, and equipment rating.
- **BandSkillScore** = average of relevant songwriting/instrumental/vocal skills for all active band members and session musicians.
- **ProducerFactor** = `1 + (producer_skill × 0.3)`; reduces randomness and increases output.
- **MoodModifier**
  - Professional → `+20%` progress, `-15%` health.
  - Party → `+10%` morale, `-20%` progress.
  - Chilled → `+10%` health, `-10%` progress.
- **SongDifficulty** = target quality / 100, reducing net progress for tougher songs.
- **Momentum** = streak multiplier for consecutive work on the same song.
- **RandomFactor** = ±5–10% swing applied after modifiers.

If `progress_per_slot` pushes the cumulative progress to `100%`, the song is marked as a recorded track. Otherwise, the new progress is saved for future sessions.

## 5. Outcomes
- Completed songs move into the "Recorded Track" pipeline for mixing/release.
- Incomplete songs retain their updated progress for subsequent bookings.
- Studio reputation shifts based on results:
  - Successful sessions provide a small boost.
  - Disastrous outcomes (e.g., chaotic party sessions) apply a minor penalty.

## 6. Economy Considerations
- Booking costs scale with studio quality and city demand.
- NPC session musicians charge daily rates aligned with their skill tier.
- Producers charge per-day fees; rates can be negotiated if the producer is a player character.
- Limited slots, especially in high-demand cities, increase prices and drive competition.

## 7. UI/UX Touchpoints
- **Calendar view** of studio availability with selectable slots.
- **Studio info cards** summarise ratings, quality, and cost.
- **Booking wizard** that walks through:
  1. Date selection.
  2. Song selection.
  3. Musician and producer assignments.
  4. Mood selection.
- **Post-session report** summarising song progress and completion percentages.
- **Notifications** dispatched to band members, session artists, and producers involved in the booking.
- **Admin management** page lets staff add studios, setting their ratings and per-day pricing to feed the booking pool.
