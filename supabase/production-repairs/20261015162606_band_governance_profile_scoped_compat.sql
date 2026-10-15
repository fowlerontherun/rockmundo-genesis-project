-- Correct profile-vs-account identities for band governance and disallow
-- unprivileged changes to leadership/identity columns.
BEGIN;

-- #4011/#4012: band leader IDs are profiles.id, not auth.users.id.
CREATE OR REPLACE FUNCTION public.transfer_band_leadership_atomic(
  p_band_id uuid, p_current_leader_id uuid, p_new_leader_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
  v_actor_profile uuid := public.current_profile_id();
  v_band public.bands%ROWTYPE;
  v_new_chemistry numeric;
BEGIN
  IF auth.uid() IS NULL OR v_actor_profile IS NULL
    OR v_actor_profile IS DISTINCT FROM p_current_leader_id
    OR NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id=v_actor_profile AND p.user_id=auth.uid()
        AND p.deleted_at IS NULL AND p.died_at IS NULL AND COALESCE(p.is_active,false)
    ) THEN RAISE EXCEPTION 'Only the selected band leader may transfer leadership.'
      USING ERRCODE='42501'; END IF;

  SELECT * INTO v_band FROM public.bands b WHERE b.id=p_band_id FOR UPDATE;
  IF NOT FOUND OR v_band.leader_id IS DISTINCT FROM v_actor_profile THEN
    RAISE EXCEPTION 'Only the current band leader may transfer leadership.'
      USING ERRCODE='42501';
  END IF;
  IF COALESCE(v_band.is_solo_artist,false) THEN
    RAISE EXCEPTION 'Solo artist leadership cannot be transferred.' USING ERRCODE='22023'; END IF;

  IF p_new_leader_id IS NULL OR p_new_leader_id=v_actor_profile OR NOT EXISTS (
    SELECT 1 FROM public.band_members bm
    JOIN public.profiles next_leader ON next_leader.id=bm.profile_id
    WHERE bm.band_id=p_band_id AND bm.profile_id=p_new_leader_id
      AND COALESCE(bm.member_status,'active')='active'
      AND NOT COALESCE(bm.is_touring_member,false)
      AND next_leader.deleted_at IS NULL AND next_leader.died_at IS NULL
      AND COALESCE(next_leader.is_active,false)
  ) THEN RAISE EXCEPTION 'Choose a different active living band member as leader.'
      USING ERRCODE='23514'; END IF;

  v_new_chemistry:=GREATEST(0,LEAST(100,COALESCE(v_band.chemistry_level,0)-5));
  UPDATE public.bands
    SET leader_id=p_new_leader_id, chemistry_level=v_new_chemistry,
        last_chemistry_update=now()
    WHERE id=p_band_id;
  INSERT INTO public.band_chemistry_events(band_id,event_type,chemistry_change,event_data)
    VALUES(p_band_id,'conflict',-5,jsonb_build_object(
      'from',v_actor_profile,'to',p_new_leader_id,'description','New leader elected'));
  INSERT INTO public.band_history(band_id,event_type,triggered_by,event_data)
    VALUES(p_band_id,'leadership_transfer',v_actor_profile,
      jsonb_build_object('new_leader_id',p_new_leader_id,'transferred_at',now()));
END;
$$;

-- #4007/#4008: leaving operates on the *selected profile* only, and may not
-- orphan a band's leader. User-scoped song ownership remains active if another
-- character under the same account is still an active band member.
CREATE OR REPLACE FUNCTION public.leave_band_atomic(p_band_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
  v_user uuid:=auth.uid();
  v_profile uuid:=public.current_profile_id();
  v_band public.bands%ROWTYPE;
  v_affected integer:=0;
  v_delta integer:=-10;
BEGIN
  IF v_user IS NULL OR v_profile IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=v_profile AND p.user_id=v_user
      AND p.died_at IS NULL AND p.deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_band FROM public.bands WHERE id=p_band_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BAND_NOT_FOUND' USING ERRCODE='22023'; END IF;
  IF v_band.leader_id=v_profile THEN
    RAISE EXCEPTION 'TRANSFER_LEADERSHIP_FIRST' USING ERRCODE='23514'; END IF;
  IF COALESCE(v_band.is_solo_artist,false) THEN
    RAISE EXCEPTION 'SOLO_ARTIST_CANNOT_LEAVE' USING ERRCODE='23514'; END IF;

  DELETE FROM public.band_members bm
    WHERE bm.band_id=p_band_id AND bm.profile_id=v_profile
      AND bm.user_id=v_user AND NOT COALESCE(bm.is_touring_member,false);
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_A_BAND_MEMBER' USING ERRCODE='22023'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id=p_band_id AND bm.user_id=v_user
      AND COALESCE(bm.member_status,'active')='active'
      AND NOT COALESCE(bm.is_touring_member,false)
  ) THEN
    UPDATE public.band_song_ownership
      SET ownership_percentage=original_percentage*0.30,
          is_active_member=false,role='former_member'
      WHERE band_id=p_band_id AND user_id=v_user
        AND is_active_member IS DISTINCT FROM false;
    GET DIAGNOSTICS v_affected=ROW_COUNT;
  END IF;

  UPDATE public.bands
    SET chemistry_level=GREATEST(0,COALESCE(chemistry_level,0)+v_delta),
        last_chemistry_update=now()
    WHERE id=p_band_id;
  INSERT INTO public.band_chemistry_events(band_id,event_type,chemistry_change,event_data)
    VALUES(p_band_id,'member_left',v_delta,jsonb_build_object(
      'profileId',v_profile,'userId',v_user,'description','Member left the band'));
  INSERT INTO public.band_history(band_id,event_type,triggered_by,event_data)
    VALUES(p_band_id,'ownership_adjusted',v_profile,
      jsonb_build_object('action','member_left','affected_songs',v_affected,
        'new_retention_rate',30,'profile_id',v_profile));
  INSERT INTO public.band_history(band_id,event_type,triggered_by,event_data)
    VALUES(p_band_id,'member_left',v_profile,
      jsonb_build_object('left_at',now(),'profile_id',v_profile));
  RETURN true;
END;
$$;

-- #4009: status and history must commit or fail together.
CREATE OR REPLACE FUNCTION public.disband_band_atomic(
  p_band_id uuid,p_leader_profile_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
  v_actor uuid:=public.current_profile_id();
  v_band public.bands%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_actor IS NULL OR v_actor IS DISTINCT FROM p_leader_profile_id
    OR NOT EXISTS(SELECT 1 FROM public.profiles p
        WHERE p.id=v_actor AND p.user_id=auth.uid()
          AND p.died_at IS NULL AND p.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Only the selected band leader may disband the band.'
      USING ERRCODE='42501'; END IF;
  SELECT * INTO v_band FROM public.bands WHERE id=p_band_id FOR UPDATE;
  IF NOT FOUND OR v_band.leader_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Only the band leader may disband the band.'
      USING ERRCODE='42501'; END IF;
  IF v_band.status='disbanded'::public.band_status THEN RETURN true; END IF;

  UPDATE public.bands SET status='disbanded'::public.band_status,
    hiatus_started_at=now() WHERE id=p_band_id;
  INSERT INTO public.band_history(band_id,event_type,triggered_by,event_data)
    VALUES(p_band_id,'disbanded',v_actor,
      jsonb_build_object('disbanded_at',now(),'band_name',v_band.name));
  RETURN true;
END;
$$;

-- #4014: a row UPDATE policy cannot constrain which columns changed.
-- Reject direct API attempts to alter membership identity, roles or privileges.
-- Privileged SECURITY DEFINER RPCs (whose current_user is their owner) retain
-- authority to perform already-validated lifecycle transitions.
CREATE OR REPLACE FUNCTION public.guard_band_membership_direct_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF NEW.band_id IS DISTINCT FROM OLD.band_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.member_status IS DISTINCT FROM OLD.member_status
       OR NEW.is_touring_member IS DISTINCT FROM OLD.is_touring_member
       OR NEW.can_be_leader IS DISTINCT FROM OLD.can_be_leader
       OR NEW.leadership_votes IS DISTINCT FROM OLD.leadership_votes
       OR NEW.salary IS DISTINCT FROM OLD.salary THEN
      RAISE EXCEPTION 'Membership leadership and privileges require an authorised band operation.'
        USING ERRCODE='42501'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS band_membership_direct_change_guard ON public.band_members;
CREATE TRIGGER band_membership_direct_change_guard
BEFORE UPDATE ON public.band_members FOR EACH ROW
EXECUTE FUNCTION public.guard_band_membership_direct_changes();

-- #4015: regardless of which other RLS policy grants access, protected
-- leader/founder membership may not be deleted directly through the API.
CREATE OR REPLACE FUNCTION public.guard_protected_band_member_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated','anon') AND (
     lower(COALESCE(OLD.role,'')) IN ('leader','founder')
     OR EXISTS (
       SELECT 1 FROM public.bands b
       WHERE b.id=OLD.band_id AND b.leader_id=OLD.profile_id
     )
  ) THEN
    RAISE EXCEPTION 'Transfer leadership through band governance before removing this member.'
      USING ERRCODE='42501';
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS protected_band_member_delete_guard ON public.band_members;
CREATE TRIGGER protected_band_member_delete_guard
BEFORE DELETE ON public.band_members FOR EACH ROW
EXECUTE FUNCTION public.guard_protected_band_member_delete();


-- Direct client changes to leader identity or disbanded status must use
-- owner-validated atomic RPCs, not the permissive generic band UPDATE policy.
CREATE OR REPLACE FUNCTION public.rockmundo_guard_band_direct_governance()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $f$
BEGIN
  IF current_user IN ('authenticated','anon') AND (
    NEW.leader_id IS DISTINCT FROM OLD.leader_id
    OR (NEW.status IS DISTINCT FROM OLD.status
        AND (NEW.status='disbanded'::public.band_status
             OR OLD.status='disbanded'::public.band_status))
  ) THEN
    RAISE EXCEPTION 'Band leadership and disbanding require an authorised RPC.'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$f$;
DROP TRIGGER IF EXISTS rockmundo_band_direct_governance_guard ON public.bands;
CREATE TRIGGER rockmundo_band_direct_governance_guard
BEFORE UPDATE OF leader_id,status ON public.bands FOR EACH ROW
EXECUTE FUNCTION public.rockmundo_guard_band_direct_governance();

REVOKE ALL ON FUNCTION public.transfer_band_leadership_atomic(uuid,uuid,uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.leave_band_atomic(uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.disband_band_atomic(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_band_leadership_atomic(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_band_atomic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disband_band_atomic(uuid,uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.guard_band_membership_direct_changes()
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_protected_band_member_delete()
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.rockmundo_guard_band_direct_governance()
  FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;