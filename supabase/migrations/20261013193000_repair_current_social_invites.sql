-- Recover from historical duplicate pending invitations before applying the
-- unique rule. Keep the newest; cancel older duplicates without changing their
-- existing notification history.
WITH ranked AS (
 SELECT id, row_number() OVER (
   PARTITION BY from_profile_id,to_profile_id,kind
   ORDER BY created_at DESC,id DESC
 ) AS rn
 FROM public.social_invites WHERE status='pending'::public.social_invite_status
)
UPDATE public.social_invites i
SET status='cancelled'::public.social_invite_status,responded_at=now()
FROM ranked r WHERE i.id=r.id AND r.rn>1;

CREATE UNIQUE INDEX IF NOT EXISTS social_invites_unique_pending_pair_kind
ON public.social_invites(from_profile_id,to_profile_id,kind)
WHERE status='pending'::public.social_invite_status;

-- Clients must use the guarded RPC, rather than inserting bare rows that
-- would have no authoritative recipient notification.
REVOKE INSERT ON public.social_invites FROM PUBLIC,authenticated,anon;

-- Restore the guarded invite semantics for the CURRENT text-signature RPC
-- overloads (the earlier enum overloads are not what production currently uses).
-- No unrelated historical social schema is replayed.
CREATE OR REPLACE FUNCTION public.send_social_invite(
  target_profile_id uuid,
  invite_kind text,
  scheduled_for timestamptz DEFAULT NULL,
  invite_message text DEFAULT NULL,
  invite_ref_id uuid DEFAULT NULL,
  invite_location_city_id uuid DEFAULT NULL
) RETURNS public.social_invites
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_from uuid := public._caller_profile_id();
  v_row public.social_invites%ROWTYPE;
  v_recipient_user uuid;
  v_kind public.social_invite_kind;
  v_message text;
BEGIN
  IF auth.uid() IS NULL OR v_from IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile before using invites.' USING ERRCODE='42501';
  END IF;
  IF target_profile_id IS NULL OR target_profile_id=v_from THEN
    RAISE EXCEPTION 'Choose another musician to invite.' USING ERRCODE='22023';
  END IF;
  IF invite_kind IS NULL THEN RAISE EXCEPTION 'Choose an invitation type.' USING ERRCODE='22023'; END IF;
  v_kind:=invite_kind::public.social_invite_kind;
  IF scheduled_for IS NOT NULL AND scheduled_for <= now() THEN
    RAISE EXCEPTION 'Scheduled invitation time must be in the future.' USING ERRCODE='22023';
  END IF;
  v_message:=NULLIF(btrim(invite_message),'');
  IF char_length(coalesce(v_message,''))>280 THEN
    RAISE EXCEPTION 'Invite messages must be 280 characters or fewer.' USING ERRCODE='22023';
  END IF;
  SELECT user_id INTO v_recipient_user FROM public.profiles
  WHERE id=target_profile_id AND deleted_at IS NULL;
  IF v_recipient_user IS NULL THEN RAISE EXCEPTION 'That player could not be found.'; END IF;
  IF public._social_blocked(v_from,target_profile_id) THEN
    RAISE EXCEPTION 'This musician is not available for invites.' USING ERRCODE='42501';
  END IF;
  -- Serialize same sender/recipient/purpose, even when no existing row exists.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_from::text||':'||target_profile_id::text||':'||v_kind::text,0));

  -- Never reuse an already past-due invitation as pending.
  UPDATE public.social_invites SET status='expired'::public.social_invite_status,
    responded_at=now()
  WHERE from_profile_id=v_from AND to_profile_id=target_profile_id AND kind=v_kind
    AND status='pending'::public.social_invite_status
    AND scheduled_at IS NOT NULL AND scheduled_at<=now();

  SELECT * INTO v_row FROM public.social_invites
  WHERE from_profile_id=v_from AND to_profile_id=target_profile_id
    AND kind=v_kind AND status='pending'::public.social_invite_status
  ORDER BY created_at DESC,id DESC
  LIMIT 1 FOR UPDATE;

  IF v_row.id IS NULL THEN
    INSERT INTO public.social_invites(
      from_profile_id,to_profile_id,kind,ref_id,scheduled_at,
      location_city_id,message,status)
    VALUES(v_from,target_profile_id,v_kind,invite_ref_id,scheduled_for,
      invite_location_city_id,v_message,'pending'::public.social_invite_status)
    RETURNING * INTO v_row;
  END IF;

  -- Exactly one notification per invite ID. A repeated send returns the same
  -- pending invite rather than flooding the target player's inbox.
  INSERT INTO public.notifications(
    user_id,profile_id,category,type,title,message,action_path,metadata)
  SELECT v_recipient_user,target_profile_id,'relationship','social_invite',
    'New social invite','Another artist sent you an invitation.',
    '/social?tab=invites',
    jsonb_build_object('social_invite_id',v_row.id,
      'from_profile_id',v_from,'to_profile_id',target_profile_id,'kind',v_kind)
  WHERE NOT EXISTS(
    SELECT 1 FROM public.notifications n
    WHERE n.user_id=v_recipient_user AND n.type='social_invite'
      AND n.metadata->>'social_invite_id'=v_row.id::text);
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.respond_social_invite(
  invite_id uuid,next_status text)
RETURNS public.social_invites
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_actor uuid:=public._caller_profile_id();
  v_row public.social_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile before responding.' USING ERRCODE='42501';
  END IF;
  IF next_status NOT IN ('accepted','declined','cancelled') THEN
    RAISE EXCEPTION 'Choose accept, decline or cancel.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_row FROM public.social_invites WHERE id=invite_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found.' USING ERRCODE='P0002'; END IF;
  IF v_actor NOT IN (v_row.from_profile_id,v_row.to_profile_id) THEN
    RAISE EXCEPTION 'Invite is not yours.' USING ERRCODE='42501';
  END IF;
  IF v_row.status<>'pending'::public.social_invite_status THEN
    RETURN v_row;
  END IF;
  IF v_row.scheduled_at IS NOT NULL AND v_row.scheduled_at<=now() THEN
    UPDATE public.social_invites SET
      status='expired'::public.social_invite_status,responded_at=now()
    WHERE id=v_row.id RETURNING * INTO v_row;
    RETURN v_row;
  END IF;
  IF public._social_blocked(v_row.from_profile_id,v_row.to_profile_id) THEN
    RAISE EXCEPTION 'This invitation can no longer be updated.' USING ERRCODE='42501';
  END IF;
  IF next_status='cancelled' AND v_actor IS DISTINCT FROM v_row.from_profile_id THEN
    RAISE EXCEPTION 'Only the sender may cancel.' USING ERRCODE='42501';
  END IF;
  IF next_status IN ('accepted','declined') AND v_actor IS DISTINCT FROM v_row.to_profile_id THEN
    RAISE EXCEPTION 'Only the recipient may accept or decline.' USING ERRCODE='42501';
  END IF;
  UPDATE public.social_invites
  SET status=next_status::public.social_invite_status,responded_at=now()
  WHERE id=v_row.id AND status='pending'::public.social_invite_status
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.send_social_invite(uuid,text,timestamptz,text,uuid,uuid)
 FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.respond_social_invite(uuid,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.send_social_invite(uuid,text,timestamptz,text,uuid,uuid)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_social_invite(uuid,text)
 TO authenticated;
