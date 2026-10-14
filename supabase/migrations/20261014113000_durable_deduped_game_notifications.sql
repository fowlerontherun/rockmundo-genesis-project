-- Persist game-event notifications once per character/event. Protect the
-- legacy SECDEF RPC from arbitrary-recipient injection.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_once_per_character
ON public.notifications (user_id, (coalesce(profile_id::text,'')), ((metadata->>'event_key')))
WHERE metadata ? 'event_key' AND nullif(metadata->>'event_key','') IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_notification(
 p_user_id uuid,p_profile_id uuid,p_category text,p_type text,p_title text,
 p_message text,p_action_path text,p_metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE v_id uuid;v_key text;v_metadata jsonb:=coalesce(p_metadata,'{}'::jsonb);
 v_trusted boolean:=coalesce(current_setting('request.jwt.claim.role',true),'')='service_role';
BEGIN
 -- The Data API must NEVER permit clients to place messages in someone
 -- else's inbox. Server-generated notifications are written by DB triggers.
 IF NOT v_trusted AND (auth.uid() IS NULL OR auth.uid()<>p_user_id) THEN
   RAISE EXCEPTION 'NOTIFICATION_RECIPIENT_NOT_AUTHORISED' USING ERRCODE='42501';
 END IF;
 IF p_profile_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.id=p_profile_id
   AND p.user_id=p_user_id AND p.deleted_at IS NULL
 ) THEN RAISE EXCEPTION 'NOTIFICATION_PROFILE_NOT_AUTHORISED' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(v_metadata)<>'object' THEN
   RAISE EXCEPTION 'NOTIFICATION_METADATA_INVALID' USING ERRCODE='22023'; END IF;
 v_key:=nullif(v_metadata->>'event_key','');
 IF v_key IS NOT NULL AND (length(v_key)>190 OR (NOT v_trusted AND v_key LIKE 'server:%')) THEN
   RAISE EXCEPTION 'NOTIFICATION_EVENT_KEY_INVALID' USING ERRCODE='22023'; END IF;
 INSERT INTO public.notifications
   (user_id,profile_id,category,type,title,message,action_path,metadata)
 VALUES (p_user_id,p_profile_id,coalesce(p_category,'system'),
   coalesce(p_type,'info'),left(coalesce(p_title,''),240),
   left(coalesce(p_message,''),2000),p_action_path,v_metadata)
 ON CONFLICT DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL AND v_key IS NOT NULL THEN
   SELECT n.id INTO v_id FROM public.notifications n
   WHERE n.user_id=p_user_id AND n.profile_id IS NOT DISTINCT FROM p_profile_id
     AND n.metadata->>'event_key'=v_key
   LIMIT 1;
 END IF;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.create_notification(uuid,uuid,text,text,text,text,text,jsonb)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid,uuid,text,text,text,text,text,jsonb)
 TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.persist_game_event_notification(
 p_user_id uuid,p_profile_id uuid,p_event_key text,p_category text,
 p_type text,p_title text,p_message text,p_action_path text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
BEGIN
 -- Prevent arbitrary caller spoofing; the helper is reachable only by
 -- internal trigger functions, never by browser or authenticated RPC calls.
 IF p_user_id IS NULL OR p_profile_id IS NULL THEN RETURN; END IF;
 IF NOT EXISTS(
    SELECT 1 FROM public.profiles p WHERE p.id=p_profile_id
      AND p.user_id=p_user_id AND p.deleted_at IS NULL
 ) THEN RETURN; END IF;
 INSERT INTO public.notifications
   (user_id,profile_id,category,type,title,message,action_path,metadata)
 VALUES (p_user_id,p_profile_id,p_category,p_type,p_title,p_message,p_action_path,
   jsonb_build_object('event_key',p_event_key,'source','game_event'))
 ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.persist_game_event_notification(uuid,uuid,text,text,text,text,text,text)
 FROM PUBLIC,anon,authenticated;

-- A single trigger covers the source tables regardless of client presence.
-- Do not couple financial settlement to Realtime connection or alert delivery.
CREATE OR REPLACE FUNCTION public.persist_game_event_on_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
 v jsonb:=to_jsonb(NEW);prior jsonb:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
 v_table text:=TG_TABLE_NAME;v_kind text;v_title text;v_message text;
 v_category text;v_type text:='success';v_path text;
 v_band uuid;v_profile uuid;v_user uuid;v_row record;v_key text;
BEGIN
 CASE v_table
 WHEN 'chart_entries' THEN
   IF TG_OP<>'INSERT' OR coalesce((v->>'rank')::integer,999)>40 THEN RETURN NEW; END IF;
   v_kind:='chart_entry';v_category:='music';v_title:='New Chart Entry';
   v_message:='Your song has entered the charts.';v_path:='/charts';
   SELECT s.profile_id,s.band_id INTO v_profile,v_band FROM public.songs s
     WHERE s.id=nullif(v->>'song_id','')::uuid;
 WHEN 'twaater_notifications' THEN
   IF TG_OP<>'INSERT' THEN RETURN NEW; END IF;
   v_kind:='twaater_notification';v_category:='social';
   v_title:='New Twaater Activity';v_message:='Your Twaater account has new activity.';
   v_path:='/twaater';
   SELECT CASE WHEN a.owner_type::text='persona' THEN a.owner_id ELSE NULL END,
          CASE WHEN a.owner_type::text='band' THEN a.owner_id ELSE NULL END
   INTO v_profile,v_band FROM public.twaater_accounts a
   WHERE a.id=nullif(v->>'account_id','')::uuid;
 WHEN 'vip_subscriptions' THEN
   IF TG_OP<>'INSERT' OR v->>'status'<>'active' THEN RETURN NEW; END IF;
   v_kind:='vip_activation';v_category:='achievement';
   v_title:='VIP Status Activated';v_message:='Your VIP subscription is active.';
   v_user:=nullif(v->>'user_id','')::uuid;
 WHEN 'gig_outcomes' THEN
   IF TG_OP<>'INSERT' THEN RETURN NEW; END IF;
   v_kind:='gig_outcome';v_category:='gig_result';v_title:='Gig Results Available';
   v_message:='Your band gig results are ready to review.';v_path:='/gig-booking';
   v_band:=nullif(v->>'band_id','')::uuid;
 WHEN 'recording_sessions' THEN
   IF v->>'status'<>'completed' OR prior->>'status'='completed' THEN RETURN NEW; END IF;
   v_kind:='recording_completed';v_category:='recording';v_title:='Recording Complete';
   v_message:='Your recording session has completed.';v_path:='/recording-studio';
   v_band:=nullif(v->>'band_id','')::uuid;
   v_profile:=nullif(v->>'profile_id','')::uuid;
 WHEN 'player_achievements' THEN
   IF TG_OP<>'INSERT' THEN RETURN NEW; END IF;
   v_kind:='achievement';v_category:='achievement';v_title:='Achievement Unlocked';
   v_message:='You earned an achievement.';v_path:='/achievements';
   v_profile:=nullif(v->>'profile_id','')::uuid;
 WHEN 'band_invitations' THEN
   IF TG_OP<>'INSERT' THEN RETURN NEW; END IF;
   v_kind:='band_invite';v_category:='social';v_type:='offer';
   v_title:='Band Invitation';v_message:='You have received a band invitation.';
   v_path:='/band/members';v_user:=nullif(v->>'invited_user_id','')::uuid;
 WHEN 'band_rehearsals' THEN
   IF v->>'status'<>'completed' OR prior->>'status'='completed' THEN RETURN NEW; END IF;
   v_kind:='rehearsal_completed';v_category:='gig_result';
   v_title:='Rehearsal Complete';v_message:='Your band rehearsal has completed.';
   v_band:=nullif(v->>'band_id','')::uuid;
 WHEN 'releases' THEN
   IF v->>'release_status'<>'released' OR prior->>'release_status'<>'manufacturing' THEN RETURN NEW; END IF;
   v_kind:='release_manufactured';v_category:='release';v_title:='Manufacturing Complete';
   v_message:='Your release is now available.';v_path:='/release-manager';
   v_band:=nullif(v->>'band_id','')::uuid;
 WHEN 'songs' THEN
   IF v->>'audio_generation_status'='completed' AND prior->>'audio_generation_status'='generating' THEN
     v_kind:='audio_generated';v_title:='Audio Generated';v_type:='success';
   ELSIF v->>'audio_generation_status'='failed' AND prior->>'audio_generation_status'='generating' THEN
     v_kind:='audio_failed';v_title:='Audio Generation Failed';v_type:='warning';
   ELSE RETURN NEW; END IF;
   v_category:='recording';v_message:='Your song audio generation status changed.';
   v_path:='/song-catalog';v_band:=nullif(v->>'band_id','')::uuid;
   v_profile:=nullif(v->>'profile_id','')::uuid;
 WHEN 'songwriting_projects' THEN
   IF v->>'status'<>'completed' OR prior->>'status'='completed' THEN RETURN NEW; END IF;
   v_kind:='songwriting_completed';v_category:='music';v_title:='Song Complete';
   v_message:='Your songwriting project has completed.';v_path:='/songwriting';
 WHEN 'gig_offers' THEN
   IF TG_OP<>'INSERT' THEN RETURN NEW; END IF;
   v_kind:='gig_offer';v_category:='gig_result';v_title:='New Gig Offer';
   v_message:='Your band has received a gig offer.';v_path:='/gig-booking';
   v_band:=nullif(v->>'band_id','')::uuid;v_type:='offer';
 WHEN 'band_sponsorships' THEN
   IF TG_OP<>'INSERT' OR v->>'status'<>'pending' THEN RETURN NEW; END IF;
   v_kind:='sponsor_offer';v_category:='sponsorship';v_title:='Sponsorship Offer';
   v_message:='Your band has received a sponsorship offer.';
   v_band:=nullif(v->>'band_id','')::uuid;v_type:='offer';v_path:='/sponsorships';
 WHEN 'festival_participants' THEN
   IF TG_OP<>'INSERT' OR v->>'status'<>'invited' THEN RETURN NEW; END IF;
   v_kind:='festival_invite';v_category:='offer';v_title:='Festival Invitation';
   v_message:='Your band has been invited to a festival.';
   v_band:=nullif(v->>'band_id','')::uuid;v_type:='offer';v_path:='/festivals';
 WHEN 'artist_label_contracts' THEN
   IF TG_OP<>'INSERT' OR v->>'status'<>'pending' THEN RETURN NEW; END IF;
   v_kind:='record_deal';v_category:='record_label';v_title:='Record Deal Offer';
   v_message:='Your band has received a record deal offer.';
   v_band:=nullif(v->>'band_id','')::uuid;v_type:='offer';v_path:='/record-labels';
 ELSE RETURN NEW;
 END CASE;
 IF v_kind IS NULL OR v->>'id' IS NULL THEN RETURN NEW; END IF;
 v_key:=v_kind||':'||(v->>'id');

 IF v_kind='vip_activation' AND v_user IS NOT NULL THEN
   -- VIP belongs to the account, not to the active character at event time.
   INSERT INTO public.notifications
     (user_id,profile_id,category,type,title,message,action_path,metadata)
   VALUES(v_user,NULL,v_category,'achievement',v_title,v_message,NULL,
     jsonb_build_object('event_key',v_key,'source','game_event'))
   ON CONFLICT DO NOTHING;
 END IF;
 IF v_band IS NOT NULL THEN
   FOR v_row IN
     SELECT DISTINCT p.user_id,p.id AS profile_id
     FROM public.band_members bm JOIN public.profiles p ON p.id=bm.profile_id
     WHERE bm.band_id=v_band AND bm.member_status='active'
       AND p.deleted_at IS NULL
   LOOP
     PERFORM public.persist_game_event_notification(v_row.user_id,v_row.profile_id,
       v_key,v_category,v_type,v_title,v_message,v_path);
   END LOOP;
 END IF;
 IF v_profile IS NOT NULL THEN
   SELECT p.user_id INTO v_user FROM public.profiles p WHERE p.id=v_profile;
   PERFORM public.persist_game_event_notification(v_user,v_profile,
     v_key,v_category,v_type,v_title,v_message,v_path);
 END IF;
 IF v_band IS NULL AND v_profile IS NULL AND v_user IS NOT NULL THEN
   FOR v_row IN SELECT p.user_id,p.id AS profile_id FROM public.profiles p
       WHERE p.user_id=v_user AND p.is_active IS TRUE AND p.deleted_at IS NULL LOOP
     PERFORM public.persist_game_event_notification(v_row.user_id,v_row.profile_id,
       v_key,v_category,v_type,v_title,v_message,v_path);
   END LOOP;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.persist_game_event_on_change()
 FROM PUBLIC,anon,authenticated;

-- Optional legacy tables are guarded, so the migration is safe on installations
-- that do not host every game subsystem.
DO $create_game_event_triggers$
DECLARE entry record;v_trigger text;v_sql text;
BEGIN
 FOR entry IN SELECT * FROM (VALUES
   ('chart_entries','INSERT'),
   ('twaater_notifications','INSERT'),
   ('vip_subscriptions','INSERT'),
   ('gig_outcomes','INSERT'),
   ('recording_sessions','UPDATE'),
   ('player_achievements','INSERT'),
   ('band_invitations','INSERT'),
   ('band_rehearsals','UPDATE'),
   ('releases','UPDATE'),
   ('songs','UPDATE'),
   ('songwriting_projects','UPDATE'),
   ('gig_offers','INSERT'),
   ('band_sponsorships','INSERT'),
   ('festival_participants','INSERT'),
   ('artist_label_contracts','INSERT')
 ) AS t(tablename,operation) LOOP
   IF to_regclass('public.'||entry.tablename) IS NULL THEN CONTINUE; END IF;
   v_trigger:='persist_game_notify_'||entry.tablename;
   EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',v_trigger,entry.tablename);
   EXECUTE format('CREATE TRIGGER %I AFTER %s ON public.%I FOR EACH ROW EXECUTE FUNCTION public.persist_game_event_on_change()',
     v_trigger,entry.operation,entry.tablename);
 END LOOP;
END $create_game_event_triggers$;

-- Catch up missed events on reconnect. No stale production data is changed
-- until an authenticated player explicitly fetches their recent events.
CREATE OR REPLACE FUNCTION public.reconcile_my_game_notifications(
 p_profile_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_count integer:=0;v_row record;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.profiles p
   WHERE p.id=p_profile_id AND p.user_id=auth.uid()
     AND p.deleted_at IS NULL
 ) THEN RAISE EXCEPTION 'NOTIFICATION_RECONCILIATION_FORBIDDEN' USING ERRCODE='42501'; END IF;
 -- Backfill achievements earned in the past 72 hours, even when browser was
 -- offline or a Realtime channel was closed. The key prevents any replay.
 FOR v_row IN SELECT pa.id FROM public.player_achievements pa
     WHERE pa.profile_id=p_profile_id AND pa.unlocked_at>=now()-interval '72 hours'
 LOOP
   PERFORM public.persist_game_event_notification(auth.uid(),p_profile_id,
     'achievement:'||v_row.id,'achievement','achievement','Achievement Unlocked',
     'You earned an achievement.','/achievements');
   v_count:=v_count+1;
 END LOOP;
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.reconcile_my_game_notifications(uuid)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reconcile_my_game_notifications(uuid)
 TO authenticated;
