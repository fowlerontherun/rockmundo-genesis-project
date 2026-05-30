
CREATE OR REPLACE FUNCTION public.notify_gig_outcome()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band_id uuid;
  v_venue_name text;
  v_rating numeric;
  v_stars text; v_title text; v_type text; v_msg text;
  v_recipients uuid[] := ARRAY[]::uuid[];
  v_leader uuid;
BEGIN
  SELECT g.band_id, COALESCE(v.name, 'Unknown Venue')
    INTO v_band_id, v_venue_name
  FROM public.gigs g LEFT JOIN public.venues v ON v.id = g.venue_id
  WHERE g.id = NEW.gig_id;
  IF v_band_id IS NULL THEN RETURN NEW; END IF;

  v_rating := COALESCE(NEW.overall_rating, 0);
  v_stars := CASE WHEN v_rating>=20 THEN '⭐⭐⭐⭐⭐' WHEN v_rating>=16 THEN '⭐⭐⭐⭐' WHEN v_rating>=12 THEN '⭐⭐⭐' WHEN v_rating>=8 THEN '⭐⭐' ELSE '⭐' END;
  v_title := CASE WHEN v_rating>=20 THEN '🔥 Legendary show at '||v_venue_name WHEN v_rating>=16 THEN '🎸 Great show at '||v_venue_name WHEN v_rating<8 THEN '😬 Rough night at '||v_venue_name ELSE 'Gig complete: '||v_venue_name END;
  v_type := CASE WHEN v_rating>=16 THEN 'success' WHEN v_rating<8 THEN 'warning' ELSE 'info' END;
  v_msg := v_stars||' '||ROUND(v_rating,1)||'/25';

  -- Only real auth users
  SELECT array_agg(DISTINCT p.user_id) INTO v_recipients
  FROM public.band_members bm
  JOIN public.profiles p ON p.id = bm.profile_id
  JOIN auth.users u ON u.id = p.user_id
  WHERE bm.band_id = v_band_id AND bm.member_status='active';

  SELECT leader_id INTO v_leader FROM public.bands WHERE id=v_band_id;
  IF v_leader IS NOT NULL AND EXISTS (SELECT 1 FROM auth.users WHERE id=v_leader)
     AND NOT (v_leader = ANY(COALESCE(v_recipients,ARRAY[]::uuid[]))) THEN
    v_recipients := array_append(COALESCE(v_recipients,ARRAY[]::uuid[]), v_leader);
  END IF;

  IF v_recipients IS NULL OR array_length(v_recipients,1) IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (SELECT 1 FROM public.player_inbox WHERE category='gig_result' AND related_entity_type='gig' AND related_entity_id=NEW.gig_id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.player_inbox (user_id, category, priority, title, message, metadata, action_type, action_data, related_entity_type, related_entity_id)
  SELECT uid, 'gig_result'::inbox_category,
    (CASE WHEN v_rating>=20 THEN 'high' ELSE 'normal' END)::inbox_priority,
    v_title, v_msg,
    jsonb_build_object('gig_id', NEW.gig_id,'band_id',v_band_id,'rating',v_rating,'outcome_id',NEW.id),
    'navigate', jsonb_build_object('route','/gigs'),'gig', NEW.gig_id
  FROM unnest(v_recipients) AS uid;

  INSERT INTO public.notifications (user_id, category, type, title, message, action_path, metadata)
  SELECT uid, 'gig_result', v_type, v_title, v_msg, '/gigs',
    jsonb_build_object('gig_id',NEW.gig_id,'band_id',v_band_id,'rating',v_rating,'outcome_id',NEW.id)
  FROM unnest(v_recipients) AS uid;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_gig_outcome] %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_gig_outcome ON public.gig_outcomes;
CREATE TRIGGER trg_notify_gig_outcome
AFTER INSERT ON public.gig_outcomes
FOR EACH ROW EXECUTE FUNCTION public.notify_gig_outcome();

-- Backfill last 30 days
DO $$
DECLARE
  o RECORD; v_band uuid; v_venue text; v_rating numeric;
  v_stars text; v_title text; v_type text; v_msg text;
  v_recipients uuid[]; v_leader uuid;
BEGIN
  FOR o IN
    SELECT id, gig_id, overall_rating FROM public.gig_outcomes
    WHERE created_at > now()-interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM public.player_inbox pi WHERE pi.category='gig_result' AND pi.related_entity_type='gig' AND pi.related_entity_id=gig_outcomes.gig_id)
  LOOP
    SELECT g.band_id, COALESCE(v.name,'Unknown Venue') INTO v_band, v_venue
    FROM public.gigs g LEFT JOIN public.venues v ON v.id=g.venue_id WHERE g.id=o.gig_id;
    IF v_band IS NULL THEN CONTINUE; END IF;

    v_rating := COALESCE(o.overall_rating,0);
    v_stars := CASE WHEN v_rating>=20 THEN '⭐⭐⭐⭐⭐' WHEN v_rating>=16 THEN '⭐⭐⭐⭐' WHEN v_rating>=12 THEN '⭐⭐⭐' WHEN v_rating>=8 THEN '⭐⭐' ELSE '⭐' END;
    v_title := CASE WHEN v_rating>=20 THEN '🔥 Legendary show at '||v_venue WHEN v_rating>=16 THEN '🎸 Great show at '||v_venue WHEN v_rating<8 THEN '😬 Rough night at '||v_venue ELSE 'Gig complete: '||v_venue END;
    v_type := CASE WHEN v_rating>=16 THEN 'success' WHEN v_rating<8 THEN 'warning' ELSE 'info' END;
    v_msg := v_stars||' '||ROUND(v_rating,1)||'/25';

    SELECT array_agg(DISTINCT p.user_id) INTO v_recipients
    FROM public.band_members bm JOIN public.profiles p ON p.id=bm.profile_id JOIN auth.users u ON u.id=p.user_id
    WHERE bm.band_id=v_band AND bm.member_status='active';
    SELECT leader_id INTO v_leader FROM public.bands WHERE id=v_band;
    IF v_leader IS NOT NULL AND EXISTS (SELECT 1 FROM auth.users WHERE id=v_leader)
       AND NOT (v_leader = ANY(COALESCE(v_recipients,ARRAY[]::uuid[]))) THEN
      v_recipients := array_append(COALESCE(v_recipients,ARRAY[]::uuid[]), v_leader);
    END IF;
    IF v_recipients IS NULL OR array_length(v_recipients,1) IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.player_inbox (user_id, category, priority, title, message, metadata, action_type, action_data, related_entity_type, related_entity_id)
    SELECT uid, 'gig_result'::inbox_category,
      (CASE WHEN v_rating>=20 THEN 'high' ELSE 'normal' END)::inbox_priority,
      v_title, v_msg,
      jsonb_build_object('gig_id',o.gig_id,'band_id',v_band,'rating',v_rating,'outcome_id',o.id,'backfilled',true),
      'navigate', jsonb_build_object('route','/gigs'),'gig', o.gig_id
    FROM unnest(v_recipients) AS uid;

    INSERT INTO public.notifications (user_id, category, type, title, message, action_path, metadata)
    SELECT uid, 'gig_result', v_type, v_title, v_msg, '/gigs',
      jsonb_build_object('gig_id',o.gig_id,'band_id',v_band,'rating',v_rating,'outcome_id',o.id,'backfilled',true)
    FROM unnest(v_recipients) AS uid;
  END LOOP;
END $$;
