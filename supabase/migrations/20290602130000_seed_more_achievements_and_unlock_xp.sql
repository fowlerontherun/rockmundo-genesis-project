-- Seed additional achievements and grant fixed XP on every achievement unlock.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE name = 'Studio Regular') THEN
    INSERT INTO public.achievements (name, description, category, rarity, icon, requirements, rewards)
    VALUES ('Studio Regular', 'Complete 5 studio recording sessions.', 'music', 'common', '🎙️', '{"recording_sessions_completed": 5}', '{"cash": 500}');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE name = 'Stage Veteran') THEN
    INSERT INTO public.achievements (name, description, category, rarity, icon, requirements, rewards)
    VALUES ('Stage Veteran', 'Perform 25 live gigs.', 'performance', 'uncommon', '🎸', '{"gigs_completed": 25}', '{"fame": 150}');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE name = 'Songwriter Sprint') THEN
    INSERT INTO public.achievements (name, description, category, rarity, icon, requirements, rewards)
    VALUES ('Songwriter Sprint', 'Write 10 original songs.', 'music', 'uncommon', '✍️', '{"songs_created": 10}', '{"cash": 1200}');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE name = 'Fan Favorite') THEN
    INSERT INTO public.achievements (name, description, category, rarity, icon, requirements, rewards)
    VALUES ('Fan Favorite', 'Reach 5,000 total fans.', 'fame', 'rare', '🔥', '{"fans": 5000}', '{"fame": 250, "cash": 1500}');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE name = 'Crowd Magnet') THEN
    INSERT INTO public.achievements (name, description, category, rarity, icon, requirements, rewards)
    VALUES ('Crowd Magnet', 'Sell 10,000 tickets across all gigs.', 'performance', 'rare', '🎟️', '{"tickets_sold": 10000}', '{"fame": 350, "cash": 2500}');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE name = 'Label Attention') THEN
    INSERT INTO public.achievements (name, description, category, rarity, icon, requirements, rewards)
    VALUES ('Label Attention', 'Receive your first label offer.', 'career', 'uncommon', '📀', '{"label_offers_received": 1}', '{"cash": 1000}');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE name = 'Airwave Breakthrough') THEN
    INSERT INTO public.achievements (name, description, category, rarity, icon, requirements, rewards)
    VALUES ('Airwave Breakthrough', 'Get played on radio 50 times.', 'success', 'rare', '📻', '{"radio_plays": 50}', '{"fame": 400, "cash": 2000}');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE name = 'Merch Machine') THEN
    INSERT INTO public.achievements (name, description, category, rarity, icon, requirements, rewards)
    VALUES ('Merch Machine', 'Sell 1,000 merch items.', 'financial', 'uncommon', '👕', '{"merch_items_sold": 1000}', '{"cash": 3000}');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE name = 'Road Warrior') THEN
    INSERT INTO public.achievements (name, description, category, rarity, icon, requirements, rewards)
    VALUES ('Road Warrior', 'Complete your first full tour.', 'career', 'rare', '🚌', '{"tours_completed": 1}', '{"fame": 300, "cash": 2500}');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE name = 'Global Sensation') THEN
    INSERT INTO public.achievements (name, description, category, rarity, icon, requirements, rewards)
    VALUES ('Global Sensation', 'Reach 100,000 fans worldwide.', 'fame', 'epic', '🌍', '{"fans": 100000}', '{"fame": 1500, "cash": 10000}');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.award_achievement_unlock_xp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET experience = COALESCE(experience, 0) + 300,
      updated_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_achievement_unlock_xp ON public.player_achievements;

CREATE TRIGGER trg_award_achievement_unlock_xp
AFTER INSERT ON public.player_achievements
FOR EACH ROW
EXECUTE FUNCTION public.award_achievement_unlock_xp();
