-- Private band shortlists and minimal labelmate discovery; booking eligibility remains authoritative.
CREATE TABLE public.band_touring_shortlist (
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  target_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (band_id, target_band_id),
  CHECK (band_id <> target_band_id)
);
CREATE INDEX band_touring_shortlist_target_idx ON public.band_touring_shortlist(target_band_id);
ALTER TABLE public.band_touring_shortlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.band_touring_shortlist FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.band_touring_shortlist TO authenticated;
GRANT ALL ON public.band_touring_shortlist TO service_role;
CREATE POLICY shortlist_read ON public.band_touring_shortlist FOR SELECT TO authenticated
  USING (public.can_manage_band_gigs(band_id, (SELECT auth.uid())));
CREATE POLICY shortlist_add ON public.band_touring_shortlist FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_band_gigs(band_id, (SELECT auth.uid())));
CREATE POLICY shortlist_remove ON public.band_touring_shortlist FOR DELETE TO authenticated
  USING (public.can_manage_band_gigs(band_id, (SELECT auth.uid())));

CREATE FUNCTION public.set_band_shortlisted(p_band_id uuid, p_target_band_id uuid, p_saved boolean)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(public.can_manage_band_gigs(p_band_id, auth.uid()), false) THEN
    RAISE EXCEPTION 'band_discovery_forbidden' USING ERRCODE='42501';
  END IF;
  IF p_saved IS NULL THEN RAISE EXCEPTION 'shortlist_state_required' USING ERRCODE='22023'; END IF;
  IF p_saved THEN
    INSERT INTO public.band_touring_shortlist(band_id, target_band_id)
      VALUES (p_band_id, p_target_band_id) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.band_touring_shortlist WHERE band_id=p_band_id AND target_band_id=p_target_band_id;
  END IF;
END;
$$;

-- Definer access is needed to match active contracts without exposing contract finances.
CREATE FUNCTION public.get_band_discovery_context(p_band_id uuid)
RETURNS TABLE(band_id uuid, shortlisted boolean, labelmate boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(public.can_manage_band_gigs(p_band_id, auth.uid()), false) THEN
    RAISE EXCEPTION 'band_discovery_forbidden' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  WITH labelmates AS (
    SELECT DISTINCT peer.band_id
    FROM public.artist_label_contracts own
    JOIN public.artist_label_contracts peer ON peer.label_id=own.label_id
    WHERE own.band_id=p_band_id AND peer.band_id<>p_band_id
      AND own.status='active' AND peer.status='active'
      AND (own.start_date IS NULL OR own.start_date<=current_date)
      AND (peer.start_date IS NULL OR peer.start_date<=current_date)
      AND (own.end_date IS NULL OR own.end_date>=current_date)
      AND (peer.end_date IS NULL OR peer.end_date>=current_date)
  ), saved AS (
    SELECT s.target_band_id AS band_id FROM public.band_touring_shortlist s WHERE s.band_id=p_band_id
  )
  SELECT COALESCE(s.band_id, l.band_id), s.band_id IS NOT NULL, l.band_id IS NOT NULL
  FROM saved s FULL JOIN labelmates l ON l.band_id=s.band_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_band_shortlisted(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_band_discovery_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_band_shortlisted(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_band_discovery_context(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
