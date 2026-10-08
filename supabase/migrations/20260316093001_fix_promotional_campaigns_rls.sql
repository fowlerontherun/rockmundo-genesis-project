-- Fix promotional_campaigns RLS so band members can launch campaigns on their releases
DROP POLICY IF EXISTS "Users can view their own campaigns" ON public.promotional_campaigns;
DROP POLICY IF EXISTS "Users can create campaigns for their releases" ON public.promotional_campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns" ON public.promotional_campaigns;

CREATE POLICY "Users can view their own campaigns"
ON public.promotional_campaigns
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.releases r
    WHERE r.id = promotional_campaigns.release_id
      AND (
        r.user_id = auth.uid()
        OR r.band_id IN (
          SELECT bm.band_id
          FROM public.band_members bm
          WHERE bm.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Users can create campaigns for their releases"
ON public.promotional_campaigns
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.releases r
    WHERE r.id = promotional_campaigns.release_id
      AND (
        r.user_id = auth.uid()
        OR r.band_id IN (
          SELECT bm.band_id
          FROM public.band_members bm
          WHERE bm.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Users can update their own campaigns"
ON public.promotional_campaigns
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.releases r
    WHERE r.id = promotional_campaigns.release_id
      AND (
        r.user_id = auth.uid()
        OR r.band_id IN (
          SELECT bm.band_id
          FROM public.band_members bm
          WHERE bm.user_id = auth.uid()
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.releases r
    WHERE r.id = promotional_campaigns.release_id
      AND (
        r.user_id = auth.uid()
        OR r.band_id IN (
          SELECT bm.band_id
          FROM public.band_members bm
          WHERE bm.user_id = auth.uid()
        )
      )
  )
);
