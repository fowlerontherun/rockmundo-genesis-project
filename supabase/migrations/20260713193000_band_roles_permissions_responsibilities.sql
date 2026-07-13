-- Band roles, scoped permissions, temporary delegations, trial review and approval foundation.
-- Existing model inspected: bands.leader_id is the current controlling owner/leader,
-- band_members.role is a legacy membership role, band_members.instrument_role/vocal_role
-- represent musical positions, and recruitment/gig/rehearsal RLS frequently checks leader/founder strings.
-- This migration extends that authority model rather than replacing it: leader_id remains the
-- active owner/controller while founder is preserved as historical membership role metadata.

CREATE TABLE IF NOT EXISTS public.band_permission_catalogue (
  permission_key text PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('membership','scheduling','gigs_tours','creative','finance','publicity','merch','administration')),
  label text NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('low','standard','sensitive','critical')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.band_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid REFERENCES public.bands(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  role_type text NOT NULL,
  display_colour text,
  display_icon text,
  is_system boolean NOT NULL DEFAULT false,
  is_protected boolean NOT NULL DEFAULT false,
  is_primary_leadership boolean NOT NULL DEFAULT false,
  risk_level text NOT NULL DEFAULT 'standard' CHECK (risk_level IN ('low','standard','sensitive','critical')),
  sort_order integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT band_roles_system_band_scope CHECK ((is_system AND band_id IS NULL) OR (NOT is_system AND band_id IS NOT NULL)),
  CONSTRAINT band_roles_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS band_roles_system_role_type_uidx ON public.band_roles (role_type) WHERE is_system AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS band_roles_band_name_uidx ON public.band_roles (band_id, lower(name)) WHERE band_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS band_roles_band_active_idx ON public.band_roles (band_id, active, sort_order) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.band_role_permissions (
  role_id uuid NOT NULL REFERENCES public.band_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.band_permission_catalogue(permission_key) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (role_id, permission_key)
);
CREATE INDEX IF NOT EXISTS band_role_permissions_lookup_idx ON public.band_role_permissions (permission_key, role_id);

CREATE TABLE IF NOT EXISTS public.band_member_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.band_members(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.band_roles(id) ON DELETE RESTRICT,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  removed_at timestamptz,
  removal_reason text,
  CONSTRAINT band_member_roles_expiry_check CHECK (expires_at IS NULL OR expires_at > starts_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS band_member_roles_active_uidx ON public.band_member_roles (member_id, role_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS band_member_roles_member_active_idx ON public.band_member_roles (band_id, member_id, starts_at, expires_at) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS band_member_roles_expiring_idx ON public.band_member_roles (expires_at) WHERE removed_at IS NULL AND expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.band_member_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.band_members(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.band_permission_catalogue(permission_key) ON DELETE RESTRICT,
  effect text NOT NULL CHECK (effect IN ('allow','deny')),
  reason text,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS band_member_permission_overrides_active_uidx ON public.band_member_permission_overrides (member_id, permission_key) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS band_member_permission_overrides_resolution_idx ON public.band_member_permission_overrides (band_id, member_id, permission_key, effect) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS band_member_permission_overrides_expiring_idx ON public.band_member_permission_overrides (expires_at) WHERE revoked_at IS NULL AND expires_at IS NOT NULL;

ALTER TABLE public.band_members
  ADD COLUMN IF NOT EXISTS leadership_role text,
  ADD COLUMN IF NOT EXISTS trial_status text CHECK (trial_status IS NULL OR trial_status IN ('active','passed','extended','failed','withdrawn')),
  ADD COLUMN IF NOT EXISTS trial_start timestamptz,
  ADD COLUMN IF NOT EXISTS trial_end timestamptz,
  ADD COLUMN IF NOT EXISTS trial_review_date timestamptz,
  ADD COLUMN IF NOT EXISTS trial_sponsor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trial_notes text;

CREATE TABLE IF NOT EXISTS public.band_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  action_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled','expired','executed','failed')),
  required_policy text NOT NULL CHECK (required_policy IN ('single_authorised','leader_approval','owner_approval','two_authorised','majority','unanimous')),
  required_approvals integer NOT NULL DEFAULT 1 CHECK (required_approvals > 0),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS band_approval_requests_band_status_idx ON public.band_approval_requests (band_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.band_approval_responses (
  approval_request_id uuid NOT NULL REFERENCES public.band_approval_requests(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.band_members(id) ON DELETE CASCADE,
  response text NOT NULL CHECK (response IN ('approve','reject')),
  comment text,
  responded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (approval_request_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.band_governance_settings (
  band_id uuid PRIMARY KEY REFERENCES public.bands(id) ON DELETE CASCADE,
  assign_standard_roles_policy text NOT NULL DEFAULT 'leader_approval',
  assign_sensitive_roles_policy text NOT NULL DEFAULT 'owner_approval',
  finance_actions_need_approval boolean NOT NULL DEFAULT true,
  new_members_start_on_trial boolean NOT NULL DEFAULT false,
  default_trial_length_days integer NOT NULL DEFAULT 14 CHECK (default_trial_length_days BETWEEN 1 AND 180),
  internal_roles_publicly_visible boolean NOT NULL DEFAULT false,
  members_can_view_audit_history boolean NOT NULL DEFAULT false,
  leader_approval_required_for_recruitment boolean NOT NULL DEFAULT true,
  two_person_approval_large_spending boolean NOT NULL DEFAULT true,
  role_expiry_notifications_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.band_role_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_member_id uuid REFERENCES public.band_members(id) ON DELETE SET NULL,
  action text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS band_role_audit_log_band_created_idx ON public.band_role_audit_log (band_id, created_at DESC);

INSERT INTO public.band_permission_catalogue(permission_key, category, label, risk_level) VALUES
('membership.view_roster','membership','View full member roster','low'),('membership.invite_player','membership','Invite player','standard'),('membership.review_applications','membership','Review applications','standard'),('membership.send_offer','membership','Send membership offer','standard'),('membership.remove_member','membership','Remove member','sensitive'),('membership.approve_departure','membership','Approve member departure','sensitive'),('membership.manage_trials','membership','Manage trial members','standard'),('membership.change_positions','membership','Change musical positions','standard'),('membership.assign_responsibilities','membership','Assign responsibilities','sensitive'),
('scheduling.create_rehearsal','scheduling','Create rehearsal','standard'),('scheduling.edit_rehearsal','scheduling','Edit rehearsal','standard'),('scheduling.cancel_rehearsal','scheduling','Cancel rehearsal','sensitive'),('scheduling.create_jam','scheduling','Create jam session','standard'),('scheduling.schedule_activity','scheduling','Schedule band activity','standard'),('scheduling.manage_attendance','scheduling','Manage attendance','standard'),('scheduling.view_private','scheduling','View private band schedule','low'),
('gigs.apply','gigs_tours','Apply for gig','standard'),('gigs.accept','gigs_tours','Accept gig','sensitive'),('gigs.decline','gigs_tours','Decline gig','sensitive'),('gigs.prepare','gigs_tours','Create gig preparation','standard'),('gigs.edit_setlist','gigs_tours','Edit setlist','standard'),('tours.schedule','gigs_tours','Schedule tour','sensitive'),('tours.edit','gigs_tours','Edit tour','standard'),('tours.cancel','gigs_tours','Cancel tour','critical'),('tours.book_transport','gigs_tours','Book transport','sensitive'),('tours.book_accommodation','gigs_tours','Book accommodation','sensitive'),
('creative.propose_song','creative','Propose song','low'),('creative.approve_song','creative','Approve band song','sensitive'),('creative.manage_songwriting','creative','Manage songwriting session','standard'),('creative.assign_contributors','creative','Assign song contributors','standard'),('creative.approve_recording','creative','Approve recording','sensitive'),('creative.select_studio','creative','Select recording studio','standard'),('creative.approve_release','creative','Approve release','sensitive'),('creative.manage_credits','creative','Manage credits','sensitive'),('creative.manage_repertoire','creative','Manage repertoire','standard'),
('finance.view_summary','finance','View summary finances','standard'),('finance.view_transactions','finance','View full transaction history','sensitive'),('finance.approve_expense','finance','Approve expense','sensitive'),('finance.make_payment','finance','Make payment','critical'),('finance.set_spending_limits','finance','Set spending limits','critical'),('finance.manage_revenue_splits','finance','Manage revenue splits','critical'),('finance.manage_budget','finance','Manage band budget','sensitive'),('finance.purchase_equipment','finance','Purchase equipment','sensitive'),('finance.sell_assets','finance','Sell band assets','sensitive'),
('publicity.edit_profile','publicity','Edit band profile','low'),('publicity.post_updates','publicity','Post band updates','standard'),('publicity.manage_twaater','publicity','Manage Twaater account','standard'),('publicity.manage_campaigns','publicity','Manage publicity campaigns','standard'),('publicity.update_recruitment','publicity','Update recruitment status','standard'),('publicity.manage_fans','publicity','Manage fan communications','standard'),
('merch.create','merch','Create merchandise','standard'),('merch.set_prices','merch','Set prices','sensitive'),('merch.order_stock','merch','Order stock','sensitive'),('merch.manage_inventory','merch','Manage inventory','standard'),('merch.view_finances','merch','View merch finances','sensitive'),
('admin.manage_roles','administration','Manage roles','sensitive'),('admin.manage_permissions','administration','Manage permissions','critical'),('admin.transfer_ownership','administration','Transfer ownership','critical'),('admin.change_settings','administration','Change band settings','sensitive'),('admin.disband','administration','Disband band','critical'),('admin.view_audit','administration','View audit history','sensitive')
ON CONFLICT (permission_key) DO UPDATE SET label = EXCLUDED.label, category = EXCLUDED.category, risk_level = EXCLUDED.risk_level;



INSERT INTO public.band_roles(name, description, role_type, is_system, is_protected, is_primary_leadership, risk_level, sort_order) VALUES
('Founder','Historical creator marker; not permanently authoritative by itself.','founder',true,true,false,'low',10),
('Band leader','Broad active operational control without ownership-transfer powers.','band_leader',true,true,true,'sensitive',20),
('Co-leader','Shared leadership for sensitive operations and day-to-day control.','co_leader',true,false,true,'sensitive',30),
('Manager','Recruitment, scheduling, gigs, tours and publicity without ownership or unrestricted finance.','manager',true,false,false,'sensitive',40),
('Musical director','Repertoire, setlists, song approvals, rehearsal planning and recording preparation.','musical_director',true,false,false,'sensitive',50),
('Recruitment manager','Vacancies, applications, invitations and trial-member management.','recruitment_manager',true,false,false,'standard',60),
('Booking manager','Gig applications, offer responses, venue communication and tour scheduling.','booking_manager',true,false,false,'sensitive',70),
('Tour manager','Tour planning, logistics, transport, accommodation and attendance coordination.','tour_manager',true,false,false,'sensitive',80),
('Finance manager','Reports, budgets, expense approval and limited payments; no ownership control.','finance_manager',true,false,false,'sensitive',90),
('Recording manager','Recording approvals, studios, sessions and release preparation.','recording_manager',true,false,false,'sensitive',100),
('Songwriting coordinator','Song pipeline, collaboration sessions and contributor assignments.','songwriting_coordinator',true,false,false,'standard',110),
('Publicity manager','Public profile, social posts, campaigns and fan announcements.','publicity_manager',true,false,false,'standard',120),
('Merch manager','Products, sale prices, stock orders, inventory and merch performance.','merch_manager',true,false,false,'sensitive',130),
('Member','Ordinary member access to roster, private schedule and creative proposals.','member',true,false,false,'low',140),
('Trial member','Limited rehearsal and internal access while under review.','trial_member',true,false,false,'low',150)
ON CONFLICT (role_type) WHERE is_system AND deleted_at IS NULL DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, risk_level=EXCLUDED.risk_level, sort_order=EXCLUDED.sort_order;

INSERT INTO public.band_role_permissions(role_id, permission_key)
SELECT br.id, pc.permission_key
FROM public.band_roles br
JOIN public.band_permission_catalogue pc ON (
  (br.role_type = 'band_leader' AND pc.risk_level <> 'critical') OR
  (br.role_type = 'co_leader' AND pc.risk_level <> 'critical' AND pc.permission_key <> 'finance.view_transactions') OR
  (br.role_type = 'member' AND pc.permission_key IN ('membership.view_roster','scheduling.view_private','creative.propose_song')) OR
  (br.role_type = 'trial_member' AND pc.permission_key IN ('scheduling.view_private','creative.propose_song')) OR
  (br.role_type = 'recruitment_manager' AND pc.permission_key IN ('membership.invite_player','membership.review_applications','membership.send_offer','membership.manage_trials','publicity.update_recruitment')) OR
  (br.role_type = 'booking_manager' AND pc.permission_key IN ('gigs.apply','gigs.accept','gigs.decline','gigs.prepare','tours.schedule','tours.edit')) OR
  (br.role_type = 'tour_manager' AND pc.permission_key IN ('tours.schedule','tours.edit','tours.book_transport','tours.book_accommodation','scheduling.manage_attendance')) OR
  (br.role_type = 'finance_manager' AND pc.permission_key IN ('finance.view_summary','finance.view_transactions','finance.approve_expense','finance.manage_budget','finance.purchase_equipment')) OR
  (br.role_type = 'musical_director' AND pc.permission_key IN ('creative.approve_song','creative.manage_songwriting','creative.assign_contributors','creative.select_studio','creative.manage_repertoire','gigs.edit_setlist','scheduling.create_rehearsal','scheduling.edit_rehearsal')) OR
  (br.role_type = 'recording_manager' AND pc.permission_key IN ('creative.approve_recording','creative.select_studio','creative.approve_release','creative.manage_credits')) OR
  (br.role_type = 'songwriting_coordinator' AND pc.permission_key IN ('creative.propose_song','creative.manage_songwriting','creative.assign_contributors')) OR
  (br.role_type = 'publicity_manager' AND pc.permission_key IN ('publicity.edit_profile','publicity.post_updates','publicity.manage_twaater','publicity.manage_campaigns','publicity.update_recruitment','publicity.manage_fans')) OR
  (br.role_type = 'merch_manager' AND pc.permission_key IN ('merch.create','merch.set_prices','merch.order_stock','merch.manage_inventory','merch.view_finances'))
)
WHERE br.is_system
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_band_owner(p_band_id uuid, p_user_id uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.bands b WHERE b.id = p_band_id AND b.leader_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_active_band_member(p_band_id uuid, p_user_id uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = p_band_id AND bm.user_id = p_user_id AND COALESCE(bm.member_status, 'active') = 'active');
$$;

CREATE OR REPLACE FUNCTION public.member_has_band_permission(p_band_id uuid, p_user_id uuid, p_permission_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH member_row AS (
    SELECT bm.id FROM public.band_members bm WHERE bm.band_id = p_band_id AND bm.user_id = p_user_id AND COALESCE(bm.member_status, 'active') = 'active' LIMIT 1
  ), denied AS (
    SELECT 1 FROM member_row mr JOIN public.band_member_permission_overrides o ON o.member_id = mr.id WHERE o.permission_key = p_permission_key AND o.effect = 'deny' AND o.revoked_at IS NULL AND (o.expires_at IS NULL OR o.expires_at > now())
  )
  SELECT public.is_band_owner(p_band_id, p_user_id)
    OR (EXISTS (SELECT 1 FROM member_row) AND NOT EXISTS (SELECT 1 FROM denied) AND (
      EXISTS (SELECT 1 FROM member_row mr JOIN public.band_member_permission_overrides o ON o.member_id = mr.id WHERE o.permission_key = p_permission_key AND o.effect = 'allow' AND o.revoked_at IS NULL AND (o.expires_at IS NULL OR o.expires_at > now()))
      OR EXISTS (SELECT 1 FROM member_row mr JOIN public.band_member_roles bmr ON bmr.member_id = mr.id JOIN public.band_role_permissions brp ON brp.role_id = bmr.role_id JOIN public.band_roles br ON br.id = bmr.role_id WHERE brp.permission_key = p_permission_key AND br.active AND br.deleted_at IS NULL AND bmr.removed_at IS NULL AND bmr.starts_at <= now() AND (bmr.expires_at IS NULL OR bmr.expires_at > now()))
    ));
$$;

ALTER TABLE public.band_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_member_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_member_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_approval_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_governance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_role_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_permission_catalogue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permission catalogue is authenticated readable" ON public.band_permission_catalogue FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "band members can view roles" ON public.band_roles FOR SELECT USING (band_id IS NULL OR public.is_active_band_member(band_id, auth.uid()));
CREATE POLICY "role managers can manage roles" ON public.band_roles FOR ALL USING (band_id IS NOT NULL AND public.member_has_band_permission(band_id, auth.uid(), 'admin.manage_roles')) WITH CHECK (band_id IS NOT NULL AND public.member_has_band_permission(band_id, auth.uid(), 'admin.manage_roles'));
CREATE POLICY "band members can view role permissions" ON public.band_role_permissions FOR SELECT USING (EXISTS (SELECT 1 FROM public.band_roles br WHERE br.id = role_id AND (br.band_id IS NULL OR public.is_active_band_member(br.band_id, auth.uid()))));
CREATE POLICY "permission managers can manage role permissions" ON public.band_role_permissions FOR ALL USING (EXISTS (SELECT 1 FROM public.band_roles br WHERE br.id = role_id AND br.band_id IS NOT NULL AND public.member_has_band_permission(br.band_id, auth.uid(), 'admin.manage_permissions'))) WITH CHECK (EXISTS (SELECT 1 FROM public.band_roles br WHERE br.id = role_id AND br.band_id IS NOT NULL AND public.member_has_band_permission(br.band_id, auth.uid(), 'admin.manage_permissions')));
CREATE POLICY "band members can view member roles" ON public.band_member_roles FOR SELECT USING (public.is_active_band_member(band_id, auth.uid()));
CREATE POLICY "responsibility managers can manage assignments" ON public.band_member_roles FOR ALL USING (public.member_has_band_permission(band_id, auth.uid(), 'membership.assign_responsibilities')) WITH CHECK (public.member_has_band_permission(band_id, auth.uid(), 'membership.assign_responsibilities'));
CREATE POLICY "permission managers can view overrides" ON public.band_member_permission_overrides FOR SELECT USING (public.member_has_band_permission(band_id, auth.uid(), 'admin.manage_permissions'));
CREATE POLICY "permission managers can manage overrides" ON public.band_member_permission_overrides FOR ALL USING (public.member_has_band_permission(band_id, auth.uid(), 'admin.manage_permissions')) WITH CHECK (public.member_has_band_permission(band_id, auth.uid(), 'admin.manage_permissions'));
CREATE POLICY "band members can view approvals" ON public.band_approval_requests FOR SELECT USING (public.is_active_band_member(band_id, auth.uid()));
CREATE POLICY "authorised members can create approvals" ON public.band_approval_requests FOR INSERT WITH CHECK (public.is_active_band_member(band_id, auth.uid()));
CREATE POLICY "band members can view approval responses" ON public.band_approval_responses FOR SELECT USING (EXISTS (SELECT 1 FROM public.band_approval_requests r WHERE r.id = approval_request_id AND public.is_active_band_member(r.band_id, auth.uid())));
CREATE POLICY "band members can respond to approvals" ON public.band_approval_responses FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.band_approval_requests r JOIN public.band_members bm ON bm.band_id = r.band_id WHERE r.id = approval_request_id AND bm.id = member_id AND bm.user_id = auth.uid() AND r.status = 'pending'));
CREATE POLICY "band members can view governance settings" ON public.band_governance_settings FOR SELECT USING (public.is_active_band_member(band_id, auth.uid()));
CREATE POLICY "settings managers can update governance settings" ON public.band_governance_settings FOR ALL USING (public.member_has_band_permission(band_id, auth.uid(), 'admin.change_settings')) WITH CHECK (public.member_has_band_permission(band_id, auth.uid(), 'admin.change_settings'));
CREATE POLICY "audit viewers can view band role audit" ON public.band_role_audit_log FOR SELECT USING (public.member_has_band_permission(band_id, auth.uid(), 'admin.view_audit'));
