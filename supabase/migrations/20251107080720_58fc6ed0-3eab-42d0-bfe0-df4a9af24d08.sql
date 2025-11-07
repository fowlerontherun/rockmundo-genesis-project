-- Add missing columns to university_courses
ALTER TABLE university_courses 
ADD COLUMN IF NOT EXISTS class_start_hour INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS class_end_hour INTEGER DEFAULT 14;

-- Add missing columns to label_releases
ALTER TABLE label_releases
ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES artist_label_contracts(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_label_releases_contract_id ON label_releases(contract_id);