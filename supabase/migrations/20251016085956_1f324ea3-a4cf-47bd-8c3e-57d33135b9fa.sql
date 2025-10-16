-- Phase 1: Add song duration columns
ALTER TABLE songs ADD COLUMN IF NOT EXISTS duration_seconds integer;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS duration_display varchar;

-- Constraint: 2:20 (140 sec) to 7:00 (420 sec)
ALTER TABLE songs ADD CONSTRAINT song_duration_range 
  CHECK (duration_seconds IS NULL OR (duration_seconds >= 140 AND duration_seconds <= 420));

-- Phase 2: Add setlist limit constraint function
CREATE OR REPLACE FUNCTION check_setlist_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM setlists WHERE band_id = NEW.band_id AND is_active = true) >= 3 THEN
    RAISE EXCEPTION 'Band can only have 3 active setlists';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for setlist limit
DROP TRIGGER IF EXISTS enforce_setlist_limit ON setlists;
CREATE TRIGGER enforce_setlist_limit
  BEFORE INSERT ON setlists
  FOR EACH ROW
  EXECUTE FUNCTION check_setlist_limit();

-- Phase 3: Create production_notes table
CREATE TABLE IF NOT EXISTS setlist_production_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  description text NOT NULL,
  category varchar NOT NULL,
  impact_type varchar NOT NULL,
  impact_value numeric NOT NULL,
  required_skill_slug varchar,
  required_skill_value integer,
  required_fame integer,
  required_venue_prestige integer,
  cost_per_use integer DEFAULT 0,
  cooldown_shows integer DEFAULT 0,
  rarity varchar DEFAULT 'common',
  created_at timestamp with time zone DEFAULT now()
);

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_production_notes_requirements 
ON setlist_production_notes(required_fame, required_venue_prestige, rarity);

-- Phase 4: Create junction table for setlist production notes
CREATE TABLE IF NOT EXISTS setlist_production_note_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id uuid NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  production_note_id uuid NOT NULL REFERENCES setlist_production_notes(id) ON DELETE CASCADE,
  added_at timestamp with time zone DEFAULT now(),
  UNIQUE(setlist_id, production_note_id)
);

-- RLS policies for production notes
ALTER TABLE setlist_production_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlist_production_note_assignments ENABLE ROW LEVEL SECURITY;

-- Production notes viewable by everyone
CREATE POLICY "Production notes are viewable by everyone"
  ON setlist_production_notes FOR SELECT
  USING (true);

-- Admins can manage production notes
CREATE POLICY "Admins can manage production notes"
  ON setlist_production_notes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Band members can view and manage their setlist note assignments
CREATE POLICY "Band members can view note assignments"
  ON setlist_production_note_assignments FOR SELECT
  USING (
    setlist_id IN (
      SELECT id FROM setlists 
      WHERE band_id IN (
        SELECT band_id FROM band_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Band members can manage note assignments"
  ON setlist_production_note_assignments FOR ALL
  USING (
    setlist_id IN (
      SELECT id FROM setlists 
      WHERE band_id IN (
        SELECT band_id FROM band_members WHERE user_id = auth.uid()
      )
    )
  );