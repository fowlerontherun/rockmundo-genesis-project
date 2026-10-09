-- Optional local mayor statements published in Today's News.
CREATE TABLE IF NOT EXISTS public.mayor_news_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  mayor_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  headline text NOT NULL CHECK (char_length(btrim(headline)) BETWEEN 5 AND 120),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 20 AND 2000),
  published_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mayor_news_columns_city_published_idx
  ON public.mayor_news_columns(city_id, published_at DESC);
ALTER TABLE public.mayor_news_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY mayor_news_columns_read
  ON public.mayor_news_columns FOR SELECT TO authenticated
  USING (true);
CREATE POLICY mayor_news_columns_current_mayor_publish
  ON public.mayor_news_columns FOR INSERT TO authenticated
  WITH CHECK (
    mayor_profile_id = public.current_active_player_profile_id()
    AND EXISTS (
      SELECT 1 FROM public.city_mayors cm
      WHERE cm.city_id = mayor_news_columns.city_id
        AND cm.profile_id = mayor_news_columns.mayor_profile_id
        AND cm.is_current = true
    )
  );
-- Published news is immutable. Mayors may publish another edition, not rewrite history.
