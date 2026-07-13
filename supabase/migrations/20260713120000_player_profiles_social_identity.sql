BEGIN;

ALTER TYPE public.profile_visibility_scope ADD VALUE IF NOT EXISTS 'band_members';

DO $$ BEGIN
  CREATE TYPE public.profile_skill_visibility AS ENUM ('exact', 'broad', 'hidden');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.player_profiles (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  biography text CHECK (char_length(biography) <= 1000),
  primary_instrument text CHECK (char_length(primary_instrument) <= 40),
  secondary_instruments text[] NOT NULL DEFAULT '{}'::text[],
  preferred_genres text[] NOT NULL DEFAULT '{}'::text[],
  preferred_roles text[] NOT NULL DEFAULT '{}'::text[],
  vocal_capability text CHECK (char_length(vocal_capability) <= 40),
  songwriting_specialisms text[] NOT NULL DEFAULT '{}'::text[],
  status_message text CHECK (char_length(status_message) <= 140),
  looking_for_band boolean NOT NULL DEFAULT false,
  looking_for_members boolean NOT NULL DEFAULT false,
  available_for_session_work boolean NOT NULL DEFAULT false,
  available_for_collaboration boolean NOT NULL DEFAULT false,
  available_for_gigs boolean NOT NULL DEFAULT false,
  available_for_employment boolean NOT NULL DEFAULT false,
  available_for_teaching boolean NOT NULL DEFAULT false,
  available_for_social boolean NOT NULL DEFAULT false,
  open_to_work_status text CHECK (char_length(open_to_work_status) <= 60),
  open_to_band_status text CHECK (char_length(open_to_band_status) <= 60),
  visibility public.profile_visibility_scope NOT NULL DEFAULT 'public',
  skill_visibility public.profile_skill_visibility NOT NULL DEFAULT 'broad',
  show_online_status boolean NOT NULL DEFAULT false,
  show_last_active boolean NOT NULL DEFAULT false,
  show_city boolean NOT NULL DEFAULT true,
  show_schedule_availability boolean NOT NULL DEFAULT false,
  show_skills boolean NOT NULL DEFAULT true,
  show_career_history boolean NOT NULL DEFAULT true,
  show_employment boolean NOT NULL DEFAULT true,
  show_activity boolean NOT NULL DEFAULT true,
  show_achievements boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.player_profile_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_key text NOT NULL,
  label text NOT NULL,
  description text,
  awarded_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  awarded_by uuid,
  UNIQUE(profile_id, badge_key)
);

CREATE TABLE IF NOT EXISTS public.player_profile_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  summary text NOT NULL CHECK (char_length(summary) <= 240),
  related_type text,
  related_id uuid,
  is_public boolean NOT NULL DEFAULT true,
  occurred_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.player_career_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  milestone_type text NOT NULL,
  summary text NOT NULL CHECK (char_length(summary) <= 240),
  is_public boolean NOT NULL DEFAULT true,
  achieved_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS player_profiles_search_idx ON public.player_profiles (visibility, primary_instrument, looking_for_band, available_for_session_work, available_for_employment);
CREATE INDEX IF NOT EXISTS player_profile_badges_profile_idx ON public.player_profile_badges (profile_id, awarded_at DESC);
CREATE INDEX IF NOT EXISTS player_profile_activity_public_idx ON public.player_profile_activity (profile_id, is_public, occurred_at DESC);
CREATE INDEX IF NOT EXISTS player_career_milestones_public_idx ON public.player_career_milestones (profile_id, is_public, achieved_at DESC);

ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_profile_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_profile_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_career_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage player social profiles" ON public.player_profiles FOR ALL USING (public.profile_belongs_to_current_user(profile_id)) WITH CHECK (public.profile_belongs_to_current_user(profile_id));
CREATE POLICY "Public player social profiles read through RPC" ON public.player_profiles FOR SELECT USING (visibility = 'public' OR public.profile_belongs_to_current_user(profile_id));
CREATE POLICY "Public badges are readable" ON public.player_profile_badges FOR SELECT USING (true);
CREATE POLICY "Public profile activity is readable" ON public.player_profile_activity FOR SELECT USING (is_public OR public.profile_belongs_to_current_user(profile_id));
CREATE POLICY "Public career milestones are readable" ON public.player_career_milestones FOR SELECT USING (is_public OR public.profile_belongs_to_current_user(profile_id));

CREATE TRIGGER update_player_profiles_updated_at BEFORE UPDATE ON public.player_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.can_view_social_profile(actor_profile_id uuid, target_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_view_public_profile_summary(actor_profile_id, target_profile_id)
    AND COALESCE((SELECT visibility FROM public.player_profiles WHERE profile_id = target_profile_id), 'public'::public.profile_visibility_scope) <> 'private';
$$;

DROP FUNCTION IF EXISTS public.get_public_profile_detail(uuid, uuid);

CREATE FUNCTION public.get_public_profile_detail(target_profile_id uuid, viewer_profile_id uuid DEFAULT NULL)
RETURNS TABLE (profile_id uuid, user_id uuid, username text, display_name text, avatar_url text, bio text, fame integer, fans integer, level integer, city_name text, created_at timestamptz, bands jsonb, social_profile jsonb, badges jsonb, public_activity jsonb, career_summary jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_profile_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required to view player profiles' USING ERRCODE = '42501'; END IF;
  SELECT p.id INTO actor_profile_id FROM public.profiles p WHERE p.user_id = auth.uid() AND (viewer_profile_id IS NULL OR p.id = viewer_profile_id) ORDER BY p.created_at ASC LIMIT 1;
  IF actor_profile_id IS NULL THEN RAISE EXCEPTION 'Sign in with an active player profile before viewing player profiles' USING ERRCODE = '42501'; END IF;
  IF NOT public.can_view_social_profile(actor_profile_id, target_profile_id) THEN RAISE EXCEPTION 'Player profile is not available to this account' USING ERRCODE = '42501'; END IF;

  RETURN QUERY SELECT psp.profile_id, psp.user_id, psp.username::text, psp.display_name::text, psp.avatar_url::text, psp.bio::text, psp.fame, psp.fans, psp.level,
    CASE WHEN COALESCE(pp.show_city, true) THEN psp.city_name::text ELSE NULL END, p.created_at,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'genre', b.genre, 'fame', COALESCE(b.fame,0), 'chemistry_level', COALESCE(b.chemistry_level,0), 'role', bm.role, 'instrument_role', bm.instrument_role, 'vocal_role', bm.vocal_role, 'joined_at', bm.joined_at) ORDER BY b.name) FROM public.band_members bm JOIN public.bands b ON b.id = bm.band_id WHERE bm.user_id = psp.user_id), '[]'::jsonb),
    CASE WHEN pp.profile_id IS NULL THEN NULL ELSE jsonb_build_object('biography', pp.biography, 'primary_instrument', CASE WHEN pp.show_skills THEN pp.primary_instrument ELSE NULL END, 'secondary_instruments', CASE WHEN pp.show_skills THEN pp.secondary_instruments ELSE '{}'::text[] END, 'preferred_genres', pp.preferred_genres, 'preferred_roles', pp.preferred_roles, 'vocal_capability', CASE WHEN pp.show_skills THEN pp.vocal_capability ELSE NULL END, 'songwriting_specialisms', CASE WHEN pp.show_skills THEN pp.songwriting_specialisms ELSE '{}'::text[] END, 'status_message', pp.status_message, 'looking_for_band', pp.looking_for_band, 'looking_for_members', pp.looking_for_members, 'available_for_session_work', pp.available_for_session_work, 'available_for_collaboration', pp.available_for_collaboration, 'available_for_gigs', pp.available_for_gigs, 'available_for_employment', pp.available_for_employment, 'available_for_teaching', pp.available_for_teaching, 'available_for_social', pp.available_for_social, 'visibility', pp.visibility, 'skill_visibility', pp.skill_visibility, 'show_skills', pp.show_skills) END,
    CASE WHEN COALESCE(pp.show_achievements, true) THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('badge_key', badge_key, 'label', label, 'description', description, 'awarded_at', awarded_at) ORDER BY awarded_at DESC) FROM public.player_profile_badges WHERE profile_id = target_profile_id), '[]'::jsonb) ELSE '[]'::jsonb END,
    CASE WHEN COALESCE(pp.show_activity, true) THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'activity_type', activity_type, 'summary', summary, 'occurred_at', occurred_at) ORDER BY occurred_at DESC) FROM (SELECT * FROM public.player_profile_activity WHERE profile_id = target_profile_id AND is_public ORDER BY occurred_at DESC LIMIT 5) a), '[]'::jsonb) ELSE '[]'::jsonb END,
    jsonb_build_object('bands_joined', (SELECT count(*) FROM public.band_members bm WHERE bm.user_id = psp.user_id), 'current_job', NULL, 'current_employer', NULL)
  FROM public.public_safe_profiles psp JOIN public.profiles p ON p.id = psp.profile_id LEFT JOIN public.player_profiles pp ON pp.profile_id = psp.profile_id WHERE psp.profile_id = target_profile_id LIMIT 1;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_detail(uuid, uuid) TO authenticated;

COMMIT;
