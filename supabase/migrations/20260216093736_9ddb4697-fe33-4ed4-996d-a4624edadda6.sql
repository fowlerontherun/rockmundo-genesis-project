
-- Widen chart_type column to accommodate scoped chart type names like 'cassette_sales_single'
ALTER TABLE chart_entries ALTER COLUMN chart_type TYPE varchar(40);
