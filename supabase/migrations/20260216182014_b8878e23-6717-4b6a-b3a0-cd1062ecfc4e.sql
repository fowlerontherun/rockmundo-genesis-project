ALTER TABLE player_properties
  ADD COLUMN daily_upkeep integer NOT NULL DEFAULT 0,
  ADD COLUMN is_rented_out boolean NOT NULL DEFAULT false,
  ADD COLUMN rental_income_daily integer NOT NULL DEFAULT 0;