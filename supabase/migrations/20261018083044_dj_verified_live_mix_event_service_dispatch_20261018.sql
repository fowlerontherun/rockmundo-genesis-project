-- Service-role-only bridge for a JWT subject VERIFIED by the Edge server.
-- Never accept p_actor_user_id from browser JSON; the Edge function obtains
-- it solely from Supabase Auth's getUser(accessToken).
CREATE OR REPLACE FUNCTION public.dj_verified_mix_event_service(
 p_actor_user_id uuid,p_booking_id uuid,p_kind text,
 p_deck text DEFAULT NULL,p_source text DEFAULT NULL,
 p_track_id uuid DEFAULT NULL,p_value numeric DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,private,pg_temp AS $$
DECLARE
 v_previous text:=current_setting('request.jwt.claim.sub',true);
 v_result uuid;
BEGIN
 IF p_actor_user_id IS NULL OR NOT EXISTS(
  SELECT 1 FROM auth.users u WHERE u.id=p_actor_user_id
 ) THEN RAISE EXCEPTION 'A verified DJ player is required' USING ERRCODE='42501'; END IF;
 PERFORM set_config('request.jwt.claim.sub',p_actor_user_id::text,true);
 v_result:=public.record_dj_mix_event_internal(
   p_booking_id,p_kind,p_deck,p_source,p_track_id,p_value);
 PERFORM set_config('request.jwt.claim.sub',coalesce(v_previous,''),true);
 RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.dj_verified_mix_event_service(
 uuid,uuid,text,text,text,uuid,numeric)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dj_verified_mix_event_service(
 uuid,uuid,text,text,text,uuid,numeric)
 TO service_role;
COMMENT ON FUNCTION public.dj_verified_mix_event_service(
 uuid,uuid,text,text,text,uuid,numeric) IS
 'Service-role DJ mixer event bridge. Real JWT identity comes from Edge Auth; timestamp and owned session verified server-side.';
