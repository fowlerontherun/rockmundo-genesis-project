-- Add setlist_performance_items table if not exists
CREATE TABLE IF NOT EXISTS setlist_performance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id UUID NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  performance_item_id UUID NOT NULL REFERENCES performance_items_catalog(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  is_encore BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(setlist_id, performance_item_id)
);

CREATE INDEX IF NOT EXISTS idx_setlist_performance_items_setlist 
  ON setlist_performance_items(setlist_id, position);

-- Enable RLS if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'setlist_performance_items' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE setlist_performance_items ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view performance items in their setlists" ON setlist_performance_items;
DROP POLICY IF EXISTS "Users can manage performance items in their setlists" ON setlist_performance_items;

CREATE POLICY "Users can view performance items in their setlists"
  ON setlist_performance_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM setlists s
      JOIN band_members bm ON bm.band_id = s.band_id
      WHERE s.id = setlist_id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage performance items in their setlists"
  ON setlist_performance_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM setlists s
      JOIN band_members bm ON bm.band_id = s.band_id
      WHERE s.id = setlist_id AND bm.user_id = auth.uid()
    )
  );

-- Add process-scheduled-activities to cron config
INSERT INTO cron_job_config (job_name, edge_function_name, display_name, description, schedule, is_active, allow_manual_trigger)
VALUES 
  ('process-scheduled-activities', 'process-scheduled-activities', 'Process Scheduled Activities', 'Auto-start and complete scheduled activities', '*/5 * * * *', true, true)
ON CONFLICT (job_name) DO UPDATE SET
  edge_function_name = EXCLUDED.edge_function_name,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  schedule = EXCLUDED.schedule,
  allow_manual_trigger = EXCLUDED.allow_manual_trigger;