
CREATE TABLE public.nightclub_dj_residencies(
 id uuid primary key default gen_random_uuid(),
 owned_club_id uuid not null references public.player_owned_nightclubs(id),
 source_application_id uuid not null unique references public.dj_club_applications(id),
 club_id uuid not null references public.city_night_clubs(id),
 owner_user_id uuid not null references auth.users(id),
 owner_profile_id uuid not null references public.profiles(id),
 dj_user_id uuid not null references auth.users(id),
 dj_profile_id uuid not null references public.profiles(id),
 setlist_id uuid not null references public.dj_setlists(id),
 dj_display_name text not null,
 setlist_name text not null,
 venue_timezone text not null,
 planned_starts_at timestamptz[] not null,
 occurrence_count integer not null check(occurrence_count between 2 and 4),
 proposed_fee integer not null check(proposed_fee between 50 and 1250),
 status text not null default 'proposed' check(status in ('proposed','agreed','declined','ended','expired')),
 owner_request_id uuid not null,
 expires_at timestamptz not null,
 agreed_at timestamptz,
 ended_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check(owner_user_id<>dj_user_id),
 check(cardinality(planned_starts_at)=occurrence_count),
 unique(owner_user_id,owner_request_id)
);
CREATE UNIQUE INDEX dj_residency_one_active_dj_club ON public.nightclub_dj_residencies(owned_club_id,dj_profile_id)
 WHERE status in ('proposed','agreed');
CREATE INDEX dj_residency_dj_view ON public.nightclub_dj_residencies(dj_profile_id,status);
ALTER TABLE public.nightclub_dj_residencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Residency participants see agreement" ON public.nightclub_dj_residencies
 FOR SELECT TO authenticated USING (
 (nightclub_dj_residencies.dj_user_id=(select auth.uid()) AND EXISTS(
 SELECT 1 FROM public.profiles p WHERE p.id=nightclub_dj_residencies.dj_profile_id
 AND p.user_id=(select auth.uid())))
 OR (nightclub_dj_residencies.owner_user_id=(select auth.uid()) AND EXISTS(
 SELECT 1 FROM public.player_owned_nightclubs o
 JOIN public.nightclub_purchase_receipts r ON r.id=o.verified_purchase_id
  AND r.club_id=o.club_id AND r.profile_id=o.profile_id
 WHERE o.id=nightclub_dj_residencies.owned_club_id
 AND o.club_id=nightclub_dj_residencies.club_id
 AND o.profile_id=nightclub_dj_residencies.owner_profile_id AND r.user_id=(select auth.uid())))
 );
REVOKE ALL ON public.nightclub_dj_residencies FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.nightclub_dj_residencies TO authenticated;
CREATE TABLE public.nightclub_dj_residency_actions(
 id uuid primary key default gen_random_uuid(),
 residency_id uuid not null references public.nightclub_dj_residencies(id),
 actor_user_id uuid not null references auth.users(id),
 request_id uuid not null,
 action text not null check(action in ('accept','decline','withdraw','end')),
 created_at timestamptz not null default clock_timestamp(),
 unique(actor_user_id,request_id)
);
ALTER TABLE public.nightclub_dj_residency_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Residency participants see action receipts" ON public.nightclub_dj_residency_actions
 FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.nightclub_dj_residencies r WHERE r.id=nightclub_dj_residency_actions.residency_id
 AND (r.owner_user_id=(select auth.uid()) OR r.dj_user_id=(select auth.uid()))
 ));
REVOKE ALL ON public.nightclub_dj_residency_actions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.nightclub_dj_residency_actions TO authenticated;

CREATE FUNCTION public.propose_nightclub_dj_residency(
 p_owned_club_id uuid,p_application_id uuid,p_occurrences integer,p_fee integer,p_request_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=(select auth.uid()); selected uuid:=public.current_active_player_profile_id();
 owned public.player_owned_nightclubs%ROWTYPE;
 appl public.dj_club_applications%ROWTYPE;
 prior public.nightclub_dj_residencies%ROWTYPE;
 tz text; minutes integer; local_start timestamp; wall timestamp;
 moment timestamptz; slots timestamptz[]:=array[]::timestamptz[];
 expiry timestamptz; result uuid; n integer;
BEGIN
 IF actor IS NULL OR selected IS NULL OR p_owned_club_id IS NULL OR p_application_id IS NULL
 OR p_request_id IS NULL OR p_fee IS NULL OR p_occurrences IS NULL THEN
 RAISE EXCEPTION 'Current owner and complete residency terms required' USING ERRCODE='42501';END IF;
 SELECT * INTO owned FROM public.player_owned_nightclubs o
 WHERE o.id=p_owned_club_id AND o.profile_id=selected FOR UPDATE;
 IF NOT FOUND OR NOT owned.is_open OR NOT EXISTS(
 SELECT 1 FROM public.nightclub_purchase_receipts r
 WHERE r.id=owned.verified_purchase_id AND r.club_id=owned.club_id
 AND r.profile_id=selected AND r.user_id=actor) THEN
 RAISE EXCEPTION 'Receipt-verified open club owner required' USING ERRCODE='42501';END IF;
 SELECT * INTO prior FROM public.nightclub_dj_residencies r
 WHERE r.owner_user_id=actor AND r.owner_request_id=p_request_id;
 IF FOUND THEN
  IF prior.owned_club_id IS DISTINCT FROM p_owned_club_id OR
  prior.source_application_id IS DISTINCT FROM p_application_id OR
  prior.occurrence_count IS DISTINCT FROM p_occurrences OR
  prior.proposed_fee IS DISTINCT FROM p_fee THEN
  RAISE EXCEPTION 'Changed residency request reused' USING ERRCODE='23505';END IF;
  RETURN prior.id;
 END IF;
 IF p_occurrences NOT BETWEEN 2 AND 4 OR
 p_fee NOT BETWEEN 50 AND least(1250,greatest(250,250*owned.quality_level)) THEN
 RAISE EXCEPTION 'Residency duration or fee outside permitted tier' USING ERRCODE='22023';END IF;
 SELECT * INTO appl FROM public.dj_club_applications a
 WHERE a.id=p_application_id AND a.owned_club_id=owned.id AND a.club_id=owned.club_id FOR UPDATE;
 IF NOT FOUND OR appl.status<>'shortlisted' OR appl.user_id=actor THEN
 RAISE EXCEPTION 'Shortlisted DJ from another account required' USING ERRCODE='42501';END IF;
 IF appl.starts_at<=clock_timestamp()+interval '3 hours' OR
 appl.starts_at>clock_timestamp()+interval '14 days' THEN
 RAISE EXCEPTION 'First weekly set must be 3 hours to 14 days ahead' USING ERRCODE='22023';END IF;
 SELECT city.timezone,coalesce((club.dj_slot_config->>'set_length_minutes')::integer,45)
 INTO tz,minutes FROM public.city_night_clubs club
 JOIN public.cities city ON city.id=club.city_id WHERE club.id=owned.club_id;
 IF tz IS NULL OR btrim(tz)='' OR minutes NOT BETWEEN 15 AND 180 THEN
 RAISE EXCEPTION 'Club has no valid DJ local hours' USING ERRCODE='22023';END IF;
 local_start:=appl.starts_at AT TIME ZONE tz;
 FOR n IN 0..p_occurrences-1 LOOP
   wall:=local_start+make_interval(days=>7*n);
   moment:=wall AT TIME ZONE tz;
   IF (moment AT TIME ZONE tz) IS DISTINCT FROM wall OR NOT
   public.dj_booking_inside_club_hours(owned.club_id,moment,moment+make_interval(mins=>minutes))
   THEN RAISE EXCEPTION 'One residency date violates local club hours or DST' USING ERRCODE='22023';END IF;
   slots:=array_append(slots,moment);
 END LOOP;
 expiry:=least(clock_timestamp()+interval '48 hours',appl.starts_at-interval '1 hour');
 IF expiry<=clock_timestamp()+interval '10 minutes' THEN
 RAISE EXCEPTION 'Residency application window is too short' USING ERRCODE='22023';END IF;
 INSERT INTO public.nightclub_dj_residencies(
 owned_club_id,source_application_id,club_id,owner_user_id,owner_profile_id,
 dj_user_id,dj_profile_id,setlist_id,dj_display_name,setlist_name,venue_timezone,
 planned_starts_at,occurrence_count,proposed_fee,owner_request_id,expires_at)
 VALUES(owned.id,appl.id,owned.club_id,actor,selected,appl.user_id,appl.profile_id,
 appl.setlist_id,appl.dj_display_name,appl.setlist_name,tz,
 slots,p_occurrences,p_fee,p_request_id,expiry) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.propose_nightclub_dj_residency(uuid,uuid,integer,integer,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.propose_nightclub_dj_residency(uuid,uuid,integer,integer,uuid) TO authenticated;

CREATE FUNCTION public.respond_nightclub_dj_residency(
 p_residency_id uuid,p_action text,p_request_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=(select auth.uid());selected uuid:=public.current_active_player_profile_id();
 r public.nightclub_dj_residencies%ROWTYPE;prior public.nightclub_dj_residency_actions%ROWTYPE;
 next_status text;
BEGIN
 IF actor IS NULL OR selected IS NULL OR p_residency_id IS NULL OR p_request_id IS NULL
 OR p_action IS NULL OR p_action NOT IN ('accept','decline','withdraw','end') THEN
 RAISE EXCEPTION 'Current residency participant and decision required' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.nightclub_dj_residencies a WHERE a.id=p_residency_id FOR UPDATE;
 IF NOT FOUND OR NOT (
 (r.dj_user_id=actor AND r.dj_profile_id=selected)
 OR (r.owner_user_id=actor AND r.owner_profile_id=selected AND EXISTS(
 SELECT 1 FROM public.player_owned_nightclubs o
 JOIN public.nightclub_purchase_receipts receipt ON receipt.id=o.verified_purchase_id
 AND receipt.club_id=o.club_id AND receipt.profile_id=o.profile_id
 WHERE o.id=r.owned_club_id AND o.profile_id=selected AND receipt.user_id=actor))) THEN
 RAISE EXCEPTION 'Residency not owned by selected character' USING ERRCODE='42501';END IF;
 SELECT * INTO prior FROM public.nightclub_dj_residency_actions a
 WHERE a.actor_user_id=actor AND a.request_id=p_request_id;
 IF FOUND THEN
  IF prior.residency_id<>p_residency_id OR prior.action<>p_action THEN
   RAISE EXCEPTION 'Residency response key reused with new intent' USING ERRCODE='23505';END IF;
  RETURN jsonb_build_object('residency_id',r.id,'status',r.status,'replayed',true);
 END IF;
 IF p_action IN ('accept','decline') THEN
  IF actor<>r.dj_user_id OR r.status<>'proposed' OR clock_timestamp()>=r.expires_at THEN
   RAISE EXCEPTION 'Only named DJ may respond to a pending residency' USING ERRCODE='42501';END IF;
  next_status:=CASE WHEN p_action='accept' THEN 'agreed' ELSE 'declined' END;
 ELSIF p_action='withdraw' THEN
  IF actor<>r.owner_user_id OR r.status<>'proposed' THEN
   RAISE EXCEPTION 'Only owner may withdraw an unsigned residency' USING ERRCODE='42501';END IF;
  next_status:='ended';
 ELSE
  IF r.status<>'agreed' THEN
   RAISE EXCEPTION 'Only agreed residencies may be ended' USING ERRCODE='22023';END IF;
  next_status:='ended';
 END IF;
 UPDATE public.nightclub_dj_residencies SET status=next_status,updated_at=clock_timestamp(),
  agreed_at=CASE WHEN next_status='agreed' THEN clock_timestamp() ELSE agreed_at END,
  ended_at=CASE WHEN next_status='ended' THEN clock_timestamp() ELSE ended_at END
 WHERE id=r.id;
 INSERT INTO public.nightclub_dj_residency_actions(residency_id,actor_user_id,request_id,action)
 VALUES(r.id,actor,p_request_id,p_action);
 RETURN jsonb_build_object('residency_id',r.id,'status',next_status,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.respond_nightclub_dj_residency(uuid,text,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.respond_nightclub_dj_residency(uuid,text,uuid) TO authenticated;
COMMENT ON TABLE public.nightclub_dj_residencies IS
 'Mutual DJ residency schedule plan only, not a paid/confirmed booking. Each performance still needs separate escrow funded and canonical confirmed gig.';
