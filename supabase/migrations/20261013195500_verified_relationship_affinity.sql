-- Relationship affinity must come from server-issued progression evidence,
-- never client-editable activity_feed.metadata.affinity_value.
-- Summing at the database removes the 75-event / 1000-row browser cap.
CREATE OR REPLACE FUNCTION public.get_verified_relationship_affinity(
  p_profile_id uuid,
  p_other_profile_id uuid
) RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  v_pair_key text;
  v_score bigint;
BEGIN
  IF auth.uid() IS NULL
     OR p_profile_id IS NULL
     OR p_other_profile_id IS NULL
     OR p_profile_id=p_other_profile_id
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id=p_profile_id AND p.user_id=auth.uid()
         AND p.deleted_at IS NULL
     )
  THEN RAISE EXCEPTION 'RELATIONSHIP_PROFILE_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;

  v_pair_key:=least(p_profile_id::text,p_other_profile_id::text)||':'||
              greatest(p_profile_id::text,p_other_profile_id::text);

  SELECT coalesce(sum(greatest(0,coalesce(l.xp_awarded,0))::bigint),0)
    INTO v_score
  FROM public.relationship_xp_log l
  WHERE l.pair_key=v_pair_key;
  RETURN v_score;
END $$;

REVOKE ALL ON FUNCTION public.get_verified_relationship_affinity(uuid,uuid)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_verified_relationship_affinity(uuid,uuid)
 TO authenticated,service_role;

-- RLS INSERT currently trusts a user-owned profile_id, allowing untrusted
-- browser clients to forge ANY xp_awarded and pair_key. Only privileged game
-- action workers may issue this economic/affinity ledger.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.relationship_xp_log
 FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS "Players can insert their own relationship XP log"
 ON public.relationship_xp_log;
GRANT SELECT ON public.relationship_xp_log TO authenticated;
GRANT INSERT,UPDATE,DELETE,SELECT ON public.relationship_xp_log TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_relationship_feed_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
  v_target uuid;
  v_user uuid;
  v_pair text;
BEGIN
  -- Only targeted relationship items participate in the pair timeline;
  -- unrelated news/activity feed items are not modified.
  IF NEW.activity_type NOT LIKE 'relationship_%'
    OR (NOT (coalesce(NEW.metadata,'{}'::jsonb) ? 'relationship_profile_id')
        AND NOT (coalesce(NEW.metadata,'{}'::jsonb) ? 'relationship_pair_key'))
  THEN RETURN NEW; END IF;

  IF NEW.profile_id IS NULL OR NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'RELATIONSHIP_ACTOR_REQUIRED' USING ERRCODE='23514'; END IF;
  SELECT p.user_id INTO v_user FROM public.profiles p WHERE p.id=NEW.profile_id;
  IF v_user IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'RELATIONSHIP_ACTOR_USER_MISMATCH' USING ERRCODE='23514'; END IF;
  IF auth.role()='authenticated' AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'RELATIONSHIP_ACTOR_NOT_OWNED' USING ERRCODE='42501'; END IF;

  IF jsonb_typeof(NEW.metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'RELATIONSHIP_METADATA_INVALID' USING ERRCODE='23514'; END IF;
  IF NOT (NEW.metadata ? 'relationship_profile_id') THEN
    RAISE EXCEPTION 'RELATIONSHIP_TARGET_REQUIRED' USING ERRCODE='23514'; END IF;
  v_target:=(NEW.metadata->>'relationship_profile_id')::uuid;
  IF v_target=NEW.profile_id OR NOT EXISTS(
    SELECT 1 FROM public.profiles p WHERE p.id=v_target AND p.deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'RELATIONSHIP_TARGET_INVALID' USING ERRCODE='23514'; END IF;

  v_pair:=least(NEW.profile_id::text,v_target::text)||':'||
          greatest(NEW.profile_id::text,v_target::text);
  NEW.metadata:=(NEW.metadata - 'relationship_pair_key'
    - 'relationship_actor_profile_id' - 'affinity_value')
    || jsonb_build_object('relationship_pair_key',v_pair,
                          'relationship_actor_profile_id',NEW.profile_id);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_relationship_feed_identity()
 FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS enforce_relationship_feed_pair ON public.activity_feed;
CREATE TRIGGER enforce_relationship_feed_pair
BEFORE INSERT OR UPDATE OF profile_id,user_id,activity_type,metadata
ON public.activity_feed FOR EACH ROW
EXECUTE FUNCTION public.enforce_relationship_feed_identity();

CREATE INDEX IF NOT EXISTS relationship_xp_log_pair_key_idx
ON public.relationship_xp_log(pair_key);
