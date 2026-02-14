
-- Estimate historical sales: multiply current sales by days_active
-- This ONLY updates release_sales, release unit counters, and release revenue
-- It does NOT add money to profiles.cash or band_earnings

-- Step 1: Scale up release_sales quantity and recalc total_amount
UPDATE release_sales rs
SET 
  quantity_sold = rs.quantity_sold * GREATEST(EXTRACT(DAY FROM now() - r.created_at)::int, 1),
  total_amount = (rs.quantity_sold * GREATEST(EXTRACT(DAY FROM now() - r.created_at)::int, 1)) * rf.retail_price
FROM release_formats rf
JOIN releases r ON r.id = rf.release_id
WHERE rs.release_format_id = rf.id;

-- Step 2: Recalculate per-format unit counters on releases
UPDATE releases r
SET 
  digital_sales = COALESCE(sub.digital, 0),
  cd_sales = COALESCE(sub.cd, 0),
  vinyl_sales = COALESCE(sub.vinyl, 0),
  cassette_sales = COALESCE(sub.cassette, 0),
  total_units_sold = COALESCE(sub.digital, 0) + COALESCE(sub.cd, 0) + COALESCE(sub.vinyl, 0) + COALESCE(sub.cassette, 0),
  total_revenue = COALESCE(sub.total_rev, 0)
FROM (
  SELECT 
    rf.release_id,
    SUM(CASE WHEN rf.format_type = 'digital' THEN rs.quantity_sold ELSE 0 END) as digital,
    SUM(CASE WHEN rf.format_type = 'cd' THEN rs.quantity_sold ELSE 0 END) as cd,
    SUM(CASE WHEN rf.format_type = 'vinyl' THEN rs.quantity_sold ELSE 0 END) as vinyl,
    SUM(CASE WHEN rf.format_type = 'cassette' THEN rs.quantity_sold ELSE 0 END) as cassette,
    SUM(rs.total_amount) as total_rev
  FROM release_sales rs
  JOIN release_formats rf ON rf.id = rs.release_format_id
  GROUP BY rf.release_id
) sub
WHERE r.id = sub.release_id;
