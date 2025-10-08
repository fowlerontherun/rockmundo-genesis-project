# Night Clubs System

## Overview
The night clubs system provides a nightlife venue management feature for cities in Rockmundo, allowing players to perform as DJs, socialize, and engage in late-night activities.

## Database Schema

### Table: `city_night_clubs`
Located in the `public` schema with the following columns:

- `id` (UUID, Primary Key)
- `city_id` (UUID, FK to cities) - Which city the club is in
- `name` (VARCHAR) - Club name
- `description` (TEXT) - Club description and vibe
- `quality_level` (INTEGER, 1-5) - Underground to Legendary
- `capacity` (INTEGER) - Maximum occupancy
- `cover_charge` (INTEGER) - Entry fee in dollars
- `guest_actions` (JSONB) - Available activities for guests
- `drink_menu` (JSONB) - Signature drinks and prices
- `npc_profiles` (JSONB) - Resident NPCs and staff
- `dj_slot_config` (JSONB) - DJ slot requirements and rewards
- `metadata` (JSONB) - Additional settings (live interactions, etc.)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### RLS Policies
- **Read**: Public (anyone can view night clubs)
- **Write/Update/Delete**: Admin only

## Quality Tiers

1. **Underground** - Small, gritty venues for emerging talent
2. **Neighborhood** - Local hotspots
3. **Boutique** - Trendy, mid-tier clubs
4. **Premier** - High-end, exclusive venues
5. **Legendary** - Elite, celebrity-frequented spots

## Features

### DJ Slot Configuration
Each club has configurable DJ slots with:
- **Minimum Fame Requirement** - Fame threshold to qualify
- **Payout** - Payment for performing
- **Set Length** - Duration of performance in minutes
- **Schedule** - Operating hours (e.g., "10pm-2am")
- **Perks** - Special bonuses (e.g., "+4% night fan buzz")

### Guest Actions
Activities available to visiting players:
- Dancing
- VIP lounge access
- Networking
- Special experiences

Each action has:
- Label (display name)
- Description (what it does)
- Energy cost

### Drink Menu
Signature drinks with:
- Name
- Price
- Effect (optional gameplay boost)

### NPC Profiles
Resident characters including:
- DJs
- Promoters
- Club owners
- Staff

Each NPC has:
- Name
- Role
- Personality
- Availability (optional schedule)
- Dialogue hooks (conversation topics)

## Admin Interface

Located at `/admin/night-clubs`, the admin interface provides:

### User-Friendly Form Interface
**No JSON required!** The admin can now:

1. **Basic Info Section**
   - Select city from dropdown
   - Enter club name and description
   - Choose quality level (1-5) with labels
   - Set capacity and cover charge
   - Toggle live interactions

2. **DJ Slot Configuration**
   - Set minimum fame, payout, set length, schedule
   - Add perks with simple input field + Add button
   - Remove perks with X button on badges

3. **Guest Actions Builder**
   - Add actions with label, description, energy cost
   - Visual list with delete buttons
   - No JSON editing needed

4. **Drink Menu Builder**
   - Add drinks with name, price, optional effect
   - Visual list with remove buttons

5. **NPC Manager**
   - Add NPCs with name, role, personality
   - Optional availability and dialogue hooks
   - Visual list for easy management

### Club List View
- Table showing all clubs by city
- Quality badges
- Quick edit/delete actions
- Filter by city (future enhancement)

## Frontend Display

### City Page Integration
Night clubs appear on the city detail page (`/cities/:cityId`) showing:
- Club name and quality tier
- Description and vibe
- Capacity and cover charge
- DJ slot requirements and payouts
- Guest activities
- Drink menu
- Resident NPCs
- Live interaction status

### Actions Available
- "Queue for DJ Slot" - Join DJ performance queue
- "Visit as Guest" - Enter club as patron
- View all club details

## Seeded Data (London)

Three example clubs have been seeded for London:

1. **The Electric Basement** (Underground, Camden)
   - 150 capacity, £10 cover
   - £200 payout, 45-min sets
   - 100 fame requirement

2. **Neon Dreams** (Boutique, Shoreditch)
   - 300 capacity, £25 cover
   - £800 payout, 60-min sets
   - 750 fame requirement
   - Premium drinks and VIP experiences

3. **The Velvet Room** (Premier, Soho)
   - 200 capacity, £50 cover
   - £1500 payout, 90-min sets
   - 2000 fame requirement
   - Celebrity networking, champagne service

## Future Enhancements

### Planned Features
1. **DJ Queue System** - Actual booking and performance mechanics
2. **Live Social Features** - Real-time chat during events
3. **Reputation System** - Club-specific fame/standing
4. **Event Hosting** - Special nights and themed events
5. **Revenue Sharing** - Club earnings for band members
6. **Crowd Reactions** - Dynamic audience feedback
7. **Set Builder** - Choose songs for DJ sets
8. **Residency Contracts** - Long-term DJ agreements

### Integration Opportunities
- Link to band chemistry (performing together)
- Connect to fan demographics (attract specific audiences)
- Integrate with schedule system (book recurring slots)
- Tie into achievements (first DJ gig, legendary venue unlock)
- Social media integration (promote events)

## Technical Notes

### Type Definitions
Located in `src/utils/worldEnvironment.ts`:
- `CityNightClub` - Main club interface
- `NightClubDjSlotConfig` - DJ slot configuration
- `NightClubGuestAction` - Guest activity
- `NightClubDrink` - Drink item
- `NightClubNPCProfile` - NPC character

### Data Normalization
The system handles flexible JSON input formats and normalizes them to consistent interfaces, supporting various field name aliases for robustness.

### Security
- All mutations require admin role via RLS policies
- Input validation on form submissions
- Safe JSON parsing with fallbacks
