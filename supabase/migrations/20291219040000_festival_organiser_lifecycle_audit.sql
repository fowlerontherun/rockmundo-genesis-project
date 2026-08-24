-- PR B5: canonical festival organiser lifecycle, blackout, audit and artist propagation.
-- Forward-only. Existing canonical edition, booking, ticket and settlement tables remain authoritative.

CREATE TABLE IF NOT EXISTS public.festival_regional_blackouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL CHECK (scope_type IN ('city','region','country')),
  city_id uuid REFERENCES public.cities(id) ON DELETE CASCADE,
  region text,
  country text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 8),
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (
    (scope_type='city' AND city_id IS NOT NULL AND region IS NULL AND country IS NULL) OR
    (scope_type='region' AND city_id IS NULL AND NULLIF(btrim(region),'') IS NOT NULL AND country IS NULL) OR
    (scope_type='country' AND city_id IS NULL AND region IS NULL AND NULLIF(btrim(country),'') IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS festival_regional_blackouts_window_idx
  ON public.festival_regional_blackouts(starts_at,ends_at) WHERE active;
CREATE INDEX IF NOT EXISTS festival_regional_blackouts_city_idx
  ON public.festival_regional_blackouts(city_id) WHERE active AND city_id IS NOT NULL;
ALTER TABLE public.festival_regional_blackouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_regional_blackouts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.festival_regional_blackouts TO service_role;

-- The existing festival-specific audit table becomes the shared admin/organiser audit stream.
DROP POLICY IF EXISTS festival_admin_audit_admin_read ON public.festival_admin_audit_events;
CREATE POLICY festival_admin_audit_manager_read ON public.festival_admin_audit_events
FOR SELECT TO authenticated USING (
  coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false)
  OR (festival_id IS NOT NULL AND public.can_manage_festival_brand(festival_id))
  OR EXISTS (
    SELECT 1 FROM public.festival_edition_management_roles r
    WHERE r.edition_id=festival_admin_audit_events.edition_id
      AND r.profile_id=public.current_profile_id_safe()
      AND r.status='active' AND (r.ends_at IS NULL OR r.ends_at>now())
  )
);

CREATE OR REPLACE FUNCTION public._festival_audit_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'festival_audit_rows_are_immutable';
END $$;
DROP TRIGGER IF EXISTS festival_admin_audit_immutable ON public.festival_admin_audit_events;
CREATE TRIGGER festival_admin_audit_immutable BEFORE UPDATE OR DELETE
ON public.festival_admin_audit_events FOR EACH ROW EXECUTE FUNCTION public._festival_audit_immutable();

CREATE OR REPLACE FUNCTION public._festival_record_organiser_audit(
  p_festival_id uuid,
  p_edition_id uuid,
  p_operation text,
  p_target_type text,
  p_target_id uuid,
  p_before jsonb DEFAULT '{}'::jsonb,
  p_after jsonb DEFAULT '{}'::jsonb,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=public.current_profile_id_safe(); audit_id uuid;
BEGIN
  IF p_edition_id IS NOT NULL AND NOT (
    coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false)
    OR public.can_manage_festival_brand(p_festival_id)
    OR EXISTS (
      SELECT 1 FROM public.festival_edition_management_roles r
      WHERE r.edition_id=p_edition_id AND r.profile_id=actor AND r.status='active'
        AND (r.ends_at IS NULL OR r.ends_at>now())
    )
    OR coalesce(auth.role(),'')='service_role'
  ) THEN RAISE EXCEPTION 'festival_audit_forbidden'; END IF;
  INSERT INTO public.festival_admin_audit_events(
    actor_profile_id,authority,festival_id,edition_id,operation,target_type,target_id,
    before_snapshot,after_snapshot,reason,idempotency_key
  ) VALUES (
    actor,CASE WHEN coalesce(auth.role(),'')='service_role' THEN 'worker'
      WHEN coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN 'platform_admin'
      ELSE 'organiser' END,
    p_festival_id,p_edition_id,p_operation,p_target_type,p_target_id,
    coalesce(p_before,'{}'::jsonb),coalesce(p_after,'{}'::jsonb) || jsonb_build_object('metadata',coalesce(p_metadata,'{}'::jsonb)),p_reason,p_idempotency_key
  ) ON CONFLICT(operation,idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
  RETURNING id INTO audit_id;
  IF audit_id IS NULL AND p_idempotency_key IS NOT NULL THEN
    SELECT id INTO audit_id FROM public.festival_admin_audit_events
    WHERE operation=p_operation AND idempotency_key=p_idempotency_key ORDER BY created_at DESC LIMIT 1;
  END IF;
  RETURN audit_id;
END $$;

CREATE OR REPLACE FUNCTION public.get_festival_edition_audit_log(p_edition_id uuid,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.festival_editions%ROWTYPE; actor uuid:=public.current_profile_id_safe();
BEGIN
  SELECT * INTO STRICT e FROM public.festival_editions WHERE id=p_edition_id;
  IF NOT (
    coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false)
    OR public.can_manage_festival_brand(e.festival_id)
    OR EXISTS (SELECT 1 FROM public.festival_edition_management_roles r WHERE r.edition_id=e.id AND r.profile_id=actor AND r.status='active' AND (r.ends_at IS NULL OR r.ends_at>now()))
  ) THEN RAISE EXCEPTION 'Not authorised to view festival audit'; END IF;
  RETURN jsonb_build_object(
    'editionId',e.id,
    'events',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',a.id,'actor_profile_id',a.actor_profile_id,'actor_name',p.display_name,
        'authority',a.authority,'operation',a.operation,'target_type',a.target_type,'target_id',a.target_id,
        'reason',a.reason,'before_snapshot',a.before_snapshot,'after_snapshot',a.after_snapshot,'created_at',a.created_at
      ) ORDER BY a.created_at DESC)
      FROM (SELECT * FROM public.festival_admin_audit_events WHERE edition_id=e.id ORDER BY created_at DESC LIMIT greatest(1,least(coalesce(p_limit,100),500))) a
      LEFT JOIN public.profiles p ON p.id=a.actor_profile_id
    ),'[]'::jsonb)
  );
END $$;

CREATE OR REPLACE FUNCTION public.festival_edition_blackout_conflicts(p_edition_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  WITH edition AS (
    SELECT e.id,e.city_id,e.start_at,e.end_at,c.region,c.country
    FROM public.festival_editions e LEFT JOIN public.cities c ON c.id=e.city_id WHERE e.id=p_edition_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',b.id,'scopeType',b.scope_type,'cityId',b.city_id,'region',b.region,'country',b.country,
    'startsAt',b.starts_at,'endsAt',b.ends_at,'reason',b.reason
  ) ORDER BY b.starts_at),'[]'::jsonb)
  FROM edition e JOIN public.festival_regional_blackouts b ON b.active
   AND e.start_at IS NOT NULL AND e.end_at IS NOT NULL
   AND tstzrange(e.start_at,e.end_at,'[]') && tstzrange(b.starts_at,b.ends_at,'[]')
   AND (
     (b.scope_type='city' AND b.city_id=e.city_id)
     OR (b.scope_type='region' AND lower(btrim(b.region))=lower(btrim(coalesce(e.region,''))))
     OR (b.scope_type='country' AND lower(btrim(b.country))=lower(btrim(coalesce(e.country,''))))
   );
$$;

CREATE OR REPLACE FUNCTION public.admin_create_festival_regional_blackout(
  p_scope_type text,p_scope_value text,p_starts_at timestamptz,p_ends_at timestamptz,
  p_reason text,p_metadata jsonb DEFAULT '{}'::jsonb,p_idempotency_key text DEFAULT NULL
) RETURNS public.festival_regional_blackouts
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=public.current_profile_id_safe(); b public.festival_regional_blackouts%ROWTYPE; city uuid;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN RAISE EXCEPTION 'Admin authority required'; END IF;
  IF p_scope_type='city' THEN city:=p_scope_value::uuid; IF NOT EXISTS(SELECT 1 FROM public.cities WHERE id=city) THEN RAISE EXCEPTION 'FESTIVAL_BLACKOUT_CITY_INVALID'; END IF; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO b FROM public.festival_regional_blackouts WHERE metadata->>'idempotencyKey'=p_idempotency_key LIMIT 1;
    IF FOUND THEN RETURN b; END IF;
  END IF;
  INSERT INTO public.festival_regional_blackouts(scope_type,city_id,region,country,starts_at,ends_at,reason,metadata,created_by_profile_id)
  VALUES(p_scope_type,CASE WHEN p_scope_type='city' THEN city END,CASE WHEN p_scope_type='region' THEN p_scope_value END,
    CASE WHEN p_scope_type='country' THEN p_scope_value END,p_starts_at,p_ends_at,btrim(p_reason),
    coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('idempotencyKey',p_idempotency_key),actor)
  RETURNING * INTO b;
  PERFORM public._festival_record_organiser_audit(NULL,NULL,'regional_blackout_created','festival_regional_blackout',b.id,'{}',to_jsonb(b),p_reason,p_metadata,p_idempotency_key);
  RETURN b;
END $$;

CREATE OR REPLACE FUNCTION public.admin_revoke_festival_regional_blackout(p_blackout_id uuid,p_reason text,p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_regional_blackouts LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.festival_regional_blackouts%ROWTYPE; old jsonb; actor uuid:=public.current_profile_id_safe();
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN RAISE EXCEPTION 'Admin authority required'; END IF;
  SELECT * INTO STRICT b FROM public.festival_regional_blackouts WHERE id=p_blackout_id FOR UPDATE; old:=to_jsonb(b);
  IF b.active THEN UPDATE public.festival_regional_blackouts SET active=false,revoked_at=now(),revoked_by_profile_id=actor WHERE id=b.id RETURNING * INTO b; END IF;
  PERFORM public._festival_record_organiser_audit(NULL,NULL,'regional_blackout_revoked','festival_regional_blackout',b.id,old,to_jsonb(b),p_reason,'{}',p_idempotency_key);
  RETURN b;
END $$;

-- Every status mutation, including service-role/direct SQL, must obey the canonical transition graph.
CREATE OR REPLACE FUNCTION public._festival_edition_lifecycle_guard_b5()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE conflicts jsonb;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NOT public.validate_festival_edition_transition(OLD.status,NEW.status) THEN
    RAISE EXCEPTION 'FESTIVAL_EDITION_INVALID_TRANSITION: % -> %',OLD.status,NEW.status;
  END IF;
  IF NEW.status IN ('applications_open','booking','announced','on_sale','setup','live')
     AND current_setting('app.festival_blackout_override',true) IS DISTINCT FROM 'on' THEN
    conflicts:=public.festival_edition_blackout_conflicts(NEW.id);
    IF jsonb_array_length(coalesce(conflicts,'[]'::jsonb))>0 THEN
      RAISE EXCEPTION 'FESTIVAL_BLACKOUT_CONFLICT: %',conflicts;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS festival_edition_lifecycle_guard_b5 ON public.festival_editions;
CREATE TRIGGER festival_edition_lifecycle_guard_b5 BEFORE UPDATE OF status ON public.festival_editions
FOR EACH ROW EXECUTE FUNCTION public._festival_edition_lifecycle_guard_b5();

-- Admin override can relax a blackout/timing blocker with a reason, never bypass the legal state graph.
CREATE OR REPLACE FUNCTION public.admin_transition_festival_edition(
  p_edition_id uuid,p_target_status public.festival_edition_status,p_reason text,
  p_override boolean DEFAULT false,p_metadata jsonb DEFAULT '{}'::jsonb,p_idempotency_key text DEFAULT NULL
) RETURNS public.festival_editions LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE oldrow public.festival_editions%ROWTYPE; newrow public.festival_editions%ROWTYPE; meta jsonb;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN RAISE EXCEPTION 'Admin authority required'; END IF;
  IF nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Lifecycle administration requires a reason'; END IF;
  SELECT * INTO STRICT oldrow FROM public.festival_editions WHERE id=p_edition_id FOR UPDATE;
  IF NOT public.validate_festival_edition_transition(oldrow.status,p_target_status) THEN
    RAISE EXCEPTION 'FESTIVAL_EDITION_INVALID_TRANSITION: % -> %',oldrow.status,p_target_status;
  END IF;
  meta:=coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('admin_override',p_override);
  IF p_override THEN PERFORM set_config('app.festival_blackout_override','on',true); END IF;
  newrow:=public.transition_festival_edition(p_edition_id,p_target_status,p_reason,meta,p_idempotency_key);
  PERFORM public._festival_record_organiser_audit(oldrow.festival_id,p_edition_id,
    CASE WHEN p_override THEN 'lifecycle_override' ELSE 'lifecycle_transition' END,
    'festival_edition',p_edition_id,to_jsonb(oldrow),to_jsonb(newrow),p_reason,meta,p_idempotency_key);
  RETURN newrow;
END $$;

CREATE OR REPLACE FUNCTION public.admin_festival_edition_lifecycle_options(p_edition_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.festival_edition_status; transitions jsonb:='[]'::jsonb; targets text[]; target text; available boolean;
 blockers text[]; warnings text[]; admin boolean; blackout jsonb;
BEGIN
  IF NOT public.can_manage_festival_edition(p_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  admin:=coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false);
  SELECT status INTO s FROM public.festival_editions WHERE id=p_edition_id;
  IF s IS NULL THEN RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND'; END IF;
  targets:=CASE s
    WHEN 'concept' THEN ARRAY['planning','cancelled','abandoned']
    WHEN 'planning' THEN ARRAY['applications_open','booking','announced','cancelled','abandoned']
    WHEN 'applications_open' THEN ARRAY['booking','announced','postponed','cancelled']
    WHEN 'booking' THEN ARRAY['announced','on_sale','postponed','cancelled']
    WHEN 'announced' THEN ARRAY['on_sale','setup','postponed','cancelled']
    WHEN 'on_sale' THEN ARRAY['setup','postponed','cancelled']
    WHEN 'setup' THEN ARRAY['live','postponed','cancelled']
    WHEN 'live' THEN ARRAY['settling','completed','cancelled']
    WHEN 'settling' THEN ARRAY['completed']
    WHEN 'postponed' THEN ARRAY['planning','announced','cancelled']
    ELSE ARRAY[]::text[] END;
  blackout:=public.festival_edition_blackout_conflicts(p_edition_id);
  FOREACH target IN ARRAY targets LOOP
    blockers:=ARRAY[]::text[]; warnings:=ARRAY[]::text[]; available:=true;
    IF target IN ('announced','on_sale') AND NOT EXISTS(SELECT 1 FROM public.festival_stages WHERE edition_id=p_edition_id AND archived_at IS NULL) THEN
      blockers:=array_append(blockers,'No stages configured for this edition.'); available:=false;
    END IF;
    IF target IN ('applications_open','booking','announced','on_sale','setup','live') AND jsonb_array_length(coalesce(blackout,'[]'::jsonb))>0 THEN
      IF admin THEN warnings:=array_append(warnings,'Regional blackout conflict requires an administrator override and reason.');
      ELSE blockers:=array_append(blockers,'This edition overlaps an active regional blackout.'); available:=false; END IF;
    END IF;
    transitions:=transitions||jsonb_build_object(
      'targetState',target,'available',available,'blockers',to_jsonb(blockers),'warnings',to_jsonb(warnings),
      'adminOverrideAllowed',admin AND (target IN ('cancelled','abandoned','postponed','live') OR jsonb_array_length(coalesce(blackout,'[]'::jsonb))>0),
      'reasonRequired',target IN ('cancelled','abandoned','postponed') OR (admin AND jsonb_array_length(coalesce(blackout,'[]'::jsonb))>0),
      'confirmationRequired',target IN ('live','cancelled','abandoned','completed'),
      'severity',CASE WHEN target IN ('cancelled','abandoned') THEN 'destructive' WHEN target='postponed' THEN 'warning' ELSE 'standard' END,
      'explanation',CASE target WHEN 'planning' THEN 'Move the edition into detailed planning.' WHEN 'applications_open' THEN 'Open band applications for this edition.' WHEN 'booking' THEN 'Close applications and begin booking confirmed acts.' WHEN 'announced' THEN 'Publicly announce the edition.' WHEN 'on_sale' THEN 'Start selling tickets.' WHEN 'setup' THEN 'Move into on-site build and setup.' WHEN 'live' THEN 'Start live operations for this edition.' WHEN 'settling' THEN 'Begin post-event settlement.' WHEN 'completed' THEN 'Mark this edition as fully completed.' WHEN 'postponed' THEN 'Postpone this edition.' WHEN 'cancelled' THEN 'Cancel this edition and create refund obligations.' WHEN 'abandoned' THEN 'Abandon this edition.' ELSE '' END
    );
  END LOOP;
  RETURN jsonb_build_object('editionId',p_edition_id,'currentState',s::text,'blackoutConflicts',blackout,'transitions',transitions);
END $$;

-- Mirror lifecycle facts into the unified organiser audit and run lifecycle consequences once.
CREATE OR REPLACE FUNCTION public._festival_lifecycle_side_effects_b5()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.festival_editions%ROWTYPE; launch public.festival_launches%ROWTYPE; buyer record; member record;
BEGIN
  SELECT * INTO STRICT e FROM public.festival_editions WHERE id=NEW.edition_id;
  PERFORM public._festival_record_organiser_audit(e.festival_id,e.id,'edition_'||NEW.to_status::text,'festival_edition',e.id,
    jsonb_build_object('status',NEW.from_status),jsonb_build_object('status',NEW.to_status),NEW.reason,NEW.metadata,
    coalesce(NEW.idempotency_key,NEW.id::text)||':lifecycle-event');

  IF NEW.to_status='postponed' THEN
    UPDATE public.festival_contracts SET status='amendment_required',updated_at=now()
    WHERE edition_id=e.id AND status IN ('active','awaiting_signatures','awaiting_band_signature','awaiting_organiser_signature');
    UPDATE public.festival_stage_slots SET public_status='postponed' WHERE edition_id=e.id AND public_status<>'cancelled';
  ELSIF NEW.to_status='cancelled' THEN
    UPDATE public.festival_contracts SET status='cancelled',cancelled_at=coalesce(cancelled_at,now()),
      cancelled_by_side='organiser',cancelled_by_profile_id=NEW.actor_profile_id,cancellation_reason=coalesce(NEW.reason,'Festival cancelled'),
      settlement_required=true,updated_at=now()
    WHERE edition_id=e.id AND status NOT IN ('cancelled','terminated','fulfilled','expired','breached');
    UPDATE public.festival_stage_slot_reservations r SET status='released',released_at=now(),release_reason='Festival cancelled'
    WHERE r.edition_id=e.id AND r.status IN ('provisional','confirmed');
    UPDATE public.festival_stage_slots SET status='cancelled',public_status='cancelled' WHERE edition_id=e.id AND status<>'completed';
    SELECT * INTO launch FROM public.festival_launches WHERE festival_edition_id=e.id;
    IF launch.id IS NOT NULL THEN
      UPDATE public.festival_launches SET launch_status='cancelled_before_event',cancelled_at=coalesce(cancelled_at,now()),
        cancellation_reason=coalesce(NEW.reason,'Festival cancelled'),updated_at=now() WHERE id=launch.id;
      INSERT INTO public.festival_ticket_refund_obligations(festival_ticket_sale_id,buyer_profile_id,amount_minor,currency,reason_code)
      SELECT s.id,s.buyer_profile_id,s.total_minor,s.currency,'festival_cancelled'
      FROM public.festival_ticket_sales s WHERE s.festival_launch_id=launch.id AND s.status='completed'
      ON CONFLICT(festival_ticket_sale_id) DO NOTHING;
      UPDATE public.festival_issued_tickets t SET status='cancelled',cancelled_at=coalesce(cancelled_at,now())
      WHERE t.festival_ticket_sale_id IN (SELECT s.id FROM public.festival_ticket_sales s WHERE s.festival_launch_id=launch.id)
        AND t.status IN ('valid','transferred');
    END IF;
  END IF;

  IF NEW.to_status IN ('postponed','cancelled') THEN
    FOR buyer IN
      SELECT DISTINCT s.buyer_profile_id,p.user_id FROM public.festival_launches l
      JOIN public.festival_ticket_sales s ON s.festival_launch_id=l.id JOIN public.profiles p ON p.id=s.buyer_profile_id
      WHERE l.festival_edition_id=e.id
    LOOP
      INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata)
      VALUES(buyer.user_id,buyer.buyer_profile_id,'festival','festival_'||NEW.to_status::text,
        CASE WHEN NEW.to_status='cancelled' THEN 'Festival cancelled' ELSE 'Festival postponed' END,
        CASE WHEN NEW.to_status='cancelled' THEN 'This festival has been cancelled. Eligible ticket refunds are queued automatically.' ELSE 'This festival has been postponed. Check the festival page for updated dates.' END,
        '/festivals/'||e.festival_id::text,jsonb_build_object('editionId',e.id,'lifecycleEventId',NEW.id));
    END LOOP;
    FOR member IN
      SELECT DISTINCT bm.profile_id,p.user_id FROM public.festival_contracts c
      JOIN public.band_members bm ON bm.band_id=c.band_id AND coalesce(bm.member_status,'active')='active'
      JOIN public.profiles p ON p.id=bm.profile_id WHERE c.edition_id=e.id
    LOOP
      INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata)
      VALUES(member.user_id,member.profile_id,'festival','festival_artist_'||NEW.to_status::text,
        CASE WHEN NEW.to_status='cancelled' THEN 'Festival performance cancelled' ELSE 'Festival performance postponed' END,
        CASE WHEN NEW.to_status='cancelled' THEN 'Your festival booking was cancelled by the organiser. Contract settlement will use the accepted cancellation terms.' ELSE 'Your festival booking needs rescheduling because the edition was postponed.' END,
        '/festival-opportunities',jsonb_build_object('editionId',e.id,'lifecycleEventId',NEW.id));
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS festival_lifecycle_side_effects_b5 ON public.festival_edition_lifecycle_events;
CREATE TRIGGER festival_lifecycle_side_effects_b5 AFTER INSERT ON public.festival_edition_lifecycle_events
FOR EACH ROW EXECUTE FUNCTION public._festival_lifecycle_side_effects_b5();

-- Server-side artist eligibility is derived from canonical profile/band/window/programme facts.
CREATE OR REPLACE FUNCTION public.festival_artist_application_eligibility(
  p_application_window_id uuid,p_artist_type text,p_artist_profile_id uuid DEFAULT NULL,p_band_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE w public.festival_artist_application_windows%ROWTYPE; pr public.festival_artist_programmes%ROWTYPE;
 fame integer:=0; genre text; members integer:=0; blockers jsonb:='[]'::jsonb; minf integer; maxf integer;
BEGIN
  SELECT * INTO STRICT w FROM public.festival_artist_application_windows WHERE id=p_application_window_id;
  SELECT * INTO STRICT pr FROM public.festival_artist_programmes WHERE id=w.festival_artist_programme_id;
  IF p_artist_type='band' THEN
    SELECT coalesce(b.fame,0),b.genre INTO fame,genre FROM public.bands b WHERE b.id=p_band_id;
    IF p_band_id IS NULL OR NOT FOUND THEN blockers:=blockers||jsonb_build_array('band_missing'); END IF;
    SELECT count(*) INTO members FROM public.band_members bm WHERE bm.band_id=p_band_id AND coalesce(bm.member_status,'active')='active';
  ELSIF p_artist_type='solo' THEN
    SELECT coalesce(p.fame,0) INTO fame FROM public.profiles p WHERE p.id=p_artist_profile_id;
    IF p_artist_profile_id IS NULL OR NOT FOUND THEN blockers:=blockers||jsonb_build_array('profile_missing'); END IF;
  ELSE blockers:=blockers||jsonb_build_array('artist_type_invalid'); END IF;

  IF nullif(w.eligible_artist_type,'') IS NOT NULL AND lower(w.eligible_artist_type) NOT IN ('any','all',lower(p_artist_type)) THEN blockers:=blockers||jsonb_build_array('artist_type_not_eligible'); END IF;
  minf:=greatest(coalesce(w.minimum_fame,0),coalesce(pr.minimum_artist_fame,0));
  maxf:=least(coalesce(w.maximum_fame,2147483647),coalesce(pr.maximum_artist_fame,2147483647));
  IF fame<minf THEN blockers:=blockers||jsonb_build_array('minimum_fame_not_met'); END IF;
  IF fame>maxf THEN blockers:=blockers||jsonb_build_array('maximum_fame_exceeded'); END IF;
  IF p_artist_type='band' AND w.minimum_band_members IS NOT NULL AND members<w.minimum_band_members THEN blockers:=blockers||jsonb_build_array('minimum_band_members_not_met'); END IF;
  IF p_artist_type='band' AND w.maximum_band_members IS NOT NULL AND members>w.maximum_band_members THEN blockers:=blockers||jsonb_build_array('maximum_band_members_exceeded'); END IF;
  IF genre IS NOT NULL AND cardinality(pr.excluded_genres)>0 AND lower(genre)=ANY(SELECT lower(x) FROM unnest(pr.excluded_genres) x) THEN blockers:=blockers||jsonb_build_array('genre_excluded'); END IF;
  IF genre IS NOT NULL AND cardinality(w.preferred_genres)>0 AND NOT (lower(genre)=ANY(SELECT lower(x) FROM unnest(w.preferred_genres) x)) THEN blockers:=blockers||jsonb_build_array('genre_not_eligible_for_window'); END IF;
  IF genre IS NOT NULL AND cardinality(pr.preferred_genres)>0 AND NOT (lower(genre)=ANY(SELECT lower(x) FROM unnest(pr.preferred_genres) x)) THEN blockers:=blockers||jsonb_build_array('genre_not_eligible_for_programme'); END IF;
  RETURN jsonb_build_object('eligible',jsonb_array_length(blockers)=0,'blockers',blockers,
    'facts',jsonb_build_object('fame',fame,'genre',genre,'activeBandMembers',members,'minimumFame',minf,'maximumFame',maxf));
END $$;

CREATE OR REPLACE FUNCTION public.submit_festival_artist_application(
 p_festival_company_id uuid,p_application_window_id uuid,p_artist_type text,p_artist_profile_id uuid DEFAULT NULL,p_band_id uuid DEFAULT NULL,
 p_preferred_dates date[] DEFAULT '{}',p_preferred_stage_types text[] DEFAULT '{}',p_minimum_fee_minor bigint DEFAULT 0,p_requested_fee_minor bigint DEFAULT 0,
 p_minimum_set_minutes integer DEFAULT 30,p_maximum_set_minutes integer DEFAULT 60,p_message text DEFAULT NULL,p_idempotency_key uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=public._caller_profile_id(); w public.festival_artist_application_windows%ROWTYPE; pr public.festival_artist_programmes%ROWTYPE;
 app public.festival_artist_applications%ROWTYPE; req public.festival_artist_plan_requests%ROWTYPE; payload jsonb; eligibility jsonb; facts jsonb;
BEGIN
 SELECT * INTO w FROM public.festival_artist_application_windows WHERE id=p_application_window_id;
 SELECT * INTO pr FROM public.festival_artist_programmes WHERE id=w.festival_artist_programme_id AND festival_company_id=p_festival_company_id;
 IF NOT FOUND OR NOT w.active OR now() NOT BETWEEN w.opens_at AND w.closes_at OR pr.application_mode NOT IN ('applications_only','hybrid') THEN RAISE EXCEPTION 'festival_artist_applications_closed' USING ERRCODE='P0001'; END IF;
 IF NOT public._festival_artist_authorised(a,p_artist_type,p_artist_profile_id,p_band_id) THEN RAISE EXCEPTION 'festival_artist_application_forbidden' USING ERRCODE='P0001'; END IF;
 eligibility:=public.festival_artist_application_eligibility(w.id,p_artist_type,p_artist_profile_id,p_band_id); facts:=eligibility->'facts';
 IF coalesce((eligibility->>'eligible')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'festival_artist_not_eligible: %',eligibility->'blockers' USING ERRCODE='P0001'; END IF;
 IF p_minimum_fee_minor<0 OR p_requested_fee_minor<p_minimum_fee_minor OR p_minimum_set_minutes<10 OR p_maximum_set_minutes<p_minimum_set_minutes OR (w.maximum_set_minutes IS NOT NULL AND p_maximum_set_minutes>w.maximum_set_minutes) THEN RAISE EXCEPTION 'festival_artist_not_eligible' USING ERRCODE='P0001'; END IF;
 payload:=jsonb_build_object('window',p_application_window_id,'type',p_artist_type,'profile',p_artist_profile_id,'band',p_band_id,'dates',p_preferred_dates,'stages',p_preferred_stage_types,'minimumFee',p_minimum_fee_minor,'requestedFee',p_requested_fee_minor,'minimumSet',p_minimum_set_minutes,'maximumSet',p_maximum_set_minutes,'message',p_message,'eligibility',eligibility);
 req:=public._festival_artist_begin(p_festival_company_id,'submit_application','application',p_application_window_id,p_idempotency_key,payload); IF req.status='succeeded' THEN RETURN req.result; END IF;
 BEGIN
   INSERT INTO public.festival_artist_applications(festival_artist_programme_id,application_window_id,artist_type,artist_profile_id,band_id,submitted_by_profile_id,preferred_dates,preferred_stage_types,minimum_fee_minor,requested_fee_minor,minimum_set_minutes,maximum_set_minutes,fame_snapshot,popularity_snapshot,availability_snapshot,message)
   VALUES(pr.id,w.id,p_artist_type,p_artist_profile_id,p_band_id,a,p_preferred_dates,p_preferred_stage_types,p_minimum_fee_minor,p_requested_fee_minor,p_minimum_set_minutes,p_maximum_set_minutes,
     coalesce((facts->>'fame')::integer,0),coalesce((SELECT popularity FROM public.bands WHERE id=p_band_id),0),
     jsonb_build_object('state','eligible','capturedAt',now(),'eligibility',eligibility),nullif(btrim(p_message),'')) RETURNING * INTO app;
 EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'festival_artist_application_duplicate' USING ERRCODE='P0001'; END;
 PERFORM public._festival_artist_audit(p_festival_company_id,a,'application',app.id,'application_submitted',NULL,'submitted',1);
 PERFORM public._festival_artist_notify(req.id,a,'application_submitted','Festival application submitted','Your application was delivered to Festival management.');
 RETURN public._festival_artist_finish(req.id,jsonb_build_object('kind','application','application',to_jsonb(app),'eligibility',eligibility));
END $$;

-- Accepted simplified artist bookings must be explicitly mapped into the canonical contract/slot model.
CREATE TABLE IF NOT EXISTS public.festival_artist_booking_canonical_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_booking_id uuid NOT NULL UNIQUE REFERENCES public.festival_artist_bookings(id) ON DELETE RESTRICT,
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE RESTRICT,
  canonical_contract_id uuid NOT NULL UNIQUE REFERENCES public.festival_contracts(id) ON DELETE RESTRICT,
  stage_slot_id uuid NOT NULL UNIQUE REFERENCES public.festival_stage_slots(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL UNIQUE,
  created_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.festival_artist_booking_canonical_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_artist_booking_canonical_links FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.festival_artist_booking_canonical_links TO service_role;

CREATE OR REPLACE FUNCTION public.finalise_festival_artist_booking_slot(
  p_artist_booking_id uuid,p_stage_slot_id uuid,p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=public._caller_profile_id(); b public.festival_artist_bookings%ROWTYPE; pr public.festival_artist_programmes%ROWTYPE;
 offer public.festival_artist_offers%ROWTYPE; e public.festival_editions%ROWTYPE; slot public.festival_stage_slots%ROWTYPE;
 contract public.festival_contracts%ROWTYPE; version_id uuid; terms jsonb; terms_hash text; signer uuid; link public.festival_artist_booking_canonical_links%ROWTYPE;
BEGIN
  IF NULLIF(btrim(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'festival_artist_finalise_idempotency_required'; END IF;
  SELECT * INTO link FROM public.festival_artist_booking_canonical_links WHERE idempotency_key=p_idempotency_key;
  IF FOUND THEN RETURN jsonb_build_object('bookingId',link.artist_booking_id,'contractId',link.canonical_contract_id,'stageSlotId',link.stage_slot_id,'replayed',true); END IF;
  SELECT * INTO STRICT b FROM public.festival_artist_bookings WHERE id=p_artist_booking_id FOR UPDATE;
  SELECT * INTO STRICT pr FROM public.festival_artist_programmes WHERE id=b.festival_artist_programme_id;
  IF NOT public._festival_artist_manager(pr.festival_company_id,actor) THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
  IF pr.festival_edition_id IS NULL THEN RAISE EXCEPTION 'festival_artist_programme_edition_missing'; END IF;
  SELECT * INTO STRICT e FROM public.festival_editions WHERE id=pr.festival_edition_id FOR UPDATE;
  IF b.artist_type<>'band' OR b.band_id IS NULL THEN RAISE EXCEPTION 'festival_artist_canonical_band_required'; END IF;
  IF b.status NOT IN ('awaiting_schedule','confirmed') THEN RAISE EXCEPTION 'festival_artist_booking_not_schedulable'; END IF;
  SELECT * INTO STRICT offer FROM public.festival_artist_offers WHERE id=b.offer_id AND status='accepted';
  SELECT * INTO STRICT slot FROM public.festival_stage_slots WHERE id=p_stage_slot_id FOR UPDATE;
  IF slot.edition_id IS DISTINCT FROM e.id OR slot.status NOT IN ('open','booked') OR slot.canonical_contract_id IS NOT NULL OR (slot.band_id IS NOT NULL AND slot.band_id<>b.band_id) THEN
    RAISE EXCEPTION 'FESTIVAL_SLOT_CONFLICT';
  END IF;
  IF slot.start_time IS NULL OR slot.end_time IS NULL OR slot.end_time<=slot.start_time THEN RAISE EXCEPTION 'FESTIVAL_SLOT_INVALID_TIME'; END IF;
  IF EXISTS(SELECT 1 FROM public.festival_artist_booking_canonical_links WHERE artist_booking_id=b.id) THEN
    SELECT * INTO link FROM public.festival_artist_booking_canonical_links WHERE artist_booking_id=b.id;
    IF link.stage_slot_id<>slot.id THEN RAISE EXCEPTION 'festival_artist_booking_already_finalised'; END IF;
    RETURN jsonb_build_object('bookingId',link.artist_booking_id,'contractId',link.canonical_contract_id,'stageSlotId',link.stage_slot_id,'replayed',true);
  END IF;

  SELECT actor_profile_id INTO signer FROM public.festival_artist_plan_audit
   WHERE entity_type='offer' AND entity_id=offer.id AND event_type='offer_accepted' ORDER BY created_at DESC LIMIT 1;
  terms:=jsonb_build_object(
    'stage_slot_id',slot.id,'proposed_start_at',slot.start_time,'proposed_end_at',slot.end_time,
    'set_duration_minutes',b.set_minutes,'guarantee_fee_cents',b.agreed_fee_minor,'deposit_cents',0,
    'performance_bonus_cents',0,'merch_share_percent',coalesce(offer.merch_revenue_share_basis_points,0)/100.0,
    'travel_terms',jsonb_build_object('support_minor',b.travel_support_minor),
    'accommodation_terms',jsonb_build_object('support_minor',b.accommodation_support_minor),
    'cancellation_terms',coalesce(b.contract_terms->'cancellationTerms','{}'::jsonb),
    'currency_code',b.currency_code,'metadata',jsonb_build_object('source','festival_artist_booking','artistBookingId',b.id,'artistOfferId',offer.id)
  );
  terms_hash:=public.festival_terms_hash(terms);
  INSERT INTO public.festival_contracts(
    edition_id,band_id,festival_id,stage_slot_id,status,contract_version,terms_snapshot,
    band_signature_status,organiser_signature_status,band_signed_by_profile_id,organiser_signed_by_profile_id,
    band_signed_at,organiser_signed_at,activated_at,settlement_required
  ) VALUES(
    e.id,b.band_id,e.festival_id,slot.id,'active',1,terms,'signed','signed',signer,offer.created_by_profile_id,
    coalesce(offer.accepted_at,now()),offer.created_at,now(),true
  ) RETURNING * INTO contract;
  INSERT INTO public.festival_contract_versions(contract_id,version,terms_snapshot,terms_hash,created_by_profile_id,created_by_side,reason)
  VALUES(contract.id,1,terms,terms_hash,offer.created_by_profile_id,'organiser','Converted from accepted festival artist offer') RETURNING id INTO version_id;
  UPDATE public.festival_contracts SET current_version_id=version_id WHERE id=contract.id RETURNING * INTO contract;
  UPDATE public.festival_stage_slots SET band_id=b.band_id,canonical_contract_id=contract.id,status='confirmed',public_status='scheduled' WHERE id=slot.id;
  INSERT INTO public.festival_stage_slot_reservations(edition_id,stage_slot_id,contract_id,band_id,status,confirmed_at)
  VALUES(e.id,slot.id,contract.id,b.band_id,'confirmed',now());
  UPDATE public.festival_artist_bookings SET status='confirmed',provisional_stage_id=slot.stage_id,provisional_date=slot.start_time::date,confirmed_at=coalesce(confirmed_at,now()),updated_at=now(),version=version+1 WHERE id=b.id RETURNING * INTO b;
  INSERT INTO public.festival_artist_booking_canonical_links(artist_booking_id,edition_id,canonical_contract_id,stage_slot_id,idempotency_key,created_by_profile_id)
  VALUES(b.id,e.id,contract.id,slot.id,p_idempotency_key,actor) RETURNING * INTO link;
  PERFORM public._festival_record_organiser_audit(e.festival_id,e.id,'artist_booking_finalised','festival_contract',contract.id,
    jsonb_build_object('artistBookingId',b.id,'bookingStatus','awaiting_schedule'),
    jsonb_build_object('artistBookingId',b.id,'bookingStatus',b.status,'contractId',contract.id,'stageSlotId',slot.id),
    'Accepted artist booking mapped to canonical contract and slot',jsonb_build_object('termsHash',terms_hash),p_idempotency_key);
  RETURN jsonb_build_object('bookingId',b.id,'contractId',contract.id,'stageSlotId',slot.id,'replayed',false);
END $$;

REVOKE ALL ON FUNCTION public._festival_record_organiser_audit(uuid,uuid,text,text,uuid,jsonb,jsonb,text,jsonb,text),
  public.festival_edition_blackout_conflicts(uuid),
  public.admin_create_festival_regional_blackout(text,text,timestamptz,timestamptz,text,jsonb,text),
  public.admin_revoke_festival_regional_blackout(uuid,text,text),
  public.festival_artist_application_eligibility(uuid,text,uuid,uuid),
  public.finalise_festival_artist_booking_slot(uuid,uuid,text),
  public.get_festival_edition_audit_log(uuid,integer)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_festival_regional_blackout(text,text,timestamptz,timestamptz,text,jsonb,text),
  public.admin_revoke_festival_regional_blackout(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.festival_artist_application_eligibility(uuid,text,uuid,uuid),
  public.finalise_festival_artist_booking_slot(uuid,uuid,text),
  public.get_festival_edition_audit_log(uuid,integer) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.festival_edition_blackout_conflicts(uuid) TO authenticated,service_role;
