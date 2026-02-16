-- Insert offsetting earnings records to zero out negative balances
-- This ensures the SUM(amount) from band_earnings = 0 for these bands

INSERT INTO band_earnings (band_id, amount, source, description)
SELECT id, ABS(band_balance), 'refund', 'Debt relief: balance reset to zero (v1.0.710)'
FROM bands
WHERE band_balance < 0;

-- Reset the band_balance to 0
UPDATE bands SET band_balance = 0 WHERE band_balance < 0;

-- Add a CHECK constraint to prevent band_balance from going negative in the future
-- This ensures no withdrawal can overdraft the band
ALTER TABLE bands ADD CONSTRAINT band_balance_non_negative CHECK (band_balance >= 0);