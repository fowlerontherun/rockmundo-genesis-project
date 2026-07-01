
ALTER TABLE public.company_news_events
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by uuid;

CREATE INDEX IF NOT EXISTS company_news_events_company_pinned_idx
  ON public.company_news_events (company_id, is_pinned DESC, created_at DESC);

GRANT SELECT, UPDATE ON public.company_news_events TO authenticated;
GRANT ALL ON public.company_news_events TO service_role;

DROP POLICY IF EXISTS "Anyone reads company news" ON public.company_news_events;
CREATE POLICY "Read visible company news"
  ON public.company_news_events FOR SELECT
  USING (
    is_hidden = false
    OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_news_events.company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners moderate their company news"
  ON public.company_news_events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_news_events.company_id
        AND c.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_news_events.company_id
        AND c.owner_id = auth.uid()
    )
  );
