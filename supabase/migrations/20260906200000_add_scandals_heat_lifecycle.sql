-- Section 4: scandals, press escalation and Heat consequences.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.player_scandals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type text NOT NULL DEFAULT 'system', source_id uuid,
  category text NOT NULL CHECK (category IN ('relationship','nightlife','property_damage','altercation','substance','promoter','authority','media','other')),
  headline text NOT NULL, summary text NOT NULL DEFAULT '',
  stage text NOT NULL DEFAULT 'rumor' CHECK (stage IN ('rumor','press','frenzy','fading','resolved')),
  severity integer NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  credibility integer NOT NULL DEFAULT 35 CHECK (credibility BETWEEN 0 AND 100),
  exposure integer NOT NULL DEFAULT 20 CHECK (exposure BETWEEN 0 AND 100),
  response_choice text CHECK (response_choice IS NULL OR response_choice IN ('ignore','apologize','deny','lean_in','consultant','disappear')),
  response_outcome text, fine_amount bigint NOT NULL DEFAULT 0 CHECK (fine_amount >= 0), fine_paid boolean NOT NULL DEFAULT false,
  venue_restriction_until timestamptz, travel_scrutiny_until timestamptz, media_blackout_until timestamptz,
  next_escalation_at timestamptz NOT NULL DEFAULT (now()+interval '12 hours'), resolved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_player_scandals_profile_stage ON public.player_scandals(profile_id,stage,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_player_scandal_source ON public.player_scandals(profile_id,source_type,source_id) WHERE source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.scandal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scandal_id uuid NOT NULL REFERENCES public.player_scandals(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('created','escalated','response','fine_paid','restriction','fading','resolved')),
  message text NOT NULL, heat_change integer NOT NULL DEFAULT 0, notoriety_change integer NOT NULL DEFAULT 0, fame_change integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scandal_events_profile ON public.scandal_events(profile_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scandal_events_scandal ON public.scandal_events(scandal_id,created_at DESC);
ALTER TABLE public.player_scandals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scandal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can view own scandals" ON public.player_scandals FOR SELECT TO authenticated USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id=(SELECT auth.uid())));
CREATE POLICY "Players can view own scandal events" ON public.scandal_events FOR SELECT TO authenticated USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id=(SELECT auth.uid())));
REVOKE ALL ON public.player_scandals FROM anon,authenticated;
REVOKE ALL ON public.scandal_events FROM anon,authenticated;
GRANT SELECT ON public.player_scandals TO authenticated;
GRANT SELECT ON public.scandal_events TO authenticated;

CREATE OR REPLACE FUNCTION private.raise_scandal(p_profile_id uuid,p_source_type text,p_source_id uuid,p_category text,p_headline text,p_summary text,p_severity integer,p_credibility integer,p_exposure integer,p_fine bigint DEFAULT 0)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_id uuid; v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.profiles WHERE id=p_profile_id; IF v_user_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.player_scandals(profile_id,source_type,source_id,category,headline,summary,severity,credibility,exposure,fine_amount,metadata)
  VALUES(p_profile_id,p_source_type,p_source_id,p_category,p_headline,p_summary,LEAST(5,GREATEST(1,p_severity)),LEAST(100,GREATEST(0,p_credibility)),LEAST(100,GREATEST(0,p_exposure)),GREATEST(0,p_fine),jsonb_build_object('origin',p_source_type))
  ON CONFLICT(profile_id,source_type,source_id) WHERE source_id IS NOT NULL DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.player_underground_state(profile_id,heat,notoriety) VALUES(p_profile_id,LEAST(100,p_severity*3),LEAST(100,p_severity*2))
  ON CONFLICT(profile_id) DO UPDATE SET heat=LEAST(100,public.player_underground_state.heat+p_severity*3),notoriety=LEAST(100,public.player_underground_state.notoriety+p_severity*2),updated_at=now();
  UPDATE public.profiles SET fame=GREATEST(0,fame+GREATEST(1,p_severity-1)) WHERE id=p_profile_id;
  INSERT INTO public.scandal_events(scandal_id,profile_id,event_type,message,heat_change,notoriety_change,fame_change) VALUES(v_id,p_profile_id,'created','A rumour has started circulating: '||p_headline,p_severity*3,p_severity*2,GREATEST(1,p_severity-1));
  INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata) VALUES(v_user_id,p_profile_id,'career','warning','Rumour circulating',p_headline,'/nightclubs',jsonb_build_object('scandal_id',v_id,'severity',p_severity));
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION private.raise_scandal(uuid,text,uuid,text,text,text,integer,integer,integer,bigint) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.scene_gossip_to_scandal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_contact text; v_display text; v_sev integer;
BEGIN
  IF NEW.gossip_change<5 THEN RETURN NEW; END IF;
  SELECT npc_name INTO v_contact FROM public.player_scene_contacts WHERE id=NEW.contact_id;
  SELECT COALESCE(display_name,username,'A musician') INTO v_display FROM public.profiles WHERE id=NEW.profile_id;
  v_sev:=LEAST(5,GREATEST(1,ceil(NEW.gossip_change/5.0)::integer));
  PERFORM private.raise_scandal(NEW.profile_id,'scene_contact',NEW.id,'relationship',v_display||' spotted getting close to '||COALESCE(v_contact,'a nightlife regular'),'A private nightlife encounter has become scene gossip. Whether it stays a rumour depends on how credible and visible the story becomes.',v_sev,30+v_sev*8,25+NEW.gossip_change*2,0);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_scene_gossip_to_scandal ON public.scene_contact_events;
CREATE TRIGGER trg_scene_gossip_to_scandal AFTER INSERT ON public.scene_contact_events FOR EACH ROW EXECUTE FUNCTION private.scene_gossip_to_scandal();

CREATE OR REPLACE FUNCTION private.underground_failure_to_scandal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_heat integer; v_name text; v_type text; v_sev integer; v_category text; v_fine bigint:=0;
BEGIN
  IF NEW.outcome<>'failure' THEN RETURN NEW; END IF;
  v_heat:=COALESCE(NULLIF(NEW.effects_applied->>'heat','')::integer,0); IF v_heat<5 AND random()>0.20 THEN RETURN NEW; END IF;
  SELECT name,event_type INTO v_name,v_type FROM public.underground_event_catalog WHERE id=NEW.catalog_id;
  v_sev:=LEAST(5,GREATEST(1,ceil(GREATEST(v_heat,4)/5.0)::integer)); v_category:=CASE WHEN v_type='risky_promoter' THEN 'promoter' ELSE 'nightlife' END;
  IF v_sev>=3 AND random()<0.45 THEN v_fine:=v_sev*750; END IF;
  PERFORM private.raise_scandal(NEW.profile_id,'underground_event',NEW.id,v_category,'Underground incident at '||COALESCE(v_name,'a secret event'),'A failed underground opportunity has attracted unwanted attention. Witnesses and local media are starting to trade versions of what happened.',v_sev,35+v_sev*7,20+v_sev*10,v_fine);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_underground_failure_to_scandal ON public.player_underground_event_history;
CREATE TRIGGER trg_underground_failure_to_scandal AFTER INSERT ON public.player_underground_event_history FOR EACH ROW EXECUTE FUNCTION private.underground_failure_to_scandal();

CREATE OR REPLACE FUNCTION public.process_player_scandals(p_profile_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_user_id uuid; v_heat integer:=0; v_s public.player_scandals%ROWTYPE; v_chance numeric; v_new_stage text; v_heat_delta integer; v_not_delta integer; v_fame_delta integer; v_processed integer:=0; v_message text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT user_id INTO v_user_id FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid(); IF v_user_id IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  SELECT COALESCE(heat,0) INTO v_heat FROM public.player_underground_state WHERE profile_id=p_profile_id;
  FOR v_s IN SELECT * FROM public.player_scandals WHERE profile_id=p_profile_id AND stage<>'resolved' AND next_escalation_at<=now() ORDER BY created_at FOR UPDATE LOOP
    v_heat_delta:=0;v_not_delta:=0;v_fame_delta:=0;
    IF v_s.stage='rumor' THEN
      v_chance:=LEAST(95,v_s.credibility*0.45+v_s.exposure*0.35+v_heat*0.20);
      IF random()*100<v_chance THEN v_new_stage:='press';v_heat_delta:=v_s.severity*2;v_not_delta:=v_s.severity*2;v_fame_delta:=v_s.severity;v_message:='The rumour has been picked up by the press: '||v_s.headline;
        UPDATE public.player_scandals SET stage='press',exposure=LEAST(100,exposure+15),next_escalation_at=now()+interval '18 hours',updated_at=now() WHERE id=v_s.id;
        INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata) VALUES(v_user_id,p_profile_id,'career','warning','Press story breaking',v_s.headline,'/nightclubs',jsonb_build_object('scandal_id',v_s.id,'stage','press'));
      ELSE v_new_stage:='fading';v_message:='The rumour is losing momentum.';UPDATE public.player_scandals SET stage='fading',credibility=GREATEST(0,credibility-15),exposure=GREATEST(0,exposure-15),next_escalation_at=now()+interval '24 hours',updated_at=now() WHERE id=v_s.id; END IF;
    ELSIF v_s.stage='press' THEN
      v_chance:=LEAST(92,15+v_s.severity*10+v_s.exposure*0.30+v_heat*0.20);
      IF random()*100<v_chance AND v_s.severity>=2 THEN v_new_stage:='frenzy';v_heat_delta:=v_s.severity*3;v_not_delta:=v_s.severity*3;v_fame_delta:=v_s.severity*2;v_message:='The story has become a media frenzy.';
        UPDATE public.player_scandals SET stage='frenzy',exposure=LEAST(100,exposure+20),venue_restriction_until=CASE WHEN severity>=4 THEN now()+interval '48 hours' ELSE venue_restriction_until END,travel_scrutiny_until=CASE WHEN severity>=4 THEN now()+interval '72 hours' ELSE travel_scrutiny_until END,fine_amount=CASE WHEN severity>=3 AND fine_amount=0 AND category IN('nightlife','property_damage','altercation','promoter','authority') THEN severity*750 ELSE fine_amount END,next_escalation_at=now()+interval '24 hours',updated_at=now() WHERE id=v_s.id;
        INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata) VALUES(v_user_id,p_profile_id,'career','error','Media frenzy',v_s.headline,'/nightclubs',jsonb_build_object('scandal_id',v_s.id,'stage','frenzy'));
      ELSE v_new_stage:='fading';v_message:='Coverage is beginning to fade.';UPDATE public.player_scandals SET stage='fading',exposure=GREATEST(0,exposure-20),next_escalation_at=now()+interval '24 hours',updated_at=now() WHERE id=v_s.id; END IF;
    ELSIF v_s.stage='frenzy' THEN v_new_stage:='fading';v_heat_delta:=-5;v_message:='The media frenzy is cooling off.';UPDATE public.player_scandals SET stage='fading',exposure=GREATEST(0,exposure-25),next_escalation_at=now()+interval '36 hours',updated_at=now() WHERE id=v_s.id;
    ELSIF v_s.stage='fading' THEN v_new_stage:='resolved';v_heat_delta:=-(v_s.severity*2);v_message:='The scandal has dropped out of the news cycle.';UPDATE public.player_scandals SET stage='resolved',resolved_at=now(),next_escalation_at=now(),updated_at=now() WHERE id=v_s.id;INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata) VALUES(v_user_id,p_profile_id,'career','success','Scandal fading',v_s.headline||' is no longer driving the news cycle.','/nightclubs',jsonb_build_object('scandal_id',v_s.id,'stage','resolved'));
    ELSE CONTINUE; END IF;
    IF v_heat_delta<>0 OR v_not_delta<>0 THEN INSERT INTO public.player_underground_state(profile_id,heat,notoriety) VALUES(p_profile_id,GREATEST(0,v_heat_delta),GREATEST(0,v_not_delta)) ON CONFLICT(profile_id) DO UPDATE SET heat=LEAST(100,GREATEST(0,public.player_underground_state.heat+v_heat_delta)),notoriety=LEAST(100,GREATEST(0,public.player_underground_state.notoriety+v_not_delta)),updated_at=now();v_heat:=LEAST(100,GREATEST(0,v_heat+v_heat_delta)); END IF;
    IF v_fame_delta<>0 THEN UPDATE public.profiles SET fame=GREATEST(0,fame+v_fame_delta) WHERE id=p_profile_id; END IF;
    INSERT INTO public.scandal_events(scandal_id,profile_id,event_type,message,heat_change,notoriety_change,fame_change,metadata) VALUES(v_s.id,p_profile_id,CASE WHEN v_new_stage='resolved' THEN 'resolved' WHEN v_new_stage='fading' THEN 'fading' ELSE 'escalated' END,v_message,v_heat_delta,v_not_delta,v_fame_delta,jsonb_build_object('stage',v_new_stage));v_processed:=v_processed+1;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'processed',v_processed,'heat',v_heat);
END; $$;
REVOKE ALL ON FUNCTION public.process_player_scandals(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.process_player_scandals(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_scandal(p_profile_id uuid,p_scandal_id uuid,p_response text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_profile public.profiles%ROWTYPE;v_s public.player_scandals%ROWTYPE;v_consultant_rate numeric;v_success boolean:=true;v_cred_delta integer:=0;v_exp_delta integer:=0;v_heat_delta integer:=0;v_not_delta integer:=0;v_fame_delta integer:=0;v_message text;v_next interval:=interval '12 hours';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  SELECT * INTO v_s FROM public.player_scandals WHERE id=p_scandal_id AND profile_id=p_profile_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Scandal not found'; END IF;
  IF v_s.stage='resolved' THEN RETURN jsonb_build_object('ok',false,'reason','resolved'); END IF;
  IF p_response='pay_fine' THEN
    IF v_s.fine_amount<=0 OR v_s.fine_paid THEN RETURN jsonb_build_object('ok',false,'reason','no_outstanding_fine'); END IF;
    IF v_profile.cash<v_s.fine_amount THEN RETURN jsonb_build_object('ok',false,'reason','insufficient_cash','required',v_s.fine_amount); END IF;
    UPDATE public.profiles SET cash=cash-v_s.fine_amount WHERE id=p_profile_id;UPDATE public.player_scandals SET fine_paid=true,updated_at=now() WHERE id=v_s.id;UPDATE public.player_underground_state SET heat=GREATEST(0,heat-10),updated_at=now() WHERE profile_id=p_profile_id;
    INSERT INTO public.scandal_events(scandal_id,profile_id,event_type,message,heat_change,metadata) VALUES(v_s.id,p_profile_id,'fine_paid','You paid the outstanding fine and reduced official attention.',-10,jsonb_build_object('amount',v_s.fine_amount));RETURN jsonb_build_object('ok',true,'response','pay_fine','message','Fine paid. Official attention has eased.','cashSpent',v_s.fine_amount,'heatChange',-10);
  END IF;
  IF p_response NOT IN('ignore','apologize','deny','lean_in','consultant','disappear') THEN RAISE EXCEPTION 'Unsupported response'; END IF;
  IF v_s.response_choice IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'reason','already_responded','response',v_s.response_choice); END IF;
  IF p_response='ignore' THEN v_cred_delta:=-5;v_message:='You refuse to feed the story. It may fade, but you surrender control of the narrative.';
  ELSIF p_response='apologize' THEN v_cred_delta:=-25;v_exp_delta:=-10;v_heat_delta:=-10;v_not_delta:=-5;v_fame_delta:=-2;v_message:='Your apology takes some heat out of the story.';
  ELSIF p_response='deny' THEN v_success:=random()*100<GREATEST(20,70-v_s.credibility*0.45);IF v_success THEN v_cred_delta:=-20;v_exp_delta:=-15;v_heat_delta:=-6;v_message:='Your denial lands well enough to muddy the story.';ELSE v_cred_delta:=15;v_exp_delta:=20;v_heat_delta:=10;v_not_delta:=8;v_fame_delta:=4;v_next:=interval '6 hours';v_message:='The denial backfires and gives the story fresh momentum.';END IF;
  ELSIF p_response='lean_in' THEN v_exp_delta:=20;v_heat_delta:=8;v_not_delta:=12;v_fame_delta:=8;v_next:=interval '6 hours';v_message:='You lean into the chaos. Fame and underground credibility rise, but so does attention.';INSERT INTO public.player_underground_state(profile_id,underground_cred) VALUES(p_profile_id,5) ON CONFLICT(profile_id) DO UPDATE SET underground_cred=LEAST(100,public.player_underground_state.underground_cred+5),updated_at=now();
  ELSIF p_response='consultant' THEN SELECT pc.success_rate INTO v_consultant_rate FROM public.player_pr_consultants ppc JOIN public.pr_consultants pc ON pc.id=ppc.consultant_id WHERE ppc.user_id=auth.uid() AND ppc.expires_at>now() ORDER BY pc.success_rate DESC LIMIT 1;IF v_consultant_rate IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','no_active_consultant');END IF;v_success:=random()<LEAST(0.98,GREATEST(0.10,v_consultant_rate));IF v_success THEN v_cred_delta:=-35;v_exp_delta:=-25;v_heat_delta:=-15;v_not_delta:=-8;v_message:='Your PR consultant gets ahead of the story and sharply reduces its momentum.';ELSE v_cred_delta:=-10;v_exp_delta:=5;v_heat_delta:=-3;v_message:='The consultant contains some damage, but the story keeps moving.';END IF;
  ELSIF p_response='disappear' THEN v_cred_delta:=-10;v_exp_delta:=-30;v_heat_delta:=-8;v_fame_delta:=-4;v_next:=interval '72 hours';v_message:='You disappear from public view for a few days. Attention drops, but so does visibility.';UPDATE public.player_scandals SET media_blackout_until=now()+interval '72 hours' WHERE id=v_s.id;UPDATE public.profiles SET stress=GREATEST(0,stress-4),mood=LEAST(100,mood+2) WHERE id=p_profile_id;END IF;
  UPDATE public.player_scandals SET response_choice=p_response,response_outcome=CASE WHEN v_success THEN 'effective' ELSE 'backfired' END,credibility=LEAST(100,GREATEST(0,credibility+v_cred_delta)),exposure=LEAST(100,GREATEST(0,exposure+v_exp_delta)),next_escalation_at=now()+v_next,updated_at=now() WHERE id=v_s.id;
  INSERT INTO public.player_underground_state(profile_id,heat,notoriety) VALUES(p_profile_id,GREATEST(0,v_heat_delta),GREATEST(0,v_not_delta)) ON CONFLICT(profile_id) DO UPDATE SET heat=LEAST(100,GREATEST(0,public.player_underground_state.heat+v_heat_delta)),notoriety=LEAST(100,GREATEST(0,public.player_underground_state.notoriety+v_not_delta)),updated_at=now();
  IF v_fame_delta<>0 THEN UPDATE public.profiles SET fame=GREATEST(0,fame+v_fame_delta) WHERE id=p_profile_id;END IF;
  INSERT INTO public.scandal_events(scandal_id,profile_id,event_type,message,heat_change,notoriety_change,fame_change,metadata) VALUES(v_s.id,p_profile_id,'response',v_message,v_heat_delta,v_not_delta,v_fame_delta,jsonb_build_object('response',p_response,'success',v_success,'credibility_change',v_cred_delta,'exposure_change',v_exp_delta));
  RETURN jsonb_build_object('ok',true,'response',p_response,'success',v_success,'message',v_message,'changes',jsonb_build_object('credibility',v_cred_delta,'exposure',v_exp_delta,'heat',v_heat_delta,'notoriety',v_not_delta,'fame',v_fame_delta));
END; $$;
REVOKE ALL ON FUNCTION public.respond_to_scandal(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_to_scandal(uuid,uuid,text) TO authenticated;
