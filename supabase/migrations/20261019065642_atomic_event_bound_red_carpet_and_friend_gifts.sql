-- Applied directly to production: receipt 20261019065642, issue #4226.
-- Server-derived fame and fixed-price friend gifts replace dangerous generic
-- privileged RPC calls. No existing character rows are changed on deploy.
-- Original application INSERT grants are removed to prevent bypass.
CREATE OR REPLACE FUNCTION public.attend_award_red_carpet_atomic(p_profile_id uuid, p_award_show_id uuid, p_outfit_choice text)
 RETURNS award_red_carpet_events
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_event public.award_red_carpet_events%ROWTYPE;
  v_fame integer;
BEGIN
  IF auth.uid() IS NULL OR p_profile_id IS NULL
     OR p_award_show_id IS NULL OR p_outfit_choice IS NULL
  THEN RAISE EXCEPTION 'red_carpet_auth_required' USING ERRCODE = '42501'; END IF;

  IF p_outfit_choice NOT IN ('standard','designer','custom') THEN
    RAISE EXCEPTION 'red_carpet_invalid_outfit'; END IF;
  v_fame := CASE p_outfit_choice
    WHEN 'designer' THEN 50 WHEN 'custom' THEN 75 ELSE 25 END;

  PERFORM 1 FROM public.profiles
   WHERE id = p_profile_id AND user_id = auth.uid()
     AND is_active IS TRUE AND died_at IS NULL AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'red_carpet_profile_not_owned' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.award_shows
   WHERE id = p_award_show_id AND status = 'live' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'red_carpet_show_not_live'; END IF;

  -- UNIQUE(award_show_id, participant_id) enforces once per character.
  -- Both insert and fame credit commit or roll back as one transaction.
  INSERT INTO public.award_red_carpet_events
    (award_show_id,participant_id,participant_type,outfit_choice,
     fame_gain,media_interactions)
  VALUES (p_award_show_id,p_profile_id,'user',p_outfit_choice,
          v_fame,5 + floor(random() * 10)::integer)
  RETURNING * INTO v_event;

  UPDATE public.profiles SET fame = fame + v_fame WHERE id = p_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'red_carpet_profile_missing'; END IF;
  RETURN v_event;
END
$function$
;
REVOKE INSERT ON public.award_red_carpet_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attend_award_red_carpet_atomic(uuid,uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.attend_award_red_carpet_atomic(uuid,uuid,text)
  TO authenticated,service_role;

CREATE UNIQUE INDEX IF NOT EXISTS friend_gifts_request_id_unique_20261019
  ON public.friend_gifts ((metadata->>'request_id'))
  WHERE metadata->>'request_id' IS NOT NULL;

CREATE OR REPLACE FUNCTION public.send_friend_gift_atomic(p_sender_profile_id uuid, p_recipient_profile_id uuid, p_gift_type text, p_message text, p_request_id uuid)
 RETURNS friend_gifts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_sender public.profiles%ROWTYPE;
  v_recipient public.profiles%ROWTYPE;
  v_gift public.friend_gifts%ROWTYPE;
  v_cost_cents bigint;
  v_affection integer;
  v_name text;
  v_rel_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_request_id IS NULL
     OR p_sender_profile_id IS NULL OR p_recipient_profile_id IS NULL
     OR p_sender_profile_id = p_recipient_profile_id
  THEN RAISE EXCEPTION 'friend_gift_invalid_actor' USING ERRCODE='42501'; END IF;
  IF length(coalesce(p_message,'')) > 500 THEN
    RAISE EXCEPTION 'friend_gift_message_too_long'; END IF;

  -- Serialize concurrent requests for the same sender before checking
  -- idempotency, available cash and the relationship update.
  SELECT * INTO v_sender FROM public.profiles
   WHERE id=p_sender_profile_id FOR UPDATE;
  IF NOT FOUND OR v_sender.user_id IS DISTINCT FROM auth.uid()
     OR v_sender.is_active IS DISTINCT FROM true
     OR v_sender.died_at IS NOT NULL OR v_sender.deleted_at IS NOT NULL
  THEN RAISE EXCEPTION 'friend_gift_sender_not_owned' USING ERRCODE='42501'; END IF;

  SELECT * INTO v_gift FROM public.friend_gifts
   WHERE metadata->>'request_id' = p_request_id::text;
  IF FOUND THEN
    IF v_gift.sender_profile_id <> p_sender_profile_id
       OR v_gift.recipient_profile_id <> p_recipient_profile_id
       OR v_gift.gift_type <> p_gift_type
       OR coalesce(v_gift.message,'') <> coalesce(p_message,'')
    THEN RAISE EXCEPTION 'friend_gift_request_conflict'; END IF;
    RETURN v_gift; -- request already charged/credited
  END IF;

  SELECT * INTO v_recipient FROM public.profiles
   WHERE id=p_recipient_profile_id AND died_at IS NULL AND deleted_at IS NULL;
  IF NOT FOUND OR public.are_profiles_blocked(p_sender_profile_id,p_recipient_profile_id)
  THEN RAISE EXCEPTION 'friend_gift_recipient_unavailable'; END IF;

  CASE p_gift_type
    WHEN 'flowers'        THEN v_cost_cents:=5000;    v_affection:=2;  v_name:='Flowers';
    WHEN 'concert_ticket' THEN v_cost_cents:=25000;   v_affection:=5;  v_name:='Concert Ticket';
    WHEN 'merch'          THEN v_cost_cents:=50000;   v_affection:=7;  v_name:='Custom Merch';
    WHEN 'vinyl'          THEN v_cost_cents:=100000;  v_affection:=10; v_name:='Rare Vinyl';
    WHEN 'jewelry'        THEN v_cost_cents:=500000;  v_affection:=20; v_name:='Jewelry';
    WHEN 'vacation'       THEN v_cost_cents:=2000000; v_affection:=40; v_name:='Surprise Vacation';
    ELSE RAISE EXCEPTION 'friend_gift_unknown_type';
  END CASE;

  UPDATE public.profiles SET cash=cash-(v_cost_cents/100)
   WHERE id=p_sender_profile_id AND cash >= (v_cost_cents/100);
  IF NOT FOUND THEN RAISE EXCEPTION 'friend_gift_insufficient_cash'; END IF;

  INSERT INTO public.friend_gifts
    (sender_profile_id,recipient_profile_id,gift_type,gift_name,
     cost_cents,affection_bonus,message,metadata)
  VALUES (p_sender_profile_id,p_recipient_profile_id,p_gift_type,v_name,
          v_cost_cents,v_affection,p_message,
          jsonb_build_object('request_id',p_request_id,'settled',true))
  RETURNING * INTO v_gift;

  SELECT id INTO v_rel_id FROM public.character_relationships
   WHERE entity_b_type='player'
     AND ((entity_a_id=p_sender_profile_id AND entity_b_id=p_recipient_profile_id)
       OR (entity_a_id=p_recipient_profile_id AND entity_b_id=p_sender_profile_id))
   ORDER BY CASE WHEN entity_a_id=p_sender_profile_id THEN 0 ELSE 1 END, id
   LIMIT 1 FOR UPDATE;
  IF v_rel_id IS NULL THEN
    INSERT INTO public.character_relationships
      (entity_a_id,entity_b_id,entity_b_type)
    VALUES (p_sender_profile_id,p_recipient_profile_id,'player')
    ON CONFLICT (entity_a_id,entity_b_id,entity_b_type) DO NOTHING
    RETURNING id INTO v_rel_id;
    IF v_rel_id IS NULL THEN
      SELECT id INTO v_rel_id FROM public.character_relationships
       WHERE entity_a_id=p_sender_profile_id
         AND entity_b_id=p_recipient_profile_id AND entity_b_type='player' FOR UPDATE;
    END IF;
  END IF;
  UPDATE public.character_relationships
   SET affection_score=LEAST(100,COALESCE(affection_score,0)+v_affection),
       last_interaction_at=now(),updated_at=now()
   WHERE id=v_rel_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'friend_gift_relationship_missing'; END IF;
  RETURN v_gift;
END
$function$
;
REVOKE INSERT ON public.friend_gifts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_friend_gift_atomic(uuid,uuid,text,text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_gift_atomic(uuid,uuid,text,text,uuid)
  TO authenticated,service_role;
