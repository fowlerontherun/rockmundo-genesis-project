-- Create supporting tables for advanced band membership management

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

ALTER TABLE public.band_membership_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_membership_status_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_band_membership_roles_band_id
  ON public.band_membership_roles (band_id);

CREATE INDEX IF NOT EXISTS idx_band_membership_status_history_member
  ON public.band_membership_status_history (member_id, changed_at DESC);

CREATE POLICY "Band members can view membership roles" ON public.band_membership_roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id = band_membership_roles.band_id
        AND bm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.bands b
      WHERE b.id = band_membership_roles.band_id
        AND b.leader_id = auth.uid()
    )
  );

CREATE POLICY "Band leaders manage membership roles" ON public.band_membership_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.bands b
      WHERE b.id = band_membership_roles.band_id
        AND b.leader_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bands b
      WHERE b.id = band_membership_roles.band_id
        AND b.leader_id = auth.uid()
    )
  );

CREATE POLICY "Band members can view membership history" ON public.band_membership_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id = band_membership_status_history.band_id
        AND bm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.bands b
      WHERE b.id = band_membership_status_history.band_id
        AND b.leader_id = auth.uid()
    )
  );

CREATE POLICY "Band leaders manage membership history" ON public.band_membership_status_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.bands b
      WHERE b.id = band_membership_status_history.band_id
        AND b.leader_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bands b
      WHERE b.id = band_membership_status_history.band_id
        AND b.leader_id = auth.uid()
    )
  );
