
# Plan: Modeling Offers System with Enhanced Film Lifecycle and Sequel Logic

## Overview

This plan implements a new **Modeling Offers** system that complements the existing Film offers, linked to the player's **Looks attribute** and utilizing the existing **sponsorship_brands** catalog. We'll also enhance the Film system with a complete lifecycle (casting → filming → premiere) and introduce sequel logic for returning actors.

---

## Part 1: Modeling System Tables

### New Tables

**modeling_agencies** - Fashion agencies that book models
```sql
CREATE TABLE modeling_agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tier TEXT CHECK (tier IN ('local', 'national', 'international', 'elite')) DEFAULT 'local',
  region TEXT,
  min_looks_required INTEGER DEFAULT 30,
  prestige_level INTEGER DEFAULT 1,
  description TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**modeling_gigs** - Available modeling jobs
```sql
CREATE TABLE modeling_gigs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES modeling_agencies(id),
  brand_id UUID REFERENCES sponsorship_brands(id),
  gig_type TEXT CHECK (gig_type IN ('photo_shoot', 'runway', 'commercial', 'music_video_cameo', 'cover_shoot', 'brand_ambassador')) DEFAULT 'photo_shoot',
  title TEXT NOT NULL,
  description TEXT,
  min_looks_required INTEGER DEFAULT 40,
  min_fame_required INTEGER DEFAULT 0,
  compensation_min INTEGER DEFAULT 500,
  compensation_max INTEGER DEFAULT 50000,
  fame_boost INTEGER DEFAULT 100,
  looks_boost INTEGER DEFAULT 0,
  duration_hours INTEGER DEFAULT 4,
  event_id UUID, -- Link to fashion_events for runway shows
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**fashion_events** - Fashion weeks and special events
```sql
CREATE TABLE fashion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_type TEXT CHECK (event_type IN ('fashion_week', 'runway_show', 'gala', 'photoshoot_event', 'brand_launch')) DEFAULT 'fashion_week',
  city_id UUID REFERENCES cities(id),
  starts_at DATE NOT NULL,
  ends_at DATE NOT NULL,
  prestige_level INTEGER DEFAULT 1,
  min_looks_required INTEGER DEFAULT 50,
  min_fame_required INTEGER DEFAULT 10000,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**player_modeling_contracts** - Player's modeling history
```sql
CREATE TABLE player_modeling_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  gig_id UUID REFERENCES modeling_gigs(id) ON DELETE CASCADE NOT NULL,
  brand_id UUID REFERENCES sponsorship_brands(id),
  status TEXT DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'shooting', 'completed', 'declined', 'cancelled')),
  gig_type TEXT,
  compensation INTEGER,
  fame_boost INTEGER,
  looks_boost INTEGER,
  shoot_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_modeling_contract UNIQUE (user_id, gig_id)
);
```

---

## Part 2: Modeling Offer Generation

### Edge Function: `generate-modeling-offers`

Similar pattern to `generate-pr-offers`:

1. Fetch players with `looks` attribute above threshold (30+)
2. Match against `modeling_gigs` where player qualifies by:
   - `looks >= min_looks_required`
   - `fame >= min_fame_required`
3. Check cooldowns per brand (can't do same brand within 30 days)
4. Create offers in `pr_media_offers` with `media_type: 'modeling'` OR a dedicated table

**Looks-Based Tiering:**
| Looks Score | Available Gig Types |
|-------------|-------------------|
| 30-50 | Photo shoots (local brands) |
| 50-70 | Commercials, music video cameos |
| 70-85 | Runway shows, cover shoots |
| 85-100 | Fashion Week, brand ambassador |

**Offer Generation Logic:**
```typescript
const looksScore = playerAttributes.looks || 0;
const eligibleGigs = modelingGigs.filter(gig => 
  looksScore >= gig.min_looks_required &&
  fame >= gig.min_fame_required
);
```

---

## Part 3: Seed Fashion Brands (30+ new brands)

Expand `sponsorship_brands` with fashion-specific entries:

**Luxury Tier (wealth_tier 5):**
- Versace, Gucci, Louis Vuitton, Chanel, Prada, Dior, Balenciaga

**Premium Tier (wealth_tier 4):**
- Calvin Klein, Tommy Hilfiger, Hugo Boss, Ralph Lauren, Armani

**Mid-Tier (wealth_tier 3):**
- Zara, H&M, Uniqlo, Mango, ASOS, Forever 21

**Streetwear Tier (wealth_tier 2-3):**
- Supreme, Off-White, Palace, Stussy, Bape

**Indie/Local Tier (wealth_tier 1-2):**
- Indie fashion labels, vintage boutiques, local designers

---

## Part 4: Fashion Events (Fashion Weeks)

Seed major fashion events:

| Event | City | Dates | Prestige | Min Looks |
|-------|------|-------|----------|-----------|
| Paris Fashion Week | Paris | Mar/Sep | 5 | 85 |
| Milan Fashion Week | Milan | Feb/Sep | 5 | 80 |
| New York Fashion Week | New York | Feb/Sep | 5 | 75 |
| London Fashion Week | London | Feb/Sep | 4 | 70 |
| Tokyo Fashion Week | Tokyo | Mar/Oct | 4 | 65 |
| Berlin Fashion Week | Berlin | Jan/Jul | 3 | 60 |
| São Paulo Fashion Week | São Paulo | Apr/Oct | 3 | 55 |

**Annual Schedule:**
- Events repeat yearly with random gig slots
- Players can only do 1 show per fashion week
- Fame/Looks boosted significantly for elite events

---

## Part 5: Enhanced Film System

### Film Lifecycle States

Expand `player_film_contracts.status`:
```sql
ALTER TABLE player_film_contracts 
ALTER COLUMN status SET DEFAULT 'offered';

-- New states: offered → casting → filming → post_production → premiere → completed
ALTER TABLE player_film_contracts 
DROP CONSTRAINT IF EXISTS player_film_contracts_status_check;

ALTER TABLE player_film_contracts 
ADD CONSTRAINT player_film_contracts_status_check 
CHECK (status IN ('offered', 'casting', 'filming', 'post_production', 'premiere', 'completed', 'declined'));
```

Add new columns:
```sql
ALTER TABLE player_film_contracts ADD COLUMN IF NOT EXISTS
  casting_date DATE,
  premiere_date DATE,
  premiere_city_id UUID REFERENCES cities(id),
  box_office_gross INTEGER DEFAULT 0,
  sequel_eligible BOOLEAN DEFAULT false,
  parent_film_id UUID REFERENCES film_productions(id);
```

### Film Phases

| Phase | Duration | Player Activity |
|-------|----------|-----------------|
| Casting | 1 day | Audition (schedule block) |
| Filming | 7-30 days | On location (schedule block) |
| Post-Production | 60-90 days | No player involvement |
| Premiere | 1 day | Red carpet event (fame boost) |
| Completed | - | Film removed from active |

### Sequel Logic

After a film is completed:
1. Check `box_office_gross` (simulated based on role type + fame)
2. If successful (gross > threshold), mark `sequel_eligible = true`
3. Next year, 30% chance of sequel offer for eligible players
4. Sequel films reference `parent_film_id` for continuity

**Sequel Offer Generation:**
```typescript
// Check for sequel-eligible contracts from previous year
const eligibleForSequels = await getEligibleSequelContracts(userId, previousYear);

for (const contract of eligibleForSequels) {
  if (Math.random() < 0.3) { // 30% sequel chance
    createSequelOffer(contract.film_id, userId);
  }
}
```

---

## Part 6: Seed More Film Productions (50+ new films)

Expand from 12 to 50+ films with diversity:

**Cameo Roles (fame 5000-25000):**
- Music documentaries, concert films
- Indie dramas, comedy cameos
- TV movies, streaming specials

**Supporting Roles (fame 25000-75000):**
- Festival comedies, band biopics
- Action movie musicians
- Romantic comedies

**Lead Roles (fame 75000+):**
- Rockstar biopics (Freddie Mercury-style)
- Music industry thrillers
- Coming-of-age musician stories
- Documentary features

**Film Studios to Add:**
- Netflix Studios, Amazon Studios, Apple Films
- A24, Focus Features, Searchlight Pictures
- Legendary Pictures, Lionsgate, MGM

---

## Part 7: UI Components

### ModelingOffersPanel.tsx
Similar to FilmOffersPanel:
- Shows pending modeling gig offers
- Displays looks requirement progress
- Fashion event calendar
- Contract history

### FashionEventsBrowser.tsx
- Browse upcoming fashion weeks
- Filter by city, date, prestige
- Show eligible events based on looks/fame

### FilmDetailView.tsx
Enhanced film card showing:
- Current phase (casting/filming/etc.)
- Days remaining in phase
- Premiere countdown
- Sequel indicator

---

## Part 8: Integration Points

### Looks Attribute Connection
```typescript
// In modeling offer generation
const looks = playerAttributes.looks || 0;
const fameMultiplier = 1 + (fame / 100000);
const compensation = baseCompensation * (looks / 50) * fameMultiplier;
```

### Brand Link (Existing System)
Use `sponsorship_brands` for modeling gigs:
- Same brand can offer modeling AND sponsorship deals
- Modeling builds relationship with brand
- Better relationship = better sponsorship terms

### Schedule Integration
- Modeling shoots block 4-8 hours
- Runway shows block 2-3 days (travel + show + afterparty)
- Fashion weeks block 1-7 days depending on bookings

---

## Part 9: Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/XXXX_modeling_system.sql` | Create | New tables, constraints, seed data |
| `supabase/functions/generate-modeling-offers/index.ts` | Create | Generate offers based on looks |
| `src/components/modeling/ModelingOffersPanel.tsx` | Create | Display modeling offers |
| `src/components/modeling/FashionEventsBrowser.tsx` | Create | Browse fashion events |
| `src/pages/media/ModelingBrowser.tsx` | Create | Browse modeling opportunities |
| `src/pages/PublicRelations.tsx` | Modify | Add Modeling tab |
| `src/components/pr/FilmOffersPanel.tsx` | Modify | Show film lifecycle phases |
| `supabase/functions/generate-pr-offers/index.ts` | Modify | Add sequel check logic |
| `supabase/functions/process-scheduled-activities/index.ts` | Modify | Handle modeling completions |
| `src/components/VersionHeader.tsx` | Modify | Version bump to 1.0.597 |
| `src/pages/VersionHistory.tsx` | Modify | Add changelog entry |

---

## Part 10: Seed Data Summary

### Fashion Brands (30 new)
```sql
-- Luxury
INSERT INTO sponsorship_brands (name, category, size, wealth_tier, min_fame_required) VALUES
('Versace', 'fashion', 'major', 5, 75000),
('Gucci', 'fashion', 'major', 5, 80000),
('Louis Vuitton', 'fashion', 'major', 5, 100000),
-- ... etc
```

### Modeling Agencies (15 new)
```sql
INSERT INTO modeling_agencies (name, tier, region, min_looks_required) VALUES
('Elite Model Management', 'elite', 'global', 85),
('IMG Models', 'elite', 'global', 80),
('Ford Models', 'international', 'North America', 70),
-- ... etc
```

### Modeling Gigs (40 new)
```sql
INSERT INTO modeling_gigs (agency_id, brand_id, gig_type, title, min_looks_required, compensation_min) VALUES
-- Photo shoots, runway shows, commercials, etc.
```

### Fashion Events (20 new)
```sql
INSERT INTO fashion_events (name, event_type, city_id, starts_at, ends_at, prestige_level) VALUES
('Paris Fashion Week Spring', 'fashion_week', (SELECT id FROM cities WHERE name = 'Paris'), '2026-03-01', '2026-03-08', 5),
-- ... etc
```

### Film Productions (40 new)
```sql
INSERT INTO film_productions (studio_id, title, film_type, genre, min_fame_required, compensation_min, compensation_max) VALUES
-- Diverse range of films across all role types
```

---

## Expected Outcomes

- **Modeling System**: Players with high Looks can pursue modeling career
- **Fashion Events**: Runway shows at major fashion weeks
- **Brand Integration**: Modeling builds brand relationships
- **Film Lifecycle**: Films now progress through realistic phases
- **Sequels**: Successful films can spawn sequel opportunities
- **More Content**: 50+ new films, 30+ fashion brands, 20 fashion events

---

## Technical Notes

### Looks-to-Compensation Formula
```typescript
function calculateModelingPay(looks: number, basePay: number, brandTier: number): number {
  const looksMultiplier = Math.pow(looks / 50, 1.5); // Exponential scaling
  const tierMultiplier = 1 + (brandTier * 0.2);
  return Math.floor(basePay * looksMultiplier * tierMultiplier);
}
```

### Film Box Office Simulation
```typescript
function simulateBoxOffice(roleType: string, playerFame: number): number {
  const baseGross = { cameo: 5_000_000, supporting: 25_000_000, lead: 100_000_000 };
  const fameMultiplier = 1 + (playerFame / 500_000);
  const variance = 0.5 + Math.random(); // 50%-150% variance
  return Math.floor(baseGross[roleType] * fameMultiplier * variance);
}
```

### Sequel Eligibility
```typescript
const SEQUEL_THRESHOLD = {
  cameo: 10_000_000,
  supporting: 50_000_000,
  lead: 150_000_000
};

function checkSequelEligibility(contract: FilmContract): boolean {
  const threshold = SEQUEL_THRESHOLD[contract.role_type] || 50_000_000;
  return contract.box_office_gross >= threshold;
}
```

**Version**: 1.0.597
