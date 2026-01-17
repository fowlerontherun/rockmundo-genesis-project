-- Add fields to track inventory state for underworld purchases
ALTER TABLE underworld_purchases 
ADD COLUMN IF NOT EXISTS is_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- Update existing purchases as "used" since effects were already applied
UPDATE underworld_purchases SET is_used = TRUE WHERE is_used IS NULL OR is_used = FALSE;