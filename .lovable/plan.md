
# Plan: Fix Company Subsidiary Management Navigation and Data Loading

## Problem Summary

Three critical issues prevent VIP users from managing their company subsidiaries:

1. **Record Label (404 Error)**: The "Manage" button navigates to `/record-label/manage/:companyId` which doesn't exist as a route
2. **Logistics Company (Nothing loads)**: Query hook is called without required parameter, causing it to be disabled  
3. **Rehearsal Studio (Nothing loads)**: Query looks up by wrong ID - uses company ID instead of looking up by company_id foreign key

---

## Root Cause Analysis

### Issue 1: Labels Route
```text
CompanyCard.tsx navigation:
  case 'label': return `/record-label/manage/${company.id}`

Available routes in App.tsx:
  - /labels (RecordLabel page with tabs)
  - No /record-label/manage/:id route exists
```

The `companies` table contains entries with `company_type: 'label'`, but the actual label data lives in the `labels` table with a `company_id` foreign key pointing to the company.

### Issue 2: Logistics Query Disabled
```typescript
// LogisticsCompanyManagement.tsx
const { data: companies } = useLogisticsCompanies(); // No parameter passed

// useLogisticsBusiness.ts  
export function useLogisticsCompanies(companyId?: string) {
  return useQuery({
    // ...
    enabled: !!companyId  // FALSE when no companyId = query never runs
  });
}
```

### Issue 3: Rehearsal Room ID Mismatch
```text
Database structure:
- companies table: id = 'd17da751...' (company_type: 'rehearsal')
- rehearsal_rooms table: id = '179e890d...', company_id = 'd17da751...'

Current query in useRehearsalStudio:
  .eq('id', studioId)  // Looks for rehearsal_rooms.id = company.id = FAILS

Should query:
  .or(`id.eq.${studioId},company_id.eq.${studioId}`)
```

---

## Solution

### Fix 1: Labels - Create Dedicated Management Page or Fix Navigation

**Option A (Recommended)**: Create a dedicated label management page at `/labels/:labelId/manage`

**Option B**: Change navigation to use the labels table ID and navigate to `/labels` with pre-selected label

We'll implement **Option A** for consistency with other subsidiary types.

**Files to modify/create:**
- Create `src/pages/LabelManagement.tsx` - Dedicated label management page
- Update `src/App.tsx` - Add route `/labels/:labelId/manage`
- Update `src/components/company/CompanyCard.tsx` - Fix navigation to lookup the labels table ID first, or navigate to a page that handles the lookup

### Fix 2: Logistics - Dual Lookup Pattern

Update the `LogisticsCompanyManagement` page to implement the same dual-lookup pattern documented in memory (matching other subsidiaries):

```typescript
// Try to fetch by direct ID first, then by company_id
const { data: companies } = useLogisticsCompaniesWithDualLookup(companyId);
```

**Files to modify:**
- `src/hooks/useLogisticsBusiness.ts` - Add new hook or modify existing to support dual lookup
- `src/pages/LogisticsCompanyManagement.tsx` - Use the corrected query pattern

### Fix 3: Rehearsal Studio - Dual Lookup Pattern

Update the `useRehearsalStudio` hook to check both the `id` column and the `company_id` column:

```typescript
// Try by ID first, then by company_id
const { data: directMatch } = await supabase
  .from('rehearsal_rooms')
  .select('*')
  .or(`id.eq.${studioId},company_id.eq.${studioId}`)
  .limit(1)
  .single();
```

**Files to modify:**
- `src/hooks/useRehearsalStudioBusiness.ts` - Update `useRehearsalStudio` hook

---

## Implementation Details

### Step 1: Fix Rehearsal Studio Hook

Update `useRehearsalStudio` to use `OR` condition for dual lookup:

```typescript
export function useRehearsalStudio(studioId: string | undefined) {
  return useQuery({
    queryKey: ['rehearsal-studio', studioId],
    queryFn: async () => {
      if (!studioId) return null;
      
      const { data, error } = await supabase
        .from('rehearsal_rooms')
        .select(`*,
          cities:city_id(name, country),
          city_districts:district_id(name),
          companies:company_id(name)
        `)
        .or(`id.eq.${studioId},company_id.eq.${studioId}`)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as RehearsalStudioBusiness;
    },
    enabled: !!studioId,
  });
}
```

### Step 2: Fix Logistics Hook

Add a new query that fetches all logistics companies without requiring a companyId filter, OR modify the existing hook to support fetching by the logistics company's own ID:

```typescript
export function useLogisticsCompanyById(idOrCompanyId?: string) {
  return useQuery({
    queryKey: ["logistics-company", idOrCompanyId],
    queryFn: async () => {
      if (!idOrCompanyId) return null;
      
      const { data, error } = await supabase
        .from("logistics_companies")
        .select("*")
        .or(`id.eq.${idOrCompanyId},company_id.eq.${idOrCompanyId}`)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as LogisticsCompany;
    },
    enabled: !!idOrCompanyId,
  });
}
```

Then update `LogisticsCompanyManagement.tsx` to use this new hook.

### Step 3: Fix Label Navigation

**Option A - Recommended**: Create a wrapper component that handles the lookup

The `CompanyCard` will navigate to `/labels/:companyId/manage`. This page will:
1. Take the `companyId` from URL params
2. Query the `labels` table for `company_id = companyId`
3. Display full label management functionality

**Files:**
- Create `src/pages/LabelManagement.tsx`
- Add route in `src/App.tsx`: `<Route path="labels/:labelId/manage" element={<LabelManagement />} />`
- Update `CompanyCard.tsx` navigation: `case 'label': return `/labels/${company.id}/manage``

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useRehearsalStudioBusiness.ts` | Modify | Dual lookup by id OR company_id |
| `src/hooks/useLogisticsBusiness.ts` | Modify | Add new hook for single company lookup |
| `src/pages/LogisticsCompanyManagement.tsx` | Modify | Use new single-company hook |
| `src/pages/LabelManagement.tsx` | Create | Dedicated label management page |
| `src/App.tsx` | Modify | Add label management route |
| `src/components/company/CompanyCard.tsx` | Modify | Fix label navigation path |
| `src/components/VersionHeader.tsx` | Modify | Version bump |
| `src/pages/VersionHistory.tsx` | Modify | Add changelog entry |

---

## Testing Checklist

After implementation, verify:

- [ ] Clicking "Manage" on a Rehearsal Studio company navigates and loads the studio data
- [ ] Clicking "Manage" on a Logistics company navigates and loads the company data  
- [ ] Clicking "Manage" on a Label company navigates and loads label management
- [ ] All subsidiary management pages show correct stats and tabs
- [ ] Going back from management pages returns to company list

---

## Technical Notes

The key insight is that when a subsidiary company is created through the company system:
- A record is created in `companies` table (e.g., `id: 'd17da751...'`, `company_type: 'rehearsal'`)
- A database trigger creates a corresponding record in the entity table (e.g., `rehearsal_rooms.id: '179e890d...'`, `rehearsal_rooms.company_id: 'd17da751...'`)

The navigation uses the `companies.id`, but the entity tables have their own primary `id`. The solution is to always query entities using `OR(id, company_id)` to handle both access patterns.

**Version**: 1.0.595
