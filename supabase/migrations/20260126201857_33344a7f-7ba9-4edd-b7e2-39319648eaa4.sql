-- Create a function to safely decrement merch stock
CREATE OR REPLACE FUNCTION decrement_merch_stock(merch_id UUID, amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE player_merchandise 
  SET stock_quantity = GREATEST(0, stock_quantity - amount)
  WHERE id = merch_id;
END;
$$;