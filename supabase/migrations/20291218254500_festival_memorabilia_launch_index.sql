-- Cover the festival launch foreign key used by festival memorabilia lookups
-- and cascaded referential checks.
CREATE INDEX IF NOT EXISTS festival_player_memorabilia_launch_idx
  ON public.festival_player_memorabilia(festival_launch_id);
