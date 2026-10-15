-- Production reconciliation, 15 October 2026 (issue #4072).
-- Safe, additive subset of the absent historical profile privacy migration.
-- Intentionally DO NOT replace existing social SECURITY DEFINER functions
-- and DO NOT enable the later direct-message/friend-request enforcement triggers.
-- The public-named view below is invoker-secured; it only returns the
-- requesting authenticated player's rows until a separately reviewed
-- privacy-safe public read model has been approved.
DO $create_types$
BEGIN
  IF to_regtype('public.profile_visibility_scope') IS NULL THEN
    CREATE TYPE public.profile_visibility_scope AS ENUM ('public','friends','private');
  END IF;
  IF to_regtype('public.profile_dm_permission') IS NULL THEN
    CREATE TYPE public.profile_dm_permission AS ENUM
      ('everyone','friends','none','friends_and_band','existing_conversations');
  END IF;
END;
$create_types$;

CREATE TABLE IF NOT EXISTS public.profile_privacy_settings (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_visibility public.profile_visibility_scope NOT NULL DEFAULT 'public',
  city_visibility public.profile_visibility_scope NOT NULL DEFAULT 'friends',
  activity_visibility public.profile_visibility_scope NOT NULL DEFAULT 'friends',
  online_status_visibility public.profile_visibility_scope NOT NULL DEFAULT 'private',
  relationship_visibility public.profile_visibility_scope NOT NULL DEFAULT 'friends',
  dm_permission public.profile_dm_permission NOT NULL DEFAULT 'friends',
  allow_band_invites boolean NOT NULL DEFAULT true,
  allow_company_invites boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_privacy_settings_dm_permission_idx
  ON public.profile_privacy_settings(dm_permission);
CREATE INDEX IF NOT EXISTS profile_privacy_settings_invites_idx
  ON public.profile_privacy_settings(allow_band_invites,allow_company_invites);

ALTER TABLE public.profile_privacy_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_privacy_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.profile_privacy_settings TO authenticated;
GRANT USAGE ON TYPE public.profile_visibility_scope TO authenticated;
GRANT USAGE ON TYPE public.profile_dm_permission TO authenticated;

CREATE POLICY "profile_privacy_owner_select_20261015"
  ON public.profile_privacy_settings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id=profile_privacy_settings.profile_id AND p.user_id=(SELECT auth.uid())));
CREATE POLICY "profile_privacy_owner_insert_20261015"
  ON public.profile_privacy_settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id=profile_privacy_settings.profile_id AND p.user_id=(SELECT auth.uid())));
CREATE POLICY "profile_privacy_owner_update_20261015"
  ON public.profile_privacy_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id=profile_privacy_settings.profile_id AND p.user_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id=profile_privacy_settings.profile_id AND p.user_id=(SELECT auth.uid())));

CREATE TRIGGER update_profile_privacy_settings_updated_at
  BEFORE UPDATE ON public.profile_privacy_settings FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE VIEW public.public_profile_privacy_settings
  WITH (security_invoker=true) AS
  SELECT profile_id,profile_visibility,dm_permission,
    allow_band_invites,allow_company_invites
  FROM public.profile_privacy_settings;
REVOKE ALL ON public.public_profile_privacy_settings FROM PUBLIC,anon;
GRANT SELECT ON public.public_profile_privacy_settings TO authenticated;
NOTIFY pgrst,'reload schema';
