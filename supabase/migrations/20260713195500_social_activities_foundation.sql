-- Social activities, hangouts and band bonding foundation.
ALTER TABLE public.player_scheduled_activities DROP CONSTRAINT IF EXISTS player_scheduled_activities_activity_type_check;
ALTER TABLE public.player_scheduled_activities ADD CONSTRAINT player_scheduled_activities_activity_type_check CHECK (activity_type IN ('songwriting','gig','rehearsal','busking','recording','travel','work','university','reading','mentorship','youtube_video','health','wellness_fitness','wellness_mindfulness','wellness_rest','wellness_indulgence','social_activity','other'));

ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'social_activity_created';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'social_activity_response';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'social_activity_cancelled';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'social_activity_completed';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'social_activity_denied';

CREATE TABLE IF NOT EXISTS public.social_activity_catalog (
  activity_type text PRIMARY KEY,
  display_name text NOT NULL,
  description text NOT NULL,
  minimum_participants integer NOT NULL CHECK (minimum_participants >= 2),
  maximum_participants integer NOT NULL CHECK (maximum_participants >= minimum_participants),
  duration_options integer[] NOT NULL CHECK (array_length(duration_options, 1) > 0),
  base_cost numeric NOT NULL DEFAULT 0 CHECK (base_cost >= 0),
  cost_type text NOT NULL CHECK (cost_type IN ('free','per_person','group')),
  energy_effect integer NOT NULL DEFAULT 0,
  stress_effect integer NOT NULL DEFAULT 0,
  mood_effect integer NOT NULL DEFAULT 0,
  rapport_effect numeric NOT NULL DEFAULT 0,
  familiarity_effect numeric NOT NULL DEFAULT 0,
  conflict_effect numeric NOT NULL DEFAULT 0,
  wellness_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  location_type text[] NOT NULL DEFAULT ARRAY['any'],
  city_requirement text NOT NULL DEFAULT 'same_city' CHECK (city_requirement IN ('same_city','reachable_city','tour_city','any')),
  available_times text[] NOT NULL DEFAULT ARRAY['morning','afternoon','evening'],
  risk_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  cooldown interval NOT NULL DEFAULT interval '20 hours',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_preferences (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitation_scope text NOT NULL DEFAULT 'band_collaborators' CHECK (invitation_scope IN ('everyone','friends_only','band_collaborators','nobody')),
  allow_nightlife boolean NOT NULL DEFAULT true,
  allow_group_invitations boolean NOT NULL DEFAULT true,
  allow_conflict_resolution boolean NOT NULL DEFAULT true,
  show_social_availability boolean NOT NULL DEFAULT true,
  availability_status text NOT NULL DEFAULT 'open_to_hangouts' CHECK (availability_status IN ('open_to_hangouts','band_activities_only','quiet_activities_preferred','not_available','available_this_week')),
  preferred_activity_types text[] NOT NULL DEFAULT '{}',
  avoided_activity_types text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type text NOT NULL REFERENCES public.social_activity_catalog(activity_type),
  host_player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  band_id uuid REFERENCES public.bands(id) ON DELETE SET NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  location_id uuid,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'inviting' CHECK (status IN ('draft','inviting','scheduled','confirmed','in_progress','completed','cancelled','failed','expired')),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes >= 30),
  cost_payer text NOT NULL DEFAULT 'split' CHECK (cost_payer IN ('host','split','each_own','band','company_later','free')),
  estimated_cost numeric NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  actual_cost numeric CHECK (actual_cost IS NULL OR actual_cost >= 0),
  visibility text NOT NULL DEFAULT 'participants_only' CHECK (visibility IN ('participants_only','band_members','friends','private','public_memory_only')),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  completion_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, cancelled_at timestamptz,
  CHECK (end_at > start_at), CHECK (start_at > timezone('utc', now()) - interval '5 minutes')
);

CREATE TABLE IF NOT EXISTS public.social_activity_participants (
  activity_id uuid NOT NULL REFERENCES public.social_activities(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitation_status text NOT NULL DEFAULT 'pending' CHECK (invitation_status IN ('host','pending','accepted','declined','expired','cancelled')),
  attendance_status text NOT NULL DEFAULT 'pending' CHECK (attendance_status IN ('pending','attended','arrived_late','left_early','cancelled_in_advance','excused_absence','no_show','host_no_show','disputed')),
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(), responded_at timestamptz, attended_at timestamptz, left_at timestamptz,
  cost_share numeric NOT NULL DEFAULT 0 CHECK (cost_share >= 0), created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(activity_id, player_id)
);

CREATE TABLE IF NOT EXISTS public.social_activity_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), activity_id uuid NOT NULL REFERENCES public.social_activities(id) ON DELETE CASCADE,
  outcome_type text NOT NULL, quality text NOT NULL CHECK (quality IN ('awkward','uneventful','enjoyable','great','memorable')),
  summary text NOT NULL, relationship_event_ids uuid[] NOT NULL DEFAULT '{}', wellness_effects jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(activity_id, outcome_type)
);

CREATE INDEX IF NOT EXISTS social_activities_host_start_idx ON public.social_activities(host_player_id,start_at DESC);
CREATE INDEX IF NOT EXISTS social_activities_status_start_idx ON public.social_activities(status,start_at) WHERE status IN ('inviting','scheduled','confirmed','in_progress');
CREATE INDEX IF NOT EXISTS social_activity_participants_player_status_idx ON public.social_activity_participants(player_id, invitation_status, created_at DESC);

ALTER TABLE public.social_activity_catalog ENABLE ROW LEVEL SECURITY; ALTER TABLE public.social_preferences ENABLE ROW LEVEL SECURITY; ALTER TABLE public.social_activities ENABLE ROW LEVEL SECURITY; ALTER TABLE public.social_activity_participants ENABLE ROW LEVEL SECURITY; ALTER TABLE public.social_activity_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Activity catalogue readable" ON public.social_activity_catalog FOR SELECT USING (auth.role()='authenticated');
CREATE POLICY "Players manage own social preferences" ON public.social_preferences FOR ALL USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id=auth.uid())) WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id=auth.uid()));
CREATE POLICY "Participants view social activities" ON public.social_activities FOR SELECT USING (host_player_id IN (SELECT id FROM public.profiles WHERE user_id=auth.uid()) OR EXISTS (SELECT 1 FROM public.social_activity_participants sap JOIN public.profiles p ON p.id=sap.player_id WHERE sap.activity_id=id AND p.user_id=auth.uid()) OR (visibility='band_members' AND EXISTS (SELECT 1 FROM public.band_members bm JOIN public.profiles p ON p.id=bm.user_id WHERE bm.band_id=social_activities.band_id AND p.user_id=auth.uid())));
CREATE POLICY "Participants view social activity roster" ON public.social_activity_participants FOR SELECT USING (player_id IN (SELECT id FROM public.profiles WHERE user_id=auth.uid()) OR EXISTS (SELECT 1 FROM public.social_activities sa WHERE sa.id=activity_id AND sa.host_player_id IN (SELECT id FROM public.profiles WHERE user_id=auth.uid())) OR EXISTS (SELECT 1 FROM public.social_activity_participants mine JOIN public.profiles p ON p.id=mine.player_id WHERE mine.activity_id=activity_id AND p.user_id=auth.uid()));
CREATE POLICY "Participants view social outcomes" ON public.social_activity_outcomes FOR SELECT USING (EXISTS (SELECT 1 FROM public.social_activity_participants sap JOIN public.profiles p ON p.id=sap.player_id WHERE sap.activity_id=activity_id AND p.user_id=auth.uid()));

INSERT INTO public.social_activity_catalog(activity_type,display_name,description,minimum_participants,maximum_participants,duration_options,base_cost,cost_type,energy_effect,stress_effect,mood_effect,rapport_effect,familiarity_effect,conflict_effect,location_type,available_times,risk_profile) VALUES
('coffee','Coffee','A low-pressure chat over coffee.',2,2,ARRAY[30,60],6,'per_person',-2,-2,2,2,2,0,ARRAY['cafe'],ARRAY['morning','afternoon','evening'],'{"negativeChance":0.08}'::jsonb),
('meal','Meal','Share food and catch up.',2,6,ARRAY[60,90,120],20,'per_person',-4,-3,4,3,2,0,ARRAY['restaurant'],ARRAY['afternoon','evening'],'{"negativeChance":0.08}'::jsonb),
('drinks','Drinks','A relaxed evening at a bar.',2,6,ARRAY[60,120],18,'per_person',-8,-2,5,4,2,0,ARRAY['bar'],ARRAY['evening','late_night'],'{"negativeChance":0.22,"negative":["fatigue","overspending"]}'::jsonb),
('night_out','Night out','A bigger social night with higher upside and fatigue risk.',2,8,ARRAY[120,180,240],35,'per_person',-16,-3,7,6,3,0,ARRAY['bar','club'],ARRAY['evening','late_night'],'{"negativeChance":0.22}'::jsonb),
('house_party','House party','A private group celebration.',3,12,ARRAY[120,180],12,'per_person',-12,-1,6,5,3,0,ARRAY['private_residence'],ARRAY['evening','late_night'],'{"negativeChance":0.16}'::jsonb),
('club_night','Club night','Dance, music and nightlife energy.',2,8,ARRAY[120,180],30,'per_person',-18,-2,7,6,2,0,ARRAY['club'],ARRAY['evening','late_night'],'{"negativeChance":0.22}'::jsonb),
('cinema','Cinema','A quiet shared movie trip.',2,5,ARRAY[120],14,'per_person',-3,-3,3,2,2,0,ARRAY['cinema'],ARRAY['afternoon','evening'],'{"negativeChance":0.06}'::jsonb),
('bowling','Bowling','Casual competition and group banter.',2,6,ARRAY[90,120],16,'per_person',-7,-2,4,4,2,0,ARRAY['bowling'],ARRAY['afternoon','evening'],'{"negativeChance":0.08}'::jsonb),
('arcade','Arcade','Games, laughs and light competition.',2,6,ARRAY[60,90],12,'per_person',-6,-2,4,4,2,0,ARRAY['arcade'],ARRAY['afternoon','evening'],'{"negativeChance":0.08}'::jsonb),
('shopping_trip','Shopping trip','Browse stores together without making it a grind.',2,4,ARRAY[90,120],25,'per_person',-8,-1,3,2,2,0,ARRAY['shopping'],ARRAY['morning','afternoon'],'{"negativeChance":0.08}'::jsonb),
('sightseeing','Sightseeing','Explore the city and create tour memories.',2,8,ARRAY[120,180],10,'per_person',-10,-4,5,4,3,0,ARRAY['landmark','city'],ARRAY['morning','afternoon'],'{"negativeChance":0.08}'::jsonb),
('beach_day','Beach day','Relax outdoors where the city supports it.',2,8,ARRAY[120,240],8,'per_person',-8,-6,6,4,3,0,ARRAY['beach'],ARRAY['morning','afternoon'],'{"negativeChance":0.08}'::jsonb),
('park_hangout','Park hangout','Affordable downtime in a public park.',2,8,ARRAY[60,120],0,'free',-3,-4,4,3,2,0,ARRAY['park'],ARRAY['morning','afternoon','evening'],'{"negativeChance":0.05}'::jsonb),
('gaming_session','Gaming session','Low-cost downtime for small groups.',2,5,ARRAY[90,180],5,'per_person',-5,-3,4,4,2,0,ARRAY['private_residence','arcade'],ARRAY['afternoon','evening'],'{"negativeChance":0.08}'::jsonb),
('band_meeting','Band meeting','Talk through plans without forcing social gains.',2,8,ARRAY[60,90],0,'free',-3,-1,1,1,2,-1,ARRAY['rehearsal_space','cafe'],ARRAY['morning','afternoon','evening'],'{"negativeChance":0.10}'::jsonb),
('team_dinner','Team dinner','A band-focused dinner to improve morale.',2,10,ARRAY[90,120],28,'per_person',-6,-4,5,4,3,-1,ARRAY['restaurant'],ARRAY['evening'],'{"negativeChance":0.08}'::jsonb),
('release_celebration','Release celebration','Celebrate a meaningful release milestone.',2,12,ARRAY[90,180],30,'per_person',-10,-5,8,5,3,-1,ARRAY['restaurant','bar','venue'],ARRAY['evening','late_night'],'{"negativeChance":0.12}'::jsonb),
('gig_afterparty','Gig afterparty','Post-gig celebration calibrated by energy and next commitments.',2,12,ARRAY[90,180],24,'per_person',-14,-3,7,5,3,0,ARRAY['venue','bar','club'],ARRAY['evening','late_night'],'{"negativeChance":0.20}'::jsonb),
('tour_downtime','Tour downtime','A tour-friendly reset between travel and gigs.',2,10,ARRAY[60,120],10,'per_person',-4,-6,5,4,3,-1,ARRAY['hotel','park','restaurant'],ARRAY['afternoon','evening'],'{"negativeChance":0.08}'::jsonb),
('quiet_catch_up','Quiet catch-up','Low-energy conversation and support.',2,3,ARRAY[45,60,90],4,'per_person',-1,-5,4,3,3,-1,ARRAY['cafe','park','private_residence'],ARRAY['morning','afternoon','evening'],'{"negativeChance":0.05}'::jsonb),
('conflict_resolution','Conflict-resolution meeting','A deliberate attempt to reduce tension.',2,4,ARRAY[60,90],0,'free',-4,1,1,1,2,-5,ARRAY['cafe','rehearsal_space'],ARRAY['morning','afternoon','evening'],'{"negativeChance":0.18}'::jsonb),
('wellness_check_in','Wellness check-in','Support a bandmate without exposing private wellness details.',2,3,ARRAY[45,60],0,'free',0,-4,3,2,2,-1,ARRAY['cafe','park','private_residence'],ARRAY['morning','afternoon','evening'],'{"negativeChance":0.05}'::jsonb)
ON CONFLICT(activity_type) DO UPDATE SET display_name=EXCLUDED.display_name, description=EXCLUDED.description, minimum_participants=EXCLUDED.minimum_participants, maximum_participants=EXCLUDED.maximum_participants, duration_options=EXCLUDED.duration_options, base_cost=EXCLUDED.base_cost, cost_type=EXCLUDED.cost_type, energy_effect=EXCLUDED.energy_effect, stress_effect=EXCLUDED.stress_effect, mood_effect=EXCLUDED.mood_effect, rapport_effect=EXCLUDED.rapport_effect, familiarity_effect=EXCLUDED.familiarity_effect, conflict_effect=EXCLUDED.conflict_effect, location_type=EXCLUDED.location_type, available_times=EXCLUDED.available_times, risk_profile=EXCLUDED.risk_profile, updated_at=now();

CREATE OR REPLACE FUNCTION public.social_activity_can_invite(sender uuid, recipient uuid, activity_type text, group_size integer DEFAULT 2) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT sender IS NOT NULL AND recipient IS NOT NULL AND sender<>recipient AND NOT public.are_profiles_blocked(sender,recipient)
    AND coalesce((SELECT invitation_scope <> 'nobody' AND (allow_group_invitations OR group_size <= 2) AND (activity_type <> 'conflict_resolution' OR allow_conflict_resolution) FROM public.social_preferences WHERE profile_id=recipient), true);
$$;

CREATE OR REPLACE FUNCTION public.create_social_activity(p_activity_type text,p_participant_ids uuid[],p_start_at timestamptz,p_duration_minutes integer,p_city_id uuid DEFAULT NULL,p_location_id uuid DEFAULT NULL,p_band_id uuid DEFAULT NULL,p_cost_payer text DEFAULT 'split',p_title text DEFAULT NULL,p_note text DEFAULT NULL,p_visibility text DEFAULT 'participants_only') RETURNS public.social_activities LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid; actor_user uuid; def public.social_activity_catalog; row public.social_activities; participant uuid; participant_count int; p_user uuid; per_share numeric; schedule_conflict boolean;
BEGIN
  SELECT id,user_id INTO actor,actor_user FROM public.profiles WHERE user_id=auth.uid() ORDER BY created_at LIMIT 1; IF actor IS NULL THEN RAISE EXCEPTION 'Sign in with an active player profile.'; END IF;
  SELECT * INTO def FROM public.social_activity_catalog WHERE activity_type=p_activity_type AND enabled; IF def.activity_type IS NULL THEN RAISE EXCEPTION 'Choose an enabled social activity.'; END IF;
  IF p_start_at < timezone('utc',now()) THEN RAISE EXCEPTION 'Activities cannot be scheduled in the past.'; END IF; IF NOT p_duration_minutes = ANY(def.duration_options) THEN RAISE EXCEPTION 'Choose a valid duration for this activity.'; END IF;
  participant_count := 1 + coalesce(array_length(p_participant_ids,1),0); IF participant_count < def.minimum_participants OR participant_count > def.maximum_participants THEN RAISE EXCEPTION 'Participant count is outside this activity limit.'; END IF;
  SELECT public.check_scheduling_conflict(actor_user,p_start_at,p_start_at + make_interval(mins=>p_duration_minutes),NULL) INTO schedule_conflict; IF schedule_conflict THEN RAISE EXCEPTION 'This overlaps another scheduled activity.'; END IF;
  INSERT INTO public.social_activities(activity_type,host_player_id,band_id,city_id,location_id,title,description,start_at,end_at,duration_minutes,cost_payer,estimated_cost,visibility,status)
  VALUES(p_activity_type,actor,p_band_id,p_city_id,p_location_id,coalesce(nullif(btrim(p_title),''),def.display_name),nullif(btrim(coalesce(p_note,'')),''),p_start_at,p_start_at + make_interval(mins=>p_duration_minutes),p_duration_minutes,p_cost_payer,def.base_cost*participant_count,p_visibility,'inviting') RETURNING * INTO row;
  per_share := CASE WHEN p_cost_payer IN ('free','host','band','company_later') OR def.cost_type='free' THEN 0 WHEN p_cost_payer='split' THEN ceil((def.base_cost*participant_count)/participant_count) ELSE def.base_cost END;
  INSERT INTO public.social_activity_participants(activity_id,player_id,invitation_status,attendance_status,invited_by,cost_share) VALUES(row.id,actor,'host','pending',actor,CASE WHEN p_cost_payer='host' THEN def.base_cost*participant_count ELSE per_share END);
  INSERT INTO public.player_scheduled_activities(user_id,profile_id,activity_type,scheduled_start,scheduled_end,status,title,description,metadata) VALUES(actor_user,actor,'social_activity',row.start_at,row.end_at,'scheduled',row.title,row.description,jsonb_build_object('social_activity_id',row.id,'activity_type',p_activity_type));
  FOREACH participant IN ARRAY coalesce(p_participant_ids,'{}'::uuid[]) LOOP
    IF NOT public.social_activity_can_invite(actor,participant,p_activity_type,participant_count) THEN INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata) VALUES(actor,participant,'social_activity_denied','social_activity',row.id,jsonb_build_object('reason','preferences_or_block')); RAISE EXCEPTION 'One or more players are not available for this invitation.'; END IF;
    INSERT INTO public.social_activity_participants(activity_id,player_id,invitation_status,invited_by,cost_share) VALUES(row.id,participant,'pending',actor,per_share);
    INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata) SELECT user_id,participant,'social','social_activity_invitation','Social activity invitation','You were invited to '||def.display_name||'.','/social/activities/'||row.id,jsonb_build_object('social_activity_id',row.id,'activity_type',p_activity_type) FROM public.profiles WHERE id=participant;
  END LOOP;
  INSERT INTO public.social_action_audit_log(actor_profile_id,action,target_type,target_id,metadata) VALUES(actor,'social_activity_created','social_activity',row.id,jsonb_build_object('activity_type',p_activity_type,'participant_count',participant_count));
  RETURN row;
END; $$;

CREATE OR REPLACE FUNCTION public.respond_social_activity_invitation(p_activity_id uuid,p_response text) RETURNS public.social_activity_participants LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid; actor_user uuid; act public.social_activities; part public.social_activity_participants; accepted_count int; def public.social_activity_catalog; conflict boolean;
BEGIN
 SELECT id,user_id INTO actor,actor_user FROM public.profiles WHERE user_id=auth.uid() ORDER BY created_at LIMIT 1; IF actor IS NULL THEN RAISE EXCEPTION 'Sign in with an active player profile.'; END IF;
 SELECT * INTO act FROM public.social_activities WHERE id=p_activity_id FOR UPDATE; IF act.id IS NULL THEN RAISE EXCEPTION 'Activity not found.'; END IF; IF act.status NOT IN ('inviting','scheduled','confirmed') THEN RAISE EXCEPTION 'This activity is no longer open.'; END IF;
 SELECT * INTO part FROM public.social_activity_participants WHERE activity_id=p_activity_id AND player_id=actor FOR UPDATE; IF part.player_id IS NULL THEN RAISE EXCEPTION 'You are not invited to this activity.'; END IF; IF p_response NOT IN ('accepted','declined','cancelled') THEN RAISE EXCEPTION 'Choose accept, decline or cancel.'; END IF;
 IF p_response='accepted' THEN SELECT public.check_scheduling_conflict(actor_user,act.start_at,act.end_at,NULL) INTO conflict; IF conflict THEN RAISE EXCEPTION 'This overlaps another scheduled activity.'; END IF; INSERT INTO public.player_scheduled_activities(user_id,profile_id,activity_type,scheduled_start,scheduled_end,status,title,description,metadata) VALUES(actor_user,actor,'social_activity',act.start_at,act.end_at,'scheduled',act.title,act.description,jsonb_build_object('social_activity_id',act.id,'activity_type',act.activity_type)); END IF;
 UPDATE public.social_activity_participants SET invitation_status=p_response, attendance_status=CASE WHEN p_response='cancelled' THEN 'cancelled_in_advance' ELSE attendance_status END, responded_at=now() WHERE activity_id=p_activity_id AND player_id=actor RETURNING * INTO part;
 SELECT * INTO def FROM public.social_activity_catalog WHERE activity_type=act.activity_type; SELECT count(*) INTO accepted_count FROM public.social_activity_participants WHERE activity_id=p_activity_id AND invitation_status IN ('host','accepted'); IF accepted_count >= def.minimum_participants THEN UPDATE public.social_activities SET status='confirmed',updated_at=now() WHERE id=p_activity_id AND status IN ('inviting','scheduled'); END IF;
 INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata) SELECT p.user_id,act.host_player_id,'social','social_activity_response','Social activity response','A player responded to your activity invitation.','/social/activities/'||act.id,jsonb_build_object('social_activity_id',act.id,'response',p_response) FROM public.profiles p WHERE p.id=act.host_player_id;
 INSERT INTO public.social_action_audit_log(actor_profile_id,action,target_type,target_id,metadata) VALUES(actor,'social_activity_response','social_activity',act.id,jsonb_build_object('response',p_response)); RETURN part;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_social_activity(p_activity_id uuid) RETURNS public.social_activity_outcomes LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE act public.social_activities; def public.social_activity_catalog; attendee uuid; other uuid; attendee_count int; relationship_ids uuid[] := '{}'; quality text; outcome public.social_activity_outcomes; multiplier numeric;
BEGIN
 SELECT * INTO act FROM public.social_activities WHERE id=p_activity_id FOR UPDATE; IF act.id IS NULL THEN RAISE EXCEPTION 'Activity not found.'; END IF; IF act.status='completed' THEN SELECT * INTO outcome FROM public.social_activity_outcomes WHERE activity_id=act.id AND outcome_type='completion'; RETURN outcome; END IF; IF act.status NOT IN ('confirmed','in_progress') THEN RAISE EXCEPTION 'Only confirmed activities can complete.'; END IF;
 SELECT * INTO def FROM public.social_activity_catalog WHERE activity_type=act.activity_type;
 UPDATE public.social_activity_participants SET attendance_status=CASE WHEN invitation_status IN ('host','accepted') AND attendance_status='pending' THEN 'attended' ELSE attendance_status END, attended_at=coalesce(attended_at,now()) WHERE activity_id=act.id;
 SELECT count(*) INTO attendee_count FROM public.social_activity_participants WHERE activity_id=act.id AND attendance_status IN ('attended','arrived_late','left_early');
 multiplier := CASE WHEN attendee_count <= 2 THEN 1 ELSE GREATEST(0.35, 1 / sqrt(attendee_count - 1)) END;
 quality := CASE WHEN attendee_count < def.minimum_participants THEN 'awkward' WHEN attendee_count >= def.maximum_participants AND def.mood_effect >= 7 THEN 'memorable' WHEN def.rapport_effect >= 4 THEN 'great' ELSE 'enjoyable' END;
 FOR attendee IN SELECT player_id FROM public.social_activity_participants WHERE activity_id=act.id AND attendance_status IN ('attended','arrived_late','left_early') LOOP
   FOR other IN SELECT player_id FROM public.social_activity_participants WHERE activity_id=act.id AND player_id > attendee AND attendance_status IN ('attended','arrived_late','left_early') LOOP
     relationship_ids := array_append(relationship_ids, public.record_relationship_event(attendee,other,'social_activity_completed',CASE WHEN def.conflict_effect < 0 THEN 'conflict_resolution' ELSE 'rapport_gain' END,'social_activity',act.id,jsonb_build_object('familiarity',round(def.familiarity_effect*multiplier,2),'social_rapport',round(def.rapport_effect*multiplier,2),'trust',1,'conflict',round(def.conflict_effect*multiplier,2)),jsonb_build_object('activity_type',act.activity_type,'quality',quality),now()));
   END LOOP;
 END LOOP;
 INSERT INTO public.social_activity_outcomes(activity_id,outcome_type,quality,summary,relationship_event_ids,wellness_effects) VALUES(act.id,'completion',quality,'The activity was '||quality||'. Effects were applied privately to attending participants.',relationship_ids,jsonb_build_object('energy',def.energy_effect,'stress',def.stress_effect,'mood',def.mood_effect)) ON CONFLICT(activity_id,outcome_type) DO UPDATE SET quality=EXCLUDED.quality RETURNING * INTO outcome;
 UPDATE public.social_activities SET status='completed',completed_at=now(),actual_cost=estimated_cost,completion_key=coalesce(completion_key,act.id::text||':completed'),updated_at=now() WHERE id=act.id;
 UPDATE public.player_scheduled_activities SET status='completed',completed_at=now() WHERE metadata->>'social_activity_id'=act.id::text;
 INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata) SELECT p.user_id,sap.player_id,'social','social_activity_completed','Social activity completed','Your social activity has completed.','/social/activities/'||act.id,jsonb_build_object('social_activity_id',act.id,'quality',quality) FROM public.social_activity_participants sap JOIN public.profiles p ON p.id=sap.player_id WHERE sap.activity_id=act.id;
 INSERT INTO public.social_action_audit_log(actor_profile_id,action,target_type,target_id,metadata) VALUES(act.host_player_id,'social_activity_completed','social_activity',act.id,jsonb_build_object('quality',quality,'attendee_count',attendee_count)); RETURN outcome;
END; $$;

GRANT EXECUTE ON FUNCTION public.social_activity_can_invite(uuid,uuid,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_social_activity(text,uuid[],timestamptz,integer,uuid,uuid,uuid,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_social_activity_invitation(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_social_activity(uuid) TO authenticated;

INSERT INTO public.cron_job_config(job_name,edge_function_name,display_name,description,schedule,is_active,allow_manual_trigger) VALUES('complete-social-activities','complete-social-activities','Complete social activities','Server-authoritative completion for social activities and private relationship/wellness outcomes.','*/15 * * * *',true,true) ON CONFLICT(job_name) DO UPDATE SET edge_function_name=EXCLUDED.edge_function_name,description=EXCLUDED.description,schedule=EXCLUDED.schedule,allow_manual_trigger=true;
