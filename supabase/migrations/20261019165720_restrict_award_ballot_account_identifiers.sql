-- #4237 production receipt 20261019165720.
-- Account identity is private. Vote summaries remain publicly readable,
-- but legacy TRUNCATE/TRIGGER/table write grants are entirely revoked.
REVOKE ALL ON TABLE public.award_votes FROM PUBLIC,anon,authenticated;
GRANT SELECT (id,nomination_id,voter_type,voter_id,weight,created_at)
ON TABLE public.award_votes TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.award_show_account_vote_count(p_show_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_user uuid:=auth.uid();
BEGIN
 IF v_user IS NULL THEN
   RAISE EXCEPTION 'Sign in to view your remaining votes' USING ERRCODE='42501';
 END IF;
 IF p_show_id IS NULL THEN
   RAISE EXCEPTION 'Award show required' USING ERRCODE='22023';
 END IF;
 RETURN (
   SELECT count(*)::integer
   FROM public.award_votes v
   JOIN public.award_nominations n ON n.id=v.nomination_id
   WHERE n.award_show_id=p_show_id AND v.voter_account_id=v_user
 );
END $function$
;
REVOKE ALL ON FUNCTION public.award_show_account_vote_count(uuid)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.award_show_account_vote_count(uuid)
TO authenticated;
