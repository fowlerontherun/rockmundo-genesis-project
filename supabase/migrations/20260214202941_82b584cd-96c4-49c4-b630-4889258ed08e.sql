
-- 1. Normalize retail_prices to cents: prices <= 100 are in dollars, convert to cents
UPDATE release_formats SET retail_price = retail_price * 100 WHERE retail_price > 0 AND retail_price <= 100;

-- 2. Wipe all inflated release_sales data
DELETE FROM release_sales;

-- 3. Reset all release revenue/unit counters
UPDATE releases SET 
  total_revenue = 0,
  total_units_sold = 0,
  digital_sales = 0,
  cd_sales = 0,
  vinyl_sales = 0,
  cassette_sales = 0;

-- 4. Delete inflated band_earnings from release_sales
DELETE FROM band_earnings WHERE source = 'release_sales';

-- 5. Update fame_multiplier_divisor to use log-based scaling (set high so edge function uses new formula)
UPDATE game_balance_config SET value = 1000000 WHERE key = 'fame_multiplier_divisor';
