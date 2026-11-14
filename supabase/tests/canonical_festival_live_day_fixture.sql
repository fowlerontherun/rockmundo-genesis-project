CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE SCHEMA extensions;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE FUNCTION extensions.digest(text,text) RETURNS bytea LANGUAGE sql IMMUTABLE AS $$SELECT sha256(convert_to($1,'UTF8'))$$;
CREATE TYPE public.app_role AS ENUM ('admin');
CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
CREATE FUNCTION public._caller_profile_id() RETURNS uuid LANGUAGE sql AS $$SELECT auth.uid()$$;
CREATE TABLE public.cities(id uuid PRIMARY KEY,timezone text);
CREATE TABLE public.festival_companies(id uuid PRIMARY KEY,owner_profile_id uuid);
CREATE TABLE public.festival_editions_v2(
 id uuid PRIMARY KEY, festival_company_id uuid, city_id uuid, version integer DEFAULT 1, status text,
 starts_on date, ends_on date, duration_days integer, locked_at timestamptz, updated_at timestamptz,
 completed_at timestamptz
);
CREATE TABLE public.festival_site_plans(id uuid PRIMARY KEY,festival_edition_id uuid,festival_company_id uuid,usable_capacity integer);
CREATE TABLE public.festival_site_plan_stages(id uuid PRIMARY KEY,festival_site_plan_id uuid,name text,status text,sort_order integer,capacity integer);
CREATE TABLE public.festival_ticket_plans(id uuid PRIMARY KEY,festival_edition_id uuid,forecast jsonb);
CREATE TABLE public.festival_artist_programmes(id uuid PRIMARY KEY,festival_edition_id uuid);
CREATE TABLE public.festival_artist_bookings(id uuid PRIMARY KEY,festival_artist_programme_id uuid,artist_type text,artist_profile_id uuid,band_id uuid,npc_artist_id uuid,set_minutes integer,billing_position text,provisional_date date,confirmed_at timestamptz,status text);
CREATE TABLE public.profiles(id uuid PRIMARY KEY, display_name text,username text);
CREATE TABLE public.bands(id uuid PRIMARY KEY,name text);
CREATE TABLE public.festival_edition_runtimes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), edition_id uuid UNIQUE, festival_company_id uuid,
 state text, version int DEFAULT 1, simulated_time timestamptz, gate_status text, admitted int DEFAULT 0,
 departed int DEFAULT 0,last_action text,idempotency_key text,schedule_source text,generated_schedule jsonb,
 expected_attendance int,site_capacity int,admitted_attendance int DEFAULT 0,site_attendance int DEFAULT 0,
 departed_attendance int DEFAULT 0,runtime_seed bigint,licence_snapshot jsonb,started_by_profile_id uuid,
 started_at timestamptz,completed_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),weather_sequence jsonb DEFAULT '[]'
);
CREATE TABLE public.festival_runtime_configuration_versions(runtime_id uuid,edition_id uuid,rules_version text,configuration jsonb,configuration_digest text);
CREATE TABLE public.festival_runtime_evidence(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),runtime_id uuid,evidence_type text,evidence jsonb,evidence_digest text,created_at timestamptz DEFAULT now(),UNIQUE(runtime_id,evidence_type));
CREATE TABLE public.festival_runtime_completion_digests(runtime_id uuid UNIQUE,edition_id uuid,rules_version text,runtime_digest text,evidence_digest text,completed_at timestamptz);
CREATE TABLE public.festival_runtime_action_audit(runtime_id uuid,actor_profile_id uuid,action text,previous_state text,new_state text,metadata jsonb);
CREATE TABLE public.festival_launches(id uuid,festival_company_id uuid,public_slug text,public_visibility text,launch_status text);
CREATE TABLE public.festival_public_profiles(festival_company_id uuid,public_slug text);
CREATE FUNCTION public.festival_public_projection_v2(uuid) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('id',l.id,'editionId',e.id)
 FROM public.festival_launches l JOIN public.festival_editions_v2 e USING(festival_company_id)
 WHERE l.festival_company_id=$1 LIMIT 1
$$;
CREATE FUNCTION public._festival_edition_runtime_authorised(uuid,uuid,uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS (SELECT 1 FROM public.festival_companies WHERE id=$1 AND owner_profile_id=$3)
$$;
CREATE FUNCTION public._simplified_festival_run_readiness(uuid,uuid) RETURNS jsonb LANGUAGE sql AS $$
 SELECT '{"canRun":true,"blockers":[],"licensedActsPerDay":8}'::jsonb
$$;
CREATE FUNCTION public._festival_runtime_projection(uuid,uuid) RETURNS jsonb LANGUAGE sql AS $$
 SELECT to_jsonb(r) FROM public.festival_edition_runtimes r WHERE id=$1
$$;
CREATE TABLE public.fixture_settlements(runtime_id uuid PRIMARY KEY);
CREATE FUNCTION public.fixture_settle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (SELECT state FROM public.festival_edition_runtimes WHERE id=NEW.runtime_id)<>'completed'
 THEN RAISE EXCEPTION 'fixture settlement before completion'; END IF;
 INSERT INTO public.fixture_settlements VALUES (NEW.runtime_id);
 RETURN NEW;
END;
$$;
CREATE TRIGGER fixture_settlement AFTER INSERT ON public.festival_runtime_completion_digests
FOR EACH ROW EXECUTE FUNCTION public.fixture_settle();
