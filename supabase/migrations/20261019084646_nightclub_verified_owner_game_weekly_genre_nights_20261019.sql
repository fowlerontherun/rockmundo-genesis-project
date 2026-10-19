-- Phase 8: owner-managed genre nights, scheduled against RockMundo's game weekday.
-- No cash, XP, fame, cover-price or DJ payout control is granted here.
ALTER TABLE public.nightclub_events
 ADD COLUMN managed_by_owned_club_id uuid REFERENCES public.player_owned_nightclubs(id)
 ON DELETE RESTRICT;
CREATE UNIQUE INDEX nightclub_one_owner_theme_night_per_game_weekday
 ON public.nightclub_events(managed_by_owned_club_id,day_of_week)
 WHERE managed_by_owned_club_id IS NOT NULL;
ALTER TABLE public.nightclub_events
 ADD CONSTRAINT nightclub_owner_theme_night_safe_fields CHECK (
  managed_by_owned_club_id IS NULL OR (
    event_type='theme_night' AND is_recurring=true AND day_of_week BETWEEN 0 AND 6
    AND scheduled_date IS NULL AND cover_charge_override IS NULL
    AND fame_multiplier=1 AND xp_multiplier=1 AND special_guest_name IS NULL
    AND description IS NULL
  )
);

CREATE TABLE public.nightclub_owner_theme_night_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 profile_id uuid NOT NULL REFERENCES public.profiles(id),
 owned_club_id uuid NOT NULL REFERENCES public.player_owned_nightclubs(id),
 event_id uuid NOT NULL REFERENCES public.nightclub_events(id),
 request_id uuid NOT NULL,
 action_type text NOT NULL CHECK (action_type IN ('set','disable')),
 intent jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,request_id)
);
ALTER TABLE public.nightclub_owner_theme_night_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners see their theme night action receipts"
 ON public.nightclub_owner_theme_night_actions FOR SELECT TO authenticated
 USING (
  user_id=(select auth.uid()) AND EXISTS(
   SELECT 1 FROM public.player_owned_nightclubs o
    JOIN public.profiles p ON p.id=o.profile_id
   WHERE o.id=owned_club_id AND o.profile_id=profile_id AND p.user_id=(select auth.uid())
  )
 );
REVOKE ALL ON public.nightclub_owner_theme_night_actions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.nightclub_owner_theme_night_actions TO authenticated;

CREATE FUNCTION public.manage_owned_nightclub_theme_night(
 p_owned_club_id uuid,
 p_game_weekday integer,
 p_action text,
 p_request_id uuid,
 p_title text DEFAULT NULL,
 p_genre text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $theme_night$
DECLARE
 v_actor uuid := (select auth.uid());
 v_active uuid := public.current_active_player_profile_id();
 v_owner public.player_owned_nightclubs%ROWTYPE;
 v_prior public.nightclub_owner_theme_night_actions%ROWTYPE;
 v_event public.nightclub_events%ROWTYPE;
 v_title text;
 v_genre text;
 v_intent jsonb;
BEGIN
 IF v_actor IS NULL OR v_active IS NULL OR p_owned_club_id IS NULL
   OR p_request_id IS NULL OR p_game_weekday IS NULL
   OR p_game_weekday NOT BETWEEN 0 AND 6
   OR p_action IS NULL OR p_action NOT IN ('set','disable') THEN
  RAISE EXCEPTION 'Active owner, game weekday and request required' USING ERRCODE='42501';
 END IF;
 v_title:=btrim(coalesce(p_title,''));
 v_genre:=btrim(coalesce(p_genre,''));
 IF p_action='set' THEN
  IF length(v_title) NOT BETWEEN 3 AND 64 OR length(v_genre) NOT BETWEEN 2 AND 40
   OR v_title ~ '[[:cntrl:]]' OR v_genre ~ '[[:cntrl:]]' THEN
   RAISE EXCEPTION 'Theme night title must be 3-64 and genre 2-40 printable characters'
    USING ERRCODE='22023';
  END IF;
 ELSE
  IF p_title IS NOT NULL OR p_genre IS NOT NULL THEN
   RAISE EXCEPTION 'Disable action cannot change theme night details'
    USING ERRCODE='22023';
  END IF;
 END IF;
 v_intent:=jsonb_build_object('club',p_owned_club_id,'weekday',p_game_weekday,
   'action',p_action,'title',CASE WHEN p_action='set' THEN v_title END,
   'genre',CASE WHEN p_action='set' THEN v_genre END);

 -- Serializes all theme-night mutations for the same owned club.
 SELECT * INTO v_owner FROM public.player_owned_nightclubs
  WHERE id=p_owned_club_id AND profile_id=v_active FOR UPDATE;
 IF NOT FOUND OR v_owner.club_id IS NULL
  OR NOT EXISTS(SELECT 1 FROM public.profiles p
    WHERE p.id=v_owner.profile_id AND p.user_id=v_actor)
  OR NOT EXISTS(
    SELECT 1 FROM public.nightclub_purchase_receipts r
    WHERE r.id=v_owner.verified_purchase_id AND r.profile_id=v_active
     AND r.club_id=v_owner.club_id AND r.user_id=v_actor
  ) THEN
  RAISE EXCEPTION 'Verified nightclub ownership is required to manage genre nights'
    USING ERRCODE='42501';
 END IF;

 -- A replay must return the original event, not revert a later edit.
 SELECT * INTO v_prior FROM public.nightclub_owner_theme_night_actions
  WHERE user_id=v_actor AND request_id=p_request_id;
 IF FOUND THEN
  IF v_prior.profile_id<>v_active OR v_prior.owned_club_id<>p_owned_club_id
    OR v_prior.action_type<>p_action OR v_prior.intent<>v_intent THEN
   RAISE EXCEPTION 'Theme night request ID used for another action'
    USING ERRCODE='23505';
  END IF;
  RETURN jsonb_build_object('event_id',v_prior.event_id,
    'owned_club_id',p_owned_club_id,'action',p_action,'replayed',true);
 END IF;

 SELECT * INTO v_event FROM public.nightclub_events
  WHERE managed_by_owned_club_id=p_owned_club_id AND day_of_week=p_game_weekday
   FOR UPDATE;
 IF p_action='disable' THEN
  IF NOT FOUND THEN
   RAISE EXCEPTION 'No owner-managed night exists for this game weekday'
    USING ERRCODE='22023';
  END IF;
  UPDATE public.nightclub_events SET is_active=false
   WHERE id=v_event.id;
 ELSE
  IF EXISTS(
   SELECT 1 FROM public.nightclub_events e
   WHERE e.club_id=v_owner.club_id AND e.is_active
    AND e.is_recurring AND e.day_of_week=p_game_weekday
    AND (e.managed_by_owned_club_id IS DISTINCT FROM p_owned_club_id)
  ) THEN
   RAISE EXCEPTION 'Another nightclub event already uses this game weekday'
    USING ERRCODE='23P01';
  END IF;
  IF FOUND THEN
   UPDATE public.nightclub_events
   SET event_name=v_title,genre_focus=v_genre,is_active=true
   WHERE id=v_event.id RETURNING * INTO v_event;
  ELSE
   INSERT INTO public.nightclub_events(
    club_id,event_name,event_type,genre_focus,day_of_week,
    scheduled_date,cover_charge_override,fame_multiplier,xp_multiplier,
    special_guest_name,description,is_recurring,is_active,managed_by_owned_club_id
   ) VALUES(
    v_owner.club_id,v_title,'theme_night',v_genre,p_game_weekday,
    NULL,NULL,1,1,NULL,NULL,true,true,p_owned_club_id
   ) RETURNING * INTO v_event;
  END IF;
 END IF;

 INSERT INTO public.nightclub_owner_theme_night_actions(
  user_id,profile_id,owned_club_id,event_id,request_id,action_type,intent
 ) VALUES(v_actor,v_active,p_owned_club_id,v_event.id,p_request_id,p_action,v_intent);
 RETURN jsonb_build_object('event_id',v_event.id,
  'owned_club_id',p_owned_club_id,'action',p_action,'replayed',false);
END;
$theme_night$;
REVOKE ALL ON FUNCTION public.manage_owned_nightclub_theme_night(uuid,integer,text,uuid,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.manage_owned_nightclub_theme_night(uuid,integer,text,uuid,text,text)
 TO authenticated;
COMMENT ON FUNCTION public.manage_owned_nightclub_theme_night(uuid,integer,text,uuid,text,text)
 IS 'Game-weekday recurring genre-night management for receipt-verified active owners, with no DJ payout, reward or cover override controls.';