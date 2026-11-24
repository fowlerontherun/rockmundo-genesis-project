-- Band-level consent, independent of player friendships and booking commitments.
CREATE TABLE public.band_touring_friendships (
  band_low uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  band_high uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  requested_by_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending','accepted','declined','removed')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (band_low,band_high),
  CHECK (band_low < band_high),
  CHECK (requested_by_band_id IN (band_low,band_high))
);
CREATE INDEX band_touring_friendships_high_idx ON public.band_touring_friendships(band_high);
ALTER TABLE public.band_touring_friendships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.band_touring_friendships FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.band_touring_friendships TO authenticated;
GRANT ALL ON public.band_touring_friendships TO service_role;
CREATE POLICY band_friendship_read ON public.band_touring_friendships FOR SELECT TO authenticated
USING (public.can_manage_band_gigs(band_low,(SELECT auth.uid())) OR public.can_manage_band_gigs(band_high,(SELECT auth.uid())));

CREATE FUNCTION public.change_band_friendship(p_band_id uuid,p_target_band_id uuid,p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_low uuid := LEAST(p_band_id,p_target_band_id);
  v_high uuid := GREATEST(p_band_id,p_target_band_id);
  v_row public.band_touring_friendships%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(public.can_manage_band_gigs(p_band_id,auth.uid()),false) THEN
    RAISE EXCEPTION 'band_friendship_forbidden' USING ERRCODE='42501';
  END IF;
  IF p_band_id IS NULL OR p_target_band_id IS NULL OR p_band_id=p_target_band_id
     OR p_action IS NULL OR p_action NOT IN ('request','accept','decline','remove') THEN
    RAISE EXCEPTION 'band_friendship_invalid' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('band-friendship:'||v_low::text||':'||v_high::text,0));
  SELECT * INTO v_row FROM public.band_touring_friendships WHERE band_low=v_low AND band_high=v_high FOR UPDATE;
  IF p_action='request' THEN
    IF NOT EXISTS (SELECT 1 FROM public.bands WHERE id=p_target_band_id AND status='active') THEN
      RAISE EXCEPTION 'band_friendship_target_unavailable' USING ERRCODE='23503';
    END IF;
    IF v_row.status IN ('pending','accepted') THEN RETURN; END IF;
    IF v_row.status='declined' AND v_row.updated_at>now()-interval '7 days' THEN
      RAISE EXCEPTION 'band_friendship_request_cooldown' USING ERRCODE='23514';
    END IF;
    INSERT INTO public.band_touring_friendships(band_low,band_high,requested_by_band_id,status)
      VALUES(v_low,v_high,p_band_id,'pending')
      ON CONFLICT (band_low,band_high) DO UPDATE SET requested_by_band_id=p_band_id,status='pending',updated_at=now();
  ELSIF p_action IN ('accept','decline') THEN
    IF v_row.requested_by_band_id IS NULL OR v_row.requested_by_band_id=p_band_id THEN
      RAISE EXCEPTION 'band_friendship_recipient_required' USING ERRCODE='42501';
    END IF;
    IF (p_action='accept' AND v_row.status='accepted') OR (p_action='decline' AND v_row.status='declined') THEN RETURN; END IF;
    IF v_row.status<>'pending' THEN RAISE EXCEPTION 'band_friendship_not_pending' USING ERRCODE='23514'; END IF;
    UPDATE public.band_touring_friendships SET status=CASE WHEN p_action='accept' THEN 'accepted' ELSE 'declined' END,updated_at=now()
      WHERE band_low=v_low AND band_high=v_high;
  ELSE
    IF v_row.status='removed' THEN RETURN; END IF;
    IF v_row.status IS NULL OR v_row.status NOT IN ('pending','accepted') THEN
      RAISE EXCEPTION 'band_friendship_not_active' USING ERRCODE='23514';
    END IF;
    IF v_row.status='pending' AND v_row.requested_by_band_id<>p_band_id THEN
      RAISE EXCEPTION 'band_friendship_sender_required' USING ERRCODE='42501';
    END IF;
    UPDATE public.band_touring_friendships SET status='removed',updated_at=now() WHERE band_low=v_low AND band_high=v_high;
  END IF;
END;
$$;

CREATE FUNCTION public.list_band_friendships(p_band_id uuid)
RETURNS TABLE(band_id uuid,band_name text,status text,incoming boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(public.can_manage_band_gigs(p_band_id,auth.uid()),false) THEN
    RAISE EXCEPTION 'band_friendship_forbidden' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT b.id,b.name::text,f.status,f.requested_by_band_id<>p_band_id
    FROM public.band_touring_friendships f JOIN public.bands b
      ON b.id=CASE WHEN f.band_low=p_band_id THEN f.band_high ELSE f.band_low END
    WHERE p_band_id IN (f.band_low,f.band_high) AND f.status IN ('pending','accepted')
    ORDER BY f.status DESC,b.name,b.id;
END;
$$;
REVOKE ALL ON FUNCTION public.change_band_friendship(uuid,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.list_band_friendships(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.change_band_friendship(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_band_friendships(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
