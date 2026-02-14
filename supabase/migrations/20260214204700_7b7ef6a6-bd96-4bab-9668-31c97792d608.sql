
-- Step 1: Normalize all retail prices to standard defaults (in cents)
UPDATE release_formats SET retail_price = 999 WHERE format_type = 'digital' AND retail_price != 999;
UPDATE release_formats SET retail_price = 1499 WHERE format_type = 'cd' AND retail_price != 1499;
UPDATE release_formats SET retail_price = 2999 WHERE format_type = 'vinyl' AND retail_price != 2999;
UPDATE release_formats SET retail_price = 1299 WHERE format_type = 'cassette' AND retail_price != 1299;
UPDATE release_formats SET retail_price = 0 WHERE format_type = 'streaming' AND retail_price != 0;

-- Step 2: Recalculate total_amount in release_sales based on corrected prices
UPDATE release_sales rs
SET total_amount = rs.quantity_sold * rf.retail_price
FROM release_formats rf
WHERE rs.release_format_id = rf.id;

-- Step 3: Recalculate total_revenue on releases
UPDATE releases r
SET total_revenue = COALESCE(sub.rev, 0)
FROM (
  SELECT rf.release_id, SUM(rs.total_amount) as rev
  FROM release_sales rs
  JOIN release_formats rf ON rf.id = rs.release_format_id
  GROUP BY rf.release_id
) sub
WHERE r.id = sub.release_id;
