-- Create a summary view that tracks unlocked achievements per user
DROP VIEW IF EXISTS public.player_achievement_summary;

CREATE VIEW public.player_achievement_summary AS
WITH total AS (
  SELECT COUNT(*)::integer AS total_achievements
  FROM public.achievements
), player_counts AS (
  SELECT
    user_id,
    COUNT(*)::integer AS earned_count,
    MAX(unlocked_at) AS last_unlocked_at
  FROM public.player_achievements
  GROUP BY user_id
)
SELECT
  p.user_id,
  COALESCE(pc.earned_count, 0) AS earned_count,
  t.total_achievements,
  GREATEST(t.total_achievements - COALESCE(pc.earned_count, 0), 0) AS remaining_count,
  pc.last_unlocked_at
FROM public.profiles p
CROSS JOIN total t
LEFT JOIN player_counts pc ON pc.user_id = p.user_id;

GRANT SELECT ON public.player_achievement_summary TO anon, authenticated;
