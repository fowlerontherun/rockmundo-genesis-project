
# Company & Subsidiary System and Record Labels - Review and Fixes

## Version: 1.0.541

---

## Executive Summary

The company/subsidiary system and record labels have several interconnected issues preventing them from working correctly. The core problems are:

1. **Trigger Schema Mismatch**: The database trigger that auto-creates subsidiary entities uses wrong column names
2. **Missing owner_id on Subsidiary Labels**: Labels created via company trigger don't have owner_id set, making them invisible in "My Labels"
3. **Recording Studios Table Missing**: The trigger references a non-existent `recording_studios` table
4. **Venues Table Column Mismatch**: Missing `city` column (uses `location` instead)
5. **Rehearsal Rooms Column Mismatch**: Missing `daily_rate` column
6. **No navigation from Company Labels to Management**: Labels created as subsidiaries can't be managed

---

## Detailed Problem Analysis

### Issue 1: Trigger Function Schema Mismatch

The `create_subsidiary_entity()` trigger function in the database uses column names that don't match the actual table schemas:

| Entity Type | Trigger Uses | Actual Columns |
|-------------|--------------|----------------|
| **security_firms** | `city_id`, `license_tier` | NO `city_id`, uses `license_level` |
| **merch_factories** | `production_capacity`, `quality_rating` | Uses `quality_level`, not `quality_rating` |
| **logistics_companies** | `city_id`, `fleet_size` | NO `city_id`, uses `fleet_capacity` |
| **labels** | `is_subsidiary: true` but NO `owner_id` | Need to inherit owner from company |
| **venues** | `city` column | Uses `location`, has no `city` text column |
| **rehearsal_rooms** | `daily_rate` | Column doesn't exist |
| **recording_studios** | Entire table | Table doesn't exist - should use `city_studios` |

**Result**: All subsidiary creations silently fail, causing companies to be created without their associated business entities.

### Issue 2: Labels Created as Subsidiaries Have No Owner

When a company of type `label` is created, the trigger creates a label in the `labels` table but sets:
- `owner_id: NULL` 
- `is_subsidiary: true`
- `company_id: {company.id}`

However, the `MyLabelsTab` component queries:
```sql
SELECT * FROM labels WHERE owner_id = profile.id
```

This means subsidiary labels are invisible to the owner because `owner_id` is null.

### Issue 3: Dual Label Creation Paths

There are two ways to create labels:
1. **Via Record Label page** (`CreateLabelDialog.tsx`) - Creates label directly with `owner_id`
2. **Via Company system** (`CreateCompanyDialog.tsx`) - Creates company → trigger creates label without `owner_id`

These paths are disconnected and create inconsistent data.

### Issue 4: Missing Management Routes

The `CompanyCard.tsx` routes label companies to `/labels` instead of a specific label management page. This means:
- User creates "label" company subsidiary
- Clicks "Manage" button
- Goes to generic Record Label hub, not the specific label they created
- Can't find their subsidiary label (because `owner_id` is null)

---

## Solution Plan

### Part 1: Fix Database Trigger Function

Update `create_subsidiary_entity()` to use correct column names for all entity types:

```sql
CREATE OR REPLACE FUNCTION public.create_subsidiary_entity()
RETURNS TRIGGER AS $$
DECLARE
  v_city_name TEXT;
  v_profile_id UUID;
BEGIN
  -- Get city name
  SELECT name INTO v_city_name FROM cities WHERE id = NEW.headquarters_city_id;
  
  -- Get owner's profile_id from companies.owner_id (which is user_id)
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = NEW.owner_id;
  
  -- Security Firm (fixed columns)
  IF NEW.company_type = 'security' THEN
    INSERT INTO security_firms (company_id, name, license_level, equipment_quality, reputation, max_guards)
    VALUES (NEW.id, NEW.name, 1, 1, 50, 10);
  
  -- Merch Factory (fixed columns)
  ELSIF NEW.company_type = 'factory' THEN
    INSERT INTO merch_factories (company_id, name, city_id, factory_type, quality_level, production_capacity, worker_count, operating_costs_daily)
    VALUES (NEW.id, NEW.name, NEW.headquarters_city_id, 'apparel', 1, 100, 5, 500);
  
  -- Logistics Company (fixed columns - no city_id)
  ELSIF NEW.company_type = 'logistics' THEN
    INSERT INTO logistics_companies (company_id, name, license_tier, fleet_capacity, reputation)
    VALUES (NEW.id, NEW.name, 1, 5, 50);
  
  -- Record Label (CRITICAL: set owner_id from company owner)
  ELSIF NEW.company_type = 'label' THEN
    INSERT INTO labels (company_id, name, headquarters_city, balance, reputation_score, is_subsidiary, owner_id)
    VALUES (NEW.id, NEW.name, COALESCE(v_city_name, 'Unknown'), NEW.balance, 50, true, v_profile_id);
  
  -- Venue (fixed: use location not city)
  ELSIF NEW.company_type = 'venue' THEN
    INSERT INTO venues (name, location, city_id, capacity, base_payment, venue_type, prestige_level)
    VALUES (NEW.name, COALESCE(v_city_name, 'Unknown'), NEW.headquarters_city_id, 500, 5000, 'club', 1);
  
  -- Rehearsal Studio (fixed: use rehearsal_rooms with correct columns)
  ELSIF NEW.company_type = 'rehearsal' THEN
    INSERT INTO rehearsal_rooms (company_id, name, city_id, hourly_rate, capacity, quality_rating)
    VALUES (NEW.id, NEW.name, NEW.headquarters_city_id, 50, 4, 50);
  
  -- Recording Studio (fixed: use city_studios table)
  ELSIF NEW.company_type = 'recording_studio' THEN
    INSERT INTO city_studios (company_id, name, city_id, hourly_rate, quality_rating, is_company_owned)
    VALUES (NEW.id, NEW.name, NEW.headquarters_city_id, 200, 50, true);
  
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Subsidiary entity creation failed for %: %', NEW.company_type, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### Part 2: Fix Existing Orphaned Subsidiary Labels

Update labels that have `company_id` but no `owner_id`:

```sql
UPDATE labels l
SET owner_id = p.id
FROM companies c
JOIN profiles p ON p.user_id = c.owner_id
WHERE l.company_id = c.id
AND l.owner_id IS NULL;
```

### Part 3: Create Missing Subsidiary Entities

For existing companies that should have subsidiary entities but don't:

```sql
-- Create missing security_firms
INSERT INTO security_firms (company_id, name, license_level, equipment_quality, reputation, max_guards)
SELECT c.id, c.name, 1, 1, 50, 10
FROM companies c
LEFT JOIN security_firms sf ON sf.company_id = c.id
WHERE c.company_type = 'security' AND sf.id IS NULL;

-- Create missing merch_factories
INSERT INTO merch_factories (company_id, name, city_id, factory_type, quality_level, production_capacity, worker_count, operating_costs_daily)
SELECT c.id, c.name, c.headquarters_city_id, 'apparel', 1, 100, 5, 500
FROM companies c
LEFT JOIN merch_factories mf ON mf.company_id = c.id
WHERE c.company_type = 'factory' AND mf.id IS NULL;

-- Create missing logistics_companies
INSERT INTO logistics_companies (company_id, name, license_tier, fleet_capacity, reputation)
SELECT c.id, c.name, 1, 5, 50
FROM companies c
LEFT JOIN logistics_companies lc ON lc.company_id = c.id
WHERE c.company_type = 'logistics' AND lc.id IS NULL;
```

### Part 4: Update CompanyCard Navigation for Labels

Modify `src/components/company/CompanyCard.tsx` to navigate to the actual label management:

```typescript
const getManageRoute = (company: Company): string => {
  switch (company.company_type) {
    case 'label':
      // Navigate to label finance/management using company_id to find the label
      return `/record-label/manage/${company.id}`;
    // ... rest stays the same
  }
};
```

### Part 5: Add Label Management Route

Create a new page or modify existing to handle company-owned labels:

**Option A**: Modify `MyLabelsTab` to also show labels where the user owns the parent company
**Option B**: Create a dedicated route `/record-label/manage/:companyId` 

The simpler fix is Option A:

```typescript
// In MyLabelsTab.tsx - modify query
const { data: myLabels = [] } = useQuery({
  queryKey: ["my-labels", user?.id],
  enabled: !!user?.id,
  queryFn: async () => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, user_id")
      .eq("user_id", user!.id)
      .single();

    if (!profile) return [];

    // Get labels where:
    // 1. owner_id = profile.id (directly owned)
    // 2. OR company.owner_id = user_id (owned via company)
    const { data, error } = await supabase
      .from("labels")
      .select(`
        id, name, logo_url, balance, is_bankrupt, balance_went_negative_at,
        headquarters_city, reputation_score, roster_slot_capacity,
        artist_label_contracts(id, status),
        companies!labels_company_id_fkey(owner_id)
      `)
      .or(`owner_id.eq.${profile.id},companies.owner_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  },
});
```

### Part 6: Update CreateCompanyDialog Schema Validation

Add `recording_studio` to the allowed company types in the Zod schema:

```typescript
company_type: z.enum(['holding', 'label', 'security', 'factory', 'venue', 'rehearsal', 'logistics', 'recording_studio']),
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/xxx_fix_subsidiary_trigger.sql` | Fix trigger function and create missing entities |
| `src/components/company/CompanyCard.tsx` | Update label navigation route |
| `src/components/labels/MyLabelsTab.tsx` | Query labels by direct ownership OR company ownership |
| `src/components/company/CreateCompanyDialog.tsx` | Add `recording_studio` to schema |
| `src/types/company.ts` | Already has `recording_studio` - verify consistency |
| `src/components/VersionHeader.tsx` | Bump to v1.0.541 |
| `src/pages/VersionHistory.tsx` | Add changelog entry |

---

## Technical Details: Database Migration

```sql
-- 1. Fix the trigger function (corrected column names)
-- 2. Fix existing orphaned labels (set owner_id from company)
-- 3. Create missing security_firms for existing security companies
-- 4. Create missing merch_factories for existing factory companies  
-- 5. Create missing logistics_companies for existing logistics companies
-- 6. Update any venues/rehearsal_rooms that need company_id connections
```

---

## Testing Verification

After implementation, verify:

1. **Create a new "security" company** → Check `security_firms` table has matching entry
2. **Create a new "factory" company** → Check `merch_factories` table has matching entry
3. **Create a new "label" company** → Check `labels` table has entry WITH `owner_id` set
4. **Go to My Labels tab** → Should see subsidiary labels
5. **Click "Manage" on label company card** → Should navigate to correct label management
6. **Existing subsidiary labels** → Should now appear in My Labels tab

---

## Changelog Entry

**Version 1.0.541**
- Companies: Fixed subsidiary entity creation trigger (security firms, factories, logistics, labels, venues, studios now properly created)
- Companies: Labels created as subsidiaries now correctly inherit owner_id from parent company
- Companies: Fixed navigation from company cards to label management
- Companies: Created missing subsidiary entities for existing companies
- Record Labels: My Labels tab now shows both directly owned and company-owned labels
