-- Fix manufacturing costs - reduce by ~10x to realistic prices (cents per unit)
UPDATE manufacturing_costs SET cost_per_unit = 50 WHERE format_type = 'cd' AND min_quantity = 1;
UPDATE manufacturing_costs SET cost_per_unit = 35 WHERE format_type = 'cd' AND min_quantity = 100;
UPDATE manufacturing_costs SET cost_per_unit = 25 WHERE format_type = 'cd' AND min_quantity = 500;
UPDATE manufacturing_costs SET cost_per_unit = 15 WHERE format_type = 'cd' AND min_quantity = 1000;

UPDATE manufacturing_costs SET cost_per_unit = 150 WHERE format_type = 'vinyl' AND min_quantity = 1;
UPDATE manufacturing_costs SET cost_per_unit = 120 WHERE format_type = 'vinyl' AND min_quantity = 100;
UPDATE manufacturing_costs SET cost_per_unit = 90 WHERE format_type = 'vinyl' AND min_quantity = 500;
UPDATE manufacturing_costs SET cost_per_unit = 70 WHERE format_type = 'vinyl' AND min_quantity = 1000;