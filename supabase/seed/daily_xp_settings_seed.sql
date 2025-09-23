INSERT INTO public.daily_xp_settings (id, daily_xp_amount)
VALUES (true, 150)
ON CONFLICT (id) DO UPDATE SET
  daily_xp_amount = EXCLUDED.daily_xp_amount,
  updated_at = timezone('utc', now());
