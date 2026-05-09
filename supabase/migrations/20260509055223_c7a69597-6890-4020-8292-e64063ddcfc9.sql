-- Watchlist for "notify me when live"
CREATE TABLE IF NOT EXISTS public.blind_box_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid,
  box_id uuid NOT NULL REFERENCES public.blind_boxes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_live_at timestamptz,
  UNIQUE (user_id, box_id)
);

CREATE INDEX IF NOT EXISTS idx_blind_box_watchlist_box ON public.blind_box_watchlist(box_id);
CREATE INDEX IF NOT EXISTS idx_blind_box_watchlist_pending
  ON public.blind_box_watchlist(box_id) WHERE notified_live_at IS NULL;

ALTER TABLE public.blind_box_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blind box watchlist"
  ON public.blind_box_watchlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their own blind box watchlist"
  ON public.blind_box_watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from their own blind box watchlist"
  ON public.blind_box_watchlist FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own blind box watchlist"
  ON public.blind_box_watchlist FOR UPDATE
  USING (auth.uid() = user_id);

-- Dispatcher: emit notifications for boxes that just went live
CREATE OR REPLACE FUNCTION public.notify_blind_box_live()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  WITH eligible AS (
    SELECT w.id AS watch_id, w.user_id, w.profile_id, w.box_id,
           b.name AS box_name, b.slug AS box_slug, b.theme_genre,
           b.available_until
    FROM public.blind_box_watchlist w
    JOIN public.blind_boxes b ON b.id = w.box_id
    WHERE w.notified_live_at IS NULL
      AND b.active = true
      AND b.available_from IS NOT NULL
      AND b.available_from <= now()
      AND (b.available_until IS NULL OR b.available_until > now())
  ),
  ins AS (
    INSERT INTO public.notifications
      (user_id, profile_id, category, type, title, message, action_path, metadata)
    SELECT
      e.user_id,
      e.profile_id,
      'store',
      'blind_box_live',
      e.box_name || ' is now live!',
      'Your watched blind box "' || e.box_name || '" (' || e.theme_genre || ') is now available to open.',
      '/blind-boxes',
      jsonb_build_object(
        'box_id', e.box_id,
        'box_slug', e.box_slug,
        'theme_genre', e.theme_genre,
        'available_until', e.available_until
      )
    FROM eligible e
    RETURNING 1
  ),
  upd AS (
    UPDATE public.blind_box_watchlist w
    SET notified_live_at = now()
    FROM eligible e
    WHERE w.id = e.watch_id
    RETURNING 1
  )
  SELECT count(*) INTO inserted_count FROM ins;

  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_blind_box_live() FROM public, anon, authenticated;

-- Schedule every minute via pg_cron
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job WHERE jobname = 'notify-blind-box-live';

    PERFORM cron.schedule(
      'notify-blind-box-live',
      '* * * * *',
      $cron$ SELECT public.notify_blind_box_live(); $cron$
    );
  END IF;
END $$;
