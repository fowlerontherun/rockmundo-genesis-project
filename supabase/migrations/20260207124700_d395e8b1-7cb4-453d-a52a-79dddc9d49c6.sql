
-- Allow anyone to view songs that are actively listed on the marketplace
CREATE POLICY "Anyone can view marketplace-listed songs"
ON public.songs
FOR SELECT
USING (
  id IN (
    SELECT song_id FROM public.marketplace_listings
    WHERE listing_status = 'active'
  )
);
