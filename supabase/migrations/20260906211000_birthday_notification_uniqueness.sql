-- Prevent duplicate birthday notifications if the hourly processor and an online
-- birthday-state request race each other.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_one_birthday_per_profile_game_year
ON public.notifications (profile_id, ((metadata->>'game_year')))
WHERE type = 'birthday' AND profile_id IS NOT NULL AND metadata ? 'game_year';