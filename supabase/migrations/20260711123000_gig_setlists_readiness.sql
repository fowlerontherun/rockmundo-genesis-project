CREATE TABLE IF NOT EXISTS public.gig_setlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Gig setlist',
  total_duration_seconds integer NOT NULL DEFAULT 0 CHECK (total_duration_seconds >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gig_id)
);

CREATE TABLE IF NOT EXISTS public.gig_setlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id uuid NOT NULL REFERENCES public.gig_setlists(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position > 0),
  is_encore boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (setlist_id, song_id),
  UNIQUE (setlist_id, position)
);

CREATE INDEX IF NOT EXISTS idx_gig_setlists_band ON public.gig_setlists(band_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gig_setlist_items_setlist_position ON public.gig_setlist_items(setlist_id, position);
CREATE INDEX IF NOT EXISTS idx_gig_setlist_items_song ON public.gig_setlist_items(song_id);

ALTER TABLE public.gig_setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_setlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members can view gig setlists" ON public.gig_setlists FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = gig_setlists.band_id AND bm.user_id = auth.uid())
);
CREATE POLICY "Band managers can insert gig setlists" ON public.gig_setlists FOR INSERT WITH CHECK (public.is_band_leader_or_manager(band_id, auth.uid()));
CREATE POLICY "Band managers can update gig setlists" ON public.gig_setlists FOR UPDATE USING (public.is_band_leader_or_manager(band_id, auth.uid())) WITH CHECK (public.is_band_leader_or_manager(band_id, auth.uid()));
CREATE POLICY "Band managers can delete gig setlists" ON public.gig_setlists FOR DELETE USING (public.is_band_leader_or_manager(band_id, auth.uid()));

CREATE POLICY "Band members can view gig setlist items" ON public.gig_setlist_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.gig_setlists gs JOIN public.band_members bm ON bm.band_id = gs.band_id WHERE gs.id = gig_setlist_items.setlist_id AND bm.user_id = auth.uid())
);
CREATE POLICY "Band managers can manage gig setlist items" ON public.gig_setlist_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.gig_setlists gs WHERE gs.id = gig_setlist_items.setlist_id AND public.is_band_leader_or_manager(gs.band_id, auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.gig_setlists gs WHERE gs.id = gig_setlist_items.setlist_id AND public.is_band_leader_or_manager(gs.band_id, auth.uid()))
);

CREATE OR REPLACE FUNCTION public.save_gig_setlist(p_gig_id uuid, p_name text, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_gig record; v_setlist_id uuid; v_total integer := 0; v_count integer := 0; v_bad integer := 0; v_encore_seen boolean := false; v_item jsonb; v_pos integer := 1;
BEGIN
  SELECT id, band_id, status, scheduled_date INTO v_gig FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF v_gig.id IS NULL THEN RAISE EXCEPTION 'Gig not found.' USING ERRCODE = '22023'; END IF;
  IF v_gig.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Completed or cancelled gigs cannot be edited.' USING ERRCODE = '55000'; END IF;
  IF NOT public.is_band_leader_or_manager(v_gig.band_id, auth.uid()) THEN RAISE EXCEPTION 'Only authorised band managers can edit gig setlists.' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Setlist must contain at least one song.' USING ERRCODE = '22023'; END IF;

  CREATE TEMP TABLE tmp_gig_setlist_items(song_id uuid, position integer, is_encore boolean, duration integer) ON COMMIT DROP;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO tmp_gig_setlist_items(song_id, position, is_encore)
    VALUES ((v_item->>'song_id')::uuid, COALESCE((v_item->>'position')::integer, v_pos), COALESCE((v_item->>'is_encore')::boolean, false));
    v_pos := v_pos + 1;
  END LOOP;
  SELECT count(*), count(DISTINCT song_id) INTO v_count, v_bad FROM tmp_gig_setlist_items;
  IF v_count <> v_bad THEN RAISE EXCEPTION 'Duplicate songs are not allowed in the same setlist.' USING ERRCODE = '23505'; END IF;

  UPDATE tmp_gig_setlist_items t SET duration = s.duration_seconds FROM public.songs s WHERE s.id = t.song_id AND s.band_id = v_gig.band_id AND COALESCE(s.archived,false) = false;
  SELECT count(*) INTO v_bad FROM tmp_gig_setlist_items WHERE duration IS NULL;
  IF v_bad > 0 THEN RAISE EXCEPTION 'Songs must belong to this band and have an estimated duration.' USING ERRCODE = '22023'; END IF;

  FOR v_item IN SELECT jsonb_build_object('is_encore', is_encore) FROM tmp_gig_setlist_items ORDER BY position LOOP
    IF v_encore_seen AND NOT COALESCE((v_item->>'is_encore')::boolean,false) THEN RAISE EXCEPTION 'Encore songs must appear after the normal set.' USING ERRCODE = '22023'; END IF;
    IF COALESCE((v_item->>'is_encore')::boolean,false) THEN v_encore_seen := true; END IF;
  END LOOP;

  SELECT COALESCE(sum(duration),0) INTO v_total FROM tmp_gig_setlist_items;
  INSERT INTO public.gig_setlists(gig_id, band_id, name, total_duration_seconds) VALUES (p_gig_id, v_gig.band_id, COALESCE(NULLIF(p_name,''),'Gig setlist'), v_total)
  ON CONFLICT (gig_id) DO UPDATE SET name = EXCLUDED.name, total_duration_seconds = EXCLUDED.total_duration_seconds, updated_at = now()
  RETURNING id INTO v_setlist_id;
  DELETE FROM public.gig_setlist_items WHERE setlist_id = v_setlist_id;
  INSERT INTO public.gig_setlist_items(setlist_id, song_id, position, is_encore)
  SELECT v_setlist_id, song_id, row_number() OVER (ORDER BY position), is_encore FROM tmp_gig_setlist_items ORDER BY position;
  RETURN jsonb_build_object('setlist_id', v_setlist_id, 'total_duration_seconds', v_total);
END; $$;

GRANT EXECUTE ON FUNCTION public.save_gig_setlist(uuid, text, jsonb) TO authenticated;

ALTER TABLE public.gig_outcomes ADD COLUMN IF NOT EXISTS readiness_score integer;
ALTER TABLE public.gig_outcomes ADD COLUMN IF NOT EXISTS readiness_modifier numeric;
ALTER TABLE public.gig_outcomes ADD COLUMN IF NOT EXISTS readiness_breakdown jsonb;
