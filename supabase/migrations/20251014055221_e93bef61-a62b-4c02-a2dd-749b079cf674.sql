-- Fix search path for new trigger functions
ALTER FUNCTION public.detect_twaat_mentions() SET search_path = public;
ALTER FUNCTION public.award_daily_twaat_xp() SET search_path = public;