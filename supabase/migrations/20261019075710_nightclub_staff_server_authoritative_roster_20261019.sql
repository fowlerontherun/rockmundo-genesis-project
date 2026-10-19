-- Server-authoritative NPC nightclub staffing, prerequisite for club-owned DJ residencies.
-- Existing employees and historical owners are preserved (staff do not confer DJ booking authority).
CREATE TABLE public.nightclub_staff_action_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_user_id uuid NOT NULL REFERENCES auth.users(id),
 profile_id uuid NOT NULL REFERENCES public.profiles(id),
 owned_club_id uuid NOT NULL REFERENCES public.player_owned_nightclubs(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL,
 action_type text NOT NULL CHECK(action_type IN ('hire','fire')),
 staff_id uuid NOT NULL,
 intent jsonb NOT NULL,
 salary_weekly integer NOT NULL CHECK (salary_weekly BETWEEN 0 AND 2000),
 performed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(actor_user_id,request_id)
);
CREATE INDEX nightclub_staff_receipts_club_time_idx
 ON public.nightclub_staff_action_receipts(owned_club_id,performed_at DESC);
ALTER TABLE public.nightclub_staff_action_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners see their staff receipts" ON public.nightclub_staff_action_receipts
 FOR SELECT TO authenticated USING (
 actor_user_id=(select auth.uid())
 AND EXISTS(SELECT 1 FROM public.player_owned_nightclubs o
  JOIN public.profiles p ON p.id=o.profile_id
  WHERE o.id=owned_club_id AND p.user_id=(select auth.uid())));
REVOKE ALL ON TABLE public.nightclub_staff_action_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.nightclub_staff_action_receipts TO authenticated;

-- Old ALL policy permitted arbitrary browser-supplied wages and arbitrary staff edits.
DROP POLICY IF EXISTS "Players can manage staff for own clubs" ON public.nightclub_staff;
REVOKE ALL ON TABLE public.nightclub_staff FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.nightclub_staff TO authenticated;

CREATE FUNCTION public.nightclub_staff_action_atomic(
 p_owned_club_id uuid,p_action text,p_request_id uuid,
 p_staff_type text DEFAULT NULL,p_name text DEFAULT NULL,
 p_skill_level integer DEFAULT NULL,p_staff_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp
AS $staff$
DECLARE
 actor uuid:=(select auth.uid());
 active_profile uuid:=public.current_active_player_profile_id();
 owner_row public.player_owned_nightclubs%ROWTYPE;
 prior public.nightclub_staff_action_receipts%ROWTYPE;
 existing public.nightclub_staff%ROWTYPE;
 intent jsonb;
 generated_staff_id uuid;
 rate integer;
 staff_cap integer;
 num_staff integer;
 trimmed_name text;
BEGIN
 IF actor IS NULL OR active_profile IS NULL OR p_owned_club_id IS NULL
 OR p_request_id IS NULL OR p_action NOT IN ('hire','fire') OR p_action IS NULL THEN
  RAISE EXCEPTION 'Active owner, action and unique request required' USING ERRCODE='42501';
 END IF;

 -- Lock club before examining roster to serialize all concurrent hires and fires.
 SELECT * INTO owner_row FROM public.player_owned_nightclubs
 WHERE id=p_owned_club_id AND profile_id=active_profile FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.profiles p
   WHERE p.id=owner_row.profile_id AND p.user_id=actor) THEN
  RAISE EXCEPTION 'Only active nightclub owner may change staff' USING ERRCODE='42501';
 END IF;

 IF p_action='hire' THEN
   trimmed_name:=btrim(coalesce(p_name,''));
   IF p_staff_id IS NOT NULL OR p_staff_type IS NULL
   OR p_staff_type NOT IN ('bouncer','bartender','dj','promoter','manager')
   OR p_skill_level IS NULL OR p_skill_level NOT BETWEEN 1 AND 5
   OR length(trimmed_name) NOT BETWEEN 2 AND 64
   OR trimmed_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Invalid nightclub hire: role, name and level 1 to 5 required'
     USING ERRCODE='22023';
   END IF;
   intent:=jsonb_build_object('action','hire','club',p_owned_club_id,
      'type',p_staff_type,'name',trimmed_name,'skill',p_skill_level);
 ELSE
   IF p_staff_id IS NULL OR p_staff_type IS NOT NULL OR p_name IS NOT NULL
     OR p_skill_level IS NOT NULL THEN
     RAISE EXCEPTION 'Firing requires only a staff ID' USING ERRCODE='22023';
   END IF;
   intent:=jsonb_build_object('action','fire','club',p_owned_club_id,'staff',p_staff_id);
 END IF;

 SELECT * INTO prior FROM public.nightclub_staff_action_receipts
 WHERE actor_user_id=actor AND request_id=p_request_id;
 IF FOUND THEN
  IF prior.intent<>intent OR prior.profile_id<>active_profile
    OR prior.owned_club_id<>p_owned_club_id OR prior.action_type<>p_action THEN
   RAISE EXCEPTION 'Staff action request ID reused for different intent'
    USING ERRCODE='23505';
  END IF;
  RETURN jsonb_build_object('action',prior.action_type,'staff_id',prior.staff_id,
   'owned_club_id',prior.owned_club_id,'salary_weekly',prior.salary_weekly,
   'replayed',true,'still_employed',
   EXISTS(SELECT 1 FROM public.nightclub_staff s WHERE s.id=prior.staff_id
      AND s.owned_club_id=prior.owned_club_id));
 END IF;

 IF p_action='hire' THEN
  staff_cap:=least(20,greatest(5,ceil(owner_row.capacity/100.0)::integer+4));
  SELECT count(*) INTO num_staff FROM public.nightclub_staff
    WHERE owned_club_id=p_owned_club_id;
  IF num_staff>=staff_cap THEN
    RAISE EXCEPTION 'Nightclub has reached the permitted staff capacity'
     USING ERRCODE='22023';
  END IF;
  rate:=CASE p_staff_type
    WHEN 'bouncer' THEN 200 WHEN 'bartender' THEN 250
    WHEN 'dj' THEN 400 WHEN 'promoter' THEN 350
    WHEN 'manager' THEN 500 END;
  rate:=round(rate*(1+(p_skill_level-1)*0.25))::integer;
  INSERT INTO public.nightclub_staff(owned_club_id,staff_type,name,skill_level,salary_weekly)
  VALUES(p_owned_club_id,p_staff_type,trimmed_name,p_skill_level,rate)
  RETURNING id INTO generated_staff_id;
 ELSE
  SELECT * INTO existing FROM public.nightclub_staff
  WHERE id=p_staff_id AND owned_club_id=p_owned_club_id FOR UPDATE;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Staff member not present at your club' USING ERRCODE='22023';
  END IF;
  generated_staff_id:=existing.id;
  rate:=existing.salary_weekly;
  DELETE FROM public.nightclub_staff WHERE id=existing.id AND owned_club_id=p_owned_club_id;
 END IF;

 INSERT INTO public.nightclub_staff_action_receipts
  (actor_user_id,profile_id,owned_club_id,request_id,action_type,staff_id,intent,salary_weekly)
 VALUES(actor,active_profile,p_owned_club_id,p_request_id,p_action,generated_staff_id,intent,rate);
 UPDATE public.player_owned_nightclubs SET
  staff_count=(SELECT count(*) FROM public.nightclub_staff WHERE owned_club_id=p_owned_club_id),
  updated_at=now()
 WHERE id=p_owned_club_id;
 RETURN jsonb_build_object('action',p_action,'staff_id',generated_staff_id,
  'owned_club_id',p_owned_club_id,'salary_weekly',rate,
  'replayed',false,'still_employed',p_action='hire');
END;
$staff$;
REVOKE ALL ON FUNCTION public.nightclub_staff_action_atomic(uuid,text,uuid,text,text,integer,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nightclub_staff_action_atomic(uuid,text,uuid,text,text,integer,uuid)
 TO authenticated;
COMMENT ON FUNCTION public.nightclub_staff_action_atomic(uuid,text,uuid,text,text,integer,uuid)
 IS 'Server-priced NPC hire/fire for active club owner. Does not approve resident DJ bookings or settle wages.';