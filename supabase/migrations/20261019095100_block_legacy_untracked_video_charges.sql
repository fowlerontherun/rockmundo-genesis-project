-- #4240 emergency compatibility guard: the old deployed React dialog
-- debits $75,000 directly and ignores the update error before INSERT.
-- The new secured generator intentionally rejects videos with no paid attempt.
-- Prevent the old screen from charging money for a doomed generation.
CREATE OR REPLACE FUNCTION public.reject_legacy_ai_video_cash_debit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
BEGIN
  -- SECURITY DEFINER reserve_music_video_generation() runs as postgres and
  -- is allowed; direct browser PostgREST UPDATE runs as authenticated.
  IF current_user='authenticated'
     AND coalesce(OLD.is_vip,false)
     AND NEW.cash=OLD.cash-75000 THEN
    RAISE EXCEPTION 'AI_VIDEO_SECURE_RESERVATION_REQUIRED';
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS guard_legacy_ai_video_cash_debit ON public.profiles;
CREATE TRIGGER guard_legacy_ai_video_cash_debit
 BEFORE UPDATE OF cash ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION public.reject_legacy_ai_video_cash_debit();

CREATE OR REPLACE FUNCTION public.reject_legacy_ai_video_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
BEGIN
  IF current_user='authenticated'
     AND NEW.budget=75000 AND NEW.production_quality=95
     AND coalesce(NEW.description,'') ~ '"ai_generated"[[:space:]]*:[[:space:]]*true' THEN
    RAISE EXCEPTION 'AI_VIDEO_SECURE_RESERVATION_REQUIRED';
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS guard_legacy_ai_video_insert ON public.music_videos;
CREATE TRIGGER guard_legacy_ai_video_insert
 BEFORE INSERT ON public.music_videos
 FOR EACH ROW EXECUTE FUNCTION public.reject_legacy_ai_video_insert();
