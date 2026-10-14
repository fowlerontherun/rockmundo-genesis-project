-- Expose only non-sensitive gig consequence status fields for band members.
-- Retain the legacy table as read fallback; never expose canonical audit/error JSON.
ALTER TABLE public.gig_post_processing_canonical ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gig_post_processing_canonical FROM PUBLIC,anon,authenticated;
GRANT SELECT(gig_id,status,processing_version,completed_at)
 ON public.gig_post_processing_canonical TO authenticated;
DROP POLICY IF EXISTS gig_canonical_processing_band_read ON public.gig_post_processing_canonical;
CREATE POLICY gig_canonical_processing_band_read ON public.gig_post_processing_canonical
 FOR SELECT TO authenticated
 USING (public.caller_in_gig_band(gig_id));
NOTIFY pgrst,'reload schema';