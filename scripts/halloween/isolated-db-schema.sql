-- Small, explicit REPRESENTATIVE schema for SQL-only Halloween checks.
-- This does NOT replace full Supabase local reset or prove production parity.
-- Run only against ephemeral, empty PostgreSQL created by the GH Actions job.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE TABLE public.profiles (
 id uuid PRIMARY KEY, user_id uuid, experience integer NOT NULL DEFAULT 0
);
CREATE TABLE public.gigs (
 id uuid PRIMARY KEY,
 status text NOT NULL DEFAULT 'scheduled',
 started_at timestamptz, completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gig_performers (
 id uuid PRIMARY KEY,
 gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
 profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 lineup_status text NOT NULL DEFAULT 'selected'
);
CREATE TABLE public.player_stage_appearances (
 profile_id uuid PRIMARY KEY REFERENCES public.profiles(id),
 appearance jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.player_avatar_config (
 profile_id uuid PRIMARY KEY REFERENCES public.profiles(id),
 gender text,skin_tone text,hair_color text,height numeric,
 shirt_color text,pants_color text,shoes_color text
);
CREATE TABLE public.avatar_clothing_items (
 id uuid PRIMARY KEY, name text NOT NULL,
 curated_asset_key text UNIQUE, category text,
 wearable_slot text, price integer NOT NULL DEFAULT 0,
 render_config jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.player_owned_skins (
 profile_id uuid NOT NULL REFERENCES public.profiles(id),
 item_id uuid NOT NULL REFERENCES public.avatar_clothing_items(id),
 item_type text NOT NULL, is_equipped boolean NOT NULL DEFAULT false,
 selected_variant_key text, customization_config jsonb,
 UNIQUE(profile_id,item_type,item_id)
);
CREATE TABLE public.system_settings (
 key text PRIMARY KEY,value jsonb NOT NULL
);
CREATE TABLE public.achievements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text,description text,category text,icon text,rarity text,
 requirements jsonb,rewards jsonb,slug text UNIQUE
);
CREATE TABLE public.player_achievements (
 user_id uuid,profile_id uuid,achievement_id uuid,
 unlocked_at timestamptz,progress jsonb,
 UNIQUE(profile_id,achievement_id)
);
CREATE TABLE public.experience_ledger (
 user_id uuid,profile_id uuid,activity_type text,xp_amount integer,metadata jsonb
);
CREATE TABLE public.gig_outcomes (
 id uuid PRIMARY KEY,gig_id uuid REFERENCES public.gigs(id),
 completed_at timestamptz, overall_rating numeric,
 xp_breakdown jsonb
);
CREATE TABLE public.gig_song_performances (
 id uuid PRIMARY KEY,gig_outcome_id uuid REFERENCES public.gig_outcomes(id)
);
CREATE FUNCTION public.clothing_equip_slot(p_slot text,p_category text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(p_slot,p_category,'unknown')
$$;
INSERT INTO public.profiles(id,user_id,experience) VALUES
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',0),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002',0);
INSERT INTO public.gigs(id,status) VALUES
 ('30000000-0000-4000-8000-000000000001','scheduled');
INSERT INTO public.gig_performers(id,gig_id,profile_id,lineup_status) VALUES
 ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','selected'),
 ('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','selected');
INSERT INTO public.player_stage_appearances(profile_id,appearance) VALUES
 ('10000000-0000-4000-8000-000000000001','{"body":{"frame":"masculine"}}'),
 ('10000000-0000-4000-8000-000000000002','{"body":{"frame":"feminine"}}');
INSERT INTO public.avatar_clothing_items(id,name,category,wearable_slot,price,curated_asset_key,render_config)
 VALUES ('50000000-0000-4000-8000-000000000001','Haunted Pumpkin Hat 2026','hat','headwear',0,
 'clothing.halloween.2026.pumpkin-hat','{"headwearStyle":"pumpkin"}');
INSERT INTO public.player_owned_skins(profile_id,item_id,item_type,is_equipped)
 VALUES ('10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','clothing',true);
INSERT INTO public.system_settings(key,value) VALUES
 ('halloween_2026_event','{"enabled":false,"rewards_live":false,"starts_at":"2026-10-23T23:00:00Z","ends_at":"2026-11-02T00:00:00Z"}');
