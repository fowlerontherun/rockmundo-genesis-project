-- Add stock columns to equipment_catalog
ALTER TABLE equipment_catalog ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 50;
ALTER TABLE equipment_catalog ADD COLUMN IF NOT EXISTS max_stock INTEGER DEFAULT 50;

-- Set initial stock based on rarity
UPDATE equipment_catalog SET 
  stock_quantity = CASE rarity
    WHEN 'common' THEN 100
    WHEN 'uncommon' THEN 50
    WHEN 'rare' THEN 20
    WHEN 'epic' THEN 10
    WHEN 'legendary' THEN 3
    ELSE 50
  END,
  max_stock = CASE rarity
    WHEN 'common' THEN 100
    WHEN 'uncommon' THEN 50
    WHEN 'rare' THEN 20
    WHEN 'epic' THEN 10
    WHEN 'legendary' THEN 3
    ELSE 50
  END;