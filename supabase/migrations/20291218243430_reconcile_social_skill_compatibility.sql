-- Restore fields silently skipped when the historical compatibility migration
-- encountered an already-existing player_skills table. Later friendship and chat
-- migrations own their deployed schemas, so this forward repair does not replay
-- obsolete social policies or column names.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipment_loadout jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS experience_at_last_weekly_bonus integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_weekly_bonus_at timestamptz,
  ADD COLUMN IF NOT EXISTS weekly_bonus_streak integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_bonus_metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.player_skills
  ADD COLUMN IF NOT EXISTS creativity integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS technical integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS business integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS marketing integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS composition integer DEFAULT 1;

DROP TRIGGER IF EXISTS update_player_skills_updated_at ON public.player_skills;
CREATE TRIGGER update_player_skills_updated_at
  BEFORE UPDATE ON public.player_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
