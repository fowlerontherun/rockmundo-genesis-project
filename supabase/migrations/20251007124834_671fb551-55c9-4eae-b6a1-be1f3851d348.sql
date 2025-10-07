-- Phase 1: Add Band Status System

-- Create enum for band status
CREATE TYPE band_status AS ENUM ('active', 'on_hiatus', 'disbanded');

-- Add status columns to bands table
ALTER TABLE bands 
  ADD COLUMN status band_status DEFAULT 'active' NOT NULL,
  ADD COLUMN hiatus_started_at timestamptz,
  ADD COLUMN hiatus_reason text,
  ADD COLUMN hiatus_ends_at timestamptz,
  ADD COLUMN hiatus_notification_sent boolean DEFAULT false;

-- Add member status to band_members
ALTER TABLE band_members 
  ADD COLUMN member_status VARCHAR(20) DEFAULT 'active' 
    CHECK (member_status IN ('active', 'on_leave', 'inactive'));

-- Create band history table
CREATE TABLE band_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  triggered_by UUID,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on band_history
ALTER TABLE band_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy for band history
CREATE POLICY "Band members can view history"
ON band_history FOR SELECT
USING (band_id IN (
  SELECT band_id FROM band_members WHERE user_id = auth.uid()
));

-- Create index for better performance
CREATE INDEX idx_band_history_band_id ON band_history(band_id);
CREATE INDEX idx_bands_status ON bands(status);
CREATE INDEX idx_bands_hiatus_ends_at ON bands(hiatus_ends_at) WHERE hiatus_ends_at IS NOT NULL;