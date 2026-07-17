-- Phase A · Batch 1: safe new-table migrations from pending backlog.
-- Combines: 20261101090000_ensure_schedule_events_schema, 20290702095000_create_community_charity_tables,
-- 20290702120000_create_band_membership_management. Adds missing GRANTs.

-- ============ schedule_events ============
CREATE TABLE IF NOT EXISTS public.schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL,
  date date NOT NULL,
  time time without time zone NOT NULL,
  location text NOT NULL,
  status text NOT NULL DEFAULT 'upcoming',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_events
  ADD COLUMN IF NOT EXISTS reminder_minutes integer,
  ADD COLUMN IF NOT EXISTS recurrence_rule text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS energy_cost integer,
  ADD COLUMN IF NOT EXISTS last_notified timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

UPDATE public.schedule_events SET duration_minutes = 60 WHERE duration_minutes IS NULL;

ALTER TABLE public.schedule_events
  ALTER COLUMN duration_minutes SET DEFAULT 60,
  ALTER COLUMN duration_minutes SET NOT NULL,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

ALTER TABLE public.schedule_events DROP CONSTRAINT IF EXISTS schedule_events_metadata_is_object;
ALTER TABLE public.schedule_events ADD CONSTRAINT schedule_events_metadata_is_object
  CHECK (metadata IS NULL OR jsonb_typeof(metadata) = 'object');

UPDATE public.schedule_events SET status = 'upcoming' WHERE status = 'scheduled';

ALTER TABLE public.schedule_events DROP CONSTRAINT IF EXISTS schedule_events_type_check;
ALTER TABLE public.schedule_events ADD CONSTRAINT schedule_events_type_check
  CHECK (type IN ('gig', 'recording', 'rehearsal', 'meeting', 'tour'));
ALTER TABLE public.schedule_events DROP CONSTRAINT IF EXISTS schedule_events_status_check;
ALTER TABLE public.schedule_events ADD CONSTRAINT schedule_events_status_check
  CHECK (status IN ('upcoming', 'in_progress', 'completed', 'cancelled'));
ALTER TABLE public.schedule_events DROP CONSTRAINT IF EXISTS schedule_events_reminder_minutes_check;
ALTER TABLE public.schedule_events ADD CONSTRAINT schedule_events_reminder_minutes_check
  CHECK (reminder_minutes IS NULL OR reminder_minutes >= 0);
ALTER TABLE public.schedule_events DROP CONSTRAINT IF EXISTS schedule_events_duration_minutes_check;
ALTER TABLE public.schedule_events ADD CONSTRAINT schedule_events_duration_minutes_check
  CHECK (duration_minutes > 0);
ALTER TABLE public.schedule_events DROP CONSTRAINT IF EXISTS schedule_events_energy_cost_check;
ALTER TABLE public.schedule_events ADD CONSTRAINT schedule_events_energy_cost_check
  CHECK (energy_cost IS NULL OR energy_cost >= 0);

CREATE INDEX IF NOT EXISTS schedule_events_user_id_idx ON public.schedule_events (user_id);
CREATE INDEX IF NOT EXISTS schedule_events_date_idx ON public.schedule_events (user_id, date);

CREATE OR REPLACE FUNCTION public.update_schedule_events_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS update_schedule_events_updated_at ON public.schedule_events;
CREATE TRIGGER update_schedule_events_updated_at BEFORE UPDATE ON public.schedule_events
  FOR EACH ROW EXECUTE FUNCTION public.update_schedule_events_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_events TO authenticated;
GRANT ALL ON public.schedule_events TO service_role;

ALTER TABLE public.schedule_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their schedule events" ON public.schedule_events;
CREATE POLICY "Users can view their schedule events" ON public.schedule_events FOR SELECT
  USING (auth.uid() = user_id OR auth.role() IN ('service_role','supabase_admin'));
DROP POLICY IF EXISTS "Users can create their schedule events" ON public.schedule_events;
CREATE POLICY "Users can create their schedule events" ON public.schedule_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their schedule events" ON public.schedule_events;
CREATE POLICY "Users can update their schedule events" ON public.schedule_events FOR UPDATE
  USING (auth.uid() = user_id OR auth.role() IN ('service_role','supabase_admin'))
  WITH CHECK (auth.uid() = user_id OR auth.role() IN ('service_role','supabase_admin'));
DROP POLICY IF EXISTS "Users can delete their schedule events" ON public.schedule_events;
CREATE POLICY "Users can delete their schedule events" ON public.schedule_events FOR DELETE
  USING (auth.uid() = user_id);

-- ============ community charity ============
CREATE TABLE IF NOT EXISTS public.community_charity_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  beneficiary TEXT NOT NULL,
  goal_amount NUMERIC(12,2) NOT NULL CHECK (goal_amount >= 0),
  impact_focus TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_charity_impact_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.community_charity_campaigns(id) ON DELETE CASCADE,
  metric_label TEXT NOT NULL,
  metric_value NUMERIC(12,2) NOT NULL,
  metric_unit TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_charity_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.community_charity_campaigns(id) ON DELETE CASCADE,
  donor_name TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  donated_at TIMESTAMPTZ DEFAULT now(),
  message TEXT
);

CREATE INDEX IF NOT EXISTS community_charity_campaigns_slug_idx ON public.community_charity_campaigns (slug);
CREATE INDEX IF NOT EXISTS community_charity_campaigns_status_idx ON public.community_charity_campaigns (status);
CREATE INDEX IF NOT EXISTS community_charity_impact_metrics_campaign_id_idx ON public.community_charity_impact_metrics (campaign_id);
CREATE INDEX IF NOT EXISTS community_charity_donations_campaign_id_idx ON public.community_charity_donations (campaign_id);
CREATE INDEX IF NOT EXISTS community_charity_donations_donated_at_idx ON public.community_charity_donations (donated_at);

GRANT SELECT ON public.community_charity_campaigns TO anon, authenticated;
GRANT SELECT ON public.community_charity_impact_metrics TO anon, authenticated;
GRANT SELECT ON public.community_charity_donations TO anon, authenticated;
GRANT ALL ON public.community_charity_campaigns, public.community_charity_impact_metrics, public.community_charity_donations TO service_role;

ALTER TABLE public.community_charity_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_charity_impact_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_charity_donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access to charity campaigns" ON public.community_charity_campaigns;
CREATE POLICY "Public access to charity campaigns" ON public.community_charity_campaigns FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public access to charity metrics" ON public.community_charity_impact_metrics;
CREATE POLICY "Public access to charity metrics" ON public.community_charity_impact_metrics FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public access to charity donations" ON public.community_charity_donations;
CREATE POLICY "Public access to charity donations" ON public.community_charity_donations FOR SELECT USING (true);

-- ============ band membership roles/history ============
CREATE TABLE IF NOT EXISTS public.band_membership_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  role_code text NOT NULL CHECK (char_length(role_code) > 0),
  display_name text NOT NULL CHECK (char_length(display_name) > 0),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (band_id, role_code)
);

CREATE TABLE IF NOT EXISTS public.band_membership_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.band_members(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (char_length(status) > 0),
  notes text,
  changed_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  changed_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_band_membership_roles_band_id ON public.band_membership_roles (band_id);
CREATE INDEX IF NOT EXISTS idx_band_membership_status_history_member ON public.band_membership_status_history (member_id, changed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.band_membership_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.band_membership_status_history TO authenticated;
GRANT ALL ON public.band_membership_roles, public.band_membership_status_history TO service_role;

ALTER TABLE public.band_membership_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_membership_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can view membership roles" ON public.band_membership_roles;
CREATE POLICY "Band members can view membership roles" ON public.band_membership_roles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = band_membership_roles.band_id AND bm.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.bands b WHERE b.id = band_membership_roles.band_id AND b.leader_id = auth.uid())
);
DROP POLICY IF EXISTS "Band leaders manage membership roles" ON public.band_membership_roles;
CREATE POLICY "Band leaders manage membership roles" ON public.band_membership_roles FOR ALL
  USING (EXISTS (SELECT 1 FROM public.bands b WHERE b.id = band_membership_roles.band_id AND b.leader_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bands b WHERE b.id = band_membership_roles.band_id AND b.leader_id = auth.uid()));

DROP POLICY IF EXISTS "Band members can view membership history" ON public.band_membership_status_history;
CREATE POLICY "Band members can view membership history" ON public.band_membership_status_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = band_membership_status_history.band_id AND bm.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.bands b WHERE b.id = band_membership_status_history.band_id AND b.leader_id = auth.uid())
);
DROP POLICY IF EXISTS "Band leaders manage membership history" ON public.band_membership_status_history;
CREATE POLICY "Band leaders manage membership history" ON public.band_membership_status_history FOR ALL
  USING (EXISTS (SELECT 1 FROM public.bands b WHERE b.id = band_membership_status_history.band_id AND b.leader_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bands b WHERE b.id = band_membership_status_history.band_id AND b.leader_id = auth.uid()));