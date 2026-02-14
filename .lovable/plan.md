

# Company System Bug Fixes & Expansion -- v1.0.696

## Root Cause Analysis

### Bug 1: Label Staff Hiring / Firing Fails (RLS Mismatch)
The `label_staff`, `label_financial_transactions`, and `label_distribution_deals` tables all have RLS policies that check `labels.owner_id = auth.uid()`. However, `labels.owner_id` stores **profile IDs** (not auth user IDs). Since `auth.uid()` returns the auth user ID, this comparison never matches, silently blocking all INSERT/UPDATE/DELETE operations on these tables.

### Bug 2: Contract Offers for Bands Fail (RLS Mismatch)
The `artist_label_contracts` INSERT policy checks `labels.created_by = auth.uid()`. This works when `created_by` is set, but for labels created via company transfer or where `created_by` was never populated, it is NULL -- blocking contract creation entirely.

### Bug 3: Venue/Studio Upgrades & Staff (Likely Working)
Venue and recording studio RLS chains through `companies.owner_id = auth.uid()`, and `companies.owner_id` correctly stores auth user IDs. If users report issues here, it may be a UI-side problem rather than RLS. However, the `FOR ALL` + `FOR SELECT` policy duplication is redundant and could cause confusion -- these will be cleaned up.

## Fix Strategy

All fixes are RLS policy corrections in a single migration. The policies need to resolve `auth.uid()` through the `profiles` table to match `labels.owner_id` (which stores profile IDs), OR alternatively match on `labels.created_by` (which stores auth user IDs).

The safest approach: update all label-related policies to check **both** `owner_id` via profile lookup AND `created_by` directly, using an OR condition.

---

## Changes

### Database Migration (single file)

1. **Fix `label_staff` RLS**: Drop and recreate the `FOR ALL` policy to check either `l.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())` OR `l.created_by = auth.uid()`.

2. **Fix `label_financial_transactions` RLS**: Same pattern as above.

3. **Fix `label_distribution_deals` RLS**: Same pattern as above.

4. **Fix `artist_label_contracts` INSERT policy**: Update `WITH CHECK` to also match `labels.owner_id` via profile lookup, not just `labels.created_by`.

5. **Fix `artist_label_contracts` SELECT policy**: Add the profile-based ownership check as an additional OR condition so label owners who only have `owner_id` set can still see contracts.

6. **Fix `artist_label_contracts` UPDATE policy** ("Label owners can update"): Same profile lookup fix.

### Version Update

- `src/components/VersionHeader.tsx` -- bump to 1.0.696
- `src/pages/VersionHistory.tsx` -- add changelog entry

---

## Technical Details

### Policy Fix Pattern

All label-related RLS policies currently do:
```text
EXISTS (SELECT 1 FROM labels l WHERE l.id = table.label_id AND l.owner_id = auth.uid())
```

They need to become:
```text
EXISTS (
  SELECT 1 FROM labels l
  WHERE l.id = table.label_id
  AND (
    l.created_by = auth.uid()
    OR l.owner_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
  )
)
```

### Tables Affected
- `label_staff` (SELECT + ALL policies)
- `label_financial_transactions` (SELECT + ALL policies)
- `label_distribution_deals` (SELECT + ALL policies)
- `artist_label_contracts` (INSERT with_check, SELECT qual, UPDATE qual for label-owner policies)

### Files Modified
- New migration SQL file (RLS policy fixes)
- `src/components/VersionHeader.tsx`
- `src/pages/VersionHistory.tsx`

