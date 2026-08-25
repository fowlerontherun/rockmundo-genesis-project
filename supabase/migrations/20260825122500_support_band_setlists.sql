-- Support Band Marketplace Phase 12: support-slot setlists.
-- Kept separate from gig_setlists because the canonical gig setlist belongs to the headliner.

CREATE TABLE IF NOT EXISTS public.support_band_setlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_slot_id uuid NOT NULL UNIQUE REFERENCES public.gig_support_slots(id) ON DELETE CASCADE,
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  support_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Support set',
  total_duration_seconds integer NOT NULL DEFAULT 0 CHECK (total_duration_seconds >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_band_setlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id uuid NOT NULL REFERENCES public.support_band_setlists(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (setlist_id, song_id),
  UNIQUE (setlist_id, position)
);

CREATE INDEX IF NOT EXISTS idx_support_band_setlists_gig ON public.support_band_setlists(gig_id);
CREATE INDEX IF NOT EXISTS idx_support_band_setlists_band ON public.support_band_setlists(support_band_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_band_setlist_items_position ON public.support_band_setlist_items(setlist_id, position);

ALTER TABLE public.support_band_setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_band_setlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Involved bands can view support setlists" ON public.support_band_setlists;
CREATE POLICY "Involved bands can view support setlists"
  ON public.support_band_setlists FOR SELECT TO authenticated
  USING (
    public.can_manage_band_gigs(support_band_id, auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.gigs g
      WHERE g.id = support_band_setlists.gig_id
        AND public.can_manage_band_gigs(g.band_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Support bands can manage support setlists" ON public.support_band_setlists;
CREATE POLICY "Support bands can manage support setlists"
  ON public.support_band_setlists FOR ALL TO authenticated
  USING (public.can_manage_band_gigs(support_band_id, auth.uid()))
  WITH CHECK (public.can_manage_band_gigs(support_band_id, auth.uid()));

DROP POLICY IF EXISTS "Involved bands can view support setlist items" ON public.support_band_setlist_items;
CREATE POLICY "Involved bands can view support setlist items"
  ON public.support_band_setlist_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_band_setlists s
      WHERE s.id = support_band_setlist_items.setlist_id
        AND (
          public.can_manage_band_gigs(s.support_band_id, auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.gigs g
            WHERE g.id = s.gig_id
              AND public.can_manage_band_gigs(g.band_id, auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS "Support bands can manage support setlist items" ON public.support_band_setlist_items;
CREATE POLICY "Support bands can manage support setlist items"
  ON public.support_band_setlist_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_band_setlists s
      WHERE s.id = support_band_setlist_items.setlist_id
        AND public.can_manage_band_gigs(s.support_band_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_band_setlists s
      WHERE s.id = support_band_setlist_items.setlist_id
        AND public.can_manage_band_gigs(s.support_band_id, auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.save_support_band_setlist(
  p_support_slot_id uuid,
  p_name text,
  p_song_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slot public.gig_support_slots%ROWTYPE;
  v_gig public.gigs%ROWTYPE;
  v_setlist_id uuid;
  v_total integer;
  v_count integer;
BEGIN
  SELECT * INTO v_slot
  FROM public.gig_support_slots
  WHERE id = p_support_slot_id
  FOR UPDATE;

  IF v_slot.id IS NULL THEN
    RAISE EXCEPTION 'support_setlist_slot_not_found' USING ERRCODE='23503';
  END IF;
  IF v_slot.status <> 'accepted' THEN
    RAISE EXCEPTION 'support_setlist_slot_not_confirmed' USING ERRCODE='23514';
  END IF;
  IF NOT public.can_manage_band_gigs(v_slot.support_band_id, auth.uid()) THEN
    RAISE EXCEPTION 'support_setlist_forbidden' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_gig FROM public.gigs WHERE id = v_slot.gig_id FOR UPDATE;
  IF v_gig.id IS NULL THEN
    RAISE EXCEPTION 'support_setlist_gig_not_found' USING ERRCODE='23503';
  END IF;
  IF v_gig.scheduled_date <= now() OR v_gig.status NOT IN ('scheduled','confirmed','ready_for_completion') THEN
    RAISE EXCEPTION 'support_setlist_gig_locked' USING ERRCODE='55000';
  END IF;

  v_count := COALESCE(array_length(p_song_ids, 1), 0);
  IF v_count < 1 OR v_count > 6 THEN
    RAISE EXCEPTION 'support_setlist_song_count' USING ERRCODE='22023', DETAIL='Choose between 1 and 6 songs.';
  END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(p_song_ids) x) <> v_count THEN
    RAISE EXCEPTION 'support_setlist_duplicate_song' USING ERRCODE='23505';
  END IF;

  SELECT COALESCE(sum(COALESCE(s.duration_seconds,0)),0)
  INTO v_total
  FROM public.songs s
  WHERE s.id = ANY(p_song_ids)
    AND s.band_id = v_slot.support_band_id
    AND COALESCE(s.archived,false) = false;

  IF (SELECT count(*) FROM public.songs s WHERE s.id = ANY(p_song_ids) AND s.band_id = v_slot.support_band_id AND COALESCE(s.archived,false)=false) <> v_count THEN
    RAISE EXCEPTION 'support_setlist_invalid_song' USING ERRCODE='22023';
  END IF;
  IF v_total > 1800 THEN
    RAISE EXCEPTION 'support_setlist_too_long' USING ERRCODE='22023', DETAIL='Support sets are limited to 30 minutes.';
  END IF;

  INSERT INTO public.support_band_setlists(support_slot_id,gig_id,support_band_id,name,total_duration_seconds)
  VALUES(v_slot.id,v_slot.gig_id,v_slot.support_band_id,COALESCE(NULLIF(trim(p_name),''),'Support set'),v_total)
  ON CONFLICT (support_slot_id) DO UPDATE SET
    name=EXCLUDED.name,
    total_duration_seconds=EXCLUDED.total_duration_seconds,
    updated_at=now()
  RETURNING id INTO v_setlist_id;

  DELETE FROM public.support_band_setlist_items WHERE setlist_id=v_setlist_id;
  INSERT INTO public.support_band_setlist_items(setlist_id,song_id,position)
  SELECT v_setlist_id, song_id, ord::integer
  FROM unnest(p_song_ids) WITH ORDINALITY AS selected(song_id, ord)
  ORDER BY ord;

  RETURN jsonb_build_object(
    'supportSetlistId',v_setlist_id,
    'supportSlotId',v_slot.id,
    'gigId',v_slot.gig_id,
    'songCount',v_count,
    'totalDurationSeconds',v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_support_band_setlist(uuid,text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_support_band_setlist(uuid,text,uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_support_band_setlist(p_support_slot_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN ss.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id',ss.id,
    'supportSlotId',ss.support_slot_id,
    'gigId',ss.gig_id,
    'supportBandId',ss.support_band_id,
    'name',ss.name,
    'totalDurationSeconds',ss.total_duration_seconds,
    'songs',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',s.id,
        'title',s.title,
        'durationSeconds',s.duration_seconds,
        'qualityScore',s.quality_score,
        'genre',s.genre,
        'position',i.position
      ) ORDER BY i.position)
      FROM public.support_band_setlist_items i
      JOIN public.songs s ON s.id=i.song_id
      WHERE i.setlist_id=ss.id
    ),'[]'::jsonb)
  ) END
  FROM public.support_band_setlists ss
  JOIN public.gigs g ON g.id=ss.gig_id
  WHERE ss.support_slot_id=p_support_slot_id
    AND (
      public.can_manage_band_gigs(ss.support_band_id,auth.uid())
      OR public.can_manage_band_gigs(g.band_id,auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.get_support_band_setlist(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_support_band_setlist(uuid) TO authenticated,service_role;
