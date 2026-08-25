-- Support Band Marketplace Phase 8: tour assignment visibility and accepted-slot cancellation rules.

CREATE TABLE IF NOT EXISTS public.support_band_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_slot_id uuid NOT NULL UNIQUE REFERENCES public.gig_support_slots(id) ON DELETE RESTRICT,
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  support_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE RESTRICT,
  headliner_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE RESTRICT,
  cancelled_by_role text NOT NULL CHECK (cancelled_by_role IN ('support','headliner')),
  reason text,
  hours_before_show numeric(10,2) NOT NULL DEFAULT 0,
  reliability_penalty numeric(5,2) NOT NULL DEFAULT 0,
  reputation_penalty integer NOT NULL DEFAULT 0,
  relationship_penalty integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_band_cancellations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Involved bands can view support cancellations" ON public.support_band_cancellations;
CREATE POLICY "Involved bands can view support cancellations"
  ON public.support_band_cancellations FOR SELECT TO authenticated
  USING (
    public.can_manage_band_gigs(support_band_id, auth.uid())
    OR public.can_manage_band_gigs(headliner_band_id, auth.uid())
  );

CREATE OR REPLACE FUNCTION public.get_tour_support_assignments(
  p_headliner_band_id uuid,
  p_tour_id uuid
) RETURNS TABLE (
  gig_id uuid,
  scheduled_date timestamptz,
  scheduled_end timestamptz,
  venue_id uuid,
  venue_name text,
  city_id uuid,
  city_name text,
  support_slot_id uuid,
  support_band_id uuid,
  support_band_name text,
  support_status text,
  revenue_share numeric,
  invited_at timestamptz,
  responded_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    g.id,
    g.scheduled_date,
    g.scheduled_end,
    g.venue_id,
    v.name,
    v.city_id,
    c.name,
    gs.id,
    gs.support_band_id,
    sb.name,
    gs.status,
    gs.revenue_share,
    gs.invited_at,
    gs.responded_at
  FROM public.gigs g
  JOIN public.venues v ON v.id = g.venue_id
  LEFT JOIN public.cities c ON c.id = v.city_id
  LEFT JOIN LATERAL (
    SELECT s.*
    FROM public.gig_support_slots s
    WHERE s.gig_id = g.id
      AND s.status IN ('pending','accepted','completed','cancelled')
    ORDER BY
      CASE s.status WHEN 'accepted' THEN 1 WHEN 'completed' THEN 2 WHEN 'pending' THEN 3 ELSE 4 END,
      s.invited_at DESC
    LIMIT 1
  ) gs ON true
  LEFT JOIN public.bands sb ON sb.id = gs.support_band_id
  WHERE g.tour_id = p_tour_id
    AND g.band_id = p_headliner_band_id
    AND public.can_manage_band_gigs(g.band_id, auth.uid())
  ORDER BY g.scheduled_date, g.id;
$$;

REVOKE ALL ON FUNCTION public.get_tour_support_assignments(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tour_support_assignments(uuid,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cancel_confirmed_support_slot(
  p_support_slot_id uuid,
  p_reason text DEFAULT NULL
) RETURNS public.gig_support_slots
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slot public.gig_support_slots%ROWTYPE;
  v_gig public.gigs%ROWTYPE;
  v_role text;
  v_hours numeric;
  v_reliability_penalty numeric := 0;
  v_reputation_penalty integer := 0;
  v_relationship_penalty integer := 0;
  v_a uuid;
  v_b uuid;
  v_completed integer := 0;
  v_cancelled integer := 0;
  v_support_name text;
  v_headliner_name text;
  v_venue_name text;
  r record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'support_cancel_unauthenticated' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_slot
  FROM public.gig_support_slots
  WHERE id = p_support_slot_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'support_cancel_slot_not_found' USING ERRCODE='23503';
  END IF;

  SELECT * INTO v_gig FROM public.gigs WHERE id = v_slot.gig_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'support_cancel_gig_not_found' USING ERRCODE='23503';
  END IF;

  IF v_slot.status = 'cancelled' THEN
    RETURN v_slot;
  END IF;
  IF v_slot.status <> 'accepted' THEN
    RAISE EXCEPTION 'support_cancel_not_confirmed' USING ERRCODE='23514';
  END IF;
  IF v_gig.scheduled_date <= now() OR v_gig.status NOT IN ('scheduled','ready_for_completion') THEN
    RAISE EXCEPTION 'support_cancel_show_started' USING ERRCODE='23514';
  END IF;

  IF public.can_manage_band_gigs(v_slot.support_band_id, auth.uid()) THEN
    v_role := 'support';
  ELSIF public.can_manage_band_gigs(v_gig.band_id, auth.uid()) THEN
    v_role := 'headliner';
  ELSE
    RAISE EXCEPTION 'support_cancel_forbidden' USING ERRCODE='42501';
  END IF;

  v_hours := GREATEST(0, EXTRACT(EPOCH FROM (v_gig.scheduled_date - now())) / 3600.0);
  IF v_role = 'support' THEN
    IF v_hours < 24 THEN
      v_reliability_penalty := 25; v_reputation_penalty := 30; v_relationship_penalty := 18;
    ELSIF v_hours < 72 THEN
      v_reliability_penalty := 15; v_reputation_penalty := 18; v_relationship_penalty := 10;
    ELSIF v_hours < 168 THEN
      v_reliability_penalty := 8; v_reputation_penalty := 10; v_relationship_penalty := 6;
    ELSE
      v_reliability_penalty := 4; v_reputation_penalty := 5; v_relationship_penalty := 3;
    END IF;
  ELSE
    -- Headliner cancellations do not damage the support band's reliability.
    v_relationship_penalty := CASE WHEN v_hours < 72 THEN 6 ELSE 3 END;
  END IF;

  INSERT INTO public.support_band_cancellations(
    support_slot_id,gig_id,support_band_id,headliner_band_id,cancelled_by_role,reason,
    hours_before_show,reliability_penalty,reputation_penalty,relationship_penalty
  ) VALUES (
    v_slot.id,v_gig.id,v_slot.support_band_id,v_gig.band_id,v_role,NULLIF(trim(COALESCE(p_reason,'')),''),
    round(v_hours,2),v_reliability_penalty,v_reputation_penalty,v_relationship_penalty
  ) ON CONFLICT (support_slot_id) DO NOTHING;

  UPDATE public.gig_support_slots
  SET status='cancelled', responded_at=COALESCE(responded_at,now()), response_note=COALESCE(NULLIF(trim(COALESCE(p_reason,'')),''), response_note), updated_at=now()
  WHERE id=v_slot.id
  RETURNING * INTO v_slot;

  UPDATE public.player_scheduled_activities
  SET status='cancelled', updated_at=now()
  WHERE linked_gig_id=v_gig.id
    AND status <> 'cancelled'
    AND (
      metadata->>'support_slot_id' = v_slot.id::text
      OR (metadata->>'gig_role'='support' AND metadata->>'band_id'=v_slot.support_band_id::text)
    );

  IF v_role='support' THEN
    INSERT INTO public.band_support_reputation(
      band_id,cancelled_support_shows,reliability_score,reputation_score,updated_at
    ) VALUES (
      v_slot.support_band_id,1,GREATEST(0,100-v_reliability_penalty),GREATEST(0,-v_reputation_penalty),now()
    ) ON CONFLICT (band_id) DO UPDATE SET
      cancelled_support_shows=public.band_support_reputation.cancelled_support_shows+1,
      reputation_score=GREATEST(0,public.band_support_reputation.reputation_score-v_reputation_penalty),
      updated_at=now();

    SELECT completed_support_shows,cancelled_support_shows
    INTO v_completed,v_cancelled
    FROM public.band_support_reputation
    WHERE band_id=v_slot.support_band_id;

    UPDATE public.band_support_reputation
    SET reliability_score=LEAST(100,GREATEST(0,
      round((v_completed::numeric / GREATEST(1,v_completed+v_cancelled))*100,2)
      - CASE WHEN v_hours < 24 THEN 5 WHEN v_hours < 72 THEN 2 ELSE 0 END
    )), updated_at=now()
    WHERE band_id=v_slot.support_band_id;
  END IF;

  v_a := LEAST(v_gig.band_id::text,v_slot.support_band_id::text)::uuid;
  v_b := GREATEST(v_gig.band_id::text,v_slot.support_band_id::text)::uuid;
  INSERT INTO public.band_support_relationships(band_a_id,band_b_id,relationship_score,shows_together,updated_at)
  VALUES(v_a,v_b,-v_relationship_penalty,0,now())
  ON CONFLICT (band_a_id,band_b_id) DO UPDATE SET
    relationship_score=GREATEST(-1000,public.band_support_relationships.relationship_score-v_relationship_penalty),
    updated_at=now();

  SELECT name INTO v_support_name FROM public.bands WHERE id=v_slot.support_band_id;
  SELECT name INTO v_headliner_name FROM public.bands WHERE id=v_gig.band_id;
  SELECT name INTO v_venue_name FROM public.venues WHERE id=v_gig.venue_id;

  FOR r IN
    SELECT DISTINCT bm.user_id, bm.band_id
    FROM public.band_members bm
    WHERE bm.band_id IN (v_slot.support_band_id,v_gig.band_id)
      AND COALESCE(bm.member_status,'active')='active'
      AND bm.user_id IS NOT NULL
  LOOP
    INSERT INTO public.player_inbox(user_id,category,priority,title,message,metadata,action_type,action_data,related_entity_type,related_entity_id)
    VALUES(
      r.user_id,'gig_result',CASE WHEN v_hours < 72 THEN 'high' ELSE 'normal' END,
      'Support slot cancelled',
      CASE
        WHEN r.band_id=v_slot.support_band_id AND v_role='support' THEN
          format('Your band cancelled the support slot with %s at %s. Reliability and support reputation were reduced.',COALESCE(v_headliner_name,'the headliner'),COALESCE(v_venue_name,'the venue'))
        WHEN r.band_id=v_slot.support_band_id THEN
          format('%s cancelled your support slot at %s. Your support reliability was not penalised.',COALESCE(v_headliner_name,'The headliner'),COALESCE(v_venue_name,'the venue'))
        WHEN v_role='support' THEN
          format('%s cancelled the support slot at %s. The date is available for a replacement support act.',COALESCE(v_support_name,'The support band'),COALESCE(v_venue_name,'the venue'))
        ELSE
          format('Your band cancelled %s''s support slot at %s.',COALESCE(v_support_name,'the support band'),COALESCE(v_venue_name,'the venue'))
      END,
      jsonb_build_object('gig_id',v_gig.id,'support_slot_id',v_slot.id,'cancelled_by',v_role,'hours_before_show',round(v_hours,2),'reliability_penalty',v_reliability_penalty,'reputation_penalty',v_reputation_penalty,'relationship_penalty',v_relationship_penalty),
      'navigate',jsonb_build_object('route','/gigs'),'gig',v_gig.id
    );
  END LOOP;

  RETURN v_slot;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_confirmed_support_slot(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_confirmed_support_slot(uuid,text) TO authenticated;

COMMENT ON FUNCTION public.cancel_confirmed_support_slot(uuid,text) IS
  'Cancels an accepted future support slot transactionally, releases member schedule blocks, records the cancellation and applies reliability/reputation penalties only when the support band cancels.';
