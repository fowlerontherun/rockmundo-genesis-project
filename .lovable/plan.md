

## v1.0.709 — Major Events System

Annual global events invite bands to perform for massive cash, fame, and fan rewards. Works like Open Mic but with 3 songs, live commentary, and a full gig outcome report.

---

### The Events

Seed ~15 major annual events across categories:

| Event | Category | Month | Audience Size | Cash Reward Range |
|-------|----------|-------|---------------|-------------------|
| Super Bowl Halftime Show | Sports | February | 500,000 | $500K-$2M |
| WrestleMania Opening | Sports | April | 80,000 | $100K-$500K |
| BBC Variety Show | TV | December | 200,000 | $50K-$200K |
| Olympics Opening Ceremony | Sports | July | 1,000,000 | $750K-$3M |
| Olympics Closing Ceremony | Sports | August | 800,000 | $500K-$2M |
| Men's World Cup Final | Sports | June | 1,500,000 | $1M-$5M |
| Women's World Cup Final | Sports | July | 600,000 | $400K-$1.5M |
| Winter Olympics Opening | Sports | February | 500,000 | $500K-$2M |
| Winter Olympics Closing | Sports | February | 400,000 | $400K-$1.5M |
| Grammy Awards | Music | January | 300,000 | $200K-$800K |
| MTV VMAs | Music | August | 250,000 | $150K-$600K |
| Brit Awards | Music | February | 200,000 | $100K-$500K |
| New Year's Eve Times Square | Holiday | December | 1,000,000 | $500K-$2M |
| Coachella Main Stage Headline | Music | April | 100,000 | $300K-$1M |
| Glastonbury Pyramid Stage Headline | Music | June | 120,000 | $350K-$1.2M |

### How It Works

1. **Invitations**: When a band reaches sufficient fame (varies per event prestige), they receive invitations to upcoming major events. Higher fame = more prestigious invitations.
2. **Browse & Accept**: Players browse available events on the Major Events page. They can accept invitations and select 3 songs for their performance.
3. **Perform**: Similar to Open Mic -- live commentary, song-by-song progression with crowd reactions, simulated or audio-based playback.
4. **Outcome Report**: Shows performance grade (S/A/B/C/D/F), cash earned, fame gained, new fans, and song-by-song breakdown.
5. **Rewards**: Unlike open mics, major events pay significant cash AND fame AND fans. Reward scales with performance quality and event prestige.

### Minimum Fame Requirements

- Tier 1 (Super Bowl, Olympics, World Cup Final): 5000+ fame
- Tier 2 (Grammys, VMAs, Brits, NYE): 2000+ fame
- Tier 3 (WrestleMania, BBC, Coachella, Glastonbury): 800+ fame

---

### Technical Implementation

#### 1. Database Migration

Create 3 new tables:

**`major_events`** -- the event definitions
- `id` UUID PK
- `name` TEXT (e.g. "Super Bowl Halftime Show")
- `description` TEXT
- `category` TEXT (sports/music/tv/holiday)
- `month` INT (1-12, when it occurs annually)
- `audience_size` INT
- `min_fame_required` INT
- `base_cash_reward` INT (minimum payout in dollars)
- `max_cash_reward` INT (maximum payout in dollars)
- `fame_multiplier` NUMERIC (how much fame to award relative to performance)
- `fan_multiplier` NUMERIC
- `image_url` TEXT
- `is_active` BOOLEAN DEFAULT true
- `created_at` TIMESTAMPTZ

**`major_event_instances`** -- yearly occurrences
- `id` UUID PK
- `event_id` UUID FK -> major_events
- `year` INT
- `event_date` TIMESTAMPTZ
- `status` TEXT ('upcoming', 'invitations_sent', 'performing', 'completed')
- `invited_band_ids` UUID[] (bands that received invitations)
- `created_at` TIMESTAMPTZ

**`major_event_performances`** -- player performances
- `id` UUID PK
- `instance_id` UUID FK -> major_event_instances
- `user_id` UUID FK -> auth.users
- `band_id` UUID FK -> bands
- `song_1_id` UUID FK -> songs
- `song_2_id` UUID FK -> songs
- `song_3_id` UUID FK -> songs
- `status` TEXT ('accepted', 'in_progress', 'completed', 'declined')
- `current_song_position` INT DEFAULT 1
- `overall_rating` NUMERIC
- `cash_earned` INT
- `fame_gained` INT
- `fans_gained` INT
- `started_at` TIMESTAMPTZ
- `completed_at` TIMESTAMPTZ
- `created_at` TIMESTAMPTZ

**`major_event_song_performances`** -- per-song results
- `id` UUID PK
- `performance_id` UUID FK -> major_event_performances
- `song_id` UUID FK -> songs
- `position` INT
- `performance_score` NUMERIC
- `crowd_response` TEXT
- `commentary` JSONB

Seed ~15 events into `major_events` and generate current-year instances in `major_event_instances`. Enable RLS with policies for authenticated users.

#### 2. New Hook: `src/hooks/useMajorEvents.ts`

Modeled on `useOpenMicNights.ts` but:
- Queries `major_events` joined with `major_event_instances`
- Filters by fame requirement (only shows events the band qualifies for)
- `useAcceptMajorEvent` mutation -- accepts invitation, selects 3 songs, creates scheduled activity
- `useStartMajorEventPerformance` / song performance queries
- Song selector allows 3 songs instead of 2

#### 3. New Edge Functions

**`process-major-event-song`** -- identical pattern to `process-open-mic-song` but:
- Higher base scores due to event prestige
- Uses `audience_size` for scaling crowd response
- Commentary themed to the specific event type

**`complete-major-event`** -- identical pattern to `complete-open-mic` but:
- Calculates cash reward: `base_cash + (performance_rating / 100) * (max_cash - base_cash)`
- Fame calculation uses the event's `fame_multiplier` and audience size
- Fan calculation uses `fan_multiplier` and audience size
- Updates band cash/fame/fans
- Credits cash to band balance

#### 4. New Pages

**`src/pages/MajorEvents.tsx`** -- Browse/accept page
- Lists upcoming major events with prestige badges, audience sizes, reward ranges
- Shows fame requirement and whether band qualifies
- "Accept Invitation" opens a 3-song selector dialog
- Shows accepted/past performances

**`src/pages/PerformMajorEvent.tsx`** -- Live performance page
- Modeled exactly on `PerformOpenMic.tsx`
- Shows "Song X of 3" progression
- Live commentary, progress bars, audio controls
- Calls `process-major-event-song` for each song
- Calls `complete-major-event` after song 3

**`src/components/major-events/MajorEventOutcomeReport.tsx`** -- Post-show report
- Modeled on `OpenMicOutcomeReport.tsx`
- Shows cash earned (unlike open mic's "no money" notice)
- Fame gained, fans gained, performance grade
- Song-by-song breakdown

**`src/components/major-events/MajorEventSongSelector.tsx`** -- 3-song selector
- Modeled on `OpenMicSongSelector.tsx` but allows 3 selections

#### 5. Routing and Navigation

**`src/App.tsx`** -- Add routes:
- `/major-events` -> MajorEvents page
- `/major-events/perform/:performanceId` -> PerformMajorEvent page

**`src/components/ui/navigation.tsx`** -- Add to "Events" section:
- `{ icon: Star, labelKey: "nav.majorEvents", path: "/major-events" }`

#### 6. Version Bump

Update to **v1.0.709** in `navigation.tsx` and `VersionHistory.tsx`:
- Added Major Events system with 15 annual global events
- Bands receive invitations based on fame level
- 3-song performances with live commentary and outcome reports
- Cash, fame, and fan rewards scale with event prestige and performance quality

---

### Files Summary

| File | Action |
|------|--------|
| New SQL migration | Create 3 tables, seed 15 events, generate instances, RLS policies |
| `src/hooks/useMajorEvents.ts` | New hook for all major event queries/mutations |
| `src/pages/MajorEvents.tsx` | New browse/accept page |
| `src/pages/PerformMajorEvent.tsx` | New live performance page |
| `src/components/major-events/MajorEventSongSelector.tsx` | New 3-song selector dialog |
| `src/components/major-events/MajorEventOutcomeReport.tsx` | New outcome report component |
| `supabase/functions/process-major-event-song/index.ts` | New edge function for song processing |
| `supabase/functions/complete-major-event/index.ts` | New edge function for completion + rewards |
| `src/App.tsx` | Add 2 new routes |
| `src/components/ui/navigation.tsx` | Add nav item + version bump |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

