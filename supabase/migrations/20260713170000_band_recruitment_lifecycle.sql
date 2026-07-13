-- Complete band recruitment vacancies, applications, invitations, offers, notes and saved vacancies.

CREATE TABLE IF NOT EXISTS public.band_vacancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 120),
  short_description text CHECK (short_description IS NULL OR char_length(short_description) <= 240),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','paused','filled','closed','expired','cancelled')),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','friends','invite_only','band_network','private')),
  role_type text NOT NULL DEFAULT 'member',
  instrument text NOT NULL DEFAULT 'Other',
  secondary_instruments text[] NOT NULL DEFAULT '{}',
  genres text[] NOT NULL DEFAULT '{}',
  minimum_proficiency integer NOT NULL DEFAULT 0 CHECK (minimum_proficiency BETWEEN 0 AND 100),
  city_id uuid REFERENCES public.cities(id),
  remote_or_travel_allowed boolean NOT NULL DEFAULT false,
  commitment_level text NOT NULL DEFAULT 'flexible' CHECK (commitment_level IN ('casual','flexible','regular','serious','professional')),
  rehearsal_expectation text,
  gig_expectation text,
  touring_required boolean NOT NULL DEFAULT false,
  age_requirement text,
  fame_preference text,
  career_level_preference text,
  audition_required boolean NOT NULL DEFAULT false,
  direct_applications_allowed boolean NOT NULL DEFAULT true,
  application_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  positions_available integer NOT NULL DEFAULT 1 CHECK (positions_available BETWEEN 1 AND 20),
  positions_filled integer NOT NULL DEFAULT 0 CHECK (positions_filled >= 0),
  application_deadline timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CHECK (positions_filled <= positions_available)
);

ALTER TABLE public.band_applications ADD COLUMN IF NOT EXISTS vacancy_id uuid REFERENCES public.band_vacancies(id) ON DELETE SET NULL;
ALTER TABLE public.band_applications ADD COLUMN IF NOT EXISTS cover_message text;
ALTER TABLE public.band_applications ADD COLUMN IF NOT EXISTS question_answers jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.band_applications ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE public.band_applications ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.band_applications ADD COLUMN IF NOT EXISTS shortlisted_at timestamptz;
ALTER TABLE public.band_applications ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
ALTER TABLE public.band_applications ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz;

CREATE TABLE IF NOT EXISTS public.band_membership_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  vacancy_id uuid REFERENCES public.band_vacancies(id) ON DELETE SET NULL, application_id uuid REFERENCES public.band_applications(id) ON DELETE SET NULL,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, offered_by uuid REFERENCES public.profiles(id),
  role_type text NOT NULL DEFAULT 'member', instrument text NOT NULL DEFAULT 'Other', terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','withdrawn','expired','invalidated')),
  expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), responded_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.saved_band_vacancies (profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, vacancy_id uuid NOT NULL REFERENCES public.band_vacancies(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(profile_id, vacancy_id));
CREATE TABLE IF NOT EXISTS public.band_recruitment_candidates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE, vacancy_id uuid REFERENCES public.band_vacancies(id) ON DELETE SET NULL, player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, added_by uuid REFERENCES public.profiles(id), status text NOT NULL DEFAULT 'saved' CHECK (status IN ('saved','contacted','invited','applied','not_suitable','joined')), private_note text CHECK (private_note IS NULL OR char_length(private_note) <= 2000), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(band_id, vacancy_id, player_id));
CREATE TABLE IF NOT EXISTS public.band_recruitment_notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE, subject_type text NOT NULL CHECK (subject_type IN ('application','candidate','audition','offer','invitation','vacancy')), subject_id uuid NOT NULL, note text NOT NULL CHECK (char_length(btrim(note)) BETWEEN 1 AND 2000), created_by uuid REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now());

ALTER TABLE public.band_invitations ADD COLUMN IF NOT EXISTS vacancy_id uuid REFERENCES public.band_vacancies(id) ON DELETE SET NULL;
ALTER TABLE public.band_invitations ADD COLUMN IF NOT EXISTS role_type text NOT NULL DEFAULT 'member';
ALTER TABLE public.band_invitations ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.band_invitations ADD COLUMN IF NOT EXISTS viewed_at timestamptz;
ALTER TABLE public.band_invitations ADD COLUMN IF NOT EXISTS responded_at timestamptz;
ALTER TABLE public.band_invitations ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE public.band_invitations ADD COLUMN IF NOT EXISTS declined_at timestamptz;
ALTER TABLE public.band_invitations ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE INDEX IF NOT EXISTS band_vacancies_search_idx ON public.band_vacancies(status, visibility, instrument, commitment_level, application_deadline, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS band_applications_one_active_per_vacancy_idx ON public.band_applications(vacancy_id, applicant_profile_id) WHERE vacancy_id IS NOT NULL AND status IN ('draft','pending','submitted','under_review','shortlisted','audition_requested','offer_made');
CREATE UNIQUE INDEX IF NOT EXISTS band_offers_one_pending_idx ON public.band_membership_offers(band_id, recipient_id, role_type) WHERE status='pending';
CREATE INDEX IF NOT EXISTS band_recruitment_notes_subject_idx ON public.band_recruitment_notes(subject_type, subject_id);

CREATE OR REPLACE FUNCTION public.can_manage_band_recruitment(target_band_id uuid, actor_user_id uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.can_manage_band_invitations(target_band_id, actor_user_id)
    OR EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id=target_band_id AND bm.user_id=actor_user_id AND lower(bm.role) IN ('manager','recruiter') AND COALESCE(bm.member_status,'active')='active');
$$;

CREATE OR REPLACE FUNCTION public.band_vacancy_match_score(vacancy_id uuid, profile_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.band_vacancies; prof public.profiles; pp public.player_profiles; score int := 35; reasons text[] := '{}';
BEGIN
 SELECT * INTO v FROM public.band_vacancies WHERE id=vacancy_id; SELECT * INTO prof FROM public.profiles WHERE id=profile_id; SELECT * INTO pp FROM public.player_profiles WHERE profile_id=profile_id;
 IF v.id IS NULL OR prof.id IS NULL THEN RETURN jsonb_build_object('score',0,'category','unavailable','reasons',jsonb_build_array()); END IF;
 IF v.instrument IS NOT NULL AND (lower(pp.primary_instrument)=lower(v.instrument) OR lower(v.instrument) = ANY(SELECT lower(x) FROM unnest(COALESCE(pp.secondary_instruments,'{}'::text[])) x)) THEN score:=score+30; reasons:=array_append(reasons,'You play '||v.instrument); END IF;
 IF v.city_id IS NOT NULL AND prof.current_city_id=v.city_id THEN score:=score+15; reasons:=array_append(reasons,'Same city'); END IF;
 IF COALESCE(array_length(v.genres,1),0)>0 AND COALESCE(v.genres && COALESCE(pp.preferred_genres,'{}'::text[]), false) THEN score:=score+15; reasons:=array_append(reasons,'Matches your preferred genres'); END IF;
 IF v.remote_or_travel_allowed THEN score:=score+5; reasons:=array_append(reasons,'Travel or remote collaboration allowed'); END IF;
 RETURN jsonb_build_object('score', LEAST(score,100), 'category', CASE WHEN score>=80 THEN 'excellent' WHEN score>=60 THEN 'strong' WHEN score>=40 THEN 'possible' ELSE 'low' END, 'reasons', to_jsonb(reasons));
END; $$;

CREATE OR REPLACE FUNCTION public.create_band_vacancy(target_band_id uuid, vacancy_payload jsonb, publish boolean DEFAULT false) RETURNS public.band_vacancies LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor_profile uuid; row public.band_vacancies; qcount int;
BEGIN
 SELECT id INTO actor_profile FROM public.profiles WHERE user_id=auth.uid() ORDER BY created_at LIMIT 1;
 IF actor_profile IS NULL THEN RAISE EXCEPTION 'Sign in with an active player profile.' USING ERRCODE='28000'; END IF;
 IF NOT public.can_manage_band_recruitment(target_band_id, auth.uid()) THEN RAISE EXCEPTION 'You are not allowed to manage recruitment for this band.' USING ERRCODE='42501'; END IF;
 qcount := jsonb_array_length(COALESCE(vacancy_payload->'application_questions','[]'::jsonb)); IF qcount > 8 THEN RAISE EXCEPTION 'A vacancy can have at most 8 application questions.'; END IF;
 INSERT INTO public.band_vacancies(band_id,title,short_description,description,status,visibility,role_type,instrument,genres,city_id,remote_or_travel_allowed,commitment_level,rehearsal_expectation,gig_expectation,touring_required,audition_required,direct_applications_allowed,application_questions,positions_available,application_deadline,created_by)
 VALUES(target_band_id, btrim(vacancy_payload->>'title'), nullif(btrim(coalesce(vacancy_payload->>'short_description','')),''), btrim(coalesce(vacancy_payload->>'description','')), CASE WHEN publish THEN 'open' ELSE 'draft' END, coalesce(vacancy_payload->>'visibility','public'), coalesce(vacancy_payload->>'role_type','member'), coalesce(vacancy_payload->>'instrument','Other'), COALESCE(ARRAY(SELECT jsonb_array_elements_text(vacancy_payload->'genres')), '{}'), nullif(vacancy_payload->>'city_id','')::uuid, coalesce((vacancy_payload->>'remote_or_travel_allowed')::boolean,false), coalesce(vacancy_payload->>'commitment_level','flexible'), vacancy_payload->>'rehearsal_expectation', vacancy_payload->>'gig_expectation', coalesce((vacancy_payload->>'touring_required')::boolean,false), coalesce((vacancy_payload->>'audition_required')::boolean,false), coalesce((vacancy_payload->>'direct_applications_allowed')::boolean,true), COALESCE(vacancy_payload->'application_questions','[]'::jsonb), greatest(1, coalesce((vacancy_payload->>'positions_available')::int,1)), nullif(vacancy_payload->>'application_deadline','')::timestamptz, actor_profile) RETURNING * INTO row;
 RETURN row;
END; $$;

CREATE OR REPLACE FUNCTION public.submit_band_vacancy_application(target_vacancy_id uuid, cover text DEFAULT '', answers jsonb DEFAULT '{}'::jsonb) RETURNS public.band_applications LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor_profile uuid; v public.band_vacancies; app public.band_applications;
BEGIN
 SELECT id INTO actor_profile FROM public.profiles WHERE user_id=auth.uid() ORDER BY created_at LIMIT 1; IF actor_profile IS NULL THEN RAISE EXCEPTION 'Sign in with an active player profile.'; END IF;
 SELECT * INTO v FROM public.band_vacancies WHERE id=target_vacancy_id FOR UPDATE; IF v.id IS NULL OR v.status <> 'open' OR v.visibility NOT IN ('public','friends','band_network') OR NOT v.direct_applications_allowed THEN RAISE EXCEPTION 'This vacancy is not open for applications.'; END IF;
 IF v.application_deadline IS NOT NULL AND v.application_deadline < now() THEN UPDATE public.band_vacancies SET status='expired', closed_at=now() WHERE id=v.id; RAISE EXCEPTION 'The application deadline has passed.'; END IF;
 IF EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id=v.band_id AND (bm.user_id=auth.uid() OR bm.profile_id=actor_profile) AND COALESCE(bm.member_status,'active')='active') THEN RAISE EXCEPTION 'You already belong to this band.'; END IF;
 SELECT * INTO app FROM public.band_applications WHERE vacancy_id=v.id AND applicant_profile_id=actor_profile AND status IN ('draft','pending','submitted','under_review','shortlisted','audition_requested','offer_made') LIMIT 1;
 IF app.id IS NULL THEN
   INSERT INTO public.band_applications(vacancy_id,band_id,applicant_profile_id,instrument_role,message,cover_message,question_answers,status,submitted_at)
   VALUES(v.id,v.band_id,actor_profile,v.instrument,left(coalesce(cover,''),500),left(coalesce(cover,''),2000),coalesce(answers,'{}'::jsonb),'submitted',now())
   RETURNING * INTO app;
 END IF;
 INSERT INTO public.notifications(user_id, profile_id, category, type, title, message, action_path, metadata)
 SELECT bm.user_id, bm.profile_id, 'band', 'band_request', 'New band application', 'A player applied to your vacancy.', '/bands/'||v.band_id||'/recruitment', jsonb_build_object('band_vacancy_id',v.id,'band_application_id',app.id) FROM public.band_members bm WHERE bm.band_id=v.band_id AND public.can_manage_band_recruitment(v.band_id,bm.user_id);
 RETURN app;
END; $$;

CREATE OR REPLACE FUNCTION public.update_band_application_stage(application_id uuid, next_status text) RETURNS public.band_applications LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE app public.band_applications; s text := lower(btrim(next_status));
BEGIN
 SELECT * INTO app FROM public.band_applications WHERE id=application_id FOR UPDATE; IF app.id IS NULL THEN RAISE EXCEPTION 'Application not found.'; END IF;
 IF NOT public.can_manage_band_recruitment(app.band_id, auth.uid()) THEN RAISE EXCEPTION 'You are not allowed to update this application.' USING ERRCODE='42501'; END IF;
 IF s NOT IN ('under_review','shortlisted','audition_requested','offer_made','rejected','cancelled') THEN RAISE EXCEPTION 'Invalid application status.'; END IF;
 UPDATE public.band_applications SET status=s, reviewed_at=COALESCE(reviewed_at,now()), shortlisted_at=CASE WHEN s='shortlisted' THEN now() ELSE shortlisted_at END, rejected_at=CASE WHEN s='rejected' THEN now() ELSE rejected_at END, responded_at=CASE WHEN s IN ('rejected','cancelled') THEN now() ELSE responded_at END WHERE id=application_id RETURNING * INTO app; RETURN app;
END; $$;

CREATE OR REPLACE FUNCTION public.accept_band_offer(offer_id uuid) RETURNS public.band_members LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor_profile uuid; offer public.band_membership_offers; uid uuid; member public.band_members; v public.band_vacancies;
BEGIN
 SELECT id,user_id INTO actor_profile,uid FROM public.profiles WHERE user_id=auth.uid() ORDER BY created_at LIMIT 1; SELECT * INTO offer FROM public.band_membership_offers WHERE id=offer_id FOR UPDATE;
 IF offer.id IS NULL OR offer.recipient_id<>actor_profile OR offer.status<>'pending' THEN RAISE EXCEPTION 'This offer is no longer available.'; END IF;
 IF offer.expires_at IS NOT NULL AND offer.expires_at < now() THEN UPDATE public.band_membership_offers SET status='expired', responded_at=now() WHERE id=offer.id; RAISE EXCEPTION 'This offer has expired.'; END IF;
 IF EXISTS (SELECT 1 FROM public.band_members WHERE band_id=offer.band_id AND (user_id=uid OR profile_id=actor_profile) AND COALESCE(member_status,'active')='active') THEN RAISE EXCEPTION 'You already belong to this band.'; END IF;
 INSERT INTO public.band_members(band_id,user_id,profile_id,role,instrument_role,member_status) VALUES(offer.band_id,uid,actor_profile,offer.role_type,offer.instrument,'active') RETURNING * INTO member;
 UPDATE public.band_membership_offers SET status='accepted', responded_at=now() WHERE id=offer.id; UPDATE public.band_applications SET status='accepted', responded_at=now() WHERE id=offer.application_id;
 IF offer.vacancy_id IS NOT NULL THEN UPDATE public.band_vacancies SET positions_filled=positions_filled+1, status=CASE WHEN positions_filled+1>=positions_available THEN 'filled' ELSE status END, closed_at=CASE WHEN positions_filled+1>=positions_available THEN now() ELSE closed_at END WHERE id=offer.vacancy_id RETURNING * INTO v; END IF;
 RETURN member;
END; $$;

ALTER TABLE public.band_vacancies ENABLE ROW LEVEL SECURITY; ALTER TABLE public.band_membership_offers ENABLE ROW LEVEL SECURITY; ALTER TABLE public.saved_band_vacancies ENABLE ROW LEVEL SECURITY; ALTER TABLE public.band_recruitment_candidates ENABLE ROW LEVEL SECURITY; ALTER TABLE public.band_recruitment_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public open vacancies are discoverable" ON public.band_vacancies FOR SELECT TO authenticated USING ((status='open' AND visibility='public') OR public.can_manage_band_recruitment(band_id, auth.uid()));
CREATE POLICY "Vacancies managed by rpc" ON public.band_vacancies FOR ALL TO authenticated USING (public.can_manage_band_recruitment(band_id, auth.uid())) WITH CHECK (public.can_manage_band_recruitment(band_id, auth.uid()));
CREATE POLICY "Offer participants can read" ON public.band_membership_offers FOR SELECT TO authenticated USING (recipient_id IN (SELECT id FROM public.profiles WHERE user_id=auth.uid()) OR public.can_manage_band_recruitment(band_id, auth.uid()));
CREATE POLICY "Saved vacancies owner access" ON public.saved_band_vacancies FOR ALL TO authenticated USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id=auth.uid())) WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id=auth.uid()));
CREATE POLICY "Recruiters manage candidates" ON public.band_recruitment_candidates FOR ALL TO authenticated USING (public.can_manage_band_recruitment(band_id, auth.uid())) WITH CHECK (public.can_manage_band_recruitment(band_id, auth.uid()));
CREATE POLICY "Recruiters read notes" ON public.band_recruitment_notes FOR SELECT TO authenticated USING (public.can_manage_band_recruitment(band_id, auth.uid()));
CREATE POLICY "Recruiters insert notes" ON public.band_recruitment_notes FOR INSERT TO authenticated WITH CHECK (public.can_manage_band_recruitment(band_id, auth.uid()));

GRANT EXECUTE ON FUNCTION public.can_manage_band_recruitment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.band_vacancy_match_score(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_band_vacancy(uuid, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_band_vacancy_application(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_band_application_stage(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_band_offer(uuid) TO authenticated;
