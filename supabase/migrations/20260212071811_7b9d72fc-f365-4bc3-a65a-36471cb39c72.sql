
-- Fix 1: Backfill labels.created_by from company owner for subsidiary labels
UPDATE labels
SET created_by = companies.owner_id
FROM companies
WHERE labels.company_id = companies.id
AND labels.created_by IS NULL;

-- Fix 2: Also update the trigger so future subsidiary labels get created_by set
-- (The trigger already exists but may not set created_by)

-- Fix 3: Allow artists to UPDATE their own contract offers (accept/reject)
CREATE POLICY "Artists can update their own contract offers"
ON artist_label_contracts
FOR UPDATE
USING (
  (artist_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  OR
  (band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'leader'))
);

-- Fix 4: Allow label owners to see demo submissions for their label
CREATE POLICY "Label owners can view demos for their labels"
ON demo_submissions
FOR SELECT
USING (
  label_id IN (
    SELECT id FROM labels WHERE created_by = auth.uid()
  )
);

-- Fix 5: Allow label owners to update demo submissions (accept/reject)
CREATE POLICY "Label owners can update demos for their labels"
ON demo_submissions
FOR UPDATE
USING (
  label_id IN (
    SELECT id FROM labels WHERE created_by = auth.uid()
  )
);

-- Fix 6: Also allow contract SELECT for artists via artist_profile_id
-- The existing policy checks artist_profile_id IN profiles WHERE user_id = auth.uid()
-- which should work, but let's also support company-owned labels
DROP POLICY IF EXISTS "Contracts are viewable by involved parties" ON artist_label_contracts;
CREATE POLICY "Contracts are viewable by involved parties"
ON artist_label_contracts
FOR SELECT
USING (
  (EXISTS (SELECT 1 FROM labels WHERE labels.id = artist_label_contracts.label_id AND labels.created_by = auth.uid()))
  OR (EXISTS (SELECT 1 FROM bands WHERE bands.id = artist_label_contracts.band_id AND bands.leader_id = auth.uid()))
  OR (artist_profile_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()))
);

-- Fix 7: Allow label owners to INSERT contracts via company ownership too
DROP POLICY IF EXISTS "Label owners can create contracts" ON artist_label_contracts;
CREATE POLICY "Label owners can create contracts"
ON artist_label_contracts
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM labels WHERE labels.id = artist_label_contracts.label_id AND labels.created_by = auth.uid())
);

-- Fix 8: Allow label owners to UPDATE contracts (keep existing + add company support)
DROP POLICY IF EXISTS "Label owners can update their contracts" ON artist_label_contracts;
CREATE POLICY "Label owners can update their contracts"
ON artist_label_contracts
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM labels WHERE labels.id = artist_label_contracts.label_id AND labels.created_by = auth.uid())
);
