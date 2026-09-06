-- Section 3: Groupies, sex & relationships.
-- Adult-only scene contacts feed the existing NPC and romance systems.

CREATE TABLE IF NOT EXISTS public.scene_contact_archetypes (
  slug text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  romance_openness integer NOT NULL DEFAULT 50 CHECK (romance_openness BETWEEN 0 AND 100),
  discretion integer NOT NULL DEFAULT 50 CHECK (discretion BETWEEN 0 AND 100),
  social_energy integer NOT NULL DEFAULT 50 CHECK (social_energy BETWEEN 0 AND 100),
  gossip_bias integer NOT NULL DEFAULT 30 CHECK (gossip_bias BETWEEN 0 AND 100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.player_scene_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  npc_name text NOT NULL,
  npc_age integer NOT NULL CHECK (npc_age >= 18),
  archetype_slug text NOT NULL REFERENCES public.scene_contact_archetypes(slug),
  chemistry integer NOT NULL DEFAULT 20 CHECK (chemistry BETWEEN 0 AND 100),
  trust integer NOT NULL DEFAULT 10 CHECK (trust BETWEEN 0 AND 100),
  attachment integer NOT NULL DEFAULT 0 CHECK (attachment BETWEEN 0 AND 100),
  tension integer NOT NULL DEFAULT 0 CHECK (tension BETWEEN 0 AND 100),
  gossip_exposure integer NOT NULL DEFAULT 0 CHECK (gossip_exposure BETWEEN 0 AND 100),
  encounter_count integer NOT NULL DEFAULT 0,
  relationship_status text NOT NULL DEFAULT 'stranger' CHECK (relationship_status IN ('stranger','acquaintance','flirting','casual','dating','exclusive','cooling_off','ended')),
  last_interaction_at timestamptz,
  cooldown_until timestamptz,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, npc_name)
);
CREATE INDEX IF NOT EXISTS idx_player_scene_contacts_profile ON public.player_scene_contacts(profile_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.scene_contact_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.player_scene_contacts(id) ON DELETE CASCADE,
  interaction_type text NOT NULL CHECK (interaction_type IN ('talk','flirt','private_time','date','define_relationship','cool_off')),
  outcome text NOT NULL CHECK (outcome IN ('positive','neutral','declined','ended')),
  mutual_interest boolean,
  outcome_message text NOT NULL,
  chemistry_change integer NOT NULL DEFAULT 0,
  trust_change integer NOT NULL DEFAULT 0,
  attachment_change integer NOT NULL DEFAULT 0,
  tension_change integer NOT NULL DEFAULT 0,
  gossip_change integer NOT NULL DEFAULT 0,
  wellness_effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  romance_id uuid REFERENCES public.romantic_relationships(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scene_contact_events_profile ON public.scene_contact_events(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scene_contact_events_contact ON public.scene_contact_events(contact_id, created_at DESC);

INSERT INTO public.scene_contact_archetypes (slug, name, description, romance_openness, discretion, social_energy, gossip_bias)
VALUES
  ('superfan', 'Superfan', 'A devoted adult fan who keeps appearing around shows and afterparties.', 75, 55, 70, 35),
  ('scene_regular', 'Scene Regular', 'A familiar face from the local underground circuit with plenty of connections.', 60, 70, 75, 25),
  ('influencer', 'Influencer', 'A nightlife personality whose attention can travel quickly through the scene.', 65, 25, 85, 80),
  ('journalist', 'Music Journalist', 'An adult music writer who mixes professional curiosity with the social scene.', 40, 45, 65, 75),
  ('promoter', 'Promoter', 'A connected nightlife promoter who knows rooms, bands and people worth knowing.', 45, 65, 80, 45),
  ('fashion_insider', 'Fashion Insider', 'A style-world regular drawn to musicians, parties and emerging scenes.', 65, 50, 80, 55)
ON CONFLICT (slug) DO UPDATE SET
  name=EXCLUDED.name, description=EXCLUDED.description, romance_openness=EXCLUDED.romance_openness,
  discretion=EXCLUDED.discretion, social_energy=EXCLUDED.social_energy, gossip_bias=EXCLUDED.gossip_bias, is_active=true;

ALTER TABLE public.scene_contact_archetypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_scene_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scene_contact_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view scene contact archetypes" ON public.scene_contact_archetypes;
CREATE POLICY "Authenticated users can view scene contact archetypes" ON public.scene_contact_archetypes FOR SELECT TO authenticated USING (is_active=true);
DROP POLICY IF EXISTS "Players can view own scene contacts" ON public.player_scene_contacts;
CREATE POLICY "Players can view own scene contacts" ON public.player_scene_contacts FOR SELECT TO authenticated USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id=auth.uid()));
DROP POLICY IF EXISTS "Players can view own scene contact events" ON public.scene_contact_events;
CREATE POLICY "Players can view own scene contact events" ON public.scene_contact_events FOR SELECT TO authenticated USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id=auth.uid()));
REVOKE ALL ON public.scene_contact_archetypes FROM anon, authenticated;
REVOKE ALL ON public.player_scene_contacts FROM anon, authenticated;
REVOKE ALL ON public.scene_contact_events FROM anon, authenticated;
GRANT SELECT ON public.scene_contact_archetypes TO authenticated;
GRANT SELECT ON public.player_scene_contacts TO authenticated;
GRANT SELECT ON public.scene_contact_events TO authenticated;

CREATE OR REPLACE FUNCTION public.discover_scene_contacts(p_profile_id uuid, p_limit integer DEFAULT 3)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_age numeric; v_existing integer; v_to_create integer; v_created integer:=0;
  v_arch public.scene_contact_archetypes%ROWTYPE; v_contact_id uuid; v_name text; v_attempts integer;
  v_first_names text[]:=ARRAY['Alex','Jamie','Morgan','Riley','Casey','Jordan','Taylor','Avery','Cameron','Rowan','Harper','Quinn','Drew','Sam','Charlie','Frankie','Skyler'];
  v_last_names text[]:=ARRAY['Stone','Reed','Vale','Mercer','Hart','Rowe','Lane','Blake','Winter','Wilde','Cross','Fox','Flynn','Hayes','Monroe','Nash','Rivers'];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT age INTO v_age FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF floor(v_age)<18 THEN RETURN jsonb_build_object('ok',false,'reason','age_restricted','minimumAge',18); END IF;
  SELECT count(*) INTO v_existing FROM public.player_scene_contacts WHERE profile_id=p_profile_id AND relationship_status<>'ended';
  v_to_create:=LEAST(GREATEST(COALESCE(p_limit,3),1),3,GREATEST(8-v_existing,0));
  IF v_to_create<=0 THEN RETURN jsonb_build_object('ok',false,'reason','contact_limit','limit',8); END IF;
  WHILE v_created<v_to_create LOOP
    SELECT * INTO v_arch FROM public.scene_contact_archetypes WHERE is_active=true ORDER BY random() LIMIT 1;
    v_attempts:=0;
    LOOP
      v_name:=v_first_names[1+floor(random()*array_length(v_first_names,1))::integer]||' '||v_last_names[1+floor(random()*array_length(v_last_names,1))::integer];
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.player_scene_contacts WHERE profile_id=p_profile_id AND npc_name=v_name);
      v_attempts:=v_attempts+1; EXIT WHEN v_attempts>=20;
    END LOOP;
    INSERT INTO public.player_scene_contacts(profile_id,npc_name,npc_age,archetype_slug,chemistry,trust,attachment,relationship_status)
    VALUES(p_profile_id,v_name,21+floor(random()*20)::integer,v_arch.slug,LEAST(100,GREATEST(5,15+floor(random()*21)::integer+floor(v_arch.social_energy/10.0)::integer)),8+floor(random()*13)::integer,0,'stranger')
    RETURNING id INTO v_contact_id;
    INSERT INTO public.npc_relationships(profile_id,npc_type,npc_id,npc_name,affinity_score,trust_score,respect_score,interaction_count,relationship_stage,notes)
    SELECT p_profile_id,'scene_contact',v_contact_id,v_name,chemistry-50,trust-50,0,0,'stranger',jsonb_build_array(jsonb_build_object('source','underground_scene','archetype',archetype_slug,'adult',true))
    FROM public.player_scene_contacts WHERE id=v_contact_id ON CONFLICT(profile_id,npc_type,npc_id) DO NOTHING;
    v_created:=v_created+1;
  END LOOP;
  INSERT INTO public.player_underground_state(profile_id,scene_connections) VALUES(p_profile_id,v_created)
  ON CONFLICT(profile_id) DO UPDATE SET scene_connections=LEAST(100,public.player_underground_state.scene_connections+v_created),updated_at=now();
  RETURN jsonb_build_object('ok',true,'created',v_created);
END; $$;

CREATE OR REPLACE FUNCTION public.interact_scene_contact(p_profile_id uuid,p_contact_id uuid,p_interaction text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_profile public.profiles%ROWTYPE; v_contact public.player_scene_contacts%ROWTYPE; v_arch public.scene_contact_archetypes%ROWTYPE;
  v_roll numeric:=random()*100; v_chance numeric:=100; v_mutual boolean:=true; v_outcome text:='positive'; v_message text;
  v_dc integer:=0; v_dt integer:=0; v_da integer:=0; v_dten integer:=0; v_dg integer:=0;
  v_mood integer:=0; v_happiness integer:=0; v_stress integer:=0; v_energy integer:=0; v_fatigue integer:=0;
  v_new_status text; v_romance_id uuid; v_romance_stage text; v_committed_id uuid; v_suspicion_delta integer:=0;
  v_gossip_leaked boolean:=false; v_gossip_chance numeric:=0; v_new_suspicion integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_interaction NOT IN ('talk','flirt','private_time','date','define_relationship','cool_off') THEN RAISE EXCEPTION 'Unsupported interaction'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF floor(v_profile.age)<18 THEN RETURN jsonb_build_object('ok',false,'reason','age_restricted','minimumAge',18); END IF;
  SELECT * INTO v_contact FROM public.player_scene_contacts WHERE id=p_contact_id AND profile_id=p_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contact not found'; END IF;
  IF v_contact.npc_age<18 THEN RAISE EXCEPTION 'Invalid contact age'; END IF;
  IF v_contact.relationship_status='ended' AND p_interaction<>'talk' THEN RETURN jsonb_build_object('ok',false,'reason','relationship_ended'); END IF;
  IF v_contact.cooldown_until IS NOT NULL AND v_contact.cooldown_until>now() THEN RETURN jsonb_build_object('ok',false,'reason','cooldown','cooldownUntil',v_contact.cooldown_until); END IF;
  SELECT * INTO v_arch FROM public.scene_contact_archetypes WHERE slug=v_contact.archetype_slug AND is_active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contact archetype unavailable'; END IF;
  v_new_status:=v_contact.relationship_status;

  IF p_interaction='talk' THEN
    v_dc:=4+floor(random()*5)::integer; v_dt:=3+floor(random()*4)::integer; v_da:=CASE WHEN v_contact.encounter_count>1 THEN 1 ELSE 0 END;
    v_mood:=2; v_happiness:=2; v_stress:=-1; IF v_contact.relationship_status='stranger' THEN v_new_status:='acquaintance'; END IF;
    v_message:=v_contact.npc_name||' enjoys the conversation. You feel a little more connected.';
  ELSIF p_interaction='flirt' THEN
    v_chance:=LEAST(95,25+v_contact.chemistry*0.55+v_contact.trust*0.15+v_arch.romance_openness*0.20); v_mutual:=v_roll<v_chance;
    IF v_mutual THEN v_dc:=7+floor(random()*6)::integer;v_dt:=2;v_da:=2;v_mood:=3;v_happiness:=3;v_stress:=-1;IF v_contact.relationship_status IN('stranger','acquaintance','cooling_off') THEN v_new_status:='flirting';END IF;v_message:='The flirting is mutual. The chemistry between you and '||v_contact.npc_name||' is noticeably stronger.';
    ELSE v_outcome:='declined';v_dc:=-2;v_dten:=2;v_stress:=2;v_message:=v_contact.npc_name||' does not return the flirting. You leave it there and move on.'; END IF;
  ELSIF p_interaction='private_time' THEN
    IF v_contact.chemistry<45 OR v_contact.trust<15 THEN RETURN jsonb_build_object('ok',false,'reason','not_close_enough','requiredChemistry',45,'requiredTrust',15); END IF;
    v_chance:=LEAST(92,20+v_contact.chemistry*0.50+v_contact.trust*0.20+v_arch.romance_openness*0.25);v_mutual:=v_roll<v_chance;
    IF v_mutual THEN v_dc:=8;v_dt:=4;v_da:=8;v_dten:=-2;v_happiness:=5;v_stress:=-3;v_energy:=-5;v_fatigue:=5;IF v_contact.relationship_status NOT IN('dating','exclusive') THEN v_new_status:='casual';END IF;v_message:='You and '||v_contact.npc_name||' choose to spend private time together. The adult encounter stays non-public unless gossip escapes.';
    ELSE v_outcome:='declined';v_dten:=2;v_stress:=2;v_message:=v_contact.npc_name||' is not interested in taking things further. You respect the boundary.'; END IF;
  ELSIF p_interaction='date' THEN
    IF v_contact.chemistry<45 OR v_contact.trust<20 THEN RETURN jsonb_build_object('ok',false,'reason','not_close_enough','requiredChemistry',45,'requiredTrust',20); END IF;
    v_chance:=LEAST(94,20+v_contact.chemistry*0.45+v_contact.trust*0.25+v_arch.romance_openness*0.20);v_mutual:=v_roll<v_chance;
    IF v_mutual THEN v_dc:=7;v_dt:=7;v_da:=7;v_dten:=-2;v_mood:=4;v_happiness:=5;v_stress:=-3;v_new_status:='dating';v_message:='The date goes well. You and '||v_contact.npc_name||' are now seeing each other.';
    ELSE v_outcome:='declined';v_dt:=-1;v_dten:=3;v_stress:=3;v_message:=v_contact.npc_name||' prefers to keep things where they are.'; END IF;
  ELSIF p_interaction='define_relationship' THEN
    IF v_contact.relationship_status NOT IN('flirting','casual','dating') OR v_contact.chemistry<60 OR v_contact.attachment<35 THEN RETURN jsonb_build_object('ok',false,'reason','not_ready','requiredChemistry',60,'requiredAttachment',35); END IF;
    v_chance:=LEAST(92,15+v_contact.chemistry*0.35+v_contact.trust*0.30+v_contact.attachment*0.25);v_mutual:=v_roll<v_chance;
    IF v_mutual THEN v_dc:=5;v_dt:=8;v_da:=12;v_dten:=-4;v_mood:=5;v_happiness:=6;v_stress:=-4;v_new_status:='exclusive';v_message:='You and '||v_contact.npc_name||' agree to make the relationship exclusive.';
    ELSE v_outcome:='declined';v_da:=-3;v_dten:=5;v_stress:=4;v_message:=v_contact.npc_name||' is not ready for that level of commitment.'; END IF;
  ELSE
    v_mutual:=NULL;v_outcome:='ended';v_da:=-5;v_dten:=-3;v_stress:=-1;v_new_status:=CASE WHEN v_contact.relationship_status IN('stranger','acquaintance') THEN 'ended' ELSE 'cooling_off' END;v_message:='You create some distance from '||v_contact.npc_name||'. The connection begins to cool off.';
  END IF;

  IF v_mutual IS TRUE AND p_interaction IN('flirt','private_time','date','define_relationship') THEN
    SELECT id INTO v_committed_id FROM public.romantic_relationships WHERE partner_a_id=p_profile_id AND partner_a_type='player' AND is_active=true AND stage IN('exclusive','public_relationship','engaged','married') AND NOT(partner_b_type='npc' AND partner_b_id=p_contact_id) ORDER BY created_at DESC LIMIT 1;
    v_romance_stage:=CASE p_interaction WHEN 'define_relationship' THEN 'exclusive' WHEN 'date' THEN 'dating' WHEN 'private_time' THEN CASE WHEN v_committed_id IS NOT NULL THEN 'secret_affair' ELSE 'flirting' END ELSE 'flirting' END;
    INSERT INTO public.romantic_relationships(partner_a_id,partner_a_type,partner_b_id,partner_b_type,partner_b_name,stage,attraction_score,compatibility_score,passion_score,commitment_score,tension_score,is_secret,initiated_by,metadata)
    VALUES(p_profile_id,'player',p_contact_id,'npc',v_contact.npc_name,v_romance_stage,LEAST(100,GREATEST(50,v_contact.chemistry+v_dc)),LEAST(100,GREATEST(35,(v_contact.chemistry+v_contact.trust)/2)),LEAST(100,GREATEST(45,v_contact.chemistry+CASE WHEN p_interaction='private_time' THEN 10 ELSE 0 END)),LEAST(100,GREATEST(0,v_contact.attachment+v_da)),LEAST(100,GREATEST(0,v_contact.tension+v_dten)),(v_committed_id IS NOT NULL OR v_arch.discretion>=65),p_profile_id,jsonb_build_object('source','scene_contact','archetype',v_contact.archetype_slug,'adult',true))
    ON CONFLICT(partner_a_id,partner_b_id,partner_b_type) DO UPDATE SET attraction_score=LEAST(100,public.romantic_relationships.attraction_score+GREATEST(v_dc,0)),passion_score=LEAST(100,public.romantic_relationships.passion_score+CASE WHEN p_interaction='private_time' THEN 8 ELSE 3 END),commitment_score=LEAST(100,public.romantic_relationships.commitment_score+GREATEST(v_da,0)),tension_score=LEAST(100,GREATEST(0,public.romantic_relationships.tension_score+v_dten)),stage=CASE WHEN public.romantic_relationships.stage IN('engaged','married','public_relationship') THEN public.romantic_relationships.stage WHEN EXCLUDED.stage='exclusive' THEN 'exclusive' WHEN EXCLUDED.stage='dating' AND public.romantic_relationships.stage NOT IN('exclusive','secret_affair') THEN 'dating' WHEN EXCLUDED.stage='secret_affair' THEN 'secret_affair' ELSE public.romantic_relationships.stage END,is_secret=public.romantic_relationships.is_secret OR EXCLUDED.is_secret,is_active=true,updated_at=now(),metadata=public.romantic_relationships.metadata||EXCLUDED.metadata RETURNING id INTO v_romance_id;
    INSERT INTO public.romantic_events(romance_id,event_type,new_stage,attraction_change,passion_change,commitment_change,tension_change,description,metadata) VALUES(v_romance_id,'scene_contact_'||p_interaction,v_romance_stage,v_dc,CASE WHEN p_interaction='private_time' THEN 8 ELSE 3 END,v_da,v_dten,v_message,jsonb_build_object('source','underground_scene','mutualInterest',true));
    IF v_committed_id IS NOT NULL AND p_interaction IN('private_time','date','define_relationship') THEN
      v_suspicion_delta:=CASE p_interaction WHEN 'private_time' THEN 18 WHEN 'define_relationship' THEN 22 ELSE 12 END;
      UPDATE public.romantic_relationships SET tension_score=LEAST(100,tension_score+CASE WHEN p_interaction='define_relationship' THEN 14 ELSE 9 END),affair_suspicion=LEAST(100,affair_suspicion+v_suspicion_delta),updated_at=now() WHERE id=v_committed_id RETURNING affair_suspicion INTO v_new_suspicion;
      INSERT INTO public.romantic_events(romance_id,event_type,tension_change,suspicion_change,description,metadata) VALUES(v_committed_id,'outside_romance_suspicion',CASE WHEN p_interaction='define_relationship' THEN 14 ELSE 9 END,v_suspicion_delta,'Your existing partner senses distance and unexplained tension around your nightlife connections.',jsonb_build_object('source','scene_contact','contactId',p_contact_id));
    END IF;
  END IF;

  IF v_mutual IS TRUE AND p_interaction IN('flirt','private_time','date','define_relationship') THEN
    v_gossip_chance:=GREATEST(2,LEAST(90,v_arch.gossip_bias+CASE p_interaction WHEN 'private_time' THEN 18 WHEN 'define_relationship' THEN 20 WHEN 'date' THEN 12 ELSE 5 END-(v_arch.discretion*0.55)+LEAST(20,v_profile.fame/100.0)));
    v_gossip_leaked:=(random()*100)<v_gossip_chance;
    IF v_gossip_leaked THEN v_dg:=CASE p_interaction WHEN 'private_time' THEN 16 WHEN 'define_relationship' THEN 18 WHEN 'date' THEN 10 ELSE 6 END;UPDATE public.profiles SET fame=fame+1 WHERE id=p_profile_id;INSERT INTO public.player_underground_state(profile_id,notoriety) VALUES(p_profile_id,1) ON CONFLICT(profile_id) DO UPDATE SET notoriety=LEAST(100,public.player_underground_state.notoriety+1),updated_at=now();END IF;
  END IF;

  UPDATE public.player_scene_contacts SET chemistry=LEAST(100,GREATEST(0,chemistry+v_dc)),trust=LEAST(100,GREATEST(0,trust+v_dt)),attachment=LEAST(100,GREATEST(0,attachment+v_da)),tension=LEAST(100,GREATEST(0,tension+v_dten)),gossip_exposure=LEAST(100,GREATEST(0,gossip_exposure+v_dg)),encounter_count=encounter_count+1,relationship_status=v_new_status,last_interaction_at=now(),cooldown_until=now()+interval '2 hours',updated_at=now() WHERE id=p_contact_id;
  UPDATE public.npc_relationships SET affinity_score=LEAST(100,GREATEST(-100,affinity_score+v_dc)),trust_score=LEAST(100,GREATEST(-100,trust_score+v_dt)),interaction_count=interaction_count+1,last_interaction_at=now(),relationship_stage=CASE WHEN v_new_status='stranger' THEN 'stranger' WHEN v_new_status='ended' THEN 'acquaintance' WHEN v_new_status IN('dating','exclusive') THEN 'friend' ELSE 'contact' END,updated_at=now() WHERE profile_id=p_profile_id AND npc_type='scene_contact' AND npc_id=p_contact_id;
  UPDATE public.profiles SET mood=LEAST(100,GREATEST(0,mood+v_mood)),happiness=LEAST(100,GREATEST(0,happiness+v_happiness)),stress=LEAST(100,GREATEST(0,stress+v_stress)),energy=LEAST(100,GREATEST(0,energy+v_energy)),fatigue=LEAST(100,GREATEST(0,fatigue+v_fatigue)) WHERE id=p_profile_id;
  INSERT INTO public.scene_contact_events(profile_id,contact_id,interaction_type,outcome,mutual_interest,outcome_message,chemistry_change,trust_change,attachment_change,tension_change,gossip_change,wellness_effects,romance_id,metadata) VALUES(p_profile_id,p_contact_id,p_interaction,v_outcome,v_mutual,v_message,v_dc,v_dt,v_da,v_dten,v_dg,jsonb_build_object('mood',v_mood,'happiness',v_happiness,'stress',v_stress,'energy',v_energy,'fatigue',v_fatigue),v_romance_id,jsonb_build_object('gossipLeaked',v_gossip_leaked,'gossipChance',round(v_gossip_chance,1),'existingRelationshipAffected',v_committed_id IS NOT NULL,'adult',true));
  RETURN jsonb_build_object('ok',true,'outcome',v_outcome,'mutualInterest',v_mutual,'message',v_message,'status',v_new_status,'changes',jsonb_build_object('chemistry',v_dc,'trust',v_dt,'attachment',v_da,'tension',v_dten,'gossip',v_dg),'wellness',jsonb_build_object('mood',v_mood,'happiness',v_happiness,'stress',v_stress,'energy',v_energy,'fatigue',v_fatigue),'romanceId',v_romance_id,'gossipLeaked',v_gossip_leaked,'existingRelationshipAffected',v_committed_id IS NOT NULL);
END; $$;

REVOKE ALL ON FUNCTION public.discover_scene_contacts(uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.interact_scene_contact(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discover_scene_contacts(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interact_scene_contact(uuid,uuid,text) TO authenticated;
