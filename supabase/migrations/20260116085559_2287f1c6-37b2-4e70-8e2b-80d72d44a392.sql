-- Create band_song_ownership table to track songwriter contributions and royalty shares
CREATE TABLE IF NOT EXISTS band_song_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  ownership_percentage NUMERIC DEFAULT 0 CHECK (ownership_percentage >= 0 AND ownership_percentage <= 100),
  role TEXT DEFAULT 'writer' CHECK (role IN ('writer', 'co-writer', 'former_member')),
  is_active_member BOOLEAN DEFAULT true,
  original_percentage NUMERIC DEFAULT 0, -- Store original percentage for restoration on rejoin
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(song_id, user_id)
);

-- Add columns to songs table for repertoire tracking
ALTER TABLE songs ADD COLUMN IF NOT EXISTS added_to_repertoire_at TIMESTAMPTZ;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS added_to_repertoire_by UUID;

-- Enable RLS on band_song_ownership
ALTER TABLE band_song_ownership ENABLE ROW LEVEL SECURITY;

-- Policy: Band members can view all ownership records for their band's songs
CREATE POLICY "Band members can view band song ownership"
ON band_song_ownership FOR SELECT
USING (
  band_id IN (
    SELECT bm.band_id FROM band_members bm 
    WHERE bm.user_id = auth.uid()
  )
);

-- Policy: Song owners can insert ownership records
CREATE POLICY "Song owners can insert ownership records"
ON band_song_ownership FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM songs s
    WHERE s.id = song_id
    AND (s.user_id = auth.uid() OR s.original_writer_id = auth.uid())
  )
);

-- Policy: Band leaders can update ownership records
CREATE POLICY "Band leaders can update ownership"
ON band_song_ownership FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM bands b
    WHERE b.id = band_id AND b.leader_id = auth.uid()
  )
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_band_song_ownership_song ON band_song_ownership(song_id);
CREATE INDEX IF NOT EXISTS idx_band_song_ownership_band ON band_song_ownership(band_id);
CREATE INDEX IF NOT EXISTS idx_band_song_ownership_user ON band_song_ownership(user_id);

-- Create trigger for updating updated_at
CREATE OR REPLACE FUNCTION update_band_song_ownership_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS band_song_ownership_updated_at ON band_song_ownership;
CREATE TRIGGER band_song_ownership_updated_at
  BEFORE UPDATE ON band_song_ownership
  FOR EACH ROW
  EXECUTE FUNCTION update_band_song_ownership_updated_at();