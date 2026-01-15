-- Seed band growth configuration values
INSERT INTO game_balance_config (key, value, category, description)
VALUES
  ('band_daily_fame_min', 5, 'band_growth', 'Minimum daily passive fame gain for bands'),
  ('band_daily_fame_max', 15, 'band_growth', 'Maximum daily passive fame gain for bands'),
  ('band_daily_fans_min', 5, 'band_growth', 'Minimum daily passive fans gain for bands'),
  ('band_daily_fans_max', 20, 'band_growth', 'Maximum daily passive fans gain for bands'),
  ('band_fame_to_fans_rate', 0.5, 'band_growth', 'Percentage of band fame added as bonus fans daily'),
  ('band_player_fame_share', 92, 'band_growth', 'Percentage of band fame gain given to player character (5-10% deduction)'),
  ('band_player_fans_share', 92, 'band_growth', 'Percentage of band fans gain given to player character (5-10% deduction)')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description;