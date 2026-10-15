-- Restore the player's own social profile editor without publishing
-- any existing characters. Original historical SQL defaulted everyone public;
-- this compatibility foundation intentionally defaults to private and leaves
-- account-level privacy and public discovery to separate verified RPCs.
BEGIN;
DO $types$
BEGIN
 IF to_regtype('public.profile_skill_visibility') IS NULL THEN
   CREATE TYPE public.profile_skill_visibility AS ENUM('exact','broad','hidden');
 END IF;
END;
$types$;

CREATE TABLE public.player_profiles (
 profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 biography text CHECK(char_length(biography)<=1000),
 primary_instrument text CHECK(char_length(primary_instrument)<=40),
 secondary_instruments text[] NOT NULL DEFAULT '{}'::text[],
 preferred_genres text[] NOT NULL DEFAULT '{}'::text[],
 preferred_roles text[] NOT NULL DEFAULT '{}'::text[],
 vocal_capability text CHECK(char_length(vocal_capability)<=40),
 songwriting_specialisms text[] NOT NULL DEFAULT '{}'::text[],
 status_message text CHECK(char_length(status_message)<=140),
 looking_for_band boolean NOT NULL DEFAULT false,
 looking_for_members boolean NOT NULL DEFAULT false,
 available_for_session_work boolean NOT NULL DEFAULT false,
 available_for_collaboration boolean NOT NULL DEFAULT false,
 available_for_gigs boolean NOT NULL DEFAULT false,
 available_for_employment boolean NOT NULL DEFAULT false,
 available_for_teaching boolean NOT NULL DEFAULT false,
 available_for_social boolean NOT NULL DEFAULT false,
 open_to_work_status text CHECK(char_length(open_to_work_status)<=60),
 open_to_band_status text CHECK(char_length(open_to_band_status)<=60),
 visibility public.profile_visibility_scope NOT NULL DEFAULT 'private'::public.profile_visibility_scope,
 skill_visibility public.profile_skill_visibility NOT NULL DEFAULT 'broad'::public.profile_skill_visibility,
 show_online_status boolean NOT NULL DEFAULT false,
 show_last_active boolean NOT NULL DEFAULT false,
 show_city boolean NOT NULL DEFAULT false,
 show_schedule_availability boolean NOT NULL DEFAULT false,
 show_skills boolean NOT NULL DEFAULT true,
 show_career_history boolean NOT NULL DEFAULT false,
 show_employment boolean NOT NULL DEFAULT false,
 show_activity boolean NOT NULL DEFAULT false,
 show_achievements boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT player_profiles_array_size CHECK (
  cardinality(secondary_instruments)<=12 AND cardinality(preferred_genres)<=12
  AND cardinality(preferred_roles)<=12 AND cardinality(songwriting_specialisms)<=12)
);
CREATE INDEX player_profiles_opt_in_search_idx
 ON public.player_profiles(visibility,primary_instrument,looking_for_band,available_for_session_work,available_for_employment)
 WHERE visibility='public'::public.profile_visibility_scope;
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.player_profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.player_profiles TO authenticated;
GRANT USAGE ON TYPE public.profile_skill_visibility TO authenticated;
GRANT USAGE ON TYPE public.profile_visibility_scope TO authenticated;

CREATE POLICY player_profiles_owner_select ON public.player_profiles
 FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.profiles p WHERE p.id=player_profiles.profile_id
 AND p.user_id=(SELECT auth.uid()) AND p.deleted_at IS NULL));
CREATE POLICY player_profiles_owner_insert ON public.player_profiles
 FOR INSERT TO authenticated WITH CHECK(EXISTS(
 SELECT 1 FROM public.profiles p WHERE p.id=player_profiles.profile_id
 AND p.user_id=(SELECT auth.uid()) AND p.died_at IS NULL AND p.deleted_at IS NULL));
CREATE POLICY player_profiles_owner_update ON public.player_profiles
 FOR UPDATE TO authenticated USING(EXISTS(
 SELECT 1 FROM public.profiles p WHERE p.id=player_profiles.profile_id
 AND p.user_id=(SELECT auth.uid()) AND p.died_at IS NULL AND p.deleted_at IS NULL))
 WITH CHECK(EXISTS(
 SELECT 1 FROM public.profiles p WHERE p.id=player_profiles.profile_id
 AND p.user_id=(SELECT auth.uid()) AND p.died_at IS NULL AND p.deleted_at IS NULL));

CREATE TRIGGER player_profiles_updated_at
 BEFORE UPDATE ON public.player_profiles FOR EACH ROW
 EXECUTE FUNCTION public.update_updated_at_column();
NOTIFY pgrst,'reload schema';
COMMIT;