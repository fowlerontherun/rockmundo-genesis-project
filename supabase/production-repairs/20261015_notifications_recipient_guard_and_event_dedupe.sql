-- Direct production reconciliation of the safe core of
-- 20261014113000_durable_deduped_game_notifications.sql (issue #4072).
-- This intentionally does NOT install the source migration's many game/event
-- triggers or change existing notification delivery sources.
-- The 1,244 historic rows, including 4 older recording notifications whose
-- user/profile IDs disagree, remain untouched for separate investigation.

DO $preflight$
BEGIN
  IF to_regclass('public.notifications') IS NULL
     OR to_regprocedure('public.create_notification(uuid,uuid,text,text,text,text,text,jsonb)') IS NULL
  THEN RAISE EXCEPTION 'notification_compatibility_preflight_missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='create_notification'
      AND p.prosecdef AND pg_get_function_identity_arguments(p.oid) ILIKE '%p_user_id uuid%')
  THEN RAISE EXCEPTION 'notification_rpc_signature_changed'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.metadata ? 'event_key'
      AND nullif(n.metadata->>'event_key','') IS NOT NULL
    GROUP BY n.user_id,coalesce(n.profile_id::text,''),n.metadata->>'event_key'
    HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'notification_duplicate_event_keys_need_manual_reconciliation'; END IF;
END
$preflight$;

-- Future retries, concurrent tabs, and trigger/client races cannot persist
-- the same event notification more than once for a character.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_once_per_character
  ON public.notifications (user_id,(coalesce(profile_id::text,'')),((metadata->>'event_key')))
  WHERE metadata ? 'event_key' AND nullif(metadata->>'event_key','') IS NOT NULL;

-- Previous production function was SECURITY DEFINER and accepted arbitrary
-- p_user_id from the anon/authenticated Data API. Preserve the exact API
-- signature and existing server trigger callers; disallow cross-account writes.
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,p_profile_id uuid,p_category text,p_type text,p_title text,
  p_message text,p_action_path text,p_metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $guard$
DECLARE
  v_id uuid;
  v_key text;
  v_metadata jsonb:=coalesce(p_metadata,'{}'::jsonb);
  -- Trusted: service-role API calls and DB trigger paths. All current
  -- in-database function callers of create_notification are postgres-owned
  -- SECURITY DEFINER trigger functions, verified against the live catalog.
  v_trusted boolean:=
    coalesce(current_setting('request.jwt.claim.role',true),'')='service_role'
    OR pg_trigger_depth()>0;
BEGIN
  IF p_user_id IS NULL THEN RETURN NULL; END IF;
  IF NOT v_trusted
     AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id)
  THEN
    RAISE EXCEPTION 'NOTIFICATION_RECIPIENT_NOT_AUTHORISED' USING ERRCODE='42501';
  END IF;
  IF p_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=p_profile_id AND p.user_id=p_user_id AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'NOTIFICATION_PROFILE_NOT_AUTHORISED' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(v_metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'NOTIFICATION_METADATA_INVALID' USING ERRCODE='22023';
  END IF;
  v_key:=nullif(v_metadata->>'event_key','');
  IF v_key IS NOT NULL AND (
      length(v_key)>190 OR (NOT v_trusted AND v_key LIKE 'server:%')
  ) THEN
    RAISE EXCEPTION 'NOTIFICATION_EVENT_KEY_INVALID' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.notifications
    (user_id,profile_id,category,type,title,message,action_path,metadata)
  VALUES(p_user_id,p_profile_id,coalesce(p_category,'system'),
    coalesce(p_type,'info'),left(coalesce(p_title,''),240),
    left(coalesce(p_message,''),2000),p_action_path,v_metadata)
  ON CONFLICT DO NOTHING RETURNING id INTO v_id;

  IF v_id IS NULL AND v_key IS NOT NULL THEN
    SELECT n.id INTO v_id FROM public.notifications n
     WHERE n.user_id=p_user_id
       AND n.profile_id IS NOT DISTINCT FROM p_profile_id
       AND n.metadata->>'event_key'=v_key
     LIMIT 1;
  END IF;
  RETURN v_id;
END
$guard$;

REVOKE ALL ON FUNCTION public.create_notification(uuid,uuid,text,text,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid,uuid,text,text,text,text,text,jsonb)
  TO authenticated,service_role;

NOTIFY pgrst,'reload schema';
