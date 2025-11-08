-- Add missing columns to equipment_items
ALTER TABLE equipment_items 
ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 999;

-- Add missing columns to band_stage_equipment
ALTER TABLE band_stage_equipment
ADD COLUMN IF NOT EXISTS size_units INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS condition_rating INTEGER DEFAULT 100;