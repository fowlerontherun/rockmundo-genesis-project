
-- Add fan sentiment and media cycle columns to bands table
ALTER TABLE public.bands 
  ADD COLUMN IF NOT EXISTS fan_sentiment_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_intensity numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_fatigue numeric DEFAULT 0;

-- Add condition column to player_equipment_inventory (the table used by usePlayerEquipment)
ALTER TABLE public.player_equipment_inventory
  ADD COLUMN IF NOT EXISTS condition numeric DEFAULT 100;

-- Add comments for documentation
COMMENT ON COLUMN public.bands.fan_sentiment_score IS 'Fan mood score -100 to 100. Affects merch/ticket demand.';
COMMENT ON COLUMN public.bands.media_intensity IS 'Media attention intensity 0-100. Affects fame gain multiplier.';
COMMENT ON COLUMN public.bands.media_fatigue IS 'Media fatigue 0-100. High fatigue reduces media effectiveness.';
COMMENT ON COLUMN public.player_equipment_inventory.condition IS 'Equipment condition 0-100 (100=new). Degrades per gig.';
