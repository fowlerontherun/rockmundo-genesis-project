-- Band governance proposals, voting and execution foundation.
CREATE TABLE IF NOT EXISTS public.band_governance_settings (
  band_id uuid PRIMARY KEY REFERENCES public.bands(id) ON DELETE CASCADE,
  default_voting_duration_hours integer NOT NULL DEFAULT 72 CHECK (default_voting_duration_hours BETWEEN 1 AND 720),
  default_quorum_type text NOT NULL DEFAULT 'percentage' CHECK (default_quorum_type IN ('none','fixed','percentage','all')),
  default_quorum_value numeric NOT NULL DEFAULT 50 CHECK (default_quorum_value >= 0),
  default_approval_threshold numeric NOT NULL DEFAULT 0.5 CHECK (default_approval_threshold > 0 AND default_approval_threshold <= 1),
  votes_visibility text NOT NULL DEFAULT 'hidden_until_close' CHECK (votes_visibility IN ('public','hidden_until_close','anonymous','leaders_only')),
  votes_changeable boolean NOT NULL DEFAULT true,
  discussion_enabled boolean NOT NULL DEFAULT true,
  trial_members_may_vote boolean NOT NULL DEFAULT false,
  leaders_have_veto boolean NOT NULL DEFAULT false,
  early_resolution_enabled boolean NOT NULL DEFAULT true,
  minimum_membership_age interval NOT NULL DEFAULT interval '0 seconds',
  proposal_creation_roles text[] NOT NULL DEFAULT ARRAY['leader','founder','manager','recruiter'],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.band_proposal_type_policies (
  proposal_type text PRIMARY KEY,
  category text NOT NULL,
  voting_method text NOT NULL CHECK (voting_method IN ('simple_majority','supermajority','unanimous','fixed_approvals','leader_approval','owner_approval')),
  approval_threshold numeric NOT NULL CHECK (approval_threshold > 0 AND approval_threshold <= 1),
  quorum_type text NOT NULL CHECK (quorum_type IN ('none','fixed','percentage','all')),
  quorum_value numeric NOT NULL DEFAULT 0 CHECK (quorum_value >= 0),
  eligible_voter_rule text NOT NULL DEFAULT 'all_non_trial_members',
  mandatory_minimum boolean NOT NULL DEFAULT false,
  requires_execution boolean NOT NULL DEFAULT true,
  platform_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.band_proposal_type_policies (proposal_type, category, voting_method, approval_threshold, quorum_type, quorum_value, mandatory_minimum, platform_notes) VALUES
('accept_applicant','membership','simple_majority',0.5,'percentage',50,false,'Recruitment acceptance is revalidated against active application state.'),
('remove_member','membership','supermajority',0.6667,'percentage',66,true,'Target may be excluded by conflict policy; historical credits and payments remain.'),
('appoint_band_leader','membership','supermajority',0.6667,'percentage',50,true,'Leadership changes require execution through membership role services.'),
('accept_gig','gigs_tours','simple_majority',0.5,'percentage',50,false,'Gig availability, schedule and fee are revalidated at execution.'),
('book_tour','gigs_tours','simple_majority',0.5,'percentage',50,false,'Tour dates and travel conflicts are revalidated.'),
('purchase_equipment','finance','supermajority',0.6667,'percentage',50,true,'Available band balance is rechecked at execution.'),
('approve_expense','finance','simple_majority',0.5,'percentage',50,false,'Expense beneficiary conflict rules may exclude voters.'),
('change_revenue_split','finance','unanimous',1,'all',100,true,'Applies prospectively and requires affected-member consent.'),
('approve_release','creative','simple_majority',0.5,'percentage',50,false,'Recording and tracklist remain protected by credit ownership rules.'),
('approve_campaign','publicity_merch','simple_majority',0.5,'percentage',50,false,'Campaign budget is revalidated.'),
('change_voting_rules','governance','supermajority',0.6667,'percentage',66,true,'Bands cannot weaken platform mandatory minimums.'),
('transfer_ownership','governance','owner_approval',1,'all',100,true,'Requires current owner and recipient confirmation.'),
('disband_band','governance','owner_approval',0.75,'percentage',75,true,'Open proposals are cancelled when a band disbands.')
ON CONFLICT (proposal_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.band_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  proposal_type text NOT NULL REFERENCES public.band_proposal_type_policies(proposal_type),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 140 AND title !~ '<[^>]+>'),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 8000 AND description !~ '<[^>]+>'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','passed','rejected','withdrawn','cancelled','expired','executing','executed','execution_failed','invalidated')),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  related_entity_type text,
  related_entity_id uuid,
  discussion_enabled boolean NOT NULL DEFAULT true,
  voting_method text NOT NULL CHECK (voting_method IN ('simple_majority','supermajority','unanimous','fixed_approvals','leader_approval','owner_approval')),
  approval_threshold numeric NOT NULL CHECK (approval_threshold > 0),
  quorum_type text NOT NULL CHECK (quorum_type IN ('none','fixed','percentage','all')),
  quorum_value numeric NOT NULL DEFAULT 0 CHECK (quorum_value >= 0),
  eligible_voter_rule jsonb NOT NULL DEFAULT '{"type":"all_non_trial_members"}'::jsonb,
  votes_visibility text NOT NULL DEFAULT 'hidden_until_close' CHECK (votes_visibility IN ('public','hidden_until_close','anonymous','leaders_only')),
  votes_changeable boolean NOT NULL DEFAULT true,
  early_resolution_enabled boolean NOT NULL DEFAULT true,
  opens_at timestamptz,
  closes_at timestamptz,
  passed_at timestamptz,
  rejected_at timestamptz,
  executed_at timestamptz,
  execution_error text,
  execution_idempotency_key text GENERATED ALWAYS AS ('band-proposal:' || id::text) STORED,
  result_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status <> 'open') OR (opens_at IS NOT NULL AND closes_at IS NOT NULL AND closes_at > opens_at))
);

CREATE TABLE IF NOT EXISTS public.band_proposal_eligible_voters (
  proposal_id uuid NOT NULL REFERENCES public.band_proposals(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  member_id uuid REFERENCES public.band_members(id) ON DELETE SET NULL,
  role text,
  eligible boolean NOT NULL DEFAULT true,
  exclusion_reason text,
  snapshotted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.band_proposal_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.band_proposals(id) ON DELETE CASCADE,
  voter_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  voter_user_id uuid NOT NULL,
  choice text NOT NULL CHECK (choice IN ('yes','no','abstain')),
  is_active boolean NOT NULL DEFAULT true,
  changed_from_vote_id uuid REFERENCES public.band_proposal_votes(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.band_proposal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.band_proposals(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.band_proposal_comments(id) ON DELETE CASCADE,
  author_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000 AND body !~ '<[^>]+>'),
  deleted_at timestamptz,
  moderated_at timestamptz,
  report_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_comment_id IS NULL OR parent_comment_id <> id)
);

CREATE TABLE IF NOT EXISTS public.band_proposal_execution_records (
  proposal_id uuid PRIMARY KEY REFERENCES public.band_proposals(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('pending','executing','executed','failed','invalidated')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  executed_domain text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.band_proposal_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES public.band_proposals(id) ON DELETE CASCADE,
  band_id uuid REFERENCES public.bands(id) ON DELETE CASCADE,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_band_proposals_band_status_deadline ON public.band_proposals(band_id, status, closes_at);
CREATE INDEX IF NOT EXISTS idx_band_proposals_open_deadlines ON public.band_proposals(closes_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_band_proposal_voters_user ON public.band_proposal_eligible_voters(user_id, proposal_id) WHERE eligible;
CREATE UNIQUE INDEX IF NOT EXISTS idx_band_proposal_one_active_vote ON public.band_proposal_votes(proposal_id, voter_profile_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_band_proposal_votes_summary ON public.band_proposal_votes(proposal_id, choice) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_band_proposal_comments_page ON public.band_proposal_comments(proposal_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_band_proposal_audit_band ON public.band_proposal_audit_events(band_id, created_at DESC);

ALTER TABLE public.band_governance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_proposal_type_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_proposal_eligible_voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_proposal_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_proposal_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_proposal_execution_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_proposal_audit_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_active_band_member(target_band_id uuid, actor_user_id uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = target_band_id AND bm.user_id = actor_user_id AND COALESCE(bm.is_touring_member, false) = false);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_band_governance(target_band_id uuid, actor_user_id uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = target_band_id AND bm.user_id = actor_user_id AND COALESCE(bm.is_touring_member, false) = false AND COALESCE(bm.role, '') IN ('leader','founder','manager','recruiter'));
$$;

CREATE POLICY "members view governance settings" ON public.band_governance_settings FOR SELECT USING (public.is_active_band_member(band_id, auth.uid()));
CREATE POLICY "managers update governance settings" ON public.band_governance_settings FOR UPDATE USING (public.can_manage_band_governance(band_id, auth.uid())) WITH CHECK (public.can_manage_band_governance(band_id, auth.uid()));
CREATE POLICY "proposal policies readable" ON public.band_proposal_type_policies FOR SELECT USING (true);
CREATE POLICY "members view non-draft proposals" ON public.band_proposals FOR SELECT USING (public.is_active_band_member(band_id, auth.uid()) AND (status <> 'draft' OR created_by IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()) OR public.can_manage_band_governance(band_id, auth.uid())));
CREATE POLICY "eligible voters readable to members" ON public.band_proposal_eligible_voters FOR SELECT USING (EXISTS (SELECT 1 FROM public.band_proposals bp WHERE bp.id = proposal_id AND public.is_active_band_member(bp.band_id, auth.uid())));
CREATE POLICY "votes privacy aware read" ON public.band_proposal_votes FOR SELECT USING (EXISTS (SELECT 1 FROM public.band_proposals bp WHERE bp.id = proposal_id AND public.is_active_band_member(bp.band_id, auth.uid()) AND (bp.votes_visibility = 'public' OR bp.status <> 'open' OR voter_user_id = auth.uid() OR public.can_manage_band_governance(bp.band_id, auth.uid()))));
CREATE POLICY "comments readable to members" ON public.band_proposal_comments FOR SELECT USING (EXISTS (SELECT 1 FROM public.band_proposals bp WHERE bp.id = proposal_id AND public.is_active_band_member(bp.band_id, auth.uid())));
CREATE POLICY "execution records readable to managers" ON public.band_proposal_execution_records FOR SELECT USING (EXISTS (SELECT 1 FROM public.band_proposals bp WHERE bp.id = proposal_id AND public.can_manage_band_governance(bp.band_id, auth.uid())));
CREATE POLICY "audit readable to members" ON public.band_proposal_audit_events FOR SELECT USING (public.is_active_band_member(band_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.create_band_proposal(proposal_input jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_profile uuid; target_band uuid; ptype text; policy record; settings record; new_id uuid; desired_status text; duration_hours integer;
BEGIN
  SELECT id INTO actor_profile FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  target_band := (proposal_input->>'band_id')::uuid; ptype := proposal_input->>'proposal_type'; desired_status := COALESCE(proposal_input->>'status','draft');
  IF actor_profile IS NULL OR target_band IS NULL OR NOT public.can_manage_band_governance(target_band, auth.uid()) THEN RAISE EXCEPTION 'not_authorised'; END IF;
  IF desired_status NOT IN ('draft','open') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  SELECT * INTO policy FROM public.band_proposal_type_policies WHERE proposal_type = ptype; IF policy.proposal_type IS NULL THEN RAISE EXCEPTION 'invalid_proposal_type'; END IF;
  SELECT * INTO settings FROM public.band_governance_settings WHERE band_id = target_band;
  duration_hours := COALESCE((proposal_input #>> '{policy,votingDurationHours}')::integer, settings.default_voting_duration_hours, 72);
  INSERT INTO public.band_proposals (band_id, proposal_type, title, description, status, created_by, action_payload, discussion_enabled, voting_method, approval_threshold, quorum_type, quorum_value, eligible_voter_rule, votes_visibility, votes_changeable, early_resolution_enabled, opens_at, closes_at)
  VALUES (target_band, ptype, left(coalesce(proposal_input->>'title',''),140), coalesce(proposal_input->>'description',''), desired_status, actor_profile, coalesce(proposal_input->'action_payload','{}'::jsonb), coalesce((proposal_input->>'discussion_enabled')::boolean, true), policy.voting_method, policy.approval_threshold, policy.quorum_type, policy.quorum_value, jsonb_build_object('type', policy.eligible_voter_rule), coalesce(settings.votes_visibility,'hidden_until_close'), coalesce(settings.votes_changeable,true), coalesce(settings.early_resolution_enabled,true), CASE WHEN desired_status='open' THEN now() END, CASE WHEN desired_status='open' THEN now() + make_interval(hours => duration_hours) END)
  RETURNING id INTO new_id;
  IF desired_status = 'open' THEN
    INSERT INTO public.band_proposal_eligible_voters (proposal_id, profile_id, user_id, member_id, role)
    SELECT new_id, COALESCE(bm.profile_id, p.id), bm.user_id, bm.id, bm.role FROM public.band_members bm LEFT JOIN public.profiles p ON p.user_id = bm.user_id WHERE bm.band_id = target_band AND bm.user_id IS NOT NULL AND COALESCE(bm.is_touring_member,false)=false AND COALESCE(bm.profile_id, p.id) IS NOT NULL;
    INSERT INTO public.notifications(user_id, profile_id, category, type, title, message, action_path, metadata)
    SELECT ev.user_id, ev.profile_id, 'band', 'band_governance_vote_required', 'Band vote required', 'A band proposal is open for voting.', '/bands/' || target_band || '/governance/proposals/' || new_id, jsonb_build_object('band_id', target_band, 'proposal_id', new_id)
    FROM public.band_proposal_eligible_voters ev WHERE ev.proposal_id = new_id AND ev.user_id <> auth.uid();
  END IF;
  INSERT INTO public.band_proposal_audit_events(proposal_id, band_id, actor_profile_id, event_type, metadata) VALUES (new_id, target_band, actor_profile, 'proposal_' || desired_status, jsonb_build_object('proposal_type', ptype));
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.cast_band_proposal_vote(target_proposal_id uuid, vote_choice text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_profile uuid; proposal record; voter record; old_vote uuid; yes_count int; no_count int; abstain_count int; eligible_count int;
BEGIN
  IF vote_choice NOT IN ('yes','no','abstain') THEN RAISE EXCEPTION 'invalid_vote_choice'; END IF;
  SELECT id INTO actor_profile FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  SELECT * INTO proposal FROM public.band_proposals WHERE id = target_proposal_id FOR UPDATE;
  IF proposal.id IS NULL OR proposal.status <> 'open' OR proposal.closes_at <= now() THEN RAISE EXCEPTION 'proposal_not_open'; END IF;
  SELECT * INTO voter FROM public.band_proposal_eligible_voters WHERE proposal_id = target_proposal_id AND profile_id = actor_profile AND eligible;
  IF voter.profile_id IS NULL OR NOT public.is_active_band_member(proposal.band_id, auth.uid()) THEN RAISE EXCEPTION 'not_eligible_to_vote'; END IF;
  SELECT id INTO old_vote FROM public.band_proposal_votes WHERE proposal_id = target_proposal_id AND voter_profile_id = actor_profile AND is_active FOR UPDATE;
  IF old_vote IS NOT NULL AND NOT proposal.votes_changeable THEN RAISE EXCEPTION 'vote_updates_disabled'; END IF;
  IF old_vote IS NOT NULL THEN UPDATE public.band_proposal_votes SET is_active = false, updated_at = now() WHERE id = old_vote; END IF;
  INSERT INTO public.band_proposal_votes(proposal_id, voter_profile_id, voter_user_id, choice, changed_from_vote_id) VALUES (target_proposal_id, actor_profile, auth.uid(), vote_choice, old_vote);
  SELECT count(*) FILTER (WHERE choice='yes'), count(*) FILTER (WHERE choice='no'), count(*) FILTER (WHERE choice='abstain') INTO yes_count, no_count, abstain_count FROM public.band_proposal_votes WHERE proposal_id = target_proposal_id AND is_active;
  SELECT count(*) INTO eligible_count FROM public.band_proposal_eligible_voters WHERE proposal_id = target_proposal_id AND eligible;
  UPDATE public.band_proposals SET result_snapshot = jsonb_build_object('yes', yes_count, 'no', no_count, 'abstain', abstain_count, 'eligible', eligible_count), updated_at = now() WHERE id = target_proposal_id;
  INSERT INTO public.band_proposal_audit_events(proposal_id, band_id, actor_profile_id, event_type, metadata) VALUES (target_proposal_id, proposal.band_id, actor_profile, CASE WHEN old_vote IS NULL THEN 'vote_cast' ELSE 'vote_updated' END, jsonb_build_object('choice', vote_choice));
  RETURN jsonb_build_object('yes', yes_count, 'no', no_count, 'abstain', abstain_count, 'eligible', eligible_count);
END; $$;

CREATE OR REPLACE FUNCTION public.list_band_governance_dashboard(target_band_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', bp.id, 'band_id', bp.band_id, 'proposal_type', bp.proposal_type, 'title', bp.title, 'status', bp.status, 'created_by', bp.created_by, 'closes_at', bp.closes_at, 'executed_at', bp.executed_at, 'execution_error', bp.execution_error, 'vote_summary', COALESCE(bp.result_snapshot, '{}'::jsonb), 'viewer_has_voted', EXISTS (SELECT 1 FROM public.band_proposal_votes v WHERE v.proposal_id = bp.id AND v.voter_user_id = auth.uid() AND v.is_active), 'viewer_action_required', EXISTS (SELECT 1 FROM public.band_proposal_eligible_voters ev WHERE ev.proposal_id = bp.id AND ev.user_id = auth.uid() AND ev.eligible) AND bp.status = 'open' AND NOT EXISTS (SELECT 1 FROM public.band_proposal_votes v WHERE v.proposal_id = bp.id AND v.voter_user_id = auth.uid() AND v.is_active)) ORDER BY bp.updated_at DESC), '[]'::jsonb)
  FROM public.band_proposals bp WHERE bp.band_id = target_band_id AND public.is_active_band_member(target_band_id, auth.uid()) AND (bp.status <> 'draft' OR bp.created_by IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR public.can_manage_band_governance(target_band_id, auth.uid()));
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_band_governance(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_band_proposal(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cast_band_proposal_vote(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_band_governance_dashboard(uuid) TO authenticated;

ALTER TABLE public.band_proposals REPLICA IDENTITY FULL;
ALTER TABLE public.band_proposal_votes REPLICA IDENTITY FULL;
ALTER TABLE public.band_proposal_comments REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='band_proposals') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.band_proposals; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='band_proposal_votes') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.band_proposal_votes; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='band_proposal_comments') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.band_proposal_comments; END IF;
END $$;
