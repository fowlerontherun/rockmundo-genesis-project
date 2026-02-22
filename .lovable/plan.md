
# Fix Record Contract Accept/Reject + Seed NPC Label Offers (v1.0.852)

## Problem Identified

Two root causes were found:

1. **RLS Policy Mismatch**: The update policy for `artist_label_contracts` checks `band_members.role = 'leader'`, but your band member role is stored as `'Founder'`. This means the accept/reject/counter mutations silently fail due to Row Level Security denying the update.

2. **No NPC Label Offers**: The band only has offers from your own label ("Fowler Record"). There are no other NPC labels making offers, so the user sees no competing offers to compare against.

## Plan

### Step 1: Fix the RLS Update Policy
Update the RLS policy "Artists can update their own contract offers" to accept both `'leader'` and `'Founder'` roles (and any leadership-equivalent role like `'founder'`), making the accept/reject/counter buttons functional.

```sql
-- Drop and recreate the policy with inclusive role check
DROP POLICY "Artists can update their own contract offers" ON artist_label_contracts;
CREATE POLICY "Artists can update their own contract offers" ON artist_label_contracts
  FOR UPDATE USING (
    artist_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR band_id IN (
      SELECT band_id FROM band_members
      WHERE user_id = auth.uid()
      AND role IN ('leader', 'Founder', 'founder', 'co-leader')
    )
  );
```

### Step 2: Seed NPC Label Offers
Insert 3-4 contract offers from existing NPC labels in the database for the band "Fowler and the Growlers", giving the player competing deals to evaluate:
- A low-advance / high-royalty indie label offer
- A high-advance / low-royalty major label offer
- A balanced mid-tier offer
- Each with different term lengths, quotas, and territories

### Step 3: Update Version
Bump version to `1.0.852` in `VersionHeader.tsx` and add a changelog entry in `VersionHistory.tsx` documenting the RLS fix and NPC offer seeding.

## Technical Details

- The existing `ContractOfferCard` component already has full accept/reject/counter-offer UI with the three-strike negotiation loop -- it just needs the RLS fix to allow mutations
- NPC offers will be inserted with `status: 'offered'`, `last_action_by: 'label'`, and `demo_submission_id: null` (the card handles null demos gracefully, showing "Demo" as fallback title)
- The `MyContractsTab` query filters for `status IN ('offered', 'negotiating')` and `last_action_by = 'label'`, so new offers will appear immediately
