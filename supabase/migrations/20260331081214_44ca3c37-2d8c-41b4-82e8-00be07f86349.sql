
-- Auto-verification function: verifies twaater accounts based on fame criteria
-- Criteria: fame_score >= 10000, OR linked to a band with award wins, OR charting artist
CREATE OR REPLACE FUNCTION public.auto_verify_twaater_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify accounts with fame_score >= 10000
  UPDATE twaater_accounts
  SET verified = true, updated_at = now()
  WHERE verified IS NOT true
    AND fame_score >= 10000;

  -- Verify persona accounts whose owner has an award win
  UPDATE twaater_accounts ta
  SET verified = true, updated_at = now()
  FROM profiles p
  JOIN band_members bm ON bm.user_id = p.user_id
  JOIN award_wins aw ON aw.band_id = bm.band_id
  WHERE ta.owner_type = 'persona'
    AND ta.owner_id = p.id
    AND ta.verified IS NOT true;

  -- Verify band accounts that have award wins
  UPDATE twaater_accounts ta
  SET verified = true, updated_at = now()
  FROM award_wins aw
  WHERE ta.owner_type = 'band'
    AND ta.owner_id = aw.band_id
    AND ta.verified IS NOT true;

  -- Verify accounts linked to bands with charting songs (top 100)
  UPDATE twaater_accounts ta
  SET verified = true, updated_at = now()
  FROM chart_singles cs
  WHERE ta.owner_type = 'band'
    AND ta.owner_id = cs.band_id
    AND cs.position <= 100
    AND ta.verified IS NOT true;
END;
$$;
