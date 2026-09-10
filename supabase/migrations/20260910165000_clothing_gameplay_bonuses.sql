-- Clothing gameplay bonuses
-- Admin-authored cosmetic items may grant small, capped gameplay modifiers while equipped.

ALTER TABLE public.avatar_clothing_items
  ADD COLUMN IF NOT EXISTS wearable_slot text,
  ADD COLUMN IF NOT EXISTS bonus_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS bonus_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.avatar_clothing_items.wearable_slot IS
  'Logical equip slot used by the avatar/wardrobe UI (top, outerwear, bottom, footwear, headwear, accessory).';
COMMENT ON COLUMN public.avatar_clothing_items.bonus_config IS
  'Gameplay bonuses while equipped. Supported keys: daily_xp, daily_ap, performance_pct, recording_pct, songwriting_pct.';

CREATE OR REPLACE FUNCTION public.validate_clothing_bonus_config()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cfg jsonb := COALESCE(NEW.bonus_config, '{}'::jsonb);
  allowed_keys text[] := ARRAY['daily_xp','daily_ap','performance_pct','recording_pct','songwriting_pct'];
  k text;
  v numeric;
BEGIN
  IF jsonb_typeof(cfg) <> 'object' THEN
    RAISE EXCEPTION 'bonus_config must be a JSON object';
  END IF;

  FOR k IN SELECT jsonb_object_keys(cfg)
  LOOP
    IF NOT (k = ANY (allowed_keys)) THEN
      RAISE EXCEPTION 'Unsupported clothing bonus key: %', k;
    END IF;
  END LOOP;

  FOR k IN SELECT unnest(allowed_keys)
  LOOP
    IF cfg ? k THEN
      BEGIN
        v := (cfg ->> k)::numeric;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Clothing bonus % must be numeric', k;
      END;
      IF v < 0 THEN RAISE EXCEPTION 'Clothing bonus % cannot be negative', k; END IF;
    END IF;
  END LOOP;

  IF COALESCE((cfg->>'daily_xp')::numeric, 0) > 25 THEN
    RAISE EXCEPTION 'daily_xp cannot exceed 25 per item';
  END IF;
  IF COALESCE((cfg->>'daily_ap')::numeric, 0) > 5 THEN
    RAISE EXCEPTION 'daily_ap cannot exceed 5 per item';
  END IF;
  IF COALESCE((cfg->>'performance_pct')::numeric, 0) > 10 THEN
    RAISE EXCEPTION 'performance_pct cannot exceed 10%% per item';
  END IF;
  IF COALESCE((cfg->>'recording_pct')::numeric, 0) > 10 THEN
    RAISE EXCEPTION 'recording_pct cannot exceed 10%% per item';
  END IF;
  IF COALESCE((cfg->>'songwriting_pct')::numeric, 0) > 10 THEN
    RAISE EXCEPTION 'songwriting_pct cannot exceed 10%% per item';
  END IF;

  NEW.bonus_config := cfg;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_clothing_bonus_config ON public.avatar_clothing_items;
CREATE TRIGGER trg_validate_clothing_bonus_config
BEFORE INSERT OR UPDATE OF bonus_config ON public.avatar_clothing_items
FOR EACH ROW EXECUTE FUNCTION public.validate_clothing_bonus_config();

CREATE INDEX IF NOT EXISTS idx_avatar_clothing_bonus_enabled
  ON public.avatar_clothing_items (bonus_enabled)
  WHERE bonus_enabled = true;
CREATE INDEX IF NOT EXISTS idx_player_owned_skins_equipped_clothing
  ON public.player_owned_skins (profile_id, item_id)
  WHERE is_equipped = true AND item_type = 'clothing';

-- Authoritative resolver for any gameplay system consuming equipped clothing bonuses.
-- Caps apply after stacking all equipped clothing to avoid pay-to-win or accidental admin over-tuning.
CREATE OR REPLACE FUNCTION public.get_equipped_clothing_bonuses(p_profile_id uuid)
RETURNS TABLE (
  daily_xp integer,
  daily_ap integer,
  performance_pct numeric,
  recording_pct numeric,
  songwriting_pct numeric,
  equipped_bonus_items integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    LEAST(50, COALESCE(SUM((aci.bonus_config->>'daily_xp')::numeric), 0))::integer,
    LEAST(10, COALESCE(SUM((aci.bonus_config->>'daily_ap')::numeric), 0))::integer,
    LEAST(20, COALESCE(SUM((aci.bonus_config->>'performance_pct')::numeric), 0)),
    LEAST(20, COALESCE(SUM((aci.bonus_config->>'recording_pct')::numeric), 0)),
    LEAST(20, COALESCE(SUM((aci.bonus_config->>'songwriting_pct')::numeric), 0)),
    COUNT(aci.id)::integer
  FROM public.player_owned_skins pos
  JOIN public.avatar_clothing_items aci ON aci.id = pos.item_id
  WHERE pos.profile_id = p_profile_id
    AND pos.item_type = 'clothing'
    AND pos.is_equipped = true
    AND aci.bonus_enabled = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_equipped_clothing_bonuses(uuid) TO authenticated;

-- Player-facing read helper limited by existing ownership RLS; admin/service callers can resolve any profile.
COMMENT ON FUNCTION public.get_equipped_clothing_bonuses(uuid) IS
  'Returns capped aggregate bonuses from currently equipped clothing. Use this function for daily XP/AP, gigs, recording and songwriting outcome calculations.';
