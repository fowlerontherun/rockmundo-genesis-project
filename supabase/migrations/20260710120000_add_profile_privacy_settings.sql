BEGIN;

CREATE TYPE public.profile_visibility_scope AS ENUM ('public', 'friends', 'private');
CREATE TYPE public.profile_dm_permission AS ENUM ('everyone', 'friends', 'none');

CREATE TABLE public.profile_privacy_settings (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_visibility public.profile_visibility_scope NOT NULL DEFAULT 'public',
  city_visibility public.profile_visibility_scope NOT NULL DEFAULT 'friends',
  activity_visibility public.profile_visibility_scope NOT NULL DEFAULT 'friends',
  online_status_visibility public.profile_visibility_scope NOT NULL DEFAULT 'private',
  relationship_visibility public.profile_visibility_scope NOT NULL DEFAULT 'friends',
  dm_permission public.profile_dm_permission NOT NULL DEFAULT 'friends',
  allow_band_invites boolean NOT NULL DEFAULT true,
  allow_company_invites boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.profile_privacy_settings IS 'Owner-managed social visibility and contact preferences used by profile, discovery, messaging, and recruitment guards.';
COMMENT ON COLUMN public.profile_privacy_settings.online_status_visibility IS 'Defaults private; social presence is opt-in before per-player online status is exposed.';
COMMENT ON COLUMN public.profile_privacy_settings.dm_permission IS 'Preference consumed by future direct-message send guards. Blocking still takes precedence.';

CREATE INDEX profile_privacy_settings_dm_permission_idx
  ON public.profile_privacy_settings (dm_permission);
CREATE INDEX profile_privacy_settings_invites_idx
  ON public.profile_privacy_settings (allow_band_invites, allow_company_invites);

ALTER TABLE public.profile_privacy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profile owners can view their privacy settings"
  ON public.profile_privacy_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_privacy_settings.profile_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Profile owners can create their privacy settings"
  ON public.profile_privacy_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_privacy_settings.profile_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Profile owners can update their privacy settings"
  ON public.profile_privacy_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_privacy_settings.profile_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_privacy_settings.profile_id
        AND p.user_id = auth.uid()
    )
  );

CREATE TRIGGER update_profile_privacy_settings_updated_at
  BEFORE UPDATE ON public.profile_privacy_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE VIEW public.public_profile_privacy_settings AS
SELECT
  profile_id,
  profile_visibility,
  dm_permission,
  allow_band_invites,
  allow_company_invites
FROM public.profile_privacy_settings;

GRANT SELECT ON public.public_profile_privacy_settings TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.profile_belongs_to_current_user(target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = target_profile_id
      AND p.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.are_profiles_blocked(first_profile_id uuid, second_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'blocked'::public.friendship_status
      AND (
        (f.requestor_id = first_profile_id AND f.addressee_id = second_profile_id)
        OR (f.requestor_id = second_profile_id AND f.addressee_id = first_profile_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_profile_receive_dm(sender_profile_id uuid, recipient_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH settings AS (
    SELECT COALESCE(
      (SELECT pps.dm_permission FROM public.profile_privacy_settings pps WHERE pps.profile_id = recipient_profile_id),
      'friends'::public.profile_dm_permission
    ) AS dm_permission
  )
  SELECT
    sender_profile_id IS NOT NULL
    AND recipient_profile_id IS NOT NULL
    AND sender_profile_id <> recipient_profile_id
    AND NOT public.are_profiles_blocked(sender_profile_id, recipient_profile_id)
    AND (
      (SELECT dm_permission FROM settings) = 'everyone'::public.profile_dm_permission
      OR (
        (SELECT dm_permission FROM settings) = 'friends'::public.profile_dm_permission
        AND EXISTS (
          SELECT 1
          FROM public.friendships f
          WHERE f.status = 'accepted'::public.friendship_status
            AND (
              (f.requestor_id = sender_profile_id AND f.addressee_id = recipient_profile_id)
              OR (f.requestor_id = recipient_profile_id AND f.addressee_id = sender_profile_id)
            )
        )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.profile_belongs_to_current_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_profiles_blocked(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_profile_receive_dm(uuid, uuid) TO authenticated;

COMMIT;
