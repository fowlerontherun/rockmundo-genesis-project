-- Support Band Marketplace Phase 6: durable history, reputation, relationships and player notifications.

CREATE TABLE IF NOT EXISTS public.band_support_reputation (
  band_id uuid PRIMARY KEY REFERENCES public.bands(id) ON DELETE CASCADE,
  completed_support_shows integer NOT NULL DEFAULT 0,
  successful_support_shows integer NOT NULL DEFAULT 0,
  cancelled_support_shows integer NOT NULL DEFAULT 0,
  reliability_score numeric(5,2) NOT NULL DEFAULT 100,
  performance_score numeric(6,2) NOT NULL DEFAULT 0,
  reputation_score integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT band_support_reputation_counts_check CHECK (completed_support_shows >= 0 AND successful_support_shows >= 0 AND cancelled_support_shows >= 0),
  CONSTRAINT band_support_reputation_reliability_check CHECK (reliability_score >= 0 AND reliability_score <= 100)
);

CREATE TABLE IF NOT EXISTS public.band_support_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL UNIQUE REFERENCES public.gigs(id) ON DELETE CASCADE,
  support_slot_id uuid NOT NULL UNIQUE REFERENCES public.gig_support_slots(id) ON DELETE RESTRICT,
  support_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE RESTRICT,
  headliner_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE RESTRICT,
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  performed_at timestamptz,
  attendance integer NOT NULL DEFAULT 0,
  performance_rating numeric(6,2) NOT NULL DEFAULT 0,
  ticket_revenue integer NOT NULL DEFAULT 0,
  support_payment integer NOT NULL DEFAULT 0,
  ticket_demand_multiplier numeric(6,4) NOT NULL DEFAULT 1,
  support_fame_gain integer NOT NULL DEFAULT 0,
  support_fan_gain integer NOT NULL DEFAULT 0,
  support_popularity_gain integer NOT NULL DEFAULT 0,
  headliner_fame_gain integer NOT NULL DEFAULT 0,
  headliner_popularity_gain integer NOT NULL DEFAULT 0,
  relationship_gain integer NOT NULL DEFAULT 0,
  reputation_gain integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.band_support_relationships (
  band_a_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  band_b_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  relationship_score integer NOT NULL DEFAULT 0,
  shows_together integer NOT NULL DEFAULT 0,
  last_gig_id uuid REFERENCES public.gigs(id) ON DELETE SET NULL,
  last_performed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (band_a_id, band_b_id),
  CONSTRAINT band_support_relationship_distinct_check CHECK (band_a_id <> band_b_id),
  CONSTRAINT band_support_relationship_canonical_check CHECK (band_a_id::text < band_b_id::text)
);

ALTER TABLE public.band_support_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_support_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_support_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can view support reputation" ON public.band_support_reputation;
CREATE POLICY "Players can view support reputation" ON public.band_support_reputation FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Involved bands can view support history" ON public.band_support_history;
CREATE POLICY "Involved bands can view support history" ON public.band_support_history FOR SELECT TO authenticated USING (
  public.can_manage_band_gigs(support_band_id, auth.uid()) OR public.can_manage_band_gigs(headliner_band_id, auth.uid())
);

DROP POLICY IF EXISTS "Involved bands can view support relationships" ON public.band_support_relationships;
CREATE POLICY "Involved bands can view support relationships" ON public.band_support_relationships FOR SELECT TO authenticated USING (
  public.can_manage_band_gigs(band_a_id, auth.uid()) OR public.can_manage_band_gigs(band_b_id, auth.uid())
);

CREATE OR REPLACE FUNCTION public.record_support_band_history(p_gig_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s public.support_band_gig_settlements%ROWTYPE;
  g public.gigs%ROWTYPE;
  o public.gig_outcomes%ROWTYPE;
  v public.venues%ROWTYPE;
  h public.band_support_history%ROWTYPE;
  a uuid;
  b uuid;
  v_relationship_gain integer;
  v_reputation_gain integer;
  v_success boolean;
  v_completed integer;
  v_cancelled integer;
  v_perf numeric;
  recipient record;
  headliner_name text;
  support_name text;
  venue_name text;
BEGIN
  SELECT * INTO s FROM public.support_band_gig_settlements WHERE gig_id=p_gig_id FOR UPDATE;
  IF s.id IS NULL OR s.progression_applied_at IS NULL THEN
    RETURN jsonb_build_object('recorded',false,'reason','settlement_not_ready');
  END IF;

  SELECT * INTO h FROM public.band_support_history WHERE gig_id=p_gig_id;
  IF h.id IS NOT NULL THEN RETURN to_jsonb(h); END IF;

  SELECT * INTO g FROM public.gigs WHERE id=p_gig_id;
  SELECT * INTO o FROM public.gig_outcomes WHERE gig_id=p_gig_id;
  SELECT * INTO v FROM public.venues WHERE id=g.venue_id;

  v_success := COALESCE(o.overall_rating,0) >= 12;
  v_relationship_gain := LEAST(12, GREATEST(2, round(COALESCE(o.overall_rating,0) / 3.0)::integer));
  v_reputation_gain := LEAST(10, GREATEST(1, round(COALESCE(o.overall_rating,0) / 3.5)::integer));

  INSERT INTO public.band_support_history(
    gig_id,support_slot_id,support_band_id,headliner_band_id,venue_id,city_id,performed_at,attendance,performance_rating,
    ticket_revenue,support_payment,ticket_demand_multiplier,support_fame_gain,support_fan_gain,support_popularity_gain,
    headliner_fame_gain,headliner_popularity_gain,relationship_gain,reputation_gain
  ) VALUES (
    p_gig_id,s.support_slot_id,s.support_band_id,s.headliner_band_id,g.venue_id,v.city_id,COALESCE(g.completed_at,g.scheduled_date),
    GREATEST(0,COALESCE(o.actual_attendance,0)),COALESCE(o.overall_rating,0),s.ticket_revenue,s.support_share,s.demand_multiplier,
    s.support_fame_gain,s.support_fan_gain,s.support_popularity_gain,s.headliner_fame_gain,s.headliner_popularity_gain,
    v_relationship_gain,v_reputation_gain
  ) RETURNING * INTO h;

  INSERT INTO public.band_support_reputation(band_id,completed_support_shows,successful_support_shows,reputation_score,performance_score,updated_at)
  VALUES(s.support_band_id,1,CASE WHEN v_success THEN 1 ELSE 0 END,v_reputation_gain,COALESCE(o.overall_rating,0),now())
  ON CONFLICT (band_id) DO UPDATE SET
    completed_support_shows=public.band_support_reputation.completed_support_shows+1,
    successful_support_shows=public.band_support_reputation.successful_support_shows+CASE WHEN v_success THEN 1 ELSE 0 END,
    reputation_score=LEAST(1000,public.band_support_reputation.reputation_score+v_reputation_gain),
    performance_score=((public.band_support_reputation.performance_score*public.band_support_reputation.completed_support_shows)+COALESCE(o.overall_rating,0))/(public.band_support_reputation.completed_support_shows+1),
    updated_at=now();

  SELECT completed_support_shows,cancelled_support_shows,performance_score INTO v_completed,v_cancelled,v_perf
  FROM public.band_support_reputation WHERE band_id=s.support_band_id;
  UPDATE public.band_support_reputation
  SET reliability_score=LEAST(100, GREATEST(0, round((v_completed::numeric / GREATEST(1,v_completed+v_cancelled))*100,2))), updated_at=now()
  WHERE band_id=s.support_band_id;

  a := LEAST(s.headliner_band_id::text,s.support_band_id::text)::uuid;
  b := GREATEST(s.headliner_band_id::text,s.support_band_id::text)::uuid;
  INSERT INTO public.band_support_relationships(band_a_id,band_b_id,relationship_score,shows_together,last_gig_id,last_performed_at,updated_at)
  VALUES(a,b,v_relationship_gain,1,p_gig_id,COALESCE(g.completed_at,g.scheduled_date),now())
  ON CONFLICT (band_a_id,band_b_id) DO UPDATE SET
    relationship_score=LEAST(1000,public.band_support_relationships.relationship_score+v_relationship_gain),
    shows_together=public.band_support_relationships.shows_together+1,
    last_gig_id=p_gig_id,last_performed_at=COALESCE(g.completed_at,g.scheduled_date),updated_at=now();

  SELECT name INTO headliner_name FROM public.bands WHERE id=s.headliner_band_id;
  SELECT name INTO support_name FROM public.bands WHERE id=s.support_band_id;
  SELECT name INTO venue_name FROM public.venues WHERE id=g.venue_id;

  FOR recipient IN
    SELECT DISTINCT bm.user_id, CASE WHEN bm.band_id=s.support_band_id THEN 'support' ELSE 'headliner' END AS role
    FROM public.band_members bm
    WHERE bm.band_id IN (s.support_band_id,s.headliner_band_id)
      AND bm.member_status='active' AND bm.user_id IS NOT NULL
  LOOP
    INSERT INTO public.player_inbox(user_id,category,priority,title,message,metadata,action_type,action_data,related_entity_type,related_entity_id)
    VALUES(
      recipient.user_id,'gig_result','normal',
      CASE WHEN recipient.role='support' THEN '🎸 Support Show Complete' ELSE '🤝 Support Act Result' END,
      CASE WHEN recipient.role='support' THEN
        format('You supported %s at %s. Payment: $%s · +%s fame · +%s fans · reputation +%s.',COALESCE(headliner_name,'the headliner'),COALESCE(venue_name,'the venue'),s.support_share,s.support_fame_gain,s.support_fan_gain,v_reputation_gain)
      ELSE
        format('%s supported your show at %s. Ticket demand: +%s%% · relationship +%s.',COALESCE(support_name,'Your support act'),COALESCE(venue_name,'the venue'),round((s.demand_multiplier-1)*100),v_relationship_gain)
      END,
      jsonb_build_object('gig_id',p_gig_id,'support_band_id',s.support_band_id,'headliner_band_id',s.headliner_band_id,'support_payment',s.support_share,'reputation_gain',v_reputation_gain,'relationship_gain',v_relationship_gain),
      'navigate',jsonb_build_object('route','/gigs'),'gig',p_gig_id
    );
  END LOOP;

  RETURN to_jsonb(h);
END;
$$;

REVOKE ALL ON FUNCTION public.record_support_band_history(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_support_band_history(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.capture_support_band_history_after_settlement()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.progression_applied_at IS NOT NULL AND OLD.progression_applied_at IS NULL THEN
    PERFORM public.record_support_band_history(NEW.gig_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capture_support_band_history_trigger ON public.support_band_gig_settlements;
CREATE TRIGGER capture_support_band_history_trigger
AFTER UPDATE OF progression_applied_at ON public.support_band_gig_settlements
FOR EACH ROW EXECUTE FUNCTION public.capture_support_band_history_after_settlement();

CREATE OR REPLACE FUNCTION public.get_band_support_summary(p_band_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'reputation',COALESCE((SELECT to_jsonb(r) FROM public.band_support_reputation r WHERE r.band_id=p_band_id),'{}'::jsonb),
    'supportHistory',COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.performed_at DESC) FROM (SELECT * FROM public.band_support_history WHERE support_band_id=p_band_id ORDER BY performed_at DESC LIMIT 50) h),'[]'::jsonb),
    'headlinerHistory',COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.performed_at DESC) FROM (SELECT * FROM public.band_support_history WHERE headliner_band_id=p_band_id ORDER BY performed_at DESC LIMIT 50) h),'[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.get_band_support_summary(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_band_support_summary(uuid) TO authenticated,service_role;
