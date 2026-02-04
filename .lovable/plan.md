
# Plan: Comprehensive Company System Expansion and Game Integration

## Overview

This plan transforms the company system from a collection of isolated management pages into an interconnected business empire that directly impacts all aspects of gameplay. Each company type will have meaningful upgrades, customizable pricing, and tangible effects on gigs, tours, recordings, and merchandise.

---

## Part 1: Unified Equipment Catalog for Recording Studios

### Current Problem
Recording studio equipment is manually entered as free-form text (equipment_name, brand, model) with no connection to the existing `equipment_items` catalog that contains 142+ real-world products.

### Solution
Link recording studio equipment purchases to the existing `equipment_items` table, creating a unified gear ecosystem.

**Database Changes:**
```
ALTER TABLE recording_studio_equipment
ADD COLUMN equipment_item_id uuid REFERENCES equipment_items(id);
```

**New Categories for equipment_items:**
- `studio_mic` - Studio microphones (U87, SM7B, etc.)
- `studio_preamp` - Preamps and channel strips
- `studio_compressor` - Hardware compressors
- `studio_console` - Mixing consoles
- `studio_monitor` - Studio monitors
- `studio_reverb` - Hardware reverb units
- `studio_outboard` - Outboard processors

**UI Changes:**
- Modify `RecordingStudioEquipmentManager` to browse from `equipment_items` catalog
- Show real product images, brands, and stat_boosts
- Equipment purchases deduct from company balance

---

## Part 2: Upgrade Systems That Affect Quality

### Current State
Companies have upgrade systems, but upgrades don't meaningfully affect gameplay outcomes.

### Recording Studio Upgrades Impact

| Upgrade Type | Current Effect | New Effect |
|-------------|---------------|------------|
| Console | +X% Quality label | +X% song quality bonus during recording |
| Monitors | Label only | +X% mixing accuracy (affects final quality) |
| Microphones | Label only | +X% vocal/instrument capture quality |
| Live Room | Label only | +X% to live instrument recordings |
| Mastering Suite | Label only | +X% to mastering quality, faster turnaround |

**Implementation:**
- Add `get_studio_quality_modifier(studio_id)` RPC that calculates total bonus
- Hook into recording completion flow to apply modifiers
- Display modifiers in studio selection UI when booking recordings

### Venue Upgrades Impact

| Upgrade Type | Current Effect | New Effect |
|-------------|---------------|------------|
| Sound System | Label only | +X% gig performance score for bands |
| Lighting | Label only | +X% crowd engagement/atmosphere |
| Capacity | Label only | Actually increases venue.capacity |
| Backstage | Label only | +X% band satisfaction, chemistry boost |
| Security System | Label only | Reduces security guard requirements |

**Implementation:**
- Add `get_venue_quality_modifier(venue_id)` RPC
- Hook into `gigExecution.ts` to apply venue upgrade bonuses
- Display "Venue Bonus" section in gig summary

### Security Firm Upgrades (New)

Add missing upgrade system for security firms:

| Upgrade Type | Cost | Effect |
|-------------|------|--------|
| Basic Training | $10,000 | +5% guard effectiveness |
| Crowd Control | $25,000 | +10% large venue capability |
| VIP Protection | $50,000 | Unlock celebrity/artist protection contracts |
| Emergency Response | $35,000 | Reduce incident penalties by 25% |
| Equipment Upgrade | $20,000 | Better radios, protective gear |

### Logistics Upgrades Impact

| Upgrade Type | Current Effect | New Effect |
|-------------|---------------|------------|
| GPS Tracking | Label only | +5% on-time delivery, visible in tour tracking |
| Climate Control | Label only | Protects sensitive equipment, +10% condition preservation |
| Fleet Expansion | Slot increase | Actually enables more concurrent contracts |
| Premium Insurance | Label only | Reduces damage liability costs |

### Merch Factory Upgrades (New)

Add upgrade system for factories:

| Upgrade Type | Cost | Effect |
|-------------|------|--------|
| Print Quality | $15,000 | +10% merchandise quality rating |
| Speed Lines | $30,000 | +25% production speed |
| Custom Packaging | $20,000 | +5% merchandise sale price |
| Eco-Friendly Materials | $25,000 | +10% with eco-conscious fans |
| Design Studio | $40,000 | Unlock custom design capability |

---

## Part 3: Customizable Service Pricing

Each company type should allow the owner to set prices for their services.

### Recording Studios
Add to management page:
- **Hourly Rate** slider: $50 - $500/hr (affects booking attractiveness)
- **Rush Fee** toggle: 2x rate for same-day bookings
- **Mixing Rate**: Separate rate for mixing-only sessions
- **Mastering Rate**: Separate rate for mastering services

**Database:**
```
ALTER TABLE city_studios
ADD COLUMN mixing_hourly_rate integer DEFAULT 150,
ADD COLUMN mastering_hourly_rate integer DEFAULT 200,
ADD COLUMN rush_fee_multiplier numeric DEFAULT 2.0,
ADD COLUMN minimum_booking_hours integer DEFAULT 2;
```

### Rehearsal Studios
- **Hourly Rate** slider: $10 - $100/hr
- **Equipment Rental Package** options (basic/pro/premium)
- **After Hours Rate**: 1.5x for late-night bookings

### Venues
- **Venue Cut %** slider: 20-50% of ticket revenue
- **Bar Revenue Share %**: 10-40%
- **Private Event Rate**: Flat fee for rentals
- **Minimum Guarantee**: Require minimum payment

### Security Firms
- **Guard Rate per Event**: $50 - $300/guard
- **Contract Rates**: Weekly/monthly discounts
- **VIP Premium**: Higher rate for celebrity protection

### Logistics Companies
- **Per-km Rate**: $0.50 - $2.00/km
- **Per-day Rate**: Flat daily charge
- **Equipment Value Insurance %**: 0.1% - 0.5% of cargo value

### Merch Factories
- **Per-unit Manufacturing Cost**: Markup over base
- **Rush Order Fee**: Expedited production
- **Bulk Discount Thresholds**: 100/500/1000 unit breaks

---

## Part 4: Deep Game Integration

### Security Firms Integration

**Hook into Gigs:**
When a band books a gig at a venue requiring security:
1. Check if venue has `security_required = true`
2. Query available security firms in the city
3. Display firm options with reputation, price, guard count
4. Player-owned firms get "In-House" badge with discounts
5. Security quality affects:
   - Incident prevention (mosh pit injuries, crowd crush)
   - VIP area management
   - Revenue protection (reduce theft)

**Hook into Tours:**
- Tour planning shows "Security Required" for large venues
- Can hire same firm for entire tour (contract discount)
- Security firm reputation affects tour prestige

### Logistics Integration

**Hook into Tours:**
When booking a tour:
1. Show logistics options for equipment transport
2. Calculate costs based on:
   - Distance between cities
   - Equipment weight (stage equipment owned)
   - Time sensitivity
3. Logistics quality affects:
   - Equipment arrival time (late = scramble penalty)
   - Equipment condition on arrival
   - Merch delivery timing

**Hook into Merch Delivery:**
- Factories produce merch
- Logistics delivers to venue before gig
- Late delivery = reduced merch available for sale

### Recording Studio Integration

**Studio Quality Affects:**
1. Song quality_score bonus during recording
2. Producer effectiveness multiplier
3. Orchestra/session musician quality
4. Mastering polish level

**Formula:**
```
final_quality = base_quality * (1 + studio_quality_modifier)
studio_quality_modifier = sum(upgrade_effects) + (equipment_value / 100000 * 0.1)
```

### Venue Integration

**Venue Quality Affects:**
1. Gig performance multiplier
2. Band chemistry boost/drain
3. Crowd capacity and energy
4. Merch sales opportunity
5. Recording capability (live albums)

**Company-Owned Venue Benefits:**
- Set your own booking rates
- Priority booking for owned label's bands
- Keep 100% of venue revenue (no external cut)
- Upgrade revenue goes back to company

### Factory Integration

**Factory Quality Affects:**
1. Merchandise production speed
2. Item quality rating (affects price point)
3. Maximum batch sizes
4. Custom design capability

**Owned Factory Benefits:**
- Reduced per-unit costs
- Priority queue for urgent orders
- Custom exclusive designs
- Bulk production for tours

---

## Part 5: Synergy System Activation

The `SYNERGY_DEFINITIONS` exist but aren't actively applied. Make them real:

### Label-Venue Partnership
When label books its artists at owned venue:
- 15% discount on venue fee
- Priority time slot booking
- Shared marketing bonus (+5% attendance)

### Venue-Security Synergy
When venue uses owned security firm:
- 25% discount on security costs
- Faster contract approval
- Dedicated guard pool

### Factory-Logistics Synergy
When factory ships via owned logistics:
- 20% shipping discount
- Guaranteed delivery times
- Real-time tracking integration

### Full Integration Bonus
Owning all company types:
- 35% discount on all internal services
- Empire Dashboard showing cross-company metrics
- Exclusive "Vertical Integration" achievement

---

## Part 6: UI/UX Enhancements

### Company Dashboard Improvements

Add to `MyCompanies.tsx`:
- **Empire Overview** card showing:
  - Total company value
  - Combined daily revenue
  - Active synergies
  - Employee count across all subsidiaries

### Per-Company Settings Tab

Add "Settings" tab to each management page:
- Pricing configuration
- Service availability hours
- Auto-accept contract rules
- Notification preferences

### Contract Discovery

Companies should receive automatic contract offers:
- Security firms get gig security requests
- Logistics get tour transport requests
- Studios get recording session requests
- Factories get merch production requests

Display in a unified "Incoming Contracts" section.

---

## Implementation Sequence

### Phase 1: Database Foundations
1. Add new columns for pricing to relevant tables
2. Create upgrade tables for security/factory
3. Add `equipment_item_id` to studio equipment
4. Seed studio equipment to `equipment_items`

### Phase 2: Upgrade Effects
1. Create quality modifier RPCs for each company type
2. Hook modifiers into gigExecution.ts
3. Hook modifiers into recording completion
4. Display modifiers in booking UIs

### Phase 3: Pricing Systems
1. Add pricing sliders to each management page
2. Update booking flows to use custom prices
3. Add "Set Prices" tab to management pages

### Phase 4: Cross-Company Integration
1. Implement security firm selection in gig booking
2. Implement logistics selection in tour planning
3. Implement factory-logistics delivery tracking
4. Activate synergy discounts

### Phase 5: Contract Generation
1. Create cron job for contract offer generation
2. Build unified contract inbox UI
3. Add auto-accept rules configuration

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/XXXX_company_system_expansion.sql` | Create | Schema changes, new upgrade tables |
| `src/hooks/useCompanyQualityModifiers.ts` | Create | Calculate quality bonuses |
| `src/utils/gigExecution.ts` | Modify | Apply venue/security modifiers |
| `src/hooks/useRecordingData.tsx` | Modify | Apply studio quality modifiers |
| `src/components/recording-studio-business/RecordingStudioEquipmentManager.tsx` | Modify | Link to equipment_items |
| `src/pages/SecurityFirmManagement.tsx` | Modify | Add upgrades and pricing tabs |
| `src/pages/MerchFactoryManagement.tsx` | Modify | Add upgrades tab |
| `src/components/security/SecurityUpgradesManager.tsx` | Create | Security firm upgrades UI |
| `src/components/merch-factory/FactoryUpgradesManager.tsx` | Create | Factory upgrades UI |
| `src/components/company/CompanyPricingSettings.tsx` | Create | Reusable pricing configuration |
| `src/components/company/CompanySynergies.tsx` | Create | Display active synergies |
| `src/pages/MyCompanies.tsx` | Modify | Add empire overview |
| `src/components/gig/SecuritySelection.tsx` | Create | Choose security for gigs |
| `src/components/tour/LogisticsSelection.tsx` | Create | Choose logistics for tours |
| `src/components/VersionHeader.tsx` | Modify | Version bump |
| `src/pages/VersionHistory.tsx` | Modify | Changelog entry |

---

## Expected Outcomes

- **Meaningful Ownership**: Each company type directly impacts gameplay outcomes
- **Economic Integration**: Custom pricing creates player-driven market dynamics  
- **Upgrade Investment**: Spending on upgrades provides tangible returns
- **Synergy Rewards**: Vertical integration provides real competitive advantages
- **Cross-System Effects**: Companies affect gigs, tours, recordings, and merch
- **Unified Equipment**: Recording studio gear shares catalog with player gear

---

## Technical Notes

### Quality Modifier Formula
```typescript
function getStudioQualityModifier(studioId: string): number {
  // Sum upgrade effects (each level = +2% typically)
  const upgradeBonus = upgrades.reduce((sum, u) => sum + u.effect_value, 0);
  
  // Equipment value bonus (every $100k = +5%)
  const equipmentBonus = (totalEquipmentValue / 100000) * 5;
  
  // Staff skill bonus (average skill / 20)
  const staffBonus = avgStaffSkill / 20;
  
  return Math.min(50, upgradeBonus + equipmentBonus + staffBonus);
}
```

### Synergy Detection
```typescript
function detectSynergies(companyId: string): SynergyType[] {
  const subsidiaryTypes = getSubsidiaryTypes(companyId);
  return Object.entries(SYNERGY_DEFINITIONS)
    .filter(([_, def]) => def.requires.every(r => subsidiaryTypes.includes(r)))
    .map(([type]) => type as SynergyType);
}
```

**Version**: 1.0.596
