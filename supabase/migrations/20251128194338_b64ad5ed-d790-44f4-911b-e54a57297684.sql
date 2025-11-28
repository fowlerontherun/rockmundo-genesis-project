-- Add new columns to release_formats for vinyl variants and limited editions
ALTER TABLE release_formats 
ADD COLUMN IF NOT EXISTS vinyl_color TEXT,
ADD COLUMN IF NOT EXISTS is_limited_edition BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS edition_quantity INTEGER,
ADD COLUMN IF NOT EXISTS edition_number INTEGER;

-- Add streaming platforms array and pre-order fields to releases
ALTER TABLE releases 
ADD COLUMN IF NOT EXISTS streaming_platforms TEXT[],
ADD COLUMN IF NOT EXISTS pre_order_start_date DATE,
ADD COLUMN IF NOT EXISTS pre_order_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS promotion_budget NUMERIC DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN release_formats.vinyl_color IS 'Color variant for vinyl: black, red, blue, green, clear, picture-disc';
COMMENT ON COLUMN release_formats.is_limited_edition IS 'Whether this is a limited edition release';
COMMENT ON COLUMN release_formats.edition_quantity IS 'Total number of units in limited edition';
COMMENT ON COLUMN release_formats.edition_number IS 'Specific edition number for this unit';
COMMENT ON COLUMN releases.streaming_platforms IS 'Array of streaming platform IDs for auto-distribution';
COMMENT ON COLUMN releases.pre_order_start_date IS 'Date when pre-orders begin';
COMMENT ON COLUMN releases.pre_order_count IS 'Number of pre-orders received';