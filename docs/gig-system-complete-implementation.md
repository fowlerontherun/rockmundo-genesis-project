# Complete Gig System Implementation

## Overview
Implemented a fully automated, real-time gig performance system with proper flow from booking to completion.

## Key Features Implemented

### 1. **Automatic Gig Starting**
- Created `useAutoGigStart` hook that periodically checks for gigs past their scheduled time
- Calls `auto_start_scheduled_gigs()` database function every minute
- Integrated into Dashboard and GigBooking pages for background monitoring
- Automatically transitions gigs from 'scheduled' to 'in_progress' at scheduled time

### 2. **Real-time Gig Performance**
- `RealtimeGigViewer` component displays live performance progress
- Shows current song, elapsed time, average score, and performance history
- Real-time commentary based on crowd response (ecstatic, enthusiastic, engaged, mixed, disappointed)
- Progress bar tracking songs completed vs total
- Subscribes to database changes for instant updates

### 3. **Real-time Song Advancement**
- `useRealtimeGigAdvancement` hook processes songs sequentially
- Calls `process-gig-song` edge function for each song performance
- Automatically advances to next song using `advance_gig_song()` RPC
- Calculates timing based on song durations
- Triggers `complete-gig` edge function when all songs are finished

### 4. **Automatic Gig Outcome Creation**
- Database trigger `create_gig_outcome_trigger` fires when gig status changes to 'in_progress'
- `create_gig_outcome_on_start()` function creates initial outcome record
- Calculates initial attendance (70-130% of estimated) and ticket revenue
- Sets up the framework for tracking performance metrics

### 5. **Gig Completion & Results**
- `complete-gig` edge function finalizes all calculations:
  - Averages song performance scores
  - Calculates merchandise sales based on performance
  - Computes crew costs and equipment wear
  - Determines net profit (revenue - costs)
  - Awards fame based on rating and attendance
  - Adjusts band chemistry (-2 to +3 based on performance)
- Updates band stats (balance, fame, chemistry, performance count)
- Distributes XP to band members via experience_ledger
- Records earnings in band_earnings table
- Marks gig as 'completed'

### 6. **Gig History**
- `GigHistoryTab` component shows all completed gigs
- Displays key metrics: rating, attendance, profit, fame gained
- "View Full Report" button opens detailed breakdown
- Auto-refreshes every 5 seconds to catch newly completed gigs
- Filters for only completed outcomes (not null completed_at)

### 7. **Navigation & User Experience**
- Added "View Details" / "Watch Live" buttons to upcoming gigs
- Routes to `/gigs/perform/:gigId` for individual gig pages
- Real-time status badges (Scheduled, Live Now, Completed)
- `PerformGig` page with three states:
  - Pre-start: Shows preparation checklist and "Start Performance" button
  - In Progress: Shows `RealtimeGigViewer` with live updates
  - Completed: Shows `GigOutcomeReport` with full results

### 8. **Notifications**
- `useGigNotifications` hook monitors gig completions
- Shows toast notifications with rating, profit, and fame
- Subscribes to real-time gig updates
- Tracks which gigs have been notified to avoid duplicates
- Integrated into Dashboard for always-on monitoring

### 9. **Periodic Refreshing**
- GigBooking page reloads upcoming gigs every 10 seconds
- Catches status transitions automatically
- Shows both 'scheduled' and 'in_progress' gigs
- Updates UI without page refresh

## Database Functions

### `auto_start_scheduled_gigs()`
```sql
- Finds gigs with status='scheduled' and scheduled_date <= NOW()
- Updates status to 'in_progress'
- Sets started_at timestamp
```

### `advance_gig_song(p_gig_id UUID)`
```sql
- Increments current_song_position by 1
- Used by real-time advancement system
```

### `create_gig_outcome_on_start()` (Trigger)
```sql
- Fires when gig status changes to 'in_progress'
- Creates initial gig_outcome record
- Calculates attendance and ticket revenue
```

## Edge Functions

### `auto-start-gigs`
- HTTP endpoint to trigger auto-start check
- Calls `auto_start_scheduled_gigs()` RPC
- Can be called manually or via cron (future)

### `process-gig-song`
- Processes individual song performance during gig
- Calculates performance score based on multiple factors:
  - Song quality (20%)
  - Rehearsal level (15%)
  - Band chemistry (20%)
  - Equipment quality (15%)
  - Crew skill (15%)
  - Member skills (15%)
- Records performance in `gig_song_performances` table
- Returns crowd response (ecstatic/enthusiastic/engaged/mixed/disappointed)

### `complete-gig`
- Finalizes gig when all songs are performed
- Aggregates all song performances
- Calculates final metrics (revenue, costs, profit, fame, chemistry)
- Updates band stats and distributes rewards
- Marks gig as 'completed'

## User Flow

### Booking a Gig
1. Navigate to `/gigs`
2. Select venue from "Available Venues" tab
3. Choose setlist, ticket price, date, and time slot
4. System validates setlist duration against slot limits
5. Gig is created with status='scheduled'

### Gig Starts Automatically
1. `useAutoGigStart` hook checks every minute
2. When scheduled_date is reached, gig transitions to 'in_progress'
3. Database trigger creates initial gig_outcome
4. Gig appears in "Upcoming Gigs" with "Live Now" badge and "Watch Live" button

### Watching Performance
1. Click "Watch Live" to navigate to `/gigs/perform/:gigId`
2. `RealtimeGigViewer` displays live progress
3. Songs advance automatically based on duration
4. Performance commentary updates after each song
5. Progress bar shows completion percentage

### Gig Completion
1. After final song, `complete-gig` edge function is called
2. All calculations finalized
3. Band receives money, fame, and XP
4. Notification shown to all band members
5. Gig appears in "Gig History" tab with full report

### Viewing History
1. Navigate to `/gigs` → "Gig History" tab
2. See all completed gigs with key metrics
3. Click "View Full Report" for detailed breakdown
4. Report shows:
   - Overall performance grade
   - Financial summary (revenue, costs, profit)
   - Attendance analysis
   - Setlist performance (each song)
   - Performance factors breakdown
   - Impact summary (fame, chemistry, merch)

## Files Created/Modified

### Created
- `src/hooks/useAutoGigStart.ts` - Auto-start hook
- `src/hooks/useGigNotifications.ts` - Notification system
- `docs/gig-system-complete-implementation.md` - This document

### Modified
- `src/pages/GigBooking.tsx` - Added auto-start hook, navigation buttons, periodic refresh
- `src/pages/Dashboard.tsx` - Added auto-start and notification hooks
- `src/components/band/GigHistoryTab.tsx` - Added auto-refresh, filter for completed
- `src/hooks/useRealtimeGigAdvancement.ts` - Removed manual outcome creation
- `supabase/functions/complete-gig/index.ts` - Fixed band stats update
- `supabase/migrations/20251101065216_d777a1e3-21d2-4175-8466-503c332330fe.sql` - Auto-start functions
- `supabase/migrations/20251102051807_1619680e-9c66-4fdb-8eb5-536f4a0048ac.sql` - Outcome trigger

## Activity Lockouts
The system checks for band lockouts before allowing gig booking to prevent:
- Booking gigs during rehearsals
- Booking gigs during other band activities
- Overlapping gigs

## Testing Checklist
- [x] Gigs auto-start at scheduled time
- [x] Real-time song advancement works
- [x] Live viewer updates in real-time
- [x] Gig completes automatically after all songs
- [x] Outcome calculations are correct
- [x] Band balance updates
- [x] Fame increases
- [x] Chemistry changes based on performance
- [x] XP distributed to members
- [x] Gig history displays completed gigs
- [x] Notifications appear on completion
- [x] Navigation between states works
- [x] UI updates without refresh

## Future Enhancements
- Add cron job for auto-start instead of client-side polling
- Add support for mid-gig events (crowd surfing, equipment failure, etc.)
- Implement encore song special bonuses
- Add venue-specific performance modifiers
- Track individual member contributions
- Add weather impact on outdoor venues
- Implement tour system with multiple connected gigs
