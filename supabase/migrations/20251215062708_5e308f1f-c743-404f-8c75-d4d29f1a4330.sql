-- Add booking fee to gigs table
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS booking_fee INTEGER DEFAULT 0;

-- Add band revenue share to venues table (default 50%)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS band_revenue_share NUMERIC(3,2) DEFAULT 0.50;

-- Add recording version tracking to release_songs
ALTER TABLE release_songs ADD COLUMN IF NOT EXISTS recording_version TEXT DEFAULT 'Standard';