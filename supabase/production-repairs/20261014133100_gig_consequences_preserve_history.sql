-- Safe gig consequences rollout: preserve legacy history, use separate canonical claims.
-- No destructive cleanup of gig_post_processing; no automatic cron.
CREATE TABLE IF NOT EXISTS public.gig_post_processing_attempt_archive (
 id uuid PRIMARY KEY,
 gig_id uuid NOT NULL,
 legacy_status text,
 captured_at timestamptz NOT NULL DEFAULT now(),
 source_row jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS gig_processing_archive_gig_idx
 ON public.gig_post_processing_attempt_archive(gig_id);
ALTER TABLE public.gig_post_processing_attempt_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gig_post_processing_attempt_archive FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.gig_post_processing_attempt_archive TO service_role;
INSERT INTO public.gig_post_processing_attempt_archive(id,gig_id,legacy_status,source_row)
 SELECT id,gig_id,status,to_jsonb(t) FROM public.gig_post_processing t
 ON CONFLICT(id) DO NOTHING;
DO $$
BEGIN
 IF (SELECT count(*) FROM public.gig_post_processing_attempt_archive)
    < (SELECT count(*) FROM public.gig_post_processing)
 THEN RAISE EXCEPTION 'LEGACY_PROCESSING_ARCHIVE_INCOMPLETE';END IF;
 IF EXISTS(SELECT 1 FROM public.gig_post_processing t
    LEFT JOIN public.gig_post_processing_attempt_archive a ON a.id=t.id
    WHERE a.id IS NULL OR a.source_row IS DISTINCT FROM to_jsonb(t))
 THEN RAISE EXCEPTION 'LEGACY_PROCESSING_ARCHIVE_MISMATCH';END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.gig_post_processing_canonical (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 gig_id uuid NOT NULL UNIQUE REFERENCES public.gigs(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending',
 processing_version text NOT NULL DEFAULT 'consequences-v2',
 started_at timestamptz,
 completed_at timestamptz,
 error_snapshot jsonb,
 audit_history jsonb NOT NULL DEFAULT '[]'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gig_post_processing_canonical ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gig_post_processing_canonical FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.gig_post_processing_canonical TO service_role;

-- Historical outcomes only. Each ready gig gets exactly one canonical claim;
-- claims alone do not run any side effects.
INSERT INTO public.gig_post_processing_canonical(gig_id,status)
 SELECT DISTINCT g.id,'pending' FROM public.gigs g
 JOIN public.gig_post_processing legacy ON legacy.gig_id=g.id
 JOIN public.gig_outcomes outcome ON outcome.gig_id=g.id
 WHERE g.status='completed' AND g.result_ready_at IS NOT NULL
   AND outcome.completed_at IS NOT NULL
 ON CONFLICT(gig_id) DO NOTHING;

ALTER TABLE public.gig_consequence_snapshots
 ADD COLUMN IF NOT EXISTS processing_id uuid REFERENCES public.gig_post_processing_canonical(id),
 ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.band_live_reputation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE UNIQUE,
  overall_score numeric NOT NULL DEFAULT 50 CHECK (overall_score BETWEEN 0 AND 100),
  performance_score numeric NOT NULL DEFAULT 50 CHECK (performance_score BETWEEN 0 AND 100),
  professionalism_score numeric NOT NULL DEFAULT 50 CHECK (professionalism_score BETWEEN 0 AND 100),
  crowd_connection_score numeric NOT NULL DEFAULT 50 CHECK (crowd_connection_score BETWEEN 0 AND 100),
  reliability_score numeric NOT NULL DEFAULT 50 CHECK (reliability_score BETWEEN 0 AND 100),
  production_score numeric NOT NULL DEFAULT 50 CHECK (production_score BETWEEN 0 AND 100),
  live_momentum_score numeric NOT NULL DEFAULT 50 CHECK (live_momentum_score BETWEEN 0 AND 100),
  booking_demand_score numeric NOT NULL DEFAULT 50 CHECK (booking_demand_score BETWEEN 0 AND 100),
  experience_count integer NOT NULL DEFAULT 0 CHECK (experience_count >= 0),
  last_gig_id uuid REFERENCES public.gigs(id) ON DELETE SET NULL,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gig_media_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  publication_id uuid,
  reviewer_type text NOT NULL DEFAULT 'system_template',
  review_tier text NOT NULL CHECK (review_tier IN ('fan_summary','local_blog','local_press','national_press','festival_report','industry_coverage')),
  headline text NOT NULL,
  rating numeric CHECK (rating BETWEEN 0 AND 5),
  summary text NOT NULL,
  positive_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  negative_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  standout_song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  standout_player_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  crowd_response text,
  production_comment text,
  incident_reference jsonb,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('private','band','venue','public')),
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gig_id, review_tier)
);
ALTER TABLE public.band_live_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_media_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.band_live_reputation,public.gig_media_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.band_live_reputation,public.gig_media_reviews TO authenticated;
GRANT ALL ON public.band_live_reputation,public.gig_media_reviews TO service_role;
DROP POLICY IF EXISTS gig_band_live_reputation_read ON public.band_live_reputation;
CREATE POLICY gig_band_live_reputation_read ON public.band_live_reputation
 FOR SELECT TO authenticated USING(public.caller_in_band(band_id));
DROP POLICY IF EXISTS gig_media_reviews_read ON public.gig_media_reviews;
CREATE POLICY gig_media_reviews_read ON public.gig_media_reviews
 FOR SELECT TO authenticated USING(visibility='public' OR public.caller_in_gig_band(gig_id));
CREATE INDEX IF NOT EXISTS experience_ledger_gig_consequence_lookup
 ON public.experience_ledger ((metadata->>'gig_id')) WHERE activity_type='gig_performance';

CREATE OR REPLACE FUNCTION public.process_gig_consequences(p_gig_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g public.gigs%ROWTYPE;
  p public.gig_post_processing_canonical%ROWTYPE;
  o jsonb;
  r public.band_live_reputation%ROWTYPE;
  v_rating numeric;
  v_delta numeric;
  v_xp numeric;
  v_fans numeric;
  v_count integer;
  v_state text;
  v_message text;
BEGIN
  SELECT * INTO g FROM public.gigs WHERE id=p_gig_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_not_found'; END IF;
  IF g.status <> 'completed' OR g.result_ready_at IS NULL THEN
    RETURN jsonb_build_object('status','pending','reason','result_not_ready');
  END IF;
  INSERT INTO public.gig_post_processing_canonical(gig_id,status) VALUES(g.id,'pending')
    ON CONFLICT(gig_id) DO NOTHING;
  SELECT * INTO p FROM public.gig_post_processing_canonical WHERE gig_id=g.id FOR UPDATE;
  -- Completion is valid only with every declared v2 evidence key, never just a flag.
  SELECT count(DISTINCT consequence_key) INTO v_count FROM public.gig_consequence_snapshots
    WHERE gig_id=g.id AND processing_id=p.id AND metadata->>'processor'='consequences-v2'
    AND consequence_key IN ('live_reputation.overall','fans.local_delta','performer.progression','media.review');
  IF p.status='completed' AND p.processing_version='consequences-v2' AND v_count=4 THEN
    RETURN jsonb_build_object('status','completed','alreadyProcessed',true);
  END IF;
  -- Unknown partial effects must be investigated, never inferred or reapplied.
  IF EXISTS(SELECT 1 FROM public.gig_consequence_snapshots WHERE gig_id=g.id)
    OR EXISTS(SELECT 1 FROM public.gig_media_reviews WHERE gig_id=g.id) THEN
    UPDATE public.gig_post_processing_canonical SET status='partially_failed',completed_at=NULL,
      error_snapshot=jsonb_build_object('reason','existing_unverified_snapshots','retryable',false),
      updated_at=now() WHERE id=p.id;
    RETURN jsonb_build_object('status','partially_failed','reason','existing_unverified_snapshots');
  END IF;
  BEGIN
    SELECT to_jsonb(x) INTO STRICT o FROM public.gig_outcomes x WHERE x.gig_id=g.id;
    IF o->>'completed_at' IS NULL OR o->>'overall_rating' IS NULL
      OR o->>'actual_attendance' IS NULL OR g.band_id IS NULL THEN
      RAISE EXCEPTION 'immutable_outcome_incomplete';
    END IF;
    v_rating=(o->>'overall_rating')::numeric;
    IF v_rating < 0 OR v_rating > 25 THEN RAISE EXCEPTION 'invalid_outcome_rating'; END IF;
    UPDATE public.gig_post_processing_canonical SET status='processing',started_at=now(),updated_at=now()
      WHERE id=p.id;
    INSERT INTO public.band_live_reputation(band_id) VALUES(g.band_id) ON CONFLICT(band_id) DO NOTHING;
    SELECT * INTO STRICT r FROM public.band_live_reputation WHERE band_id=g.band_id FOR UPDATE;
    -- Narrow v2 rule: stored performance rating only; no invented historical context.
    v_delta=round(greatest(-8,least(8,(v_rating*4-r.overall_score)*
      greatest(.035,.24/(1+r.experience_count::numeric/8)))),2);
    UPDATE public.band_live_reputation SET overall_score=overall_score+v_delta,
      experience_count=experience_count+1,last_gig_id=g.id,
      breakdown=jsonb_build_object('processor','consequences-v2','rating',v_rating),updated_at=now()
      WHERE band_id=g.band_id;
    INSERT INTO public.gig_consequence_snapshots(gig_id,processing_id,category,target_type,target_id,
      consequence_key,previous_value,delta_value,new_value,status,explanation,source_factors,metadata)
    VALUES(g.id,p.id,'live_reputation','band',g.band_id,'live_reputation.overall',r.overall_score,
      v_delta,r.overall_score+v_delta,CASE WHEN v_delta>0 THEN 'positive' WHEN v_delta<0 THEN 'negative' ELSE 'neutral' END,
      'Live reputation applied once from the stored performance rating, with experience smoothing and an eight-point cap.',
      '["overall_rating","previous_live_reputation"]','{"processor":"consequences-v2","effect":"applied"}');

    -- Core completion owns fan and XP awards. Snapshot existing evidence; NEVER award again.
    v_fans=(o->>'new_followers')::numeric;
    SELECT sum(xp_amount) INTO v_xp FROM public.experience_ledger
      WHERE activity_type='gig_performance' AND metadata->>'gig_id'=g.id::text;
    INSERT INTO public.gig_consequence_snapshots(gig_id,processing_id,category,target_type,target_id,
      consequence_key,delta_value,status,explanation,source_factors,metadata)
    VALUES
      (g.id,p.id,'fans','band',g.band_id,'fans.local_delta',v_fans,'neutral',
       'Recorded core fan reward only; no additional fans were awarded. Missing values remain unavailable.',
       '["gig_outcomes.new_followers"]',jsonb_build_object('processor','consequences-v2','effect','observed_core','available',v_fans IS NOT NULL)),
      (g.id,p.id,'performer','band',g.band_id,'performer.progression',v_xp,'neutral',
       'Recorded gig XP ledger total only; no progression was rerolled or awarded again. Missing ledger evidence remains unavailable.',
       '["experience_ledger"]',jsonb_build_object('processor','consequences-v2','effect','observed_core','available',v_xp IS NOT NULL));

    -- Private, deterministic fan summary; no retroactive news or social spam.
    IF (o->>'actual_attendance')::numeric > 0 THEN
      INSERT INTO public.gig_media_reviews(gig_id,review_tier,headline,rating,summary,visibility,published_at)
      VALUES(g.id,'fan_summary','Recorded gig performance',v_rating/5,
        format('In-game summary: performance %s/25; attendance %s.',v_rating,o->>'actual_attendance'),
        'band',g.result_ready_at);
    END IF;
    INSERT INTO public.gig_consequence_snapshots(gig_id,processing_id,category,target_type,target_id,
      consequence_key,new_value,status,explanation,source_factors,metadata)
    VALUES(g.id,p.id,'media','gig',g.id,'media.review',
      CASE WHEN (o->>'actual_attendance')::numeric>0 THEN v_rating/5 ELSE NULL END,'neutral',
      CASE WHEN (o->>'actual_attendance')::numeric>0 THEN 'Private in-game fan summary saved from the immutable outcome.'
        ELSE 'No media summary: recorded attendance was zero.' END,
      '["overall_rating","actual_attendance"]',jsonb_build_object('processor','consequences-v2',
        'effect',CASE WHEN (o->>'actual_attendance')::numeric>0 THEN 'applied' ELSE 'not_applicable' END));
    UPDATE public.gig_post_processing_canonical SET status='completed',processing_version='consequences-v2',
      completed_at=now(),updated_at=now(),error_snapshot=NULL,
      audit_history=audit_history || jsonb_build_array(jsonb_build_object('event','consequences_completed','at',now(),
        'scope','live reputation, core reward evidence, private fan summary',
        'unavailable','follower movement, booking demand, contextual reputation, health, equipment, opportunities'))
      WHERE id=p.id;
    RETURN jsonb_build_object('status','completed','alreadyProcessed',false);
  EXCEPTION WHEN OTHERS THEN
    -- PL/pgSQL rolls back ALL effects in this block before persisting the failure.
    GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE,v_message=MESSAGE_TEXT;
    UPDATE public.gig_post_processing_canonical SET status='retry_required',completed_at=NULL,updated_at=now(),
      error_snapshot=jsonb_build_object('reason',v_message,'sqlstate',v_state,'retryable',true),
      audit_history=audit_history || jsonb_build_array(jsonb_build_object('event','consequences_failed','at',now(),'sqlstate',v_state))
      WHERE id=p.id;
    RETURN jsonb_build_object('status','retry_required','reason',v_message);
  END;
END $$;
REVOKE ALL ON FUNCTION public.process_gig_consequences(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_gig_consequences(uuid) TO service_role;

-- Explicit bounded historical reconciliation and retry worker. Completed gigs with
-- no historical claim remain legacy_missing. It never calls complete-gig.
CREATE OR REPLACE FUNCTION public.process_pending_gig_consequences(p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v record; v_result jsonb; v_results jsonb='[]'::jsonb;
BEGIN
  IF p_limit IS NULL OR p_limit<1 OR p_limit>1000 THEN RAISE EXCEPTION 'invalid_batch_limit'; END IF;
  FOR v IN SELECT g.id FROM public.gigs g JOIN public.gig_post_processing_canonical p ON p.gig_id=g.id
    WHERE g.status='completed' AND g.result_ready_at IS NOT NULL
      AND (p.status IN ('pending','processing','retry_required')
        OR (p.status='completed' AND NOT EXISTS(
          SELECT 1 FROM public.gig_consequence_snapshots s WHERE s.gig_id=g.id)))
    ORDER BY p.updated_at,g.result_ready_at,g.id LIMIT p_limit FOR UPDATE OF g SKIP LOCKED
  LOOP
    v_result=public.process_gig_consequences(v.id);
    v_results=v_results || jsonb_build_array(jsonb_build_object('gig_id',v.id,'result',v_result));
  END LOOP;
  RETURN v_results;
END $$;
REVOKE ALL ON FUNCTION public.process_pending_gig_consequences(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_pending_gig_consequences(integer) TO service_role;
-- Deliberately omit cron.schedule('process-gig-consequences',...).
NOTIFY pgrst,'reload schema';