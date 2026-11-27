CREATE TABLE public.festival_guest_solos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL UNIQUE REFERENCES public.festival_artist_bookings(id),
 edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id),
 host_band_id uuid NOT NULL REFERENCES public.bands(id),
 host_profile_id uuid NOT NULL REFERENCES public.profiles(id),
 guest_band_id uuid NOT NULL REFERENCES public.bands(id),
 guest_profile_id uuid NOT NULL REFERENCES public.profiles(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','withdrawn','completed')),
 version integer NOT NULL DEFAULT 1,
 host_share boolean NOT NULL DEFAULT false,
 guest_share boolean NOT NULL DEFAULT false,
 session_id uuid REFERENCES public.festival_performance_sessions(id),
 joined_at timestamptz,
 rewarded_at timestamptz,
 twaat_id uuid REFERENCES public.twaats(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(host_band_id<>guest_band_id), CHECK(host_profile_id<>guest_profile_id)
);
GRANT SELECT ON public.festival_guest_solos TO authenticated;
GRANT ALL ON public.festival_guest_solos TO service_role;
ALTER TABLE public.festival_guest_solos ENABLE ROW LEVEL SECURITY;
CREATE POLICY guest_solo_participant_read ON public.festival_guest_solos FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.band_members m WHERE m.profile_id=public._caller_profile_id() AND m.member_status='active' AND m.band_id IN(host_band_id,guest_band_id)));
CREATE TRIGGER festival_guest_solos_updated_at BEFORE UPDATE ON public.festival_guest_solos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.reward_config(reward_key,xp_amount) VALUES ('festival_guest_solo',100) ON CONFLICT(reward_key) DO NOTHING;

CREATE OR REPLACE FUNCTION private.festival_guest_solo_eligible(p_booking_id uuid,p_guest_profile_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.festival_artist_bookings h
 JOIN public.festival_artist_programmes hp ON hp.id=h.festival_artist_programme_id
 JOIN public.festival_artist_programmes gp ON gp.festival_edition_id=hp.festival_edition_id
 JOIN public.festival_artist_bookings g ON g.festival_artist_programme_id=gp.id AND g.band_id<>h.band_id AND g.artist_type='band' AND g.status IN('confirmed','awaiting_schedule','scheduled')
 JOIN public.band_members gm ON gm.band_id=g.band_id AND gm.profile_id=p_guest_profile_id AND gm.member_status='active' AND NOT coalesce(gm.is_touring_member,false)
 JOIN public.profiles p ON p.id=gm.profile_id AND p.died_at IS NULL AND p.deleted_at IS NULL AND p.is_active
 JOIN public.band_touring_friendships f ON f.band_low=least(h.band_id,g.band_id) AND f.band_high=greatest(h.band_id,g.band_id) AND f.status='accepted'
 WHERE h.id=p_booking_id AND h.artist_type='band' AND h.status IN('confirmed','awaiting_schedule','scheduled'));
$$;
REVOKE ALL ON FUNCTION private.festival_guest_solo_eligible(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.festival_guest_solo(p_booking_id uuid,p_action text DEFAULT 'read',p_invitation_id uuid DEFAULT NULL,p_expected_version integer DEFAULT NULL,p_guest_profile_id uuid DEFAULT NULL,p_share boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=public._caller_profile_id(); b public.festival_artist_bookings%ROWTYPE; e public.festival_editions_v2%ROWTYPE; i public.festival_guest_solos%ROWTYPE; s public.festival_performance_sessions%ROWTYPE; zone text; guest_band uuid; candidates jsonb; invitations jsonb; editable boolean;
BEGIN
 IF auth.uid() IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'Sign in with an active character'; END IF;
 SELECT * INTO b FROM public.festival_artist_bookings WHERE id=p_booking_id FOR UPDATE;
 IF NOT FOUND OR b.artist_type<>'band' OR NOT EXISTS(SELECT 1 FROM public.band_members WHERE band_id=b.band_id AND profile_id=actor AND member_status='active') THEN RAISE EXCEPTION 'Active band membership required'; END IF;
 SELECT ed.* INTO e FROM public.festival_editions_v2 ed JOIN public.festival_artist_programmes pr ON pr.festival_edition_id=ed.id WHERE pr.id=b.festival_artist_programme_id;
 SELECT timezone INTO zone FROM public.cities WHERE id=e.city_id;
 editable:=coalesce(b.status IN('confirmed','awaiting_schedule','scheduled') AND e.status<>'cancelled' AND (now() AT TIME ZONE zone)::date<e.starts_on,false);
 IF p_action NOT IN('read','invite','accept','decline','withdraw','join') THEN RAISE EXCEPTION 'Unknown guest solo action'; END IF;
 IF p_action='invite' THEN
  IF NOT editable OR b.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Refresh preparation; invitations close when the festival starts'; END IF;
  IF NOT private.festival_guest_solo_eligible(b.id,p_guest_profile_id) THEN RAISE EXCEPTION 'Choose an active member of a friendly band booked at this edition'; END IF;
  SELECT gm.band_id INTO guest_band FROM public.band_members gm JOIN public.festival_artist_bookings gb ON gb.band_id=gm.band_id JOIN public.festival_artist_programmes gp ON gp.id=gb.festival_artist_programme_id WHERE gm.profile_id=p_guest_profile_id AND gm.member_status='active' AND gp.festival_edition_id=e.id AND gm.band_id<>b.band_id ORDER BY gb.id LIMIT 1;
  INSERT INTO public.festival_guest_solos(booking_id,edition_id,host_band_id,host_profile_id,guest_band_id,guest_profile_id,host_share) VALUES(b.id,e.id,b.band_id,actor,guest_band,p_guest_profile_id,p_share)
  ON CONFLICT(booking_id) DO UPDATE SET guest_band_id=excluded.guest_band_id,guest_profile_id=excluded.guest_profile_id,host_profile_id=excluded.host_profile_id,host_share=excluded.host_share,guest_share=false,status='pending',version=public.festival_guest_solos.version+1 WHERE public.festival_guest_solos.status IN('declined','withdrawn') AND public.festival_guest_solos.joined_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'This booking already has a guest invitation'; END IF;
 ELSIF p_action<>'read' THEN
  SELECT * INTO i FROM public.festival_guest_solos WHERE id=p_invitation_id AND edition_id=e.id AND (booking_id=b.id OR guest_band_id=b.band_id) FOR UPDATE;
  IF NOT FOUND OR i.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Invitation changed; refresh and try again'; END IF;
  IF p_action IN('accept','decline') THEN
   IF NOT editable OR actor<>i.guest_profile_id OR i.status<>'pending' THEN RAISE EXCEPTION 'Only the invited character can respond before the festival starts'; END IF;
   IF p_action='accept' AND NOT private.festival_guest_solo_eligible(i.booking_id,actor) THEN RAISE EXCEPTION 'The friendship or booking is no longer eligible'; END IF;
   UPDATE public.festival_guest_solos SET status=CASE p_action WHEN 'accept' THEN 'accepted' ELSE 'declined' END,guest_share=p_share,version=version+1 WHERE id=i.id;
  ELSIF p_action='withdraw' THEN
   IF i.joined_at IS NOT NULL OR i.status NOT IN('pending','accepted') OR NOT (actor=i.guest_profile_id OR i.booking_id=b.id) THEN RAISE EXCEPTION 'This invitation cannot be withdrawn'; END IF;
   UPDATE public.festival_guest_solos SET status='withdrawn',version=version+1 WHERE id=i.id;
  ELSIF p_action='join' THEN
   IF actor<>i.guest_profile_id OR i.status<>'accepted' OR i.joined_at IS NOT NULL OR NOT private.festival_guest_solo_eligible(i.booking_id,actor) THEN RAISE EXCEPTION 'Only the accepted guest can join'; END IF;
   SELECT ps.* INTO s FROM public.festival_performance_sessions ps JOIN public.festival_artist_booking_canonical_links l ON l.canonical_contract_id=ps.contract_id AND l.edition_id=ps.edition_id WHERE l.artist_booking_id=i.booking_id AND ps.edition_id=e.id AND ps.band_id=i.host_band_id AND ps.status='in_progress' AND now() BETWEEN ps.scheduled_start_at AND ps.scheduled_end_at FOR UPDATE OF ps;
   IF NOT FOUND THEN RAISE EXCEPTION 'The linked live performance is not available yet'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor AND current_city_id=e.city_id AND NOT coalesce(is_traveling,false) AND health>0 AND died_at IS NULL) THEN RAISE EXCEPTION 'Travel to the festival city before joining'; END IF;
   IF EXISTS(SELECT 1 FROM public.festival_performance_sessions other JOIN public.band_members m ON m.band_id=other.band_id AND m.profile_id=actor AND m.member_status='active' WHERE other.id<>s.id AND other.status NOT IN('cancelled','no_show','abandoned','completed','partially_completed') AND tstzrange(other.scheduled_start_at,other.scheduled_end_at,'[)') && tstzrange(s.scheduled_start_at,s.scheduled_end_at,'[)')) OR EXISTS(SELECT 1 FROM public.festival_guest_solos other JOIN public.festival_performance_sessions ps ON ps.id=other.session_id WHERE other.guest_profile_id=actor AND other.id<>i.id AND other.joined_at IS NOT NULL AND tstzrange(ps.scheduled_start_at,ps.scheduled_end_at,'[)') && tstzrange(s.scheduled_start_at,s.scheduled_end_at,'[)')) THEN RAISE EXCEPTION 'Another festival performance overlaps this solo'; END IF;
   UPDATE public.festival_guest_solos SET joined_at=now(),session_id=s.id,version=version+1 WHERE id=i.id;
  END IF;
 END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.band_name,c.name),'[]') INTO candidates FROM (SELECT DISTINCT gm.profile_id AS id,coalesce(p.display_name,p.username) AS name,gb.name AS band_name FROM public.band_members gm JOIN public.profiles p ON p.id=gm.profile_id JOIN public.bands gb ON gb.id=gm.band_id WHERE private.festival_guest_solo_eligible(b.id,gm.profile_id) AND EXISTS(SELECT 1 FROM public.festival_artist_bookings ab JOIN public.festival_artist_programmes ap ON ap.id=ab.festival_artist_programme_id WHERE ab.band_id=gm.band_id AND ap.festival_edition_id=e.id) LIMIT 100) c;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',g.id,'version',g.version,'status',g.status,'guestName',coalesce(p.display_name,p.username),'hostBand',hb.name,'guestBand',gb.name,'incoming',g.guest_band_id=b.band_id,'isGuest',g.guest_profile_id=actor,'joined',g.joined_at IS NOT NULL,'rewarded',g.rewarded_at IS NOT NULL,'shared',g.twaat_id IS NOT NULL,'canJoin',g.guest_profile_id=actor AND g.status='accepted' AND g.joined_at IS NULL AND EXISTS(SELECT 1 FROM public.festival_performance_sessions ps JOIN public.festival_artist_booking_canonical_links l ON l.canonical_contract_id=ps.contract_id AND l.edition_id=ps.edition_id WHERE l.artist_booking_id=g.booking_id AND ps.status='in_progress' AND now() BETWEEN ps.scheduled_start_at AND ps.scheduled_end_at)) ORDER BY g.created_at),'[]') INTO invitations FROM public.festival_guest_solos g JOIN public.profiles p ON p.id=g.guest_profile_id JOIN public.bands hb ON hb.id=g.host_band_id JOIN public.bands gb ON gb.id=g.guest_band_id WHERE g.edition_id=e.id AND (g.booking_id=b.id OR g.guest_band_id=b.band_id);
 RETURN jsonb_build_object('bookingVersion',b.version,'editable',editable,'candidates',candidates,'invitations',invitations);
END; $$;
REVOKE ALL ON FUNCTION private.festival_guest_solo(uuid,text,uuid,integer,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.festival_guest_solo(uuid,text,uuid,integer,uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.festival_guest_solo(p_booking_id uuid,p_action text DEFAULT 'read',p_invitation_id uuid DEFAULT NULL,p_expected_version integer DEFAULT NULL,p_guest_profile_id uuid DEFAULT NULL,p_share boolean DEFAULT false) RETURNS jsonb LANGUAGE sql SET search_path='' AS $$ SELECT private.festival_guest_solo(p_booking_id,p_action,p_invitation_id,p_expected_version,p_guest_profile_id,p_share); $$;
REVOKE ALL ON FUNCTION public.festival_guest_solo(uuid,text,uuid,integer,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.festival_guest_solo(uuid,text,uuid,integer,uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION private.festival_guest_solo_completed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i public.festival_guest_solos%ROWTYPE; p public.profiles%ROWTYPE; a uuid; post_id uuid; story text;
BEGIN
 IF NEW.status::text<>'completed' OR NEW.actual_end_at IS NULL THEN RETURN NEW; END IF;
 FOR i IN SELECT g.* FROM public.festival_guest_solos g JOIN public.festival_artist_bookings b ON b.id=g.booking_id JOIN public.festival_artist_booking_canonical_links l ON l.artist_booking_id=b.id AND l.canonical_contract_id=NEW.contract_id AND l.edition_id=NEW.edition_id WHERE g.session_id=NEW.id AND g.edition_id=NEW.edition_id AND g.host_band_id=NEW.band_id AND g.status='accepted' AND g.joined_at IS NOT NULL AND g.rewarded_at IS NULL AND b.status IN('confirmed','awaiting_schedule','scheduled') FOR UPDATE OF g LOOP
  FOR p IN SELECT pr.* FROM public.profiles pr WHERE pr.id IN(i.host_profile_id,i.guest_profile_id) AND pr.is_active AND pr.died_at IS NULL AND pr.deleted_at IS NULL AND EXISTS(SELECT 1 FROM public.band_members m WHERE m.profile_id=pr.id AND m.band_id=CASE WHEN pr.id=i.host_profile_id THEN i.host_band_id ELSE i.guest_band_id END AND m.member_status='active') LOOP
   PERFORM public._apply_game_reward(p.user_id,p.id,'festival_guest_solo','festival-guest-solo:'||i.edition_id||':'||p.id,NULL,jsonb_build_object('invitationId',i.id,'sessionId',NEW.id));
  END LOOP;
  IF i.host_share AND i.guest_share THEN
   SELECT id INTO a FROM public.twaater_accounts WHERE owner_type='band' AND owner_id=i.host_band_id ORDER BY created_at LIMIT 1;
   IF a IS NOT NULL THEN
    SELECT left(coalesce(pr.display_name,pr.username)||' from '||gb.name||' joined '||hb.name||' on stage at '||ed.name||' for a guest solo! #FestivalFriends',500) INTO story FROM public.profiles pr JOIN public.bands gb ON gb.id=i.guest_band_id JOIN public.bands hb ON hb.id=i.host_band_id JOIN public.festival_editions_v2 ed ON ed.id=i.edition_id WHERE pr.id=i.guest_profile_id;
    INSERT INTO public.twaats(account_id,body,visibility) VALUES(a,story,'public') RETURNING id INTO post_id;
   END IF;
  END IF;
  UPDATE public.festival_guest_solos SET status='completed',rewarded_at=now(),twaat_id=post_id,version=version+1 WHERE id=i.id;
 END LOOP;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.festival_guest_solo_completed() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER festival_guest_solo_completed AFTER UPDATE OF status,actual_end_at ON public.festival_performance_sessions FOR EACH ROW EXECUTE FUNCTION private.festival_guest_solo_completed();