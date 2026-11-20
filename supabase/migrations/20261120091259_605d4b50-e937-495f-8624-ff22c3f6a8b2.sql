CREATE TABLE public.profile_roleplay_settings (
 profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 mood text CHECK (char_length(mood) <= 60),
 hooks text CHECK (char_length(hooks) <= 280),
 rp_enabled boolean NOT NULL DEFAULT true,
 open_romance boolean NOT NULL DEFAULT false,
 open_rivalry boolean NOT NULL DEFAULT true,
 open_collab boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profile_roleplay_settings TO authenticated;
GRANT ALL ON public.profile_roleplay_settings TO service_role;
ALTER TABLE public.profile_roleplay_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_settings_read ON public.profile_roleplay_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY rp_settings_own_insert ON public.profile_roleplay_settings FOR INSERT TO authenticated
 WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=auth.uid()));
CREATE POLICY rp_settings_own_update ON public.profile_roleplay_settings FOR UPDATE TO authenticated
 USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=auth.uid()))
 WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=auth.uid()));

CREATE TABLE public.roleplay_scenes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 host_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
 setting text CHECK (char_length(setting) <= 280),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','ended')),
 created_at timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz
);
CREATE TABLE public.roleplay_scene_members (
 scene_id uuid NOT NULL REFERENCES public.roleplay_scenes(id) ON DELETE CASCADE,
 profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 joined_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (scene_id, profile_id)
);
GRANT SELECT ON public.roleplay_scenes, public.roleplay_scene_members TO authenticated;
GRANT ALL ON public.roleplay_scenes, public.roleplay_scene_members TO service_role;
ALTER TABLE public.roleplay_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roleplay_scene_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._my_profile_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT id FROM public.profiles WHERE user_id=auth.uid()
$$;
REVOKE ALL ON FUNCTION public._my_profile_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._my_profile_ids() TO authenticated;

CREATE OR REPLACE FUNCTION public._is_scene_member(p_scene uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS (SELECT 1 FROM public.roleplay_scene_members m JOIN public.profiles p ON p.id=m.profile_id
  WHERE m.scene_id=p_scene AND p.user_id=auth.uid())
$$;
REVOKE ALL ON FUNCTION public._is_scene_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._is_scene_member(uuid) TO authenticated;

CREATE POLICY scenes_member_read ON public.roleplay_scenes FOR SELECT TO authenticated USING (public._is_scene_member(id));
CREATE POLICY scene_members_read ON public.roleplay_scene_members FOR SELECT TO authenticated USING (public._is_scene_member(scene_id));

CREATE TABLE public.social_room_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 room_key text NOT NULL CHECK (room_key ~ '^(city|club|scene):[0-9a-f-]{36}$'),
 profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 kind text NOT NULL DEFAULT 'say' CHECK (kind IN ('say','me','ooc','system')),
 body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX social_room_messages_room_idx ON public.social_room_messages(room_key, created_at DESC);
GRANT SELECT ON public.social_room_messages TO authenticated;
GRANT ALL ON public.social_room_messages TO service_role;
ALTER TABLE public.social_room_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_social_room(p_room text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_kind text := split_part(p_room,':',1); v_id uuid;
BEGIN
 BEGIN v_id := split_part(p_room,':',2)::uuid; EXCEPTION WHEN others THEN RETURN false; END;
 IF v_kind='city' THEN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE user_id=auth.uid() AND current_city_id=v_id AND died_at IS NULL);
 ELSIF v_kind='club' THEN
  RETURN EXISTS (SELECT 1 FROM public.club_presence c JOIN public.profiles p ON p.id=c.profile_id
   WHERE c.club_id=v_id AND p.user_id=auth.uid() AND (c.expires_at IS NULL OR c.expires_at>now()));
 ELSIF v_kind='scene' THEN
  RETURN public._is_scene_member(v_id);
 END IF;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.can_access_social_room(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_social_room(text) TO authenticated;

CREATE POLICY room_messages_read ON public.social_room_messages FOR SELECT TO authenticated
 USING (created_at > now() - interval '24 hours' AND public.can_access_social_room(room_key)
  AND NOT EXISTS (SELECT 1 FROM public.player_blocks b WHERE b.removed_at IS NULL
   AND b.blocker_id IN (SELECT public._my_profile_ids()) AND b.blocked_id=social_room_messages.profile_id));

CREATE OR REPLACE FUNCTION public._assert_owned_active_profile(p_profile uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_profile AND user_id=auth.uid() AND died_at IS NULL) THEN
  RAISE EXCEPTION 'character_not_owned';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public._assert_owned_active_profile(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.post_social_room_message(p_profile uuid, p_room text, p_kind text, p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid; v_body text := btrim(coalesce(p_body,''));
BEGIN
 PERFORM public._assert_owned_active_profile(p_profile);
 IF p_kind NOT IN ('say','me','ooc') THEN RAISE EXCEPTION 'invalid_kind'; END IF;
 IF char_length(v_body) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'invalid_length'; END IF;
 IF NOT public.can_access_social_room(p_room) THEN RAISE EXCEPTION 'not_in_room'; END IF;
 IF p_room LIKE 'city:%' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_profile AND current_city_id=split_part(p_room,':',2)::uuid) THEN
  RAISE EXCEPTION 'not_in_room'; END IF;
 IF EXISTS (SELECT 1 FROM public.social_room_messages WHERE profile_id=p_profile AND created_at > now()-interval '3 seconds') THEN
  RAISE EXCEPTION 'slow_down'; END IF;
 IF (SELECT count(*) FROM public.social_room_messages WHERE profile_id=p_profile AND created_at > now()-interval '1 minute') >= 15 THEN
  RAISE EXCEPTION 'slow_down'; END IF;
 INSERT INTO public.social_room_messages(room_key,profile_id,kind,body) VALUES (p_room,p_profile,p_kind,v_body) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.post_social_room_message(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_social_room_message(uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.report_social_room_message(p_profile uuid, p_message uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE m public.social_room_messages%rowtype; v_id uuid;
BEGIN
 PERFORM public._assert_owned_active_profile(p_profile);
 SELECT * INTO m FROM public.social_room_messages WHERE id=p_message;
 IF NOT FOUND OR NOT public.can_access_social_room(m.room_key) THEN RAISE EXCEPTION 'message_not_found'; END IF;
 INSERT INTO public.player_reports(reporter_profile_id,reported_player_id,category,target_type,target_id,content_type,content_id,description,evidence,status,priority,submitted_at,updated_at)
 VALUES (p_profile,m.profile_id,'chat_abuse','player',m.profile_id,'social_room_message',m.id,left(coalesce(p_reason,''),500),
  jsonb_build_object('body',m.body,'room',m.room_key,'sent_at',m.created_at),'open','normal',now(),now()) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.report_social_room_message(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_social_room_message(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_roleplay_scene(p_profile uuid, p_title text, p_setting text, p_invitees uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_scene uuid; v_inv uuid[] := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_invitees,'{}')) x WHERE x<>p_profile);
BEGIN
 PERFORM public._assert_owned_active_profile(p_profile);
 IF array_length(v_inv,1) IS NULL OR array_length(v_inv,1) > 5 THEN RAISE EXCEPTION 'scene_needs_1_to_5_guests'; END IF;
 IF (SELECT count(*) FROM public.roleplay_scenes WHERE host_profile_id=p_profile AND created_at>now()-interval '1 hour') >= 3 THEN RAISE EXCEPTION 'slow_down'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(v_inv) g LEFT JOIN public.profiles p ON p.id=g
   LEFT JOIN public.profile_roleplay_settings s ON s.profile_id=g
   WHERE p.id IS NULL OR p.died_at IS NULL IS FALSE OR coalesce(s.rp_enabled,true)=false
    OR EXISTS (SELECT 1 FROM public.player_blocks b WHERE b.removed_at IS NULL AND ((b.blocker_id=g AND b.blocked_id=p_profile) OR (b.blocker_id=p_profile AND b.blocked_id=g)))) THEN
  RAISE EXCEPTION 'guest_unavailable'; END IF;
 INSERT INTO public.roleplay_scenes(host_profile_id,title,setting) VALUES (p_profile,btrim(p_title),nullif(btrim(coalesce(p_setting,'')),'')) RETURNING id INTO v_scene;
 INSERT INTO public.roleplay_scene_members(scene_id,profile_id) SELECT v_scene, x FROM unnest(array_append(v_inv,p_profile)) x;
 INSERT INTO public.social_room_messages(room_key,profile_id,kind,body) VALUES ('scene:'||v_scene,p_profile,'system','Scene opened: '||btrim(p_title));
 RETURN v_scene;
END $$;
REVOKE ALL ON FUNCTION public.create_roleplay_scene(uuid,text,text,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_roleplay_scene(uuid,text,text,uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.end_roleplay_scene(p_profile uuid, p_scene uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.roleplay_scenes%rowtype;
BEGIN
 PERFORM public._assert_owned_active_profile(p_profile);
 SELECT * INTO s FROM public.roleplay_scenes WHERE id=p_scene AND host_profile_id=p_profile AND status='open' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'scene_not_found'; END IF;
 UPDATE public.roleplay_scenes SET status='ended', ended_at=now() WHERE id=p_scene;
 INSERT INTO public.activity_feed(user_id,profile_id,activity_type,message,metadata)
 SELECT p.user_id,p.id,'roleplay_scene','Took part in the scene "'||s.title||'"',jsonb_build_object('scene_id',s.id)
 FROM public.roleplay_scene_members m JOIN public.profiles p ON p.id=m.profile_id WHERE m.scene_id=p_scene;
END $$;
REVOKE ALL ON FUNCTION public.end_roleplay_scene(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_roleplay_scene(uuid,uuid) TO authenticated;

CREATE TABLE public.social_interactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 target_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('buy_drink','compliment','insult','flirt','offer_jam','challenge')),
 room_key text,
 xp_awarded integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX social_interactions_pair_idx ON public.social_interactions(actor_profile_id, target_profile_id, kind, created_at DESC);
GRANT SELECT ON public.social_interactions TO authenticated;
GRANT ALL ON public.social_interactions TO service_role;
ALTER TABLE public.social_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY social_interactions_involved ON public.social_interactions FOR SELECT TO authenticated
 USING (actor_profile_id IN (SELECT public._my_profile_ids()) OR target_profile_id IN (SELECT public._my_profile_ids()));

CREATE OR REPLACE FUNCTION public.perform_social_interaction(p_actor uuid, p_target uuid, p_kind text, p_room text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.profile_roleplay_settings%rowtype; v_aff int:=0; v_trust int:=0; v_attr int:=0;
 v_xp int:=10; v_today int; v_actor text; v_target text; v_line text;
BEGIN
 PERFORM public._assert_owned_active_profile(p_actor);
 IF p_actor=p_target THEN RAISE EXCEPTION 'cannot_target_self'; END IF;
 IF p_kind NOT IN ('buy_drink','compliment','insult','flirt','offer_jam','challenge') THEN RAISE EXCEPTION 'invalid_kind'; END IF;
 SELECT coalesce(display_name,username,'Someone') INTO v_target FROM public.profiles WHERE id=p_target AND died_at IS NULL;
 IF v_target IS NULL THEN RAISE EXCEPTION 'target_unavailable'; END IF;
 SELECT coalesce(display_name,username,'Someone') INTO v_actor FROM public.profiles WHERE id=p_actor;
 IF EXISTS (SELECT 1 FROM public.player_blocks b WHERE b.removed_at IS NULL AND ((b.blocker_id=p_target AND b.blocked_id=p_actor) OR (b.blocker_id=p_actor AND b.blocked_id=p_target))) THEN
  RAISE EXCEPTION 'target_unavailable'; END IF;
 SELECT * INTO s FROM public.profile_roleplay_settings WHERE profile_id=p_target;
 IF FOUND AND s.rp_enabled=false THEN RAISE EXCEPTION 'target_not_roleplaying'; END IF;
 IF p_kind='flirt' AND coalesce(s.open_romance,false)=false THEN RAISE EXCEPTION 'target_not_open_romance'; END IF;
 IF p_kind IN ('insult','challenge') AND coalesce(s.open_rivalry,true)=false THEN RAISE EXCEPTION 'target_not_open_rivalry'; END IF;
 IF p_kind='offer_jam' AND coalesce(s.open_collab,true)=false THEN RAISE EXCEPTION 'target_not_open_collab'; END IF;
 IF EXISTS (SELECT 1 FROM public.social_interactions WHERE actor_profile_id=p_actor AND target_profile_id=p_target AND kind=p_kind AND created_at>now()-interval '1 hour') THEN
  RAISE EXCEPTION 'cooldown_active'; END IF;
 IF p_room IS NOT NULL AND NOT public.can_access_social_room(p_room) THEN RAISE EXCEPTION 'not_in_room'; END IF;
 CASE p_kind
  WHEN 'buy_drink' THEN v_aff:=4; v_trust:=2; v_line:=v_actor||' buys '||v_target||' a drink.';
  WHEN 'compliment' THEN v_aff:=3; v_trust:=1; v_line:=v_actor||' compliments '||v_target||'.';
  WHEN 'insult' THEN v_aff:=-6; v_trust:=-3; v_line:=v_actor||' throws an insult at '||v_target||'!';
  WHEN 'flirt' THEN v_aff:=2; v_attr:=4; v_line:=v_actor||' flirts with '||v_target||'.';
  WHEN 'offer_jam' THEN v_aff:=2; v_trust:=3; v_line:=v_actor||' offers to jam with '||v_target||'.';
  WHEN 'challenge' THEN v_aff:=-2; v_trust:=1; v_line:=v_actor||' challenges '||v_target||' to a battle of the bands!';
 END CASE;
 INSERT INTO public.character_relationships(entity_a_id,entity_a_type,entity_b_id,entity_b_type,entity_b_name,relationship_types,affection_score,trust_score,attraction_score,last_interaction_at)
 VALUES (p_actor,'player',p_target,'player',v_target,ARRAY['acquaintance'],greatest(-100,least(100,v_aff)),greatest(0,least(100,v_trust)),greatest(0,least(100,v_attr)),now())
 ON CONFLICT (entity_a_id,entity_b_id,entity_b_type) DO UPDATE SET
  affection_score=greatest(-100,least(100,character_relationships.affection_score+v_aff)),
  trust_score=greatest(0,least(100,character_relationships.trust_score+v_trust)),
  attraction_score=greatest(0,least(100,character_relationships.attraction_score+v_attr)),
  last_interaction_at=now(), updated_at=now();
 SELECT coalesce(sum(xp_awarded),0) INTO v_today FROM public.social_interactions WHERE actor_profile_id=p_actor AND created_at>=date_trunc('day',now());
 v_xp := greatest(0, least(v_xp, 100 - v_today));
 INSERT INTO public.social_interactions(actor_profile_id,target_profile_id,kind,room_key,xp_awarded) VALUES (p_actor,p_target,p_kind,p_room,v_xp);
 IF v_xp > 0 THEN
  INSERT INTO public.player_xp_wallet(profile_id) VALUES(p_actor) ON CONFLICT(profile_id) DO NOTHING;
  UPDATE public.player_xp_wallet SET xp_balance=coalesce(xp_balance,0)+v_xp, lifetime_xp=coalesce(lifetime_xp,0)+v_xp,
   skill_xp_balance=coalesce(skill_xp_balance,0)+v_xp, skill_xp_lifetime=coalesce(skill_xp_lifetime,0)+v_xp, last_recalculated=now()
  WHERE profile_id=p_actor;
 END IF;
 IF p_room IS NOT NULL THEN
  INSERT INTO public.social_room_messages(room_key,profile_id,kind,body) VALUES (p_room,p_actor,'system',v_line);
 END IF;
 RETURN jsonb_build_object('xp',v_xp,'affection_change',v_aff,'trust_change',v_trust,'line',v_line);
END $$;
REVOKE ALL ON FUNCTION public.perform_social_interaction(uuid,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perform_social_interaction(uuid,uuid,text,text) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.social_room_messages;