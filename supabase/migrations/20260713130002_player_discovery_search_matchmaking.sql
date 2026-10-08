BEGIN;

CREATE TABLE IF NOT EXISTS public.player_discovery_profiles (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  primary_instrument text,
  secondary_instruments text[] NOT NULL DEFAULT '{}',
  vocal_capability boolean NOT NULL DEFAULT false,
  musical_roles text[] NOT NULL DEFAULT '{}',
  preferred_genres text[] NOT NULL DEFAULT '{}',
  career_level text NOT NULL DEFAULT 'developing',
  band_status text NOT NULL DEFAULT 'available',
  employment_status text NOT NULL DEFAULT 'available',
  availability jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_skill_bands jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_message text,
  willing_to_travel boolean NOT NULL DEFAULT false,
  currently_travelling boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT player_discovery_status_message_length CHECK (status_message IS NULL OR char_length(status_message) <= 280)
);

COMMENT ON TABLE public.player_discovery_profiles IS 'Player-managed public discovery metadata. Exact private skill values are never stored here; only opt-in public proficiency bands are searchable.';
CREATE INDEX IF NOT EXISTS player_discovery_profiles_primary_instrument_idx ON public.player_discovery_profiles (lower(primary_instrument));
CREATE INDEX IF NOT EXISTS player_discovery_profiles_preferred_genres_idx ON public.player_discovery_profiles USING gin (preferred_genres);
CREATE INDEX IF NOT EXISTS player_discovery_profiles_roles_idx ON public.player_discovery_profiles USING gin (musical_roles);
CREATE INDEX IF NOT EXISTS player_discovery_profiles_availability_idx ON public.player_discovery_profiles USING gin (availability);
CREATE INDEX IF NOT EXISTS player_discovery_profiles_skill_bands_idx ON public.player_discovery_profiles USING gin (public_skill_bands);
CREATE INDEX IF NOT EXISTS profiles_player_discovery_name_idx ON public.profiles (lower(COALESCE(display_name, username)), created_at DESC);
CREATE INDEX IF NOT EXISTS profiles_player_discovery_city_idx ON public.profiles (current_city_id) WHERE current_city_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.player_saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  discovery_mode text NOT NULL,
  search_query text NOT NULL DEFAULT '',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order text NOT NULL DEFAULT 'best-match',
  alerts_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_used_at timestamptz,
  CONSTRAINT player_saved_searches_filters_object CHECK (jsonb_typeof(filters) = 'object')
);
CREATE INDEX IF NOT EXISTS player_saved_searches_user_updated_idx ON public.player_saved_searches (user_id, updated_at DESC);
COMMENT ON COLUMN public.player_saved_searches.alerts_enabled IS 'Reserved for future saved-search notification support; no notifications are sent by this migration.';
ALTER TABLE public.player_saved_searches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players manage their saved discovery searches" ON public.player_saved_searches;
CREATE POLICY "Players manage their saved discovery searches" ON public.player_saved_searches USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.player_discovery_match_score(candidate public.player_discovery_profiles, filters jsonb, viewer_city_id uuid, candidate_city_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE score integer := 35; reasons text[] := ARRAY[]::text[]; req text;
BEGIN
  req := NULLIF(filters->>'instrument', '');
  IF req IS NOT NULL AND (lower(candidate.primary_instrument) = lower(req) OR lower(req) = ANY(SELECT lower(x) FROM unnest(candidate.secondary_instruments) x)) THEN score := score + 25; reasons := reasons || ('Plays ' || req); END IF;
  req := NULLIF(filters->>'genre', '');
  IF req IS NOT NULL AND lower(req) = ANY(SELECT lower(x) FROM unnest(candidate.preferred_genres) x) THEN score := score + 15; reasons := reasons || ('Likes ' || req); END IF;
  IF viewer_city_id IS NOT NULL AND candidate_city_id = viewer_city_id THEN score := score + 15; reasons := reasons || 'In your city'; END IF;
  IF COALESCE((candidate.availability->>'lookingForBand')::boolean, false) THEN score := score + 8; reasons := reasons || 'Looking for a band'; END IF;
  IF COALESCE((candidate.availability->>'sessionAvailable')::boolean, false) THEN reasons := reasons || 'Available for session work'; END IF;
  IF candidate.willing_to_travel THEN score := score + 4; reasons := reasons || 'Willing to travel'; END IF;
  RETURN jsonb_build_object('percentage', LEAST(score, 98), 'category', CASE WHEN score >= 80 THEN 'Strong match' WHEN score >= 60 THEN 'Good match' ELSE 'Potential match' END, 'reasons', to_jsonb(reasons[1:4]));
END; $$;
COMMENT ON FUNCTION public.player_discovery_match_score(public.player_discovery_profiles, jsonb, uuid, uuid) IS 'Configurable-friendly baseline scoring: instrument +25, genre +15, same visible city +15, looking-for-band +8, willing-to-travel +4. Uses only public discovery metadata and omits hidden raw variables.';

CREATE OR REPLACE FUNCTION public.search_player_discovery(viewer_profile_id uuid DEFAULT NULL, query jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_profile_id uuid; q text := NULLIF(BTRIM(COALESCE(query->>'search','')), ''); filters jsonb := COALESCE(query->'filters','{}'::jsonb); lim int := LEAST(GREATEST(COALESCE((query->>'pageSize')::int, 18),1),48); pg int := GREATEST(COALESCE((query->>'page')::int,1),1); off int; actor_city uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT id, current_city_id INTO actor_profile_id, actor_city FROM public.profiles WHERE user_id = auth.uid() AND (viewer_profile_id IS NULL OR id = viewer_profile_id) ORDER BY created_at LIMIT 1;
  IF actor_profile_id IS NULL THEN RAISE EXCEPTION 'Active profile required' USING ERRCODE='42501'; END IF;
  off := (pg - 1) * lim;
  RETURN (WITH candidates AS (
    SELECT p.id, p.user_id, COALESCE(p.display_name,p.username) character_name, p.avatar_url,
      CASE WHEN COALESCE(pps.city_visibility,'friends'::public.profile_visibility_scope) = 'public'::public.profile_visibility_scope THEN c.name ELSE NULL END city_name,
      CASE WHEN COALESCE(pps.city_visibility,'friends'::public.profile_visibility_scope) = 'public'::public.profile_visibility_scope THEN p.current_city_id ELSE NULL END visible_city_id,
      COALESCE(b.name, NULL) current_band, pdp.primary_instrument, pdp.musical_roles, pdp.preferred_genres, COALESCE(p.fame,0) fame, COALESCE(pdp.career_level, 'Level ' || COALESCE(p.level,1)::text) career_level,
      pdp.availability, pdp.status_message, public.player_discovery_match_score(pdp, filters, actor_city, CASE WHEN COALESCE(pps.city_visibility,'friends'::public.profile_visibility_scope) = 'public'::public.profile_visibility_scope THEN p.current_city_id ELSE NULL END) match
    FROM public.profiles p
    JOIN public.player_discovery_profiles pdp ON pdp.profile_id = p.id
    LEFT JOIN public.profile_privacy_settings pps ON pps.profile_id = p.id
    LEFT JOIN public.cities c ON c.id = p.current_city_id
    LEFT JOIN public.band_members bm ON bm.user_id = p.user_id
    LEFT JOIN public.bands b ON b.id = bm.band_id
    WHERE public.can_view_public_profile_summary(actor_profile_id, p.id)
      AND (q IS NULL OR COALESCE(p.display_name,p.username,'') ILIKE '%'||q||'%' OR COALESCE(pdp.primary_instrument,'') ILIKE '%'||q||'%' OR EXISTS (SELECT 1 FROM unnest(pdp.preferred_genres || pdp.musical_roles || pdp.secondary_instruments) term WHERE term ILIKE '%'||q||'%') OR (COALESCE(pps.city_visibility,'friends'::public.profile_visibility_scope) = 'public'::public.profile_visibility_scope AND c.name ILIKE '%'||q||'%') OR COALESCE(pdp.status_message,'') ILIKE '%'||q||'%')
      AND (filters->>'instrument' IS NULL OR lower(pdp.primary_instrument) = lower(filters->>'instrument') OR lower(filters->>'instrument') = ANY(SELECT lower(x) FROM unnest(pdp.secondary_instruments) x))
      AND (filters->>'genre' IS NULL OR lower(filters->>'genre') = ANY(SELECT lower(x) FROM unnest(pdp.preferred_genres) x))
      AND (filters->>'role' IS NULL OR lower(filters->>'role') = ANY(SELECT lower(x) FROM unnest(pdp.musical_roles) x))
      AND (filters->>'city' IS NULL OR (COALESCE(pps.city_visibility,'friends'::public.profile_visibility_scope) = 'public'::public.profile_visibility_scope AND c.name ILIKE filters->>'city'))
      AND (filters->>'lookingForBand' IS NULL OR COALESCE((pdp.availability->>'lookingForBand')::boolean,false) = (filters->>'lookingForBand')::boolean)
      AND (filters->>'sessionAvailable' IS NULL OR COALESCE((pdp.availability->>'sessionAvailable')::boolean,false) = (filters->>'sessionAvailable')::boolean)
  ), sorted AS (SELECT * FROM candidates ORDER BY (match->>'percentage')::int DESC, character_name ASC OFFSET off LIMIT lim + 1)
  SELECT jsonb_build_object('results', COALESCE(jsonb_agg(jsonb_build_object('profile_id', id, 'user_id', user_id, 'character_name', character_name, 'avatar_url', avatar_url, 'city_name', city_name, 'activity_state', 'hidden', 'current_band', current_band, 'primary_instrument', primary_instrument, 'primary_role', musical_roles[1], 'preferred_genres', preferred_genres, 'fame', fame, 'career_level', career_level, 'availability', (SELECT COALESCE(jsonb_agg(key), '[]'::jsonb) FROM jsonb_each_text(availability) WHERE value = 'true'), 'status_message', status_message, 'badges', '[]'::jsonb, 'match', match)) FILTER (WHERE rn <= lim), '[]'::jsonb), 'has_more', COUNT(*) > lim, 'approximate_total', CASE WHEN COUNT(*) < 10 THEN NULL ELSE COUNT(*) END) FROM (SELECT *, row_number() over () AS rn FROM sorted) s);
END; $$;
GRANT EXECUTE ON FUNCTION public.search_player_discovery(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_player_discovery_filter_options() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('modes', jsonb_build_array('all','musicians','band-recruitment','collaboration','session-work','employment','teaching','social','nearby','recommended')); $$;
GRANT EXECUTE ON FUNCTION public.get_player_discovery_filter_options() TO authenticated;
COMMIT;

BEGIN;
CREATE OR REPLACE FUNCTION public.list_player_saved_searches(viewer_profile_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'userId', user_id, 'name', name, 'discoveryMode', discovery_mode, 'searchQuery', search_query, 'filters', filters, 'sortOrder', sort_order, 'alertsEnabled', alerts_enabled, 'createdAt', created_at, 'updatedAt', updated_at, 'lastUsedAt', last_used_at) ORDER BY updated_at DESC), '[]'::jsonb)
  FROM public.player_saved_searches WHERE user_id = auth.uid();
$$;
CREATE OR REPLACE FUNCTION public.save_player_search(viewer_profile_id uuid DEFAULT NULL, saved_search jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE saved_count int; row public.player_saved_searches;
BEGIN
  SELECT count(*) INTO saved_count FROM public.player_saved_searches WHERE user_id = auth.uid();
  IF saved_count >= 20 THEN RAISE EXCEPTION 'Saved search limit reached' USING ERRCODE='22023'; END IF;
  INSERT INTO public.player_saved_searches(user_id, name, discovery_mode, search_query, filters, sort_order, alerts_enabled)
  VALUES (auth.uid(), COALESCE(NULLIF(saved_search->>'name',''), 'Player search'), COALESCE(saved_search->>'discoveryMode','all'), COALESCE(saved_search->>'searchQuery',''), COALESCE(saved_search->'filters','{}'::jsonb), COALESCE(saved_search->>'sortOrder','best-match'), COALESCE((saved_search->>'alertsEnabled')::boolean, false)) RETURNING * INTO row;
  RETURN jsonb_build_object('id', row.id, 'userId', row.user_id, 'name', row.name, 'discoveryMode', row.discovery_mode, 'searchQuery', row.search_query, 'filters', row.filters, 'sortOrder', row.sort_order, 'alertsEnabled', row.alerts_enabled, 'createdAt', row.created_at, 'updatedAt', row.updated_at, 'lastUsedAt', row.last_used_at);
END; $$;
CREATE OR REPLACE FUNCTION public.update_player_saved_search(viewer_profile_id uuid DEFAULT NULL, saved_search_id uuid DEFAULT NULL, patch jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row public.player_saved_searches;
BEGIN
  UPDATE public.player_saved_searches SET name = COALESCE(NULLIF(patch->>'name',''), name), discovery_mode = COALESCE(patch->>'discoveryMode', discovery_mode), search_query = COALESCE(patch->>'searchQuery', search_query), filters = COALESCE(patch->'filters', filters), sort_order = COALESCE(patch->>'sortOrder', sort_order), alerts_enabled = COALESCE((patch->>'alertsEnabled')::boolean, alerts_enabled), last_used_at = COALESCE((patch->>'lastUsedAt')::timestamptz, last_used_at), updated_at = timezone('utc', now()) WHERE id = saved_search_id AND user_id = auth.uid() RETURNING * INTO row;
  IF row.id IS NULL THEN RAISE EXCEPTION 'Saved search not found' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('id', row.id, 'userId', row.user_id, 'name', row.name, 'discoveryMode', row.discovery_mode, 'searchQuery', row.search_query, 'filters', row.filters, 'sortOrder', row.sort_order, 'alertsEnabled', row.alerts_enabled, 'createdAt', row.created_at, 'updatedAt', row.updated_at, 'lastUsedAt', row.last_used_at);
END; $$;
CREATE OR REPLACE FUNCTION public.delete_player_saved_search(viewer_profile_id uuid DEFAULT NULL, saved_search_id uuid DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ DELETE FROM public.player_saved_searches WHERE id = saved_search_id AND user_id = auth.uid(); $$;
GRANT EXECUTE ON FUNCTION public.list_player_saved_searches(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_player_search(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_player_saved_search(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_player_saved_search(uuid, uuid) TO authenticated;
COMMIT;
