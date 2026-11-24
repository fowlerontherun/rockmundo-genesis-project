-- Label recommendations collect interest; booking consent remains with the gig/tour RPCs.
CREATE TABLE public.label_play_together_suggestions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 label_id uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
 headliner_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
 support_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
 note text NOT NULL DEFAULT '' CHECK (length(note)<=500),
 headliner_response text NOT NULL DEFAULT 'pending' CHECK (headliner_response IN ('pending','interested','declined')),
 support_response text NOT NULL DEFAULT 'pending' CHECK (support_response IN ('pending','interested','declined')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (headliner_band_id<>support_band_id)
);
-- One recommendation per label/pair, including reversed roles. Retries never reset a response.
CREATE UNIQUE INDEX label_play_together_pair_idx ON public.label_play_together_suggestions
 (label_id,least(headliner_band_id,support_band_id),greatest(headliner_band_id,support_band_id));
CREATE INDEX label_play_together_headliner_idx ON public.label_play_together_suggestions(headliner_band_id);
CREATE INDEX label_play_together_support_idx ON public.label_play_together_suggestions(support_band_id);
ALTER TABLE public.label_play_together_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.label_play_together_suggestions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.label_play_together_suggestions TO authenticated;
GRANT ALL ON public.label_play_together_suggestions TO service_role;
CREATE POLICY suggestions_read ON public.label_play_together_suggestions FOR SELECT TO authenticated USING (
 public._can_manage_label(label_id) OR
 public.can_manage_band_gigs(headliner_band_id,(SELECT auth.uid())) OR
 public.can_manage_band_gigs(support_band_id,(SELECT auth.uid()))
);

-- Expose only band identity, never contract finances.
CREATE FUNCTION public.get_label_play_together_roster(p_label_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public._can_manage_label(p_label_id),false) THEN
   RAISE EXCEPTION 'label_suggestion_forbidden' USING ERRCODE='42501';
 END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY b.name,b.id),'[]'::jsonb) INTO v_result FROM (
   SELECT DISTINCT b.id,b.name FROM public.artist_label_contracts c JOIN public.bands b ON b.id=c.band_id
   WHERE c.label_id=p_label_id AND c.status='active' AND b.status='active'
   AND (c.start_date IS NULL OR c.start_date<=current_date) AND (c.end_date IS NULL OR c.end_date>=current_date)
 ) b;
 RETURN v_result;
END; $$;

CREATE FUNCTION public.suggest_label_play_together(p_label_id uuid,p_headliner_band_id uuid,p_support_band_id uuid,p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public._can_manage_label(p_label_id),false) THEN
   RAISE EXCEPTION 'label_suggestion_forbidden' USING ERRCODE='42501';
 END IF;
 IF p_headliner_band_id IS NULL OR p_support_band_id IS NULL OR p_headliner_band_id=p_support_band_id OR length(COALESCE(p_note,''))>500 THEN
   RAISE EXCEPTION 'label_suggestion_invalid' USING ERRCODE='22023';
 END IF;
 IF (SELECT count(DISTINCT c.band_id) FROM public.artist_label_contracts c JOIN public.bands b ON b.id=c.band_id
     WHERE c.label_id=p_label_id AND c.band_id IN (p_headliner_band_id,p_support_band_id) AND c.status='active' AND b.status='active'
     AND (c.start_date IS NULL OR c.start_date<=current_date) AND (c.end_date IS NULL OR c.end_date>=current_date))<>2 THEN
   RAISE EXCEPTION 'label_suggestion_roster_changed' USING ERRCODE='23514';
 END IF;
 INSERT INTO public.label_play_together_suggestions(label_id,headliner_band_id,support_band_id,note)
 VALUES(p_label_id,p_headliner_band_id,p_support_band_id,btrim(COALESCE(p_note,''))) ON CONFLICT DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL THEN SELECT id INTO v_id FROM public.label_play_together_suggestions
   WHERE label_id=p_label_id AND least(headliner_band_id,support_band_id)=least(p_headliner_band_id,p_support_band_id)
   AND greatest(headliner_band_id,support_band_id)=greatest(p_headliner_band_id,p_support_band_id); END IF;
 RETURN v_id;
END; $$;

CREATE FUNCTION public.respond_to_label_play_together(p_suggestion_id uuid,p_band_id uuid,p_response text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_row public.label_play_together_suggestions%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.can_manage_band_gigs(p_band_id,auth.uid()),false) THEN
   RAISE EXCEPTION 'label_suggestion_forbidden' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_row FROM public.label_play_together_suggestions WHERE id=p_suggestion_id FOR UPDATE;
 IF NOT FOUND OR p_band_id NOT IN (v_row.headliner_band_id,v_row.support_band_id) THEN
   RAISE EXCEPTION 'label_suggestion_forbidden' USING ERRCODE='42501';
 END IF;
 IF p_response IS NULL OR p_response NOT IN ('interested','declined') THEN
   RAISE EXCEPTION 'label_suggestion_invalid' USING ERRCODE='22023';
 END IF;
 IF p_response='interested' THEN
   IF (SELECT count(DISTINCT c.band_id) FROM public.artist_label_contracts c JOIN public.bands b ON b.id=c.band_id
       WHERE c.label_id=v_row.label_id AND c.band_id IN (v_row.headliner_band_id,v_row.support_band_id) AND c.status='active' AND b.status='active'
       AND (c.start_date IS NULL OR c.start_date<=current_date) AND (c.end_date IS NULL OR c.end_date>=current_date))<>2 THEN
     RAISE EXCEPTION 'label_suggestion_roster_changed' USING ERRCODE='23514';
   END IF;
   PERFORM public.set_band_shortlisted(p_band_id,CASE WHEN p_band_id=v_row.headliner_band_id THEN v_row.support_band_id ELSE v_row.headliner_band_id END,true);
 END IF;
 UPDATE public.label_play_together_suggestions SET
   headliner_response=CASE WHEN p_band_id=headliner_band_id THEN p_response ELSE headliner_response END,
   support_response=CASE WHEN p_band_id=support_band_id THEN p_response ELSE support_response END,updated_at=now()
 WHERE id=p_suggestion_id;
END; $$;

CREATE FUNCTION public.list_label_play_together(p_label_id uuid DEFAULT NULL,p_band_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR (p_label_id IS NULL)=(p_band_id IS NULL) THEN
   RAISE EXCEPTION 'label_suggestion_forbidden' USING ERRCODE='42501';
 END IF;
 IF (p_label_id IS NOT NULL AND NOT COALESCE(public._can_manage_label(p_label_id),false)) OR
    (p_band_id IS NOT NULL AND NOT COALESCE(public.can_manage_band_gigs(p_band_id,auth.uid()),false)) THEN
   RAISE EXCEPTION 'label_suggestion_forbidden' USING ERRCODE='42501';
 END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC,x.id),'[]'::jsonb) INTO v_result FROM (
   SELECT s.*,l.name AS label_name,h.name AS headliner_name,b.name AS support_name,
     (SELECT count(DISTINCT c.band_id)=2 FROM public.artist_label_contracts c JOIN public.bands a ON a.id=c.band_id
      WHERE c.label_id=s.label_id AND c.band_id IN (s.headliner_band_id,s.support_band_id) AND c.status='active' AND a.status='active'
      AND (c.start_date IS NULL OR c.start_date<=current_date) AND (c.end_date IS NULL OR c.end_date>=current_date)) AS roster_current
   FROM public.label_play_together_suggestions s JOIN public.labels l ON l.id=s.label_id
   JOIN public.bands h ON h.id=s.headliner_band_id JOIN public.bands b ON b.id=s.support_band_id
   WHERE (p_label_id IS NOT NULL AND s.label_id=p_label_id) OR (p_band_id IS NOT NULL AND p_band_id IN (s.headliner_band_id,s.support_band_id))
   ORDER BY s.created_at DESC,s.id LIMIT 100
 ) x;
 RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.get_label_play_together_roster(uuid),public.suggest_label_play_together(uuid,uuid,uuid,text),
 public.respond_to_label_play_together(uuid,uuid,text),public.list_label_play_together(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_label_play_together_roster(uuid),public.suggest_label_play_together(uuid,uuid,uuid,text),
 public.respond_to_label_play_together(uuid,uuid,text),public.list_label_play_together(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
