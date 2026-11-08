-- Broader touring interest, durable proposals and notifications use existing booking authority.
ALTER TABLE public.band_support_preferences
 ADD COLUMN availability_scope text NOT NULL DEFAULT 'declared' CHECK (availability_scope IN ('declared','countries','worldwide')),
 ADD COLUMN touring_countries text[] NOT NULL DEFAULT '{}',
 ADD COLUMN touring_from date, ADD COLUMN touring_until date,
 ADD CONSTRAINT touring_dates_valid CHECK (touring_from IS NULL OR touring_until IS NULL OR touring_until>=touring_from);
CREATE FUNCTION public.set_support_touring_scope(p_band_id uuid,p_scope text,p_countries text[],p_from date,p_until date,p_travel boolean,p_max_minutes integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.can_manage_band_gigs(p_band_id,auth.uid()),false) THEN RAISE EXCEPTION 'support_scope_forbidden' USING ERRCODE='42501'; END IF;
 IF p_scope IS NULL OR p_scope NOT IN ('declared','countries','worldwide') OR p_travel IS NULL OR p_max_minutes IS NOT NULL AND p_max_minutes<0 OR
    p_from IS NOT NULL AND p_until IS NOT NULL AND p_until<p_from OR cardinality(COALESCE(p_countries,'{}'))>100 OR
    p_scope='countries' AND COALESCE(cardinality(p_countries),0)=0 OR
    EXISTS(SELECT 1 FROM unnest(p_countries) x WHERE x IS NULL OR NOT EXISTS(SELECT 1 FROM public.cities c WHERE c.country=x)) THEN RAISE EXCEPTION 'support_scope_invalid' USING ERRCODE='22023'; END IF;
 INSERT INTO public.band_support_preferences(band_id,availability_scope,touring_countries,touring_from,touring_until,travel_enabled,max_travel_minutes)
 VALUES(p_band_id,p_scope,CASE WHEN p_scope='countries' THEN p_countries ELSE '{}' END,p_from,p_until,p_travel,p_max_minutes)
 ON CONFLICT(band_id) DO UPDATE SET availability_scope=EXCLUDED.availability_scope,touring_countries=EXCLUDED.touring_countries,touring_from=p_from,touring_until=p_until,travel_enabled=p_travel,max_travel_minutes=p_max_minutes,updated_at=now();
END; $$;
REVOKE ALL ON FUNCTION public.set_support_touring_scope(uuid,text,text[],date,date,boolean,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_support_touring_scope(uuid,text,text[],date,date,boolean,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.find_available_support_bands(
  p_headliner_band_id uuid,
  p_city_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_for_tour boolean DEFAULT false,
  p_venue_capacity integer DEFAULT 0
) RETURNS TABLE (
  band_id uuid,
  band_name text,
  fame integer,
  popularity integer,
  availability_id uuid,
  available_from date,
  available_until date
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH headliner AS (
    SELECT b.id, COALESCE(b.fame,0)::integer AS fame
    FROM public.bands b
    WHERE b.id = p_headliner_band_id AND b.status = 'active'
  ), candidates AS (
    SELECT DISTINCT ON (b.id)
      b.id AS band_id,
      b.name AS band_name,
      COALESCE(b.fame,0)::integer AS fame,
      COALESCE(b.popularity,0)::integer AS popularity,
      a.id AS availability_id,
      COALESCE(a.available_from,pref.touring_from,date '1970-01-01') AS available_from,
      COALESCE(a.available_until,pref.touring_until,date '9999-12-31') AS available_until
    FROM public.bands b
    JOIN public.band_support_preferences pref ON pref.band_id = b.id
    LEFT JOIN public.band_support_availability a ON a.band_id = b.id AND a.status='active' AND a.city_id=p_city_id AND (p_start AT TIME ZONE 'UTC')::date BETWEEN a.available_from AND a.available_until
    CROSS JOIN headliner h
    WHERE b.status = 'active'
      AND b.id <> p_headliner_band_id
      AND pref.enabled
      AND (CASE WHEN p_for_tour THEN pref.tour_enabled ELSE pref.single_gigs_enabled END)
      AND h.fame >= pref.minimum_headliner_fame
      AND COALESCE(p_venue_capacity,0) >= pref.minimum_venue_capacity
      AND p_start>now() AND p_end>p_start
      AND (((NOT p_for_tour OR pref.availability_scope='declared') AND a.id IS NOT NULL)
       OR (p_for_tour AND pref.availability_scope IN ('countries','worldwide')
        AND (pref.touring_from IS NULL OR p_start::date>=pref.touring_from)
        AND (pref.touring_until IS NULL OR p_end::date<=pref.touring_until)
        AND (pref.availability_scope='worldwide' OR EXISTS(SELECT 1 FROM public.cities city WHERE city.id=p_city_id AND city.country=ANY(pref.touring_countries)))))
      AND NOT EXISTS (
        SELECT 1
        FROM public.gigs g
        WHERE g.band_id = b.id
          AND g.status IN ('scheduled','in_progress','ready_for_completion')
          AND g.scheduled_date < p_end
          AND COALESCE(g.scheduled_end, g.scheduled_date + interval '3 hours') > p_start
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.player_scheduled_activities psa
        WHERE psa.status IN ('scheduled','in_progress')
          AND psa.scheduled_start < p_end
          AND psa.scheduled_end > p_start
          AND psa.profile_id IN (
            SELECT COALESCE(bm.profile_id, mp.id)
            FROM public.band_members bm
            LEFT JOIN public.profiles mp ON mp.user_id = bm.user_id
            WHERE bm.band_id = b.id
              AND COALESCE(bm.member_status,'active') = 'active'
              AND COALESCE(bm.is_touring_member,false) = false
              AND COALESCE(bm.profile_id, mp.id) IS NOT NULL
            UNION
            SELECT b.leader_id
            WHERE EXISTS (SELECT 1 FROM public.profiles lp WHERE lp.id = b.leader_id)
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.gig_support_slots gs
        JOIN public.gigs existing_gig ON existing_gig.id = gs.gig_id
        WHERE gs.support_band_id = b.id
          AND gs.status IN ('accepted','completed')
          AND existing_gig.scheduled_date < p_end
          AND COALESCE(existing_gig.scheduled_end, existing_gig.scheduled_date + interval '3 hours') > p_start
      )
    ORDER BY b.id, a.available_until DESC
  )
  SELECT * FROM candidates
  ORDER BY popularity DESC, fame DESC, band_name ASC;
$$;


CREATE TABLE public.support_tour_proposals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL UNIQUE,
 tour_id uuid NOT NULL REFERENCES public.tours(id), headliner_band_id uuid NOT NULL REFERENCES public.bands(id),
 support_band_id uuid NOT NULL REFERENCES public.bands(id), slot_ids uuid[] NOT NULL, itinerary jsonb NOT NULL,
 note text NOT NULL DEFAULT '' CHECK(length(note)<=500),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','withdrawn','expired','changed')),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(headliner_band_id<>support_band_id), CHECK(cardinality(slot_ids) BETWEEN 1 AND 100)
);
CREATE INDEX support_proposals_headliner_idx ON public.support_tour_proposals(headliner_band_id,created_at DESC);
CREATE INDEX support_proposals_band_idx ON public.support_tour_proposals(support_band_id,created_at DESC);
CREATE INDEX support_proposals_expiry_idx ON public.support_tour_proposals(expires_at) WHERE status='pending';
CREATE INDEX support_proposals_slots_idx ON public.support_tour_proposals USING gin(slot_ids);
ALTER TABLE public.support_tour_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_tour_proposals FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.support_tour_proposals TO authenticated;
GRANT ALL ON public.support_tour_proposals TO service_role;
CREATE POLICY proposals_read ON public.support_tour_proposals FOR SELECT TO authenticated USING
 (public.can_manage_band_gigs(headliner_band_id,(SELECT auth.uid())) OR public.can_manage_band_gigs(support_band_id,(SELECT auth.uid())));

-- Internal route validation includes other booked gigs and the members' current cities.
CREATE FUNCTION public.validate_support_route(p_band_id uuid,p_gig_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r record; prev_city uuid; prev_end timestamptz; minutes integer; pref public.band_support_preferences%ROWTYPE; first_id uuid; first_city uuid; first_start timestamptz; member record;
BEGIN
 SELECT * INTO pref FROM public.band_support_preferences WHERE band_id=p_band_id;
 FOR r IN
  SELECT g.id,g.scheduled_date,COALESCE(g.scheduled_end,g.scheduled_date+interval '3 hours') AS ends,v.city_id
  FROM public.gigs g JOIN public.venues v ON v.id=g.venue_id
  WHERE COALESCE(g.scheduled_end,g.scheduled_date+interval '3 hours')>now() AND g.status IN ('scheduled','ready_for_completion','in_progress') AND
   (g.id=ANY(p_gig_ids) OR g.band_id=p_band_id OR EXISTS(SELECT 1 FROM public.gig_support_slots s WHERE s.gig_id=g.id AND s.support_band_id=p_band_id AND s.status='accepted'))
  ORDER BY g.scheduled_date,g.id
 LOOP
  IF first_id IS NULL THEN first_id:=r.id; first_city:=r.city_id; first_start:=r.scheduled_date; END IF;
  IF prev_end IS NOT NULL THEN
   minutes:=COALESCE(public.estimate_support_travel_minutes(prev_city,r.city_id),360);
   IF prev_city IS DISTINCT FROM r.city_id AND (NOT COALESCE(pref.travel_enabled,false) OR pref.max_travel_minutes IS NOT NULL AND minutes>pref.max_travel_minutes) OR prev_end+make_interval(mins=>minutes)>r.scheduled_date THEN
     RAISE EXCEPTION 'support_route_unreachable' USING ERRCODE='23P01';
   END IF;
  END IF;
  prev_city:=r.city_id; prev_end:=r.ends;
 END LOOP;
 IF first_id IS NOT NULL AND first_start>now() THEN
  FOR member IN SELECT DISTINCT p.id,p.current_city_id FROM public.profiles p WHERE p.id IN (
   SELECT COALESCE(bm.profile_id,mp.id) FROM public.band_members bm LEFT JOIN public.profiles mp ON mp.user_id=bm.user_id
    WHERE bm.band_id=p_band_id AND COALESCE(bm.member_status,'active')='active' AND NOT COALESCE(bm.is_touring_member,false)
   UNION SELECT leader_id FROM public.bands WHERE id=p_band_id)
  LOOP
   IF member.current_city_id IS NULL THEN RAISE EXCEPTION 'support_route_location_unknown' USING ERRCODE='23514'; END IF;
   minutes:=COALESCE(public.estimate_support_travel_minutes(member.current_city_id,first_city),360);
   IF member.current_city_id IS DISTINCT FROM first_city AND (NOT COALESCE(pref.travel_enabled,false) OR pref.max_travel_minutes IS NOT NULL AND minutes>pref.max_travel_minutes) OR now()+make_interval(mins=>minutes)>first_start THEN RAISE EXCEPTION 'support_route_arrival_unreachable' USING ERRCODE='23P01'; END IF;
  END LOOP;
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.validate_support_route(uuid,uuid[]) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.create_support_tour_proposal(p_headliner_band_id uuid,p_tour_id uuid,p_support_band_id uuid,p_gig_ids uuid[],p_request_id uuid,p_note text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE existing public.support_tour_proposals%ROWTYPE; items jsonb; slots uuid[]; expiry timestamptz; result uuid; old_flag text;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.can_manage_band_gigs(p_headliner_band_id,auth.uid()),false) THEN RAISE EXCEPTION 'proposal_forbidden' USING ERRCODE='42501'; END IF;
 IF length(COALESCE(p_note,''))>500 THEN RAISE EXCEPTION 'proposal_note_invalid'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('support-proposal:'||p_request_id::text,0));
 SELECT * INTO existing FROM public.support_tour_proposals WHERE request_id=p_request_id;
 IF FOUND THEN
  IF existing.headliner_band_id<>p_headliner_band_id OR existing.support_band_id<>p_support_band_id OR existing.tour_id<>p_tour_id OR
    (SELECT array_agg((x->>'gig_id')::uuid ORDER BY x->>'gig_id') FROM jsonb_array_elements(existing.itinerary) x) IS DISTINCT FROM (SELECT array_agg(g ORDER BY g) FROM unnest(p_gig_ids) g) THEN RAISE EXCEPTION 'proposal_request_mismatch'; END IF;
  RETURN existing.id;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('support-band:'||p_support_band_id::text,0));
 PERFORM public.validate_support_route(p_support_band_id,p_gig_ids);
 old_flag:=current_setting('app.support_proposal',true); PERFORM set_config('app.support_proposal','1',true);
 PERFORM public.create_tour_support_offers(p_headliner_band_id,p_tour_id,p_support_band_id,p_gig_ids,p_request_id);
 SELECT jsonb_agg(jsonb_build_object('slot_id',s.id,'gig_id',g.id,'tour_id',g.tour_id,'scheduled_date',g.scheduled_date,'scheduled_end',g.scheduled_end,'venue_id',v.id,'venue_name',v.name,'city_name',c.name,'city_id',c.id,'travel_minutes_from_previous',COALESCE(public.estimate_support_travel_minutes((SELECT v2.city_id FROM public.gigs g2 JOIN public.venues v2 ON v2.id=g2.venue_id WHERE g2.id=ANY(p_gig_ids) AND g2.scheduled_date<g.scheduled_date ORDER BY g2.scheduled_date DESC LIMIT 1),c.id),0),'revenue_share',s.revenue_share) ORDER BY g.scheduled_date,g.id),array_agg(s.id ORDER BY g.scheduled_date,g.id),least(now()+interval '7 days',min(g.scheduled_date))
 INTO items,slots,expiry FROM public.gig_support_slots s JOIN public.gigs g ON g.id=s.gig_id JOIN public.venues v ON v.id=g.venue_id JOIN public.cities c ON c.id=v.city_id
 WHERE g.id=ANY(p_gig_ids) AND s.request_id=md5(p_request_id::text||':'||g.id::text)::uuid;
 IF cardinality(slots) IS DISTINCT FROM cardinality(p_gig_ids) THEN RAISE EXCEPTION 'proposal_itinerary_incomplete'; END IF;
 PERFORM set_config('app.support_proposal',COALESCE(old_flag,''),true);
 INSERT INTO public.support_tour_proposals(request_id,tour_id,headliner_band_id,support_band_id,slot_ids,itinerary,note,expires_at)
 VALUES(p_request_id,p_tour_id,p_headliner_band_id,p_support_band_id,slots,items,btrim(COALESCE(p_note,'')),expiry) RETURNING id INTO result;
 RETURN result;
END; $$;

CREATE FUNCTION public.respond_support_tour_proposal(p_id uuid,p_action text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.support_tour_proposals%ROWTYPE; slot uuid; old_flag text;
BEGIN
 SELECT * INTO p FROM public.support_tour_proposals WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR p_action IS NULL OR p_action NOT IN ('accept','decline','withdraw') OR
  NOT COALESCE(public.can_manage_band_gigs(CASE WHEN p_action='withdraw' THEN p.headliner_band_id ELSE p.support_band_id END,auth.uid()),false) THEN RAISE EXCEPTION 'proposal_forbidden' USING ERRCODE='42501'; END IF;
 IF p.status<>'pending' THEN RETURN p.status; END IF;
 IF p.expires_at<=now() THEN
  old_flag:=current_setting('app.support_proposal',true); PERFORM set_config('app.support_proposal','1',true);
  UPDATE public.gig_support_slots SET status='expired',updated_at=now() WHERE id=ANY(p.slot_ids) AND status='pending';
  UPDATE public.support_tour_proposals SET status='expired',updated_at=now() WHERE id=p.id; PERFORM set_config('app.support_proposal',COALESCE(old_flag,''),true); RETURN 'expired';
 END IF;
 IF EXISTS(SELECT 1 FROM public.gig_support_slots WHERE id=ANY(p.slot_ids) AND status<>'pending') THEN UPDATE public.support_tour_proposals SET status='changed',updated_at=now() WHERE id=p.id; RETURN 'changed'; END IF;
 old_flag:=current_setting('app.support_proposal',true); PERFORM set_config('app.support_proposal','1',true);
 IF p_action='accept' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('support-band:'||p.support_band_id::text,0));
  PERFORM public.validate_support_route(p.support_band_id,ARRAY(SELECT (x->>'gig_id')::uuid FROM jsonb_array_elements(p.itinerary) x));
  PERFORM public.respond_to_tour_support_offers(p.itinerary,'accept');
 ELSIF p_action='decline' THEN PERFORM public.respond_to_tour_support_offers(p.itinerary,'decline');
 ELSE FOREACH slot IN ARRAY p.slot_ids LOOP PERFORM public.cancel_gig_support_offer(slot); END LOOP;
 END IF;
 PERFORM set_config('app.support_proposal',COALESCE(old_flag,''),true);
 UPDATE public.support_tour_proposals SET status=CASE p_action WHEN 'accept' THEN 'accepted' WHEN 'decline' THEN 'declined' ELSE 'withdrawn' END,updated_at=now() WHERE id=p.id RETURNING * INTO p;
 RETURN p.status;
END; $$;
CREATE FUNCTION public.list_support_tour_proposals(p_band_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.can_manage_band_gigs(p_band_id,auth.uid()),false) THEN RAISE EXCEPTION 'proposal_forbidden' USING ERRCODE='42501'; END IF;
 RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC),'[]') FROM (
  SELECT p.*,h.name headliner_name,b.name support_name,t.name tour_name,
   CASE WHEN p.status='pending' AND p.expires_at<=now() THEN 'expired' ELSE p.status END display_status
  FROM public.support_tour_proposals p JOIN public.bands h ON h.id=p.headliner_band_id JOIN public.bands b ON b.id=p.support_band_id JOIN public.tours t ON t.id=p.tour_id
  WHERE p_band_id IN (p.headliner_band_id,p.support_band_id) ORDER BY p.created_at DESC LIMIT 100) r);
END; $$;
CREATE FUNCTION public.expire_support_tour_proposals() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r record; n integer:=0; old_flag text;
BEGIN
 old_flag:=current_setting('app.support_proposal',true); PERFORM set_config('app.support_proposal','1',true);
 FOR r IN SELECT id,slot_ids FROM public.support_tour_proposals WHERE status='pending' AND expires_at<=now() ORDER BY expires_at FOR UPDATE SKIP LOCKED LIMIT 100 LOOP
  UPDATE public.gig_support_slots SET status='expired',updated_at=now() WHERE id=ANY(r.slot_ids) AND status='pending';
  UPDATE public.support_tour_proposals SET status='expired',updated_at=now() WHERE id=r.id; n:=n+1;
 END LOOP;
 PERFORM set_config('app.support_proposal',COALESCE(old_flag,''),true);
 RETURN n;
END; $$;
REVOKE ALL ON FUNCTION public.create_support_tour_proposal(uuid,uuid,uuid,uuid[],uuid,text),public.respond_support_tour_proposal(uuid,text),public.list_support_tour_proposals(uuid),public.expire_support_tour_proposals() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_support_tour_proposal(uuid,uuid,uuid,uuid[],uuid,text),public.respond_support_tour_proposal(uuid,text),public.list_support_tour_proposals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_support_tour_proposals() TO service_role;
DO $$ BEGIN IF to_regnamespace('cron') IS NOT NULL THEN PERFORM cron.schedule('expire-support-tour-proposals','*/5 * * * *','select public.expire_support_tour_proposals()'); END IF; END; $$;

CREATE TABLE public.play_together_notification_receipts (
 event_key text NOT NULL,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(event_key,user_id)
);
CREATE INDEX play_together_receipt_user_idx ON public.play_together_notification_receipts(user_id);
ALTER TABLE public.play_together_notification_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.play_together_notification_receipts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.play_together_notification_receipts TO service_role;
CREATE FUNCTION public.notify_play_together_band(p_band uuid,p_key text,p_title text,p_message text,p_section text DEFAULT 'offers') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u uuid;
BEGIN
 FOR u IN SELECT DISTINCT user_id FROM (
  SELECT COALESCE(bm.user_id,p.user_id) user_id FROM public.band_members bm LEFT JOIN public.profiles p ON p.id=bm.profile_id WHERE bm.band_id=p_band AND COALESCE(bm.member_status,'active')='active'
  UNION SELECT p.user_id FROM public.bands b JOIN public.profiles p ON p.id=b.leader_id WHERE b.id=p_band) members WHERE user_id IS NOT NULL
 LOOP
  INSERT INTO public.play_together_notification_receipts(event_key,user_id) VALUES(p_key,u) ON CONFLICT DO NOTHING;
  IF FOUND THEN INSERT INTO public.player_inbox(user_id,category,priority,title,message,metadata,action_type,action_data,related_entity_type,related_entity_id)
   VALUES(u,'social','normal',p_title,p_message,jsonb_build_object('band_id',p_band,'event_key',p_key),'navigate',jsonb_build_object('route','/gig-booking?tab=play-together&section='||p_section||'&bandId='||p_band::text),'band',p_band); END IF;
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.notify_play_together_band(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.notify_play_together_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a uuid; b uuid; k text; title text; message text; section text:='offers'; state text; identity text;
BEGIN
 IF TG_OP='UPDATE' AND to_jsonb(OLD)->>'status' IS NOT DISTINCT FROM to_jsonb(NEW)->>'status' AND
  (TG_TABLE_NAME<>'label_play_together_suggestions' OR (to_jsonb(OLD)->>'headliner_response' IS NOT DISTINCT FROM to_jsonb(NEW)->>'headliner_response' AND to_jsonb(OLD)->>'support_response' IS NOT DISTINCT FROM to_jsonb(NEW)->>'support_response' AND to_jsonb(OLD)->>'tour_id' IS NOT DISTINCT FROM to_jsonb(NEW)->>'tour_id' AND to_jsonb(OLD)->>'gig_id' IS NOT DISTINCT FROM to_jsonb(NEW)->>'gig_id')) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='gig_support_slots' THEN
  IF current_setting('app.support_proposal',true)='1' THEN RETURN NEW; END IF;
  SELECT band_id INTO a FROM public.gigs WHERE id=NEW.gig_id; b:=NEW.support_band_id; state:=NEW.status; identity:=NEW.id::text;
  title:='Support offer: '||state; message:='A support invitation changed. Review the gig date, venue and revenue share before responding.';
 ELSIF TG_TABLE_NAME='band_touring_friendships' THEN
  a:=NEW.band_low; b:=NEW.band_high; state:=NEW.status; identity:=a::text||':'||b::text; section:='friends';
  title:='Band friendship: '||state; message:='Review your band friendship requests and connections.';
 ELSIF TG_TABLE_NAME='label_play_together_suggestions' THEN
  a:=NEW.headliner_band_id; b:=NEW.support_band_id; identity:=NEW.id::text; state:=NEW.headliner_response||':'||NEW.support_response; section:='friends';
  title:='Label Play Together suggestion'; message:='Your label suggested a pairing or a band updated its response. Review the suggestion and any linked booking.';
 ELSE
  a:=NEW.headliner_band_id; b:=NEW.support_band_id; identity:=NEW.id::text; state:=NEW.status;
  title:='Tour proposal: '||state; message:='Review the tour itinerary, dates, revenue share and expiry in Play Together.';
 END IF;
 k:=TG_TABLE_NAME||':'||identity||':'||state||':'||COALESCE(to_jsonb(NEW)->>'updated_at',to_jsonb(NEW)->>'created_at','');
 PERFORM public.notify_play_together_band(a,k,title,message,section); PERFORM public.notify_play_together_band(b,k,title,message,section);
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_play_together_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER play_together_slot_notifications AFTER INSERT OR UPDATE ON public.gig_support_slots FOR EACH ROW EXECUTE FUNCTION public.notify_play_together_change();
CREATE TRIGGER play_together_friend_notifications AFTER INSERT OR UPDATE ON public.band_touring_friendships FOR EACH ROW EXECUTE FUNCTION public.notify_play_together_change();
CREATE TRIGGER play_together_label_notifications AFTER INSERT OR UPDATE ON public.label_play_together_suggestions FOR EACH ROW EXECUTE FUNCTION public.notify_play_together_change();
CREATE TRIGGER play_together_proposal_notifications AFTER INSERT OR UPDATE ON public.support_tour_proposals FOR EACH ROW EXECUTE FUNCTION public.notify_play_together_change();

-- A material itinerary change withdraws consent and clears obsolete member schedules, with no support reliability penalty.
CREATE FUNCTION public.invalidate_changed_support_booking() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE old_flag text; change_key text;
BEGIN
 change_key:='gig-change:'||NEW.id||':'||clock_timestamp()::text;
 IF NEW.scheduled_date IS NOT DISTINCT FROM OLD.scheduled_date AND NEW.scheduled_end IS NOT DISTINCT FROM OLD.scheduled_end AND NEW.venue_id IS NOT DISTINCT FROM OLD.venue_id AND NEW.band_id IS NOT DISTINCT FROM OLD.band_id AND NEW.tour_id IS NOT DISTINCT FROM OLD.tour_id AND NOT(NEW.status='cancelled' AND OLD.status IS DISTINCT FROM 'cancelled') THEN RETURN NEW; END IF;
 old_flag:=current_setting('app.support_proposal',true); PERFORM set_config('app.support_proposal','1',true);
 UPDATE public.player_scheduled_activities SET status='cancelled',updated_at=now() WHERE linked_gig_id=NEW.id AND status<>'cancelled' AND metadata->>'gig_role'='support';
 UPDATE public.gig_support_slots SET status=CASE WHEN status='accepted' THEN 'cancelled' ELSE 'expired' END,response_note='The headliner changed or cancelled the show. A new invitation is required.',updated_at=now() WHERE gig_id=NEW.id AND status IN ('pending','accepted');
 UPDATE public.gig_support_slots slot SET status='expired',updated_at=now() WHERE slot.status='pending' AND EXISTS(
  SELECT 1 FROM public.support_tour_proposals p WHERE p.status='pending' AND slot.id=ANY(p.slot_ids) AND EXISTS(SELECT 1 FROM jsonb_array_elements(p.itinerary) x WHERE (x->>'gig_id')::uuid=NEW.id));
 UPDATE public.support_tour_proposals SET status='changed',updated_at=now() WHERE status IN ('pending','accepted') AND EXISTS(SELECT 1 FROM jsonb_array_elements(itinerary) x WHERE (x->>'gig_id')::uuid=NEW.id);
 PERFORM set_config('app.support_proposal',COALESCE(old_flag,''),true);
 PERFORM public.notify_play_together_band(OLD.band_id,change_key,'Support booking changed','A show changed or was cancelled. Support invitations were cleared; send a new offer for the revised itinerary.');
 PERFORM public.notify_play_together_band(s.support_band_id,change_key,'Support booking changed','A show changed or was cancelled. Your old commitment was cleared without a reliability penalty. Review a new invitation before agreeing.') FROM public.gig_support_slots s WHERE s.gig_id=NEW.id AND s.status IN ('cancelled','expired');
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.invalidate_changed_support_booking() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER play_together_gig_changes AFTER UPDATE OF scheduled_date,scheduled_end,venue_id,band_id,tour_id,status ON public.gigs FOR EACH ROW EXECUTE FUNCTION public.invalidate_changed_support_booking();

-- Public profile information contains only opt-in status. Private relations remain organiser-only.
CREATE FUNCTION public.get_band_play_together_status(p_band_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('touring',COALESCE(p.enabled AND p.tour_enabled,false),'single_gigs',COALESCE(p.enabled AND p.single_gigs_enabled,false),'scope',p.availability_scope)
 FROM public.bands b LEFT JOIN public.band_support_preferences p ON p.band_id=b.id WHERE b.id=p_band_id AND b.status='active' AND auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.get_band_play_together_status(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_band_play_together_status(uuid) TO authenticated;

ALTER TABLE public.label_play_together_suggestions ADD COLUMN tour_id uuid REFERENCES public.tours(id), ADD COLUMN gig_id uuid REFERENCES public.gigs(id), ADD CONSTRAINT label_suggestion_one_booking CHECK(tour_id IS NULL OR gig_id IS NULL);
CREATE INDEX label_suggestion_tour_idx ON public.label_play_together_suggestions(tour_id) WHERE tour_id IS NOT NULL;
CREATE INDEX label_suggestion_gig_idx ON public.label_play_together_suggestions(gig_id) WHERE gig_id IS NOT NULL;
CREATE FUNCTION public.label_play_together_booking_options(p_label_id uuid,p_headliner_band_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public._can_manage_label(p_label_id),false) OR NOT EXISTS(SELECT 1 FROM public.artist_label_contracts WHERE label_id=p_label_id AND band_id=p_headliner_band_id AND status='active' AND (start_date IS NULL OR start_date<=current_date) AND (end_date IS NULL OR end_date>=current_date)) THEN RAISE EXCEPTION 'label_suggestion_forbidden'; END IF;
 RETURN jsonb_build_object('tours',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY start_date),'[]') FROM public.tours WHERE band_id=p_headliner_band_id AND status IN ('scheduled','active') AND end_date>=current_date),
 'gigs',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',g.id,'name',v.name||' · '||g.scheduled_date::date) ORDER BY g.scheduled_date),'[]') FROM public.gigs g JOIN public.venues v ON v.id=g.venue_id WHERE g.band_id=p_headliner_band_id AND g.scheduled_date>now() AND g.status='scheduled' AND g.tour_id IS NULL));
END; $$;
CREATE FUNCTION public.suggest_label_pairing_for_booking(p_label_id uuid,p_headliner_band_id uuid,p_support_band_id uuid,p_note text,p_tour_id uuid,p_gig_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result uuid; r public.label_play_together_suggestions%ROWTYPE;
BEGIN
 IF p_tour_id IS NOT NULL AND p_gig_id IS NOT NULL THEN RAISE EXCEPTION 'label_suggestion_one_booking'; END IF;
 IF p_tour_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.tours WHERE id=p_tour_id AND band_id=p_headliner_band_id AND status IN ('scheduled','active') AND end_date>=current_date) OR
 p_gig_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.gigs WHERE id=p_gig_id AND band_id=p_headliner_band_id AND status='scheduled' AND scheduled_date>now()) THEN RAISE EXCEPTION 'label_suggestion_booking_invalid'; END IF;
 result:=public.suggest_label_play_together(p_label_id,p_headliner_band_id,p_support_band_id,p_note);
 SELECT * INTO r FROM public.label_play_together_suggestions WHERE id=result FOR UPDATE;
 IF (r.tour_id IS DISTINCT FROM p_tour_id OR r.gig_id IS DISTINCT FROM p_gig_id) AND (r.headliner_response<>'pending' OR r.support_response<>'pending') THEN RAISE EXCEPTION 'label_suggestion_already_reviewed'; END IF;
 IF r.headliner_band_id<>p_headliner_band_id THEN RAISE EXCEPTION 'label_suggestion_roles_already_set'; END IF;
 UPDATE public.label_play_together_suggestions SET tour_id=p_tour_id,gig_id=p_gig_id,updated_at=now() WHERE id=result;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.label_play_together_booking_options(uuid,uuid),public.suggest_label_pairing_for_booking(uuid,uuid,uuid,text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.label_play_together_booking_options(uuid,uuid),public.suggest_label_pairing_for_booking(uuid,uuid,uuid,text,uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
CREATE OR REPLACE FUNCTION public.list_label_play_together(p_label_id uuid DEFAULT NULL,p_band_id uuid DEFAULT NULL)
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
   SELECT s.*,(SELECT name FROM public.tours WHERE id=s.tour_id) AS tour_name,
    (SELECT count(*) FROM public.gig_support_slots slot JOIN public.gigs g ON g.id=slot.gig_id WHERE slot.support_band_id=s.support_band_id AND g.band_id=s.headliner_band_id AND slot.status IN ('accepted','completed') AND (s.tour_id IS NULL OR g.tour_id=s.tour_id) AND (s.gig_id IS NULL OR g.id=s.gig_id)) AS confirmed_dates,
    (SELECT count(*) FROM public.gig_support_slots slot JOIN public.gigs g ON g.id=slot.gig_id WHERE slot.support_band_id=s.support_band_id AND g.band_id=s.headliner_band_id AND slot.status='pending' AND (s.tour_id IS NULL OR g.tour_id=s.tour_id) AND (s.gig_id IS NULL OR g.id=s.gig_id)) AS invited_dates,
    l.name AS label_name,h.name AS headliner_name,b.name AS support_name,
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

CREATE TABLE public.support_member_xp_receipts (
 support_slot_id uuid NOT NULL REFERENCES public.gig_support_slots(id) ON DELETE CASCADE,profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 xp_amount integer NOT NULL CHECK(xp_amount>=0),ledger_id uuid REFERENCES public.experience_ledger(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(support_slot_id,profile_id)
);
CREATE INDEX support_member_xp_profile_idx ON public.support_member_xp_receipts(profile_id);
CREATE INDEX support_member_xp_ledger_idx ON public.support_member_xp_receipts(ledger_id);
ALTER TABLE public.support_member_xp_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_member_xp_receipts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.support_member_xp_receipts TO service_role;
CREATE FUNCTION public.finish_support_member_schedule() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE member record; xp integer; total integer; ledger uuid;
BEGIN
 IF NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
  SELECT count(DISTINCT profile_id) INTO total FROM public.player_scheduled_activities WHERE linked_gig_id=NEW.gig_id AND metadata->>'support_slot_id'=NEW.id::text AND status<>'cancelled';
  SELECT floor(GREATEST(0,support_fame_gain)*1.5/GREATEST(1,total))::integer INTO xp FROM public.support_band_gig_settlements WHERE gig_id=NEW.gig_id AND progression_applied_at IS NOT NULL;
  IF xp>0 THEN
   FOR member IN SELECT DISTINCT p.id,p.user_id FROM public.player_scheduled_activities a JOIN public.profiles p ON p.id=a.profile_id WHERE a.linked_gig_id=NEW.gig_id AND a.metadata->>'support_slot_id'=NEW.id::text AND a.status<>'cancelled' AND p.user_id IS NOT NULL LOOP
    INSERT INTO public.support_member_xp_receipts(support_slot_id,profile_id,xp_amount) VALUES(NEW.id,member.id,xp) ON CONFLICT DO NOTHING;
    IF FOUND THEN
     INSERT INTO public.experience_ledger(user_id,profile_id,activity_type,xp_amount,metadata) VALUES(member.user_id,member.id,'gig_performance',xp,jsonb_build_object('gig_id',NEW.gig_id,'band_id',NEW.support_band_id,'support_slot_id',NEW.id,'gig_role','support')) RETURNING id INTO ledger;
     UPDATE public.support_member_xp_receipts SET ledger_id=ledger WHERE support_slot_id=NEW.id AND profile_id=member.id;
    END IF;
   END LOOP;
  END IF;
  UPDATE public.player_scheduled_activities SET status='completed',updated_at=now() WHERE linked_gig_id=NEW.gig_id AND metadata->>'support_slot_id'=NEW.id::text AND status IN ('scheduled','in_progress');
 ELSIF NEW.status='cancelled' AND OLD.status='accepted' THEN
  UPDATE public.player_scheduled_activities SET status='cancelled',updated_at=now() WHERE linked_gig_id=NEW.gig_id AND metadata->>'support_slot_id'=NEW.id::text AND status IN ('scheduled','in_progress');
  UPDATE public.support_tour_proposals SET status='changed',updated_at=now() WHERE NEW.id=ANY(slot_ids) AND status='accepted';
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.finish_support_member_schedule() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER play_together_member_schedule AFTER UPDATE OF status ON public.gig_support_slots FOR EACH ROW EXECUTE FUNCTION public.finish_support_member_schedule();

CREATE OR REPLACE FUNCTION public.get_band_support_summary(p_band_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.can_manage_band_gigs(p_band_id,auth.uid()),false) THEN RAISE EXCEPTION 'support_history_forbidden' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
 'reputation',COALESCE((SELECT to_jsonb(r) FROM public.band_support_reputation r WHERE r.band_id=p_band_id),'{}'),
 'supportHistory',COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM (SELECT h.*,s.status finance_status,(SELECT COALESCE(sum(xp_amount),0) FROM public.support_member_xp_receipts WHERE support_slot_id=h.support_slot_id) member_xp FROM public.band_support_history h LEFT JOIN public.support_band_gig_settlements s ON s.gig_id=h.gig_id WHERE h.support_band_id=p_band_id ORDER BY h.performed_at DESC LIMIT 50) r),'[]'),
 'headlinerHistory',COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM (SELECT h.*,s.status finance_status,(SELECT COALESCE(sum(xp_amount),0) FROM public.support_member_xp_receipts WHERE support_slot_id=h.support_slot_id) member_xp FROM public.band_support_history h LEFT JOIN public.support_band_gig_settlements s ON s.gig_id=h.gig_id WHERE h.headliner_band_id=p_band_id ORDER BY h.performed_at DESC LIMIT 50) r),'[]'));
END; $$;
REVOKE ALL ON FUNCTION public.get_band_support_summary(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_band_support_summary(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';

-- Keep retry identities scoped to the authorised headliner and validate null responses.
-- Match the saved gig context for both invitation and acceptance.
-- Single-gig and touring opt-ins remain independent.

CREATE OR REPLACE FUNCTION public.create_gig_support_offer(
  p_gig_id uuid,
  p_support_band_id uuid,
  p_request_id uuid
) RETURNS public.gig_support_slots
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor public.profiles%ROWTYPE;
  v_gig public.gigs%ROWTYPE;
  v_venue public.venues%ROWTYPE;
  v_slot public.gig_support_slots%ROWTYPE;
  v_city_id uuid;
  v_end timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'support_offer_unauthenticated' USING ERRCODE='42501';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'support_offer_request_invalid' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_actor FROM public.profiles WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'support_offer_profile_missing' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_slot FROM public.gig_support_slots WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_slot.gig_id IS DISTINCT FROM p_gig_id OR v_slot.support_band_id IS DISTINCT FROM p_support_band_id OR NOT EXISTS(SELECT 1 FROM public.gigs g WHERE g.id=v_slot.gig_id AND public.can_manage_band_gigs(g.band_id,auth.uid())) THEN
      RAISE EXCEPTION 'support_offer_request_mismatch' USING ERRCODE='42501';
    END IF;
    RETURN v_slot;
  END IF;

  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'support_offer_gig_invalid' USING ERRCODE='23503';
  END IF;
  IF NOT public.can_manage_band_gigs(v_gig.band_id, auth.uid()) THEN
    RAISE EXCEPTION 'support_offer_forbidden' USING ERRCODE='42501';
  END IF;
  IF v_gig.band_id = p_support_band_id THEN
    RAISE EXCEPTION 'support_offer_self_support' USING ERRCODE='23514';
  END IF;
  IF v_gig.status NOT IN ('scheduled','ready_for_completion') OR v_gig.scheduled_date <= now() THEN
    RAISE EXCEPTION 'support_offer_gig_unavailable' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_venue FROM public.venues WHERE id = v_gig.venue_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'support_offer_venue_invalid' USING ERRCODE='23503';
  END IF;
  v_city_id := v_venue.city_id;
  v_end := COALESCE(v_gig.scheduled_end, v_gig.scheduled_date + interval '3 hours');

  IF EXISTS (
    SELECT 1 FROM public.gig_support_slots gs
    WHERE gs.gig_id = p_gig_id AND gs.status IN ('accepted','completed')
  ) THEN
    RAISE EXCEPTION 'support_offer_slot_filled' USING ERRCODE='23505';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.gig_support_slots gs
    WHERE gs.gig_id = p_gig_id
      AND gs.support_band_id = p_support_band_id
      AND gs.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'support_offer_already_pending' USING ERRCODE='23505';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.find_available_support_bands(
      v_gig.band_id,
      v_city_id,
      v_gig.scheduled_date,
      v_end,
      v_gig.tour_id IS NOT NULL,
      COALESCE(v_venue.capacity,0)
    ) candidate
    WHERE candidate.band_id = p_support_band_id
  ) THEN
    RAISE EXCEPTION 'support_offer_band_unavailable' USING ERRCODE='23P01';
  END IF;

  INSERT INTO public.gig_support_slots (
    gig_id, support_band_id, invited_by, status, revenue_share, request_id
  ) VALUES (
    p_gig_id, p_support_band_id, v_actor.id, 'pending', 0.2000, p_request_id
  )
  RETURNING * INTO v_slot;

  RETURN v_slot;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_gig_support_offer(
  p_support_slot_id uuid,
  p_action text,
  p_response_note text DEFAULT NULL
) RETURNS public.gig_support_slots
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slot public.gig_support_slots%ROWTYPE;
  v_gig public.gigs%ROWTYPE;
  v_venue public.venues%ROWTYPE;
  v_band public.bands%ROWTYPE;
  v_end timestamptz;
BEGIN
  IF auth.uid() IS NULL OR p_action IS NULL OR p_action NOT IN ('accept','decline') THEN
    RAISE EXCEPTION 'support_offer_action_invalid' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_slot
  FROM public.gig_support_slots
  WHERE id = p_support_slot_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'support_offer_not_found' USING ERRCODE='23503';
  END IF;

  IF NOT public.can_manage_band_gigs(v_slot.support_band_id, auth.uid()) THEN
    RAISE EXCEPTION 'support_offer_response_forbidden' USING ERRCODE='42501';
  END IF;

  IF v_slot.status <> 'pending' THEN
    IF (p_action = 'accept' AND v_slot.status = 'accepted')
       OR (p_action = 'decline' AND v_slot.status = 'declined') THEN
      RETURN v_slot;
    END IF;
    RAISE EXCEPTION 'support_offer_not_pending' USING ERRCODE='23514';
  END IF;

  IF p_action = 'decline' THEN
    UPDATE public.gig_support_slots
    SET status = 'declined', responded_at = now(), response_note = p_response_note, updated_at = now()
    WHERE id = v_slot.id
    RETURNING * INTO v_slot;
    RETURN v_slot;
  END IF;

  SELECT * INTO v_gig FROM public.gigs WHERE id = v_slot.gig_id FOR UPDATE;
  IF NOT FOUND OR v_gig.status NOT IN ('scheduled','ready_for_completion') OR v_gig.scheduled_date <= now() THEN
    RAISE EXCEPTION 'support_offer_gig_unavailable' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_band FROM public.bands WHERE id = v_slot.support_band_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'support_offer_band_invalid' USING ERRCODE='23503';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('support-gig:' || v_gig.id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('support-band:' || v_slot.support_band_id::text, 0));

  SELECT * INTO v_venue FROM public.venues WHERE id = v_gig.venue_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'support_offer_venue_invalid' USING ERRCODE='23503';
  END IF;
  v_end := COALESCE(v_gig.scheduled_end, v_gig.scheduled_date + interval '3 hours');

  IF EXISTS (
    SELECT 1 FROM public.gig_support_slots gs
    WHERE gs.gig_id = v_gig.id
      AND gs.id <> v_slot.id
      AND gs.status IN ('accepted','completed')
  ) THEN
    RAISE EXCEPTION 'support_offer_slot_filled' USING ERRCODE='23505';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.find_available_support_bands(
      v_gig.band_id,
      v_venue.city_id,
      v_gig.scheduled_date,
      v_end,
      v_gig.tour_id IS NOT NULL,
      COALESCE(v_venue.capacity,0)
    ) candidate
    WHERE candidate.band_id = v_slot.support_band_id
  ) THEN
    RAISE EXCEPTION 'support_offer_band_unavailable' USING ERRCODE='23P01';
  END IF;

  UPDATE public.gig_support_slots
  SET status = 'accepted', responded_at = now(), response_note = p_response_note, updated_at = now()
  WHERE id = v_slot.id
  RETURNING * INTO v_slot;

  INSERT INTO public.player_scheduled_activities (
    user_id, profile_id, activity_type, scheduled_start, scheduled_end,
    status, title, location, linked_gig_id, metadata
  )
  SELECT
    p.user_id,
    p.id,
    'gig',
    v_gig.scheduled_date,
    v_end,
    'scheduled',
    'Support gig at ' || v_venue.name,
    v_venue.name,
    v_gig.id,
    jsonb_build_object(
      'band_id', v_slot.support_band_id,
      'headliner_band_id', v_gig.band_id,
      'venueId', v_gig.venue_id,
      'is_band_activity', true,
      'gig_role', 'support',
      'support_slot_id', v_slot.id
    )
  FROM public.profiles p
  WHERE p.id IN (
    SELECT COALESCE(bm.profile_id, mp.id)
    FROM public.band_members bm
    LEFT JOIN public.profiles mp ON mp.user_id = bm.user_id
    WHERE bm.band_id = v_slot.support_band_id
      AND COALESCE(bm.member_status,'active') = 'active'
      AND COALESCE(bm.is_touring_member,false) = false
      AND COALESCE(bm.profile_id,mp.id) IS NOT NULL
    UNION
    SELECT v_band.leader_id
    WHERE EXISTS (SELECT 1 FROM public.profiles lp WHERE lp.id = v_band.leader_id)
  )
  ON CONFLICT (linked_gig_id,profile_id)
    WHERE linked_gig_id IS NOT NULL AND status <> 'cancelled'
  DO NOTHING;

  UPDATE public.gig_support_slots other
  SET status = 'expired', updated_at = now()
  FROM public.gigs other_gig
  WHERE other.gig_id = other_gig.id
    AND other.support_band_id = v_slot.support_band_id
    AND other.id <> v_slot.id
    AND other.status = 'pending'
    AND other_gig.scheduled_date < v_end
    AND COALESCE(other_gig.scheduled_end, other_gig.scheduled_date + interval '3 hours') > v_gig.scheduled_date;

  UPDATE public.gig_support_slots
  SET status = 'expired', updated_at = now()
  WHERE gig_id = v_gig.id
    AND id <> v_slot.id
    AND status = 'pending';

  RETURN v_slot;
END;
$$;

REVOKE ALL ON FUNCTION public.create_gig_support_offer(uuid,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_to_gig_support_offer(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_gig_support_offer(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_gig_support_offer(uuid,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
