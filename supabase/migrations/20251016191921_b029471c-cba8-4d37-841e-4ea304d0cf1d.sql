-- Sync band_balance with band_earnings total
-- First, update all existing band balances to match their earnings
UPDATE bands
SET band_balance = COALESCE((
  SELECT SUM(amount)
  FROM band_earnings
  WHERE band_earnings.band_id = bands.id
), 0);

-- Create function to update band balance when earnings change
CREATE OR REPLACE FUNCTION update_band_balance_from_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the band's balance by summing all earnings
  UPDATE bands
  SET band_balance = COALESCE((
    SELECT SUM(amount)
    FROM band_earnings
    WHERE band_id = COALESCE(NEW.band_id, OLD.band_id)
  ), 0)
  WHERE id = COALESCE(NEW.band_id, OLD.band_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for INSERT
CREATE TRIGGER update_band_balance_on_earnings_insert
AFTER INSERT ON band_earnings
FOR EACH ROW
EXECUTE FUNCTION update_band_balance_from_earnings();

-- Create trigger for UPDATE
CREATE TRIGGER update_band_balance_on_earnings_update
AFTER UPDATE ON band_earnings
FOR EACH ROW
EXECUTE FUNCTION update_band_balance_from_earnings();

-- Create trigger for DELETE
CREATE TRIGGER update_band_balance_on_earnings_delete
AFTER DELETE ON band_earnings
FOR EACH ROW
EXECUTE FUNCTION update_band_balance_from_earnings();