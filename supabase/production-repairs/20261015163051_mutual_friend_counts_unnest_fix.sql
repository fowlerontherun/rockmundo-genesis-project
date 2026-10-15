BEGIN;
CREATE OR REPLACE FUNCTION public.get_mutual_friend_counts(p_profile_id uuid, p_other_profile_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_other uuid;v_count integer;v_result jsonb:='{}'::jsonb;
BEGIN
 IF auth.uid() IS NULL OR p_profile_id IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.id=p_profile_id
     AND p.user_id=auth.uid() AND p.deleted_at IS NULL AND p.died_at IS NULL
 ) THEN
   RAISE EXCEPTION 'FRIEND_COUNTS_NOT_AUTHORIZED' USING ERRCODE='42501';
 END IF;
 IF p_other_profile_ids IS NULL OR cardinality(p_other_profile_ids)=0 THEN
   RETURN '{}'::jsonb;
 END IF;
 IF cardinality(p_other_profile_ids)>500 THEN
   RAISE EXCEPTION 'TOO_MANY_FRIEND_COUNT_TARGETS' USING ERRCODE='22023';
 END IF;
 FOR v_other IN SELECT DISTINCT targets.id FROM unnest(p_other_profile_ids) AS targets(id) WHERE targets.id IS NOT NULL
 LOOP
   IF v_other=p_profile_id OR public._social_blocked(p_profile_id,v_other) OR
      NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_other
        AND p.deleted_at IS NULL AND p.died_at IS NULL) OR
      NOT EXISTS(SELECT 1 FROM public.friendships f WHERE f.status='accepted'
        AND ((f.requestor_id=p_profile_id AND f.addressee_id=v_other)
             OR (f.addressee_id=p_profile_id AND f.requestor_id=v_other)))
   THEN CONTINUE; END IF;
   SELECT count(DISTINCT shared.friend_id)::integer INTO v_count
   FROM (
     SELECT CASE WHEN f.requestor_id=p_profile_id
       THEN f.addressee_id ELSE f.requestor_id END AS friend_id
     FROM public.friendships f
     WHERE f.status='accepted'
       AND (f.requestor_id=p_profile_id OR f.addressee_id=p_profile_id)
   ) shared
   JOIN public.friendships other_f ON other_f.status='accepted'
     AND (
       (other_f.requestor_id=v_other AND other_f.addressee_id=shared.friend_id)
       OR (other_f.addressee_id=v_other AND other_f.requestor_id=shared.friend_id)
     )
   WHERE shared.friend_id<>v_other AND shared.friend_id<>p_profile_id
     AND NOT public._social_blocked(p_profile_id,shared.friend_id)
     AND NOT public._social_blocked(v_other,shared.friend_id);
   v_result:=v_result||jsonb_build_object(v_other::text,coalesce(v_count,0));
 END LOOP;
 RETURN v_result;
END;
$function$
;
COMMIT;