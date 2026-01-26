-- Add sales tax and VAT columns to merch_orders
ALTER TABLE merch_orders 
  ADD COLUMN IF NOT EXISTS sales_tax NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_revenue NUMERIC DEFAULT 0;

-- Add comments explaining the columns
COMMENT ON COLUMN merch_orders.sales_tax IS 'Sales tax amount (US states typically 5-10%)';
COMMENT ON COLUMN merch_orders.vat IS 'VAT amount (EU countries typically 15-25%)';
COMMENT ON COLUMN merch_orders.net_revenue IS 'Revenue after taxes (amount that goes to band)';