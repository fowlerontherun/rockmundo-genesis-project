
-- ================================================================
-- Fix label-related RLS policies: owner_id stores profile IDs,
-- not auth user IDs. Add profile lookup + created_by fallback.
-- ================================================================

-- ==================== label_staff ====================
DROP POLICY IF EXISTS "Label owners can manage staff" ON label_staff;
DROP POLICY IF EXISTS "Label owners can view staff" ON label_staff;

CREATE POLICY "Label owners can manage staff"
ON label_staff FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM labels l
    WHERE l.id = label_staff.label_id
    AND (
      l.created_by = auth.uid()
      OR l.owner_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM labels l
    WHERE l.id = label_staff.label_id
    AND (
      l.created_by = auth.uid()
      OR l.owner_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
    )
  )
);

CREATE POLICY "Label owners can view staff"
ON label_staff FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM labels l
    WHERE l.id = label_staff.label_id
    AND (
      l.created_by = auth.uid()
      OR l.owner_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
    )
  )
);

-- ==================== label_financial_transactions ====================
DROP POLICY IF EXISTS "Label owners can manage transactions" ON label_financial_transactions;
DROP POLICY IF EXISTS "Label owners can view transactions" ON label_financial_transactions;

CREATE POLICY "Label owners can manage transactions"
ON label_financial_transactions FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM labels l
    WHERE l.id = label_financial_transactions.label_id
    AND (
      l.created_by = auth.uid()
      OR l.owner_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM labels l
    WHERE l.id = label_financial_transactions.label_id
    AND (
      l.created_by = auth.uid()
      OR l.owner_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
    )
  )
);

CREATE POLICY "Label owners can view transactions"
ON label_financial_transactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM labels l
    WHERE l.id = label_financial_transactions.label_id
    AND (
      l.created_by = auth.uid()
      OR l.owner_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
    )
  )
);

-- ==================== label_distribution_deals ====================
DROP POLICY IF EXISTS "Label owners can manage distribution deals" ON label_distribution_deals;
DROP POLICY IF EXISTS "Label owners can view distribution deals" ON label_distribution_deals;

CREATE POLICY "Label owners can manage distribution deals"
ON label_distribution_deals FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM labels l
    WHERE l.id = label_distribution_deals.label_id
    AND (
      l.created_by = auth.uid()
      OR l.owner_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM labels l
    WHERE l.id = label_distribution_deals.label_id
    AND (
      l.created_by = auth.uid()
      OR l.owner_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
    )
  )
);

CREATE POLICY "Label owners can view distribution deals"
ON label_distribution_deals FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM labels l
    WHERE l.id = label_distribution_deals.label_id
    AND (
      l.created_by = auth.uid()
      OR l.owner_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
    )
  )
);

-- ==================== artist_label_contracts ====================
DROP POLICY IF EXISTS "Label owners can create contracts" ON artist_label_contracts;
DROP POLICY IF EXISTS "Contracts are viewable by involved parties" ON artist_label_contracts;
DROP POLICY IF EXISTS "Label owners can update their contracts" ON artist_label_contracts;

CREATE POLICY "Label owners can create contracts"
ON artist_label_contracts FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM labels l
    WHERE l.id = artist_label_contracts.label_id
    AND (
      l.created_by = auth.uid()
      OR l.owner_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
    )
  )
);

CREATE POLICY "Contracts are viewable by involved parties"
ON artist_label_contracts FOR SELECT
TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM labels l
    WHERE l.id = artist_label_contracts.label_id
    AND (
      l.created_by = auth.uid()
      OR l.owner_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
    )
  ))
  OR (EXISTS (
    SELECT 1 FROM bands
    WHERE bands.id = artist_label_contracts.band_id
    AND bands.leader_id = auth.uid()
  ))
  OR (artist_profile_id IN (
    SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
  ))
);

CREATE POLICY "Label owners can update their contracts"
ON artist_label_contracts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM labels l
    WHERE l.id = artist_label_contracts.label_id
    AND (
      l.created_by = auth.uid()
      OR l.owner_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
    )
  )
);
