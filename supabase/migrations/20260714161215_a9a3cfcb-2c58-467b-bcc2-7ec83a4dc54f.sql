
CREATE OR REPLACE FUNCTION public.notify_achievement_unlock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ach public.achievements%ROWTYPE;
  v_reward_lines text[] := ARRAY[]::text[];
  v_key text;
  v_val jsonb;
  v_message text;
  v_rarity text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_ach FROM public.achievements WHERE id = NEW.achievement_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_rarity := COALESCE(v_ach.rarity, 'common');

  -- Format rewards nicely
  IF v_ach.rewards IS NOT NULL AND jsonb_typeof(v_ach.rewards) = 'object' THEN
    FOR v_key, v_val IN SELECT * FROM jsonb_each(v_ach.rewards) LOOP
      IF jsonb_typeof(v_val) = 'number' THEN
        v_reward_lines := v_reward_lines || (
          '+' || (v_val #>> '{}')::text || ' ' || replace(v_key, '_', ' ')
        );
      ELSE
        v_reward_lines := v_reward_lines || (
          replace(v_key, '_', ' ') || ': ' || (v_val #>> '{}')::text
        );
      END IF;
    END LOOP;
  END IF;

  v_message := 'You unlocked "' || v_ach.name || '" (' || v_rarity || ').';
  IF array_length(v_reward_lines, 1) IS NOT NULL THEN
    v_message := v_message || E'\nRewards: ' || array_to_string(v_reward_lines, ', ');
  ELSIF v_ach.description IS NOT NULL THEN
    v_message := v_message || E'\n' || v_ach.description;
  END IF;

  INSERT INTO public.notifications (
    user_id, profile_id, category, type, title, message, action_path, metadata
  ) VALUES (
    NEW.user_id,
    NEW.profile_id,
    'achievement',
    CASE v_rarity
      WHEN 'legendary' THEN 'success'
      WHEN 'mythic' THEN 'success'
      WHEN 'epic' THEN 'success'
      ELSE 'info'
    END,
    '🏆 Achievement Unlocked: ' || v_ach.name,
    v_message,
    '/achievements',
    jsonb_build_object(
      'achievement_id', v_ach.id,
      'rarity', v_rarity,
      'category', v_ach.category,
      'icon', v_ach.icon,
      'rewards', COALESCE(v_ach.rewards, '{}'::jsonb)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_achievement_unlock ON public.player_achievements;
CREATE TRIGGER trg_notify_achievement_unlock
AFTER INSERT ON public.player_achievements
FOR EACH ROW
EXECUTE FUNCTION public.notify_achievement_unlock();
