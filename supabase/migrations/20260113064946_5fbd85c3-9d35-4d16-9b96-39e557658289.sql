-- Update the sale_type check constraint to allow cassette and physical
ALTER TABLE chart_entries DROP CONSTRAINT IF EXISTS chart_entries_sale_type_check;

ALTER TABLE chart_entries ADD CONSTRAINT chart_entries_sale_type_check 
CHECK (sale_type = ANY (ARRAY['stream'::text, 'digital'::text, 'cd'::text, 'vinyl'::text, 'record'::text, 'cassette'::text, 'physical'::text]));