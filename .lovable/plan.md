

# Company Subsidiary System Complete Fix

## Version: 1.0.504

## Overview
This update fixes the subsidiary creation system so that all company types properly create their specialized business records. It also aligns costs across the platform to match the $1,000,000 standard for labels and appropriately scales other business types.

---

## Issues Identified

### 1. Missing Specialized Record Creation
The database trigger `create_subsidiary_entity` only handles:
- ✅ `security` → creates `security_firms` record
- ✅ `factory` → creates `merch_factories` record  
- ✅ `logistics` → creates `logistics_companies` record
- ❌ `label` → NO record created (should create `labels` record)
- ❌ `venue` → NO record created (should create `venues` record)
- ❌ `rehearsal` → NO record created (should create `rehearsal_rooms` record)

### 2. Cost Inconsistency
| Type | Current Subsidiary Cost | Should Be |
|------|------------------------|-----------|
| holding | $100,000 | $500,000 |
| label | $75,000 | $1,000,000 (matches independent) |
| security | $50,000 | $250,000 |
| factory | $150,000 | $500,000 |
| logistics | $100,000 | $300,000 |
| venue | $200,000 | $750,000 |
| rehearsal | $75,000 | $200,000 |

### 3. Missing Navigation/Management
After creation, subsidiaries need proper routing to their management pages.

---

## Implementation Plan

### Phase 1: Update Company Creation Costs

**File: `src/types/company.ts`**

Update `COMPANY_CREATION_COSTS` to realistic values:

```typescript
export const COMPANY_CREATION_COSTS: Record<CompanyType, { creationCost: number; startingBalance: number }> = {
  holding: { creationCost: 500_000, startingBalance: 1_000_000 },
  label: { creationCost: 1_000_000, startingBalance: 1_000_000 },
  security: { creationCost: 250_000, startingBalance: 500_000 },
  factory: { creationCost: 500_000, startingBalance: 750_000 },
  logistics: { creationCost: 300_000, startingBalance: 500_000 },
  venue: { creationCost: 750_000, startingBalance: 1_000_000 },
  rehearsal: { creationCost: 200_000, startingBalance: 300_000 },
};
```

### Phase 2: Expand Database Trigger

**New Migration: Expand `create_subsidiary_entity` trigger**

Update the trigger function to handle all company types:

```sql
CREATE OR REPLACE FUNCTION create_subsidiary_entity()
RETURNS TRIGGER AS $$
BEGIN
  -- Security Firm
  IF NEW.company_type = 'security' THEN
    INSERT INTO security_firms (company_id, name, city_id, reputation, license_tier)
    VALUES (NEW.id, NEW.name, NEW.headquarters_city_id, 50, 1);
  
  -- Merch Factory
  ELSIF NEW.company_type = 'factory' THEN
    INSERT INTO merch_factories (company_id, name, city_id, production_capacity, quality_rating)
    VALUES (NEW.id, NEW.name, NEW.headquarters_city_id, 100, 50);
  
  -- Logistics Company
  ELSIF NEW.company_type = 'logistics' THEN
    INSERT INTO logistics_companies (company_id, name, city_id, fleet_size, license_tier)
    VALUES (NEW.id, NEW.name, NEW.headquarters_city_id, 0, 1);
  
  -- Record Label (NEW)
  ELSIF NEW.company_type = 'label' THEN
    INSERT INTO labels (company_id, name, headquarters_city, balance, reputation_score, is_subsidiary)
    VALUES (NEW.id, NEW.name, 
      (SELECT name FROM cities WHERE id = NEW.headquarters_city_id),
      NEW.balance, 50, true);
  
  -- Venue (NEW)
  ELSIF NEW.company_type = 'venue' THEN
    INSERT INTO venues (name, city, capacity, base_payment, venue_type, prestige_level, company_id)
    VALUES (NEW.name, 
      (SELECT name FROM cities WHERE id = NEW.headquarters_city_id),
      500, 5000, 'club', 1, NEW.id);
  
  -- Rehearsal Studio (NEW)
  ELSIF NEW.company_type = 'rehearsal' THEN
    INSERT INTO rehearsal_rooms (company_id, name, city_id, hourly_rate, daily_rate, capacity, quality_rating)
    VALUES (NEW.id, NEW.name, NEW.headquarters_city_id, 50, 300, 4, 50);
  
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Phase 3: Add company_id to venues table

The `venues` table currently lacks a `company_id` column. Add it:

```sql
ALTER TABLE venues ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
```

### Phase 4: Update Subsidiary Management Navigation

**File: `src/components/company/CompanyCard.tsx`**

Add smart navigation that routes to the correct management page based on company type:

```typescript
const getManagementRoute = (company: Company): string => {
  switch (company.company_type) {
    case 'label':
      // Find the label record linked to this company
      return `/labels`; // or specific label page
    case 'venue':
      return `/venue-management/${company.id}`;
    case 'rehearsal':
      return `/rehearsal-studio/${company.id}`;
    case 'security':
      return `/security-firm/${company.id}`;
    case 'factory':
      return `/merch-factory/${company.id}`;
    case 'logistics':
      return `/logistics/${company.id}`;
    default:
      return `/company/${company.id}`;
  }
};
```

### Phase 5: Add Recording Studio Type

Currently missing from company types - add `recording_studio` as a company type option:

**File: `src/types/company.ts`**

```typescript
export type CompanyType = 'holding' | 'label' | 'security' | 'factory' | 'logistics' | 'venue' | 'rehearsal' | 'recording_studio';

// Add to COMPANY_CREATION_COSTS
recording_studio: { creationCost: 400_000, startingBalance: 600_000 },

// Add to COMPANY_TYPE_INFO
recording_studio: {
  label: 'Recording Studio',
  icon: 'Mic2',
  description: 'Professional recording facilities for music production',
  color: 'text-rose-500',
},
```

And update the trigger to handle it:
```sql
ELSIF NEW.company_type = 'recording_studio' THEN
  INSERT INTO recording_studios (company_id, name, city_id, hourly_rate, quality_rating, capacity)
  VALUES (NEW.id, NEW.name, NEW.headquarters_city_id, 200, 50, 1);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/company.ts` | Update costs, add recording_studio type |
| `supabase/migrations/xxx_expand_subsidiary_trigger.sql` | New migration for trigger + venues.company_id |
| `src/components/company/CompanyCard.tsx` | Add smart management routing |
| `src/components/company/CreateSubsidiaryDialog.tsx` | Ensure all types available |
| `src/components/VersionHeader.tsx` | Update to v1.0.504 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

---

## Technical Details

### Specialized Tables & Required Fields

| Company Type | Target Table | Key Fields |
|--------------|--------------|------------|
| label | labels | name, headquarters_city, balance, reputation_score, is_subsidiary, company_id |
| venue | venues | name, city, capacity, base_payment, venue_type, prestige_level, company_id |
| rehearsal | rehearsal_rooms | name, city_id, hourly_rate, daily_rate, capacity, quality_rating, company_id |
| recording_studio | recording_studios | name, city_id, hourly_rate, quality_rating, capacity, company_id |
| security | security_firms | name, city_id, reputation, license_tier, company_id |
| factory | merch_factories | name, city_id, production_capacity, quality_rating, company_id |
| logistics | logistics_companies | name, city_id, fleet_size, license_tier, company_id |

### Default Starting Values

All subsidiaries start with:
- **Reputation/Quality**: 50 (out of 100)
- **License Tier**: 1 (basic)
- **Capacity**: Type-appropriate defaults
- **Rates**: Market-standard starting rates

---

## Version History Entry

**v1.0.504**
- Companies: Fixed subsidiary creation - all types (labels, venues, rehearsal studios, recording studios) now properly create their specialized business records
- Companies: Aligned creation costs with realistic values ($1M for labels, $750K for venues, etc.)
- Companies: Added Recording Studio as a new subsidiary type
- Companies: Added smart navigation to route subsidiaries to their management pages
- Companies: Added company_id column to venues table for proper ownership tracking

