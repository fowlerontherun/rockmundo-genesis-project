-- First drop the existing check constraint
ALTER TABLE manufacturing_costs DROP CONSTRAINT IF EXISTS manufacturing_costs_format_type_check;

-- Add new check constraint that includes cassette
ALTER TABLE manufacturing_costs ADD CONSTRAINT manufacturing_costs_format_type_check
  CHECK (format_type IN ('cd', 'vinyl', 'cassette'));

-- Now insert cassette manufacturing costs
INSERT INTO manufacturing_costs (format_type, min_quantity, max_quantity, cost_per_unit)
VALUES
  ('cassette', 1, 49, 25),
  ('cassette', 50, 99, 20),
  ('cassette', 100, 249, 16),
  ('cassette', 250, 499, 12),
  ('cassette', 500, 999, 9),
  ('cassette', 1000, 2499, 7),
  ('cassette', 2500, NULL, 5);