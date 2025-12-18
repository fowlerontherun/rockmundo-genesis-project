-- Clear existing manufacturing costs and add new tiered pricing with better volume discounts
DELETE FROM manufacturing_costs;

-- CD pricing tiers (costs in cents) - more tiers with better discounts
INSERT INTO manufacturing_costs (format_type, min_quantity, max_quantity, cost_per_unit) VALUES
('cd', 1, 49, 35),       -- $0.35/unit (base price)
('cd', 50, 99, 28),      -- $0.28/unit (20% off)
('cd', 100, 249, 22),    -- $0.22/unit (37% off)
('cd', 250, 499, 16),    -- $0.16/unit (54% off)
('cd', 500, 999, 12),    -- $0.12/unit (66% off)
('cd', 1000, 2499, 9),   -- $0.09/unit (74% off)
('cd', 2500, NULL, 6);   -- $0.06/unit (83% off)

-- Vinyl pricing tiers (costs in cents) - more tiers with better discounts
INSERT INTO manufacturing_costs (format_type, min_quantity, max_quantity, cost_per_unit) VALUES
('vinyl', 1, 49, 100),     -- $1.00/unit (base price)
('vinyl', 50, 99, 85),     -- $0.85/unit (15% off)
('vinyl', 100, 249, 70),   -- $0.70/unit (30% off)
('vinyl', 250, 499, 55),   -- $0.55/unit (45% off)
('vinyl', 500, 999, 45),   -- $0.45/unit (55% off)
('vinyl', 1000, 2499, 38), -- $0.38/unit (62% off)
('vinyl', 2500, NULL, 30); -- $0.30/unit (70% off)