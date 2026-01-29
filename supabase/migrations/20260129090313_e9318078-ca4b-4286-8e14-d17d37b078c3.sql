-- Insert default distribution rate configs
INSERT INTO public.game_balance_config (category, key, value, description, min_value, max_value)
VALUES 
  ('sales', 'digital_distribution_rate', 30, 'Distribution fee % for digital sales (platform cut)', 0, 50),
  ('sales', 'cd_distribution_rate', 20, 'Distribution fee % for CD sales', 0, 50),
  ('sales', 'vinyl_distribution_rate', 15, 'Distribution fee % for vinyl sales', 0, 50),
  ('sales', 'cassette_distribution_rate', 15, 'Distribution fee % for cassette sales', 0, 50),
  ('sales', 'default_sales_tax_rate', 10, 'Default sales tax % when no city laws exist', 0, 30)
ON CONFLICT (category, key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value;