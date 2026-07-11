-- Phase 4 gig preparation: forecast snapshots and final pre-resolution preservation.
ALTER TABLE public.gig_outcomes ADD COLUMN IF NOT EXISTS final_forecast_snapshot jsonb;
ALTER TABLE public.gig_outcomes ADD COLUMN IF NOT EXISTS final_forecast_version integer;
ALTER TABLE public.gig_outcomes ADD COLUMN IF NOT EXISTS final_forecast_captured_at timestamptz;

CREATE TABLE IF NOT EXISTS public.gig_forecast_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  calculation_version integer NOT NULL DEFAULT 1,
  input_fingerprint text NOT NULL,
  forecast jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (gig_id, calculation_version, input_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_gig_forecast_snapshots_gig_generated ON public.gig_forecast_snapshots(gig_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gig_forecast_snapshots_band_generated ON public.gig_forecast_snapshots(band_id, generated_at DESC);

ALTER TABLE public.gig_forecast_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can view gig forecasts" ON public.gig_forecast_snapshots;
CREATE POLICY "Band members can view gig forecasts" ON public.gig_forecast_snapshots
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = gig_forecast_snapshots.band_id AND bm.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Band managers can insert gig forecasts" ON public.gig_forecast_snapshots;
CREATE POLICY "Band managers can insert gig forecasts" ON public.gig_forecast_snapshots
FOR INSERT WITH CHECK (public.is_band_leader_or_manager(band_id, auth.uid()));

DROP POLICY IF EXISTS "Band managers can update gig forecasts" ON public.gig_forecast_snapshots;
CREATE POLICY "Band managers can update gig forecasts" ON public.gig_forecast_snapshots
FOR UPDATE USING (public.is_band_leader_or_manager(band_id, auth.uid())) WITH CHECK (public.is_band_leader_or_manager(band_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.preserve_final_gig_forecast_snapshot(p_gig_id uuid, p_forecast jsonb, p_version integer DEFAULT 1)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.gig_outcomes
  SET final_forecast_snapshot = p_forecast,
      final_forecast_version = p_version,
      final_forecast_captured_at = now()
  WHERE gig_id = p_gig_id
    AND final_forecast_snapshot IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.preserve_final_gig_forecast_snapshot(uuid, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preserve_final_gig_forecast_snapshot(uuid, jsonb, integer) TO service_role;
