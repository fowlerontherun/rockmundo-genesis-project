
# Plan: Expand Legendary Masters with Engaging Discovery Mechanics

## Overview
This plan expands the mentor system with 30+ new masters across underserved cities and skill categories, plus implements active discovery mechanics that make finding masters feel like meaningful narrative moments rather than passive unlocks.

---

## Part 1: Seed New Legendary Masters (Database)

### New Mentors by Category

**Production & Recording Masters (6 new)**
| Name | City | Skill | Discovery Type | Hint |
|------|------|-------|---------------|------|
| Dr. Dub | Kingston (Jamaica)* | Basic Mixing & Mastering | Studio Session | Record at a reggae studio to meet the dub architect |
| Nina Frequency | Berlin | Basic Sound Design | Exploration | Thursday nights in Kreuzberg, follow the bassline |
| The Architect | Los Angeles | Basic Record Production | Studio Session | The Hollywood studios know his number |
| DJ Phantom | Ibiza | Basic DJ Controller | Venue Gig | Headline at Amnesia to catch his attention |
| Madame Analog | Tokyo | Basic DAW Use | Exploration | She only teaches those who respect the old ways |
| The Sampler King | New York | Basic Sampling & Remixing | Exploration | Brooklyn warehouses hold his secrets |

**Genre Specialists (8 new)**
| Name | City | Skill | Discovery Type | Hint |
|------|------|-------|---------------|------|
| Bluesman Jack | Memphis* | Basic Blues | Venue Gig | Play Beale Street to earn his respect |
| Salsa Queen Rosa | Havana* | Basic Latin | Exploration | She dances on Friday evenings by the Malecón |
| MC Prophet | New York | Basic Hip Hop | Exploration | The Bronx remembers those who pay homage |
| Count Jazzula | New Orleans | Basic Jazz | Venue Gig | Midnight at Preservation Hall reveals him |
| Synth Lord | Berlin | Basic EDM | Venue Gig | Pack Berghain and he'll find you |
| Punk Patriarch | London | Basic Punk Rock | Exploration | Camden Market punks whisper his name |
| Samba Master Rafa | Rio de Janeiro | Basic Latin | Exploration | Carnival knows his rhythm |
| K-Pop Sensei | Seoul* | Basic K-Pop/J-Pop | Studio Session | The trainees know where he teaches |

**Performance & Showmanship (4 new)**
| Name | City | Skill | Discovery Type | Hint |
|------|------|-------|---------------|------|
| The Hypnotist | Las Vegas | Basic Crowd Interaction | Venue Gig | Fill an arena on The Strip |
| Madam Mystique | Paris | Basic Showmanship | Exploration | She observes from Le Marais cafes |
| Loop Wizard | Amsterdam | Basic Live Looping | Exploration | The canals echo his experiments |
| Viral Vince | Los Angeles | Basic Social Media Performance | Achievement | Reach 100k followers to unlock |

**Instrument Virtuosos (6 new)**
| Name | City | Skill | Discovery Type | Hint |
|------|------|-------|---------------|------|
| Ivory Empress | Vienna | Basic Keyboard | Venue Gig | Play the Musikverein to earn an audience |
| String Theory | Prague | Basic Strings | Exploration | The classical halls know her touch |
| Brass Baron | New Orleans | Basic Brass | Exploration | Second Line parades reveal him |
| Percussion Prophet | Lagos | Basic Percussions | Exploration | The talking drums carry his message |
| Steel Fingers | Nashville | Basic Acoustic Guitar | Venue Gig | Country legends remember his sessions |
| Bass Prophet | Detroit | Basic Bass Guitar | Exploration | Motown echoes speak of him |

**Vocal & Lyrics Coaches (4 new)**
| Name | City | Skill | Discovery Type | Hint |
|------|------|-------|---------------|------|
| The Wordsmith | Dublin | Basic Lyrics | Exploration | Temple Bar poets trade in his verses |
| Soul Sister Supreme | Memphis | Basic Singing | Exploration | Gospel choirs carry her legacy |
| Rhyme Oracle | Atlanta | Basic Rapping | Achievement | Chart a hip-hop track to prove your worth |
| Harmony Queen | Nashville | Basic Singing | Studio Session | Recording engineers know her booth |

*Note: Cities marked with * may need to be added to the cities table first

---

## Part 2: Active Discovery System

### 2.1 Venue-Based Discovery Trigger
**Location**: `src/utils/gigExecution.ts`

Add logic after gig completion to check if the venue triggers a mentor discovery:

```text
After gig completion:
1. Query education_mentors where discovery_venue_id matches venue
2. Check if player already discovered this mentor
3. If not discovered, call discover_master RPC
4. Show dramatic discovery notification with mentor lore
```

### 2.2 Studio-Based Discovery Trigger
**Location**: Recording flow completion

When a player completes a recording session at a studio:
1. Check if any mentor has discovery_studio_id matching the studio
2. Trigger discovery with narrative popup

### 2.3 Achievement-Based Discovery
**New mechanism**: Link discoveries to achievement unlocks

Add `discovery_achievement_id` column to education_mentors for achievements like:
- First #1 hit unlocks "The Hitmaker"
- 100k social followers unlocks "Viral Vince"
- Complete a world tour unlocks "The Road Warrior"

### 2.4 Exploration Discovery Events
**New random event type**: "Master Encounter"

Create new random events that can fire when in specific cities:
- "A street musician hands you a card: 'My teacher wants to meet you'"
- "A venue owner mentions a legendary local who's been watching your career"
- "An NPC at the bar says they know someone who could help your sound"

---

## Part 3: Discovery Storytelling UI

### 3.1 Master Discovery Modal
**New Component**: `MasterDiscoveryModal.tsx`

When a master is discovered, show a dramatic modal with:
- Master portrait/silhouette reveal animation
- Lore biography reading
- Achievement callout (their claim to fame)
- City connection story
- "Journey to [City] to begin training" CTA

### 3.2 Discovery Hints Enhancement
Update `MentorsTab.tsx` undiscovered card to show:
- Atmospheric hint text with flavor
- Discovery method icon with tooltip
- City name (teaser without full location)
- Skill they teach (helps players target discoveries)

### 3.3 Discovery Log
Add a "Discovery Journal" tab showing:
- Timeline of discoveries with dates
- How each master was found
- Upcoming hints for undiscovered masters in visited cities

---

## Part 4: Database Changes

### Migration 1: Add New Cities (if needed)
```sql
INSERT INTO cities (name, country, ...) VALUES
  ('Memphis', 'USA', ...),
  ('Kingston', 'Jamaica', ...),
  ('Havana', 'Cuba', ...),
  ('Seoul', 'South Korea', ...);
```

### Migration 2: Add Achievement Discovery Column
```sql
ALTER TABLE education_mentors
ADD COLUMN discovery_achievement_id uuid REFERENCES achievements(id);
```

### Migration 3: Seed New Mentors
Insert 28+ new mentors with:
- Rich lore_biography (2-3 sentences)
- Evocative discovery_hint
- Appropriate difficulty scaling
- Varied costs ($15k-$150k)
- Different available_days for variety

### Migration 4: Create Master Encounter Events
```sql
INSERT INTO random_events (...)
VALUES 
  ('master_encounter_jazz', 'A Whisper in the Smoky Club', ...),
  ('master_encounter_hip_hop', 'Street Corner Respect', ...);
```

---

## Part 5: Implementation Sequence

1. **Database Migrations** (first)
   - Add missing cities
   - Add achievement discovery column
   - Seed new mentors with full lore
   - Create master encounter random events

2. **Discovery Triggers** (backend logic)
   - Hook venue-based discovery into gigExecution.ts
   - Hook studio-based discovery into recording completion
   - Hook achievement-based discovery into achievement unlock flow

3. **UI Enhancements**
   - Create MasterDiscoveryModal component
   - Update MentorsTab undiscovered cards
   - Add discovery journal/log

4. **Testing**
   - Verify gig at specific venue triggers discovery
   - Verify discovery modal shows correctly
   - Verify mentor becomes bookable after discovery

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/XXXX_seed_legendary_masters.sql` | Create - Add cities, mentors, events |
| `src/utils/gigExecution.ts` | Modify - Add venue discovery trigger |
| `src/components/education/MasterDiscoveryModal.tsx` | Create - Dramatic reveal UI |
| `src/features/education/components/MentorsTab.tsx` | Modify - Enhanced undiscovered cards |
| `src/hooks/useMentorSessions.ts` | Modify - Add discovery notification |
| `src/components/VersionHeader.tsx` | Modify - Version bump |
| `src/pages/VersionHistory.tsx` | Modify - Changelog entry |

---

## Expected Outcomes

- **50+ Legendary Masters** across global cities
- **Active discovery** through gameplay (gigs, studios, achievements)
- **Narrative immersion** with rich lore and dramatic reveals
- **Player motivation** to explore cities and try new activities
- **Skill variety** covering production, genres, and modern music skills
