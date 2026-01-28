
# Touring Lifestyle & Behavior System - Implementation Plan

## Overview
This plan adds a new "Behavior" section to the Dashboard where players can configure their touring lifestyle preferences. These settings will influence what random events they encounter and affect health, reputation, and finances. All outcomes will appear in the player's inbox.

---

## Part 1: Database Schema

### New Table: `player_behavior_settings`
Stores player lifestyle preferences that influence random events.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | gen_random_uuid() | Primary key |
| user_id | uuid | FK to auth.users | Player reference |
| travel_comfort | text | 'standard' | Options: 'budget', 'standard', 'luxury' |
| hotel_standard | text | 'standard' | Options: 'hostel', 'budget', 'standard', 'luxury', 'suite' |
| partying_intensity | text | 'moderate' | Options: 'abstinent', 'light', 'moderate', 'heavy', 'legendary' |
| fan_interaction | text | 'friendly' | Options: 'distant', 'professional', 'friendly', 'wild' |
| media_behavior | text | 'professional' | Options: 'reclusive', 'professional', 'outspoken', 'controversial' |
| afterparty_attendance | text | 'sometimes' | Options: 'never', 'sometimes', 'always' |
| entourage_size | text | 'small' | Options: 'solo', 'small', 'medium', 'large' |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

### New Random Event Categories
Add new event categories to support lifestyle events:
- `lifestyle` - General touring lifestyle events
- `hotel` - Hotel-related incidents
- `partying` - Party and aftershow events
- `fan_encounter` - Fan interaction events
- `media_incident` - Press and media events

---

## Part 2: Random Events (30+ New Events)

### Hotel Events (8 events)

| Title | Trigger Condition | Option A | Option B |
|-------|-------------------|----------|----------|
| "Roach Motel Nightmare" | hotel_standard = 'hostel' OR 'budget' | Demand refund (-$50, +stress) | Tough it out (-10 health, +5 fame "street cred") |
| "Luxury Suite Upgrade" | hotel_standard = 'luxury' OR 'suite' | Accept graciously (+15 health, -$0) | Decline, donate to charity (+20 fame, -$200) |
| "Hotel Room Trashed" | partying_intensity = 'heavy' OR 'legendary' | Pay damages (-$500 to -$2000) | Deny involvement (50% caught = -fame, 50% escape) |
| "Noise Complaint" | partying_intensity != 'abstinent' | Apologize quietly (+0) | Rock star attitude (-$100, +10 fame) |
| "Lost Room Key" | Random | Pay replacement (-$25) | Climb through window (-5 health, funny story +5 fame) |
| "Hotel Spa Day" | hotel_standard = 'luxury' | Indulge (+20 health, -$150) | Skip it, rehearse instead (+skill XP) |
| "Bed Bug Incident" | hotel_standard = 'hostel' | Demand new room (50% success) | Sleep in van (-15 health, save money) |
| "Celebrity Neighbor" | hotel_standard = 'suite' | Network at bar (+fame, -$50) | Respect privacy (+reputation) |

### Partying Events (8 events)

| Title | Trigger Condition | Option A | Option B |
|-------|-------------------|----------|----------|
| "Legendary Afterparty" | partying_intensity = 'heavy'+ | Go all night (-25 health, +30 fame) | Leave early (-5 fame, +10 health) |
| "Morning Hangover" | partying_intensity != 'abstinent' | Hair of the dog (-10 health) | Suffer through (-5 energy, no health loss) |
| "Free Drinks Backstage" | Any gig | Accept generously (-15 health, +social) | Stay hydrated (+5 health) |
| "Industry Party Invite" | fame > 1000 | Attend (+networking, -$100, -10 health) | Decline (-5 fame) |
| "Band Celebration" | After successful gig | Celebrate big (-20 health, +band chemistry) | Quiet dinner (+5 health, +5 chemistry) |
| "Sobriety Challenge" | partying_intensity = 'heavy'+ | Accept 30-day challenge (+health over time) | Decline (no effect) |
| "Club VIP Section" | fame > 5000 | Accept VIP (-$200, +15 fame) | Mingle with fans (+10 fame, +fan loyalty) |
| "Drinking Contest" | partying_intensity = 'moderate'+ | Accept challenge (win: +fame, lose: -health) | Decline gracefully (+0) |

### Fan Encounter Events (8 events)

| Title | Trigger Condition | Option A | Option B |
|-------|-------------------|----------|----------|
| "Obsessive Fan at Hotel" | fame > 2000 | Be kind, take photo (+5 fame) | Ask security to handle (-2 fame, safer) |
| "Fan Gift at Stage Door" | Any | Accept warmly (+5 fame, +1 fan loyalty) | Politely decline (+0) |
| "Superfan Tattoo" | fame > 5000 | Sign autograph (+10 fame) | Offer to pay removal (-$100, +15 fame) |
| "Fan Crowd Surge" | fan_interaction = 'wild' | Crowd surf (+15 fame, -10 health risk) | Stay on stage (+0, safe) |
| "Meet and Greet Gone Wrong" | Random | Handle professionally (+reputation) | Get upset (viral video, +/-20 fame coin flip) |
| "Fan Marriage Proposal" | fame > 10000 | Play along graciously (+20 fame) | Awkward decline (-5 fame) |
| "Young Fan Inspiration" | Random | Encourage their music dreams (+10 reputation) | Sign autograph and move on (+0) |
| "Stalker Warning" | fan_interaction = 'wild', fame > 5000 | Report to security (-5 fan trust, +safety) | Ignore it (-0, risk future event) |

### Media/TV Events (6 events)

| Title | Trigger Condition | Option A | Option B |
|-------|-------------------|----------|----------|
| "Paparazzi Ambush" | fame > 3000 | Smile and wave (+5 fame) | Cover face and run (-3 fame, privacy) |
| "Interview Gone Wrong" | media_behavior = 'outspoken'+ | Stand by controversial statement (+/-30 fame) | Apologize publicly (+5 reputation) |
| "Wardrobe Malfunction on TV" | Random live appearance | Laugh it off (+15 fame) | Storm off stage (-10 fame, +drama) |
| "Viral Moment" | Random | Embrace meme status (+25 fame) | Try to suppress (-$500, usually fails) |
| "Tell-All Book Offer" | fame > 10000 | Accept deal (+$5000, -band chemistry risk) | Decline politely (+band trust) |
| "Reality TV Offer" | fame > 20000 | Accept season (+$10000, -health, +fame) | Decline, focus on music (+band respect) |

---

## Part 3: Frontend Components

### New Dashboard Tab: "Behavior"
Add a new tab to the Dashboard between "Profile" and "Fame" tabs.

**File: `src/components/dashboard/BehaviorSettingsTab.tsx`**

Features:
- Card-based layout for each setting category
- Radio group selectors with icons and descriptions
- Visual indicators for health/reputation impact
- "Touring Lifestyle Profile" summary card showing current risk level

### Behavior Settings Categories UI

```text
+------------------------------------------+
| TOURING LIFESTYLE SETTINGS               |
+------------------------------------------+
| Travel Comfort                           |
| [Budget] [Standard] [Luxury]             |
| "Affects travel events and recovery"     |
+------------------------------------------+
| Hotel Standard                           |
| [Hostel] [Budget] [Standard] [Luxury] [Suite] |
| "Higher = better rest, more celebrity events" |
+------------------------------------------+
| Partying Intensity                       |
| [Abstinent] [Light] [Moderate] [Heavy] [Legendary] |
| "Warning: Heavy+ increases health drain" |
+------------------------------------------+
| Fan Interaction Style                    |
| [Distant] [Professional] [Friendly] [Wild] |
| "Wild = more fan events, higher risk"    |
+------------------------------------------+
| Media Behavior                           |
| [Reclusive] [Professional] [Outspoken] [Controversial] |
| "Controversial = more drama, more fame variance" |
+------------------------------------------+
```

### Risk Assessment Card
Shows a calculated "Lifestyle Risk Score" based on settings:
- Low risk (green): Abstinent + Luxury + Professional
- Medium risk (yellow): Moderate settings
- High risk (red): Legendary + Wild + Controversial

---

## Part 4: Hook and Integration

### New Hook: `useBehaviorSettings.ts`
```text
- Fetch player's behavior settings
- Create default settings on first load
- Update settings with optimistic updates
- Calculate risk score
- Return current lifestyle profile
```

### Integration with Random Events
Modify `supabase/functions/trigger-random-events/index.ts`:
1. Fetch player's behavior settings
2. Filter eligible events based on settings
3. Weight event probability by setting values
4. Example: `partying_intensity = 'legendary'` = 3x chance for party events

### Health Impact Integration
Update `src/utils/healthSystem.ts`:
- Add health drain modifiers based on behavior settings
- Partying intensity affects recovery rate
- Hotel standard affects rest effectiveness

---

## Part 5: Edge Function Updates

### Modify: `trigger-random-events/index.ts`
Add behavior-aware event filtering:
```text
1. Fetch player_behavior_settings for each player
2. Filter events by category matching settings
3. Apply probability weights:
   - partying = 'legendary' -> party events 3x likely
   - hotel = 'hostel' -> bad hotel events 2x likely
   - fan_interaction = 'wild' -> fan events 2x likely
4. Track behavior-related events separately
```

### New: `process-lifestyle-events/index.ts`
Dedicated handler for lifestyle event outcomes:
1. Apply health changes based on choices
2. Apply fame/reputation changes
3. Create inbox messages with detailed outcomes
4. Log to experience_ledger

---

## Part 6: Inbox Integration

All lifestyle events send detailed inbox messages:

| Category | Priority | Example Title | Example Message |
|----------|----------|---------------|-----------------|
| lifestyle | normal | "Hotel Incident" | "The hotel manager has billed you $500 for room damages after last night's celebration. Your fans loved the viral video though! +15 Fame" |
| lifestyle | high | "Health Warning" | "Your doctor recommends slowing down. Continuous partying has dropped your health to critical levels." |
| lifestyle | normal | "Fan Encounter" | "A superfan got your band logo tattooed! You graciously signed it, earning +10 fame." |

---

## Part 7: File Structure

### New Files
| File | Purpose |
|------|---------|
| `src/components/dashboard/BehaviorSettingsTab.tsx` | Main behavior settings UI |
| `src/hooks/useBehaviorSettings.ts` | Settings CRUD and risk calculation |
| `supabase/migrations/xxx_add_behavior_system.sql` | Database schema + seed events |
| `supabase/functions/process-lifestyle-events/index.ts` | Handle lifestyle event outcomes |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/Dashboard.tsx` | Add "Behavior" tab |
| `src/utils/healthSystem.ts` | Add behavior-based modifiers |
| `supabase/functions/trigger-random-events/index.ts` | Add behavior-aware filtering |
| `src/integrations/supabase/types.ts` | Auto-generated type updates |
| `src/components/VersionHeader.tsx` | Bump to v1.0.537 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

---

## Part 8: Event Outcome Effects

### Health Impact by Setting

| Setting | Value | Health Modifier |
|---------|-------|-----------------|
| partying_intensity | abstinent | +5% recovery rate |
| partying_intensity | light | +0% |
| partying_intensity | moderate | -5% recovery rate |
| partying_intensity | heavy | -15% recovery rate |
| partying_intensity | legendary | -25% recovery rate |
| hotel_standard | hostel | -10% rest effectiveness |
| hotel_standard | suite | +20% rest effectiveness |

### Fame/Reputation Impact

| Behavior | Positive Events | Negative Events |
|----------|-----------------|-----------------|
| Wild fan interaction | More viral moments | Stalker risk |
| Controversial media | Huge fame swings | Reputation damage |
| Heavy partying | Rock star legend | Health collapse risk |
| Reclusive media | Mystique (+rep) | Less exposure |

---

## Technical Notes

- All settings use `text` type with CHECK constraints for valid values
- Default settings created via database trigger on profile creation
- Behavior events tracked in `player_event_history` to prevent repeats
- Risk score calculation: weighted sum of setting values (0-100)
- Inbox messages include actionable links where relevant
