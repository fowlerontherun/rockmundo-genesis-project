-- Saved searches table
CREATE TABLE IF NOT EXISTS public.player_saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  profile_id uuid,
  name text NOT NULL,
  discovery_mode text NOT NULL DEFAULT 'all',
  search_query text NOT NULL DEFAULT '',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order text NOT NULL DEFAULT 'best-match',
  alerts_enabled boolean NOT NULL DEFAULT false,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_saved_searches TO authenticated;
GRANT ALL ON public.player_saved_searches TO service_role;
ALTER TABLE public.player_saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players manage their own saved searches" ON public.player_saved_searches;
CREATE POLICY "Players manage their own saved searches"
  ON public.player_saved_searches FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS player_saved_searches_user_idx ON public.player_saved_searches(user_id, created_at DESC);

-- Helper: blocked check
CREATE OR REPLACE FUNCTION public._social_blocked(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.player_blocks b
     WHERE b.removed_at IS NULL
       AND ((b.blocker_id = p_a AND b.blocked_id = p_b)
         OR (b.blocker_id = p_b AND b.blocked_id = p_a))
  );
$function$;

-- Public profile search
CREATE OR REPLACE FUNCTION public.search_public_profiles(
  search_term text,
  viewer_profile_id uuid DEFAULT NULL,
  result_limit integer DEFAULT 20
)
RETURNS TABLE (
  profile_id uuid,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  fame integer,
  fans integer,
  level integer,
  city_name text,
  bands jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id,
         p.user_id,
         p.username::text,
         p.display_name::text,
         p.avatar_url,
         p.bio,
         coalesce(p.fame, 0),
         coalesce(p.fans, 0),
         coalesce(p.level, 1),
         c.name::text,
         coalesce((
           SELECT jsonb_agg(jsonb_build_object('name', b.name, 'genre', coalesce(b.primary_genre, b.genre)))
             FROM public.band_members bm
             JOIN public.bands b ON b.id = bm.band_id
            WHERE bm.profile_id = p.id
              AND coalesce(bm.member_status, 'active') = 'active'
         ), '[]'::jsonb)
    FROM public.profiles p
    LEFT JOIN public.cities c ON c.id = p.current_city_id
   WHERE coalesce(p.is_active, true)
     AND p.deleted_at IS NULL
     AND (viewer_profile_id IS NULL OR p.id <> viewer_profile_id)
     AND (viewer_profile_id IS NULL OR NOT public._social_blocked(viewer_profile_id, p.id))
     AND (
       p.username ILIKE '%' || search_term || '%'
       OR p.display_name ILIKE '%' || search_term || '%'
       OR p.bio ILIKE '%' || search_term || '%'
     )
   ORDER BY coalesce(p.fame, 0) DESC, p.username ASC
   LIMIT greatest(1, least(coalesce(result_limit, 20), 50));
$function$;

GRANT EXECUTE ON FUNCTION public.search_public_profiles(text, uuid, integer) TO authenticated, service_role;

-- Public profile detail
CREATE OR REPLACE FUNCTION public.get_public_profile_detail(
  target_profile_id uuid,
  viewer_profile_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p public.profiles%ROWTYPE;
  v_city text;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = target_profile_id;
  IF p.id IS NULL OR p.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Player profile not found.' USING ERRCODE='P0001';
  END IF;
  IF viewer_profile_id IS NOT NULL AND public._social_blocked(viewer_profile_id, p.id) THEN
    RAISE EXCEPTION 'This player profile is not available to this account.' USING ERRCODE='P0001';
  END IF;

  SELECT c.name::text INTO v_city FROM public.cities c WHERE c.id = p.current_city_id;

  RETURN jsonb_build_object(
    'profile_id', p.id,
    'user_id', p.user_id,
    'username', p.username,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'bio', p.bio,
    'fame', coalesce(p.fame, 0),
    'fans', coalesce(p.fans, 0),
    'level', coalesce(p.level, 1),
    'city_name', v_city,
    'created_at', p.created_at,
    'bands', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'genre', coalesce(b.primary_genre, b.genre),
        'fame', coalesce(b.fame, 0),
        'chemistry_level', coalesce(b.chemistry_level, 0),
        'role', bm.role,
        'instrument_role', bm.instrument_role,
        'vocal_role', bm.vocal_role,
        'joined_at', bm.joined_at
      ) ORDER BY bm.joined_at NULLS LAST)
        FROM public.band_members bm
        JOIN public.bands b ON b.id = bm.band_id
       WHERE bm.profile_id = p.id
    ), '[]'::jsonb),
    'social_profile', NULL,
    'badges', '[]'::jsonb,
    'public_activity', '[]'::jsonb,
    'career_summary', jsonb_build_object(
      'level', coalesce(p.level, 1),
      'fame', coalesce(p.fame, 0),
      'fans', coalesce(p.fans, 0)
    )
  );
END $function$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_detail(uuid, uuid) TO authenticated, service_role;

-- Social invites
CREATE OR REPLACE FUNCTION public.send_social_invite(
  target_profile_id uuid,
  invite_kind text,
  scheduled_for timestamptz DEFAULT NULL,
  invite_message text DEFAULT NULL,
  invite_ref_id uuid DEFAULT NULL,
  invite_location_city_id uuid DEFAULT NULL
)
RETURNS public.social_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_from uuid := public._caller_profile_id();
  v_row public.social_invites;
BEGIN
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile before using invites.' USING ERRCODE='P0001';
  END IF;
  IF target_profile_id = v_from THEN
    RAISE EXCEPTION 'This player is not available for invites.' USING ERRCODE='P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_profile_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'That invite or player could not be found.' USING ERRCODE='P0001';
  END IF;
  IF public._social_blocked(v_from, target_profile_id) THEN
    RAISE EXCEPTION 'This player is not available for invites.' USING ERRCODE='P0001';
  END IF;
  IF scheduled_for IS NOT NULL AND scheduled_for < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'Choose a future time for this invite.' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.social_invites (from_profile_id, to_profile_id, kind, ref_id, scheduled_at, location_city_id, message, status)
  VALUES (v_from, target_profile_id, invite_kind::public.social_invite_kind, invite_ref_id, scheduled_for, invite_location_city_id, invite_message, 'pending')
  RETURNING * INTO v_row;

  RETURN v_row;
END $function$;

GRANT EXECUTE ON FUNCTION public.send_social_invite(uuid, text, timestamptz, text, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.respond_social_invite(invite_id uuid, next_status text)
RETURNS public.social_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile uuid := public._caller_profile_id();
  v_row public.social_invites;
BEGIN
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile before using invites.' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO v_row FROM public.social_invites WHERE id = invite_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'That invite or player could not be found.' USING ERRCODE='P0001';
  END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'This invite can no longer be updated.' USING ERRCODE='P0001';
  END IF;

  IF next_status = 'cancelled' THEN
    IF v_row.from_profile_id IS DISTINCT FROM v_profile THEN
      RAISE EXCEPTION 'permission denied for this invite' USING ERRCODE='P0001';
    END IF;
  ELSE
    IF v_row.to_profile_id IS DISTINCT FROM v_profile THEN
      RAISE EXCEPTION 'permission denied for this invite' USING ERRCODE='P0001';
    END IF;
  END IF;

  UPDATE public.social_invites
     SET status = next_status::public.social_invite_status,
         responded_at = now(),
         updated_at = now()
   WHERE id = invite_id
  RETURNING * INTO v_row;

  RETURN v_row;
END $function$;

GRANT EXECUTE ON FUNCTION public.respond_social_invite(uuid, text) TO authenticated, service_role;

-- Discovery filter options
CREATE OR REPLACE FUNCTION public.get_player_discovery_filter_options()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'cities', coalesce((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'country', c.country) ORDER BY c.name)
                          FROM public.cities c), '[]'::jsonb),
    'regions', coalesce((SELECT jsonb_agg(DISTINCT c.country) FROM public.cities c WHERE c.country IS NOT NULL), '[]'::jsonb),
    'genres', coalesce((SELECT jsonb_agg(DISTINCT b.primary_genre) FROM public.bands b WHERE b.primary_genre IS NOT NULL), '[]'::jsonb),
    'instruments', coalesce((SELECT jsonb_agg(DISTINCT bm.instrument_role) FROM public.band_members bm WHERE bm.instrument_role IS NOT NULL), '[]'::jsonb),
    'roles', jsonb_build_array('musician','vocalist','producer','manager'),
    'careerLevels', jsonb_build_array('rookie','rising','established','star','legend')
  );
$function$;

GRANT EXECUTE ON FUNCTION public.get_player_discovery_filter_options() TO authenticated, service_role;

-- Discovery search
CREATE OR REPLACE FUNCTION public.search_player_discovery(query jsonb, viewer_profile_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_search text := coalesce(nullif(btrim(query->>'search'), ''), NULL);
  v_page integer := greatest(1, coalesce((query->>'page')::int, 1));
  v_page_size integer := least(48, greatest(1, coalesce((query->>'pageSize')::int, 18)));
  v_sort text := coalesce(query->>'sort', 'recently-active');
  v_filters jsonb := coalesce(query->'filters', '{}'::jsonb);
  v_city text := nullif(v_filters->>'city', '');
  v_genre text := nullif(v_filters->>'genre', '');
  v_fame_min integer := coalesce((v_filters->>'fameMin')::int, 0);
  v_rows jsonb;
  v_count integer;
BEGIN
  WITH base AS (
    SELECT p.id, p.user_id, p.username, p.display_name, p.avatar_url, p.bio,
           coalesce(p.fame, 0) AS fame, coalesce(p.level, 1) AS level, p.last_login_at,
           c.name AS city_name,
           (SELECT b.name FROM public.band_members bm JOIN public.bands b ON b.id = bm.band_id
             WHERE bm.profile_id = p.id AND coalesce(bm.member_status,'active') = 'active'
             ORDER BY bm.joined_at NULLS LAST LIMIT 1) AS current_band,
           (SELECT bm.instrument_role FROM public.band_members bm
             WHERE bm.profile_id = p.id ORDER BY bm.joined_at NULLS LAST LIMIT 1) AS primary_instrument,
           (SELECT bm.role FROM public.band_members bm
             WHERE bm.profile_id = p.id ORDER BY bm.joined_at NULLS LAST LIMIT 1) AS primary_role
      FROM public.profiles p
      LEFT JOIN public.cities c ON c.id = p.current_city_id
     WHERE coalesce(p.is_active, true)
       AND p.deleted_at IS NULL
       AND (viewer_profile_id IS NULL OR p.id <> viewer_profile_id)
       AND (viewer_profile_id IS NULL OR NOT public._social_blocked(viewer_profile_id, p.id))
       AND (v_search IS NULL OR p.username ILIKE '%'||v_search||'%' OR p.display_name ILIKE '%'||v_search||'%')
       AND (v_city IS NULL OR c.name = v_city)
       AND coalesce(p.fame, 0) >= v_fame_min
       AND (v_genre IS NULL OR EXISTS (
             SELECT 1 FROM public.band_members bm JOIN public.bands b ON b.id = bm.band_id
              WHERE bm.profile_id = p.id AND coalesce(b.primary_genre, b.genre) = v_genre))
  ), counted AS (
    SELECT count(*)::int AS total FROM base
  ), ordered AS (
    SELECT * FROM base
     ORDER BY
       CASE WHEN v_sort = 'highest-fame' THEN fame END DESC NULLS LAST,
       CASE WHEN v_sort = 'career-level' THEN level END DESC NULLS LAST,
       CASE WHEN v_sort = 'name' THEN username END ASC NULLS LAST,
       last_login_at DESC NULLS LAST,
       fame DESC
     LIMIT v_page_size OFFSET (v_page - 1) * v_page_size
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'profile_id', o.id,
           'user_id', o.user_id,
           'character_name', coalesce(o.display_name, o.username),
           'avatar_url', o.avatar_url,
           'city_name', o.city_name,
           'activity_state', CASE
              WHEN o.last_login_at > now() - interval '15 minutes' THEN 'online'
              WHEN o.last_login_at > now() - interval '1 day' THEN 'today'
              WHEN o.last_login_at > now() - interval '14 days' THEN 'recent'
              ELSE 'inactive' END,
           'current_band', o.current_band,
           'primary_role', o.primary_role,
           'primary_instrument', o.primary_instrument,
           'preferred_genres', '[]'::jsonb,
           'fame', o.fame,
           'career_level', 'Level ' || o.level,
           'availability', '[]'::jsonb,
           'status_message', o.bio,
           'badges', '[]'::jsonb,
           'match', jsonb_build_object('percentage', 50, 'category', 'Potential match', 'reasons', '[]'::jsonb)
         )), '[]'::jsonb),
         (SELECT total FROM counted)
    INTO v_rows, v_count
    FROM ordered o;

  RETURN jsonb_build_object(
    'results', v_rows,
    'page', v_page,
    'page_size', v_page_size,
    'has_more', (v_page * v_page_size) < coalesce(v_count, 0),
    'approximate_total', coalesce(v_count, 0)
  );
END $function$;

GRANT EXECUTE ON FUNCTION public.search_player_discovery(jsonb, uuid) TO authenticated, service_role;

-- Saved search RPCs
CREATE OR REPLACE FUNCTION public._saved_search_json(r public.player_saved_searches)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'id', r.id, 'userId', r.user_id, 'name', r.name,
    'discoveryMode', r.discovery_mode, 'searchQuery', r.search_query,
    'filters', r.filters, 'sortOrder', r.sort_order,
    'alertsEnabled', r.alerts_enabled, 'createdAt', r.created_at,
    'updatedAt', r.updated_at, 'lastUsedAt', r.last_used_at
  );
$function$;

CREATE OR REPLACE FUNCTION public.list_player_saved_searches(viewer_profile_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(public._saved_search_json(r) ORDER BY r.created_at DESC), '[]'::jsonb)
    FROM public.player_saved_searches r
   WHERE r.user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.save_player_search(saved_search jsonb, viewer_profile_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.player_saved_searches;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='P0001'; END IF;
  IF (SELECT count(*) FROM public.player_saved_searches WHERE user_id = auth.uid()) >= 20 THEN
    RAISE EXCEPTION 'Saved search limit reached.' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.player_saved_searches (user_id, profile_id, name, discovery_mode, search_query, filters, sort_order, alerts_enabled)
  VALUES (
    auth.uid(), viewer_profile_id,
    coalesce(nullif(btrim(saved_search->>'name'), ''), 'Saved search'),
    coalesce(saved_search->>'discoveryMode', 'all'),
    coalesce(saved_search->>'searchQuery', ''),
    coalesce(saved_search->'filters', '{}'::jsonb),
    coalesce(saved_search->>'sortOrder', 'best-match'),
    coalesce((saved_search->>'alertsEnabled')::boolean, false)
  )
  RETURNING * INTO v_row;

  RETURN public._saved_search_json(v_row);
END $function$;

CREATE OR REPLACE FUNCTION public.update_player_saved_search(saved_search_id uuid, patch jsonb, viewer_profile_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.player_saved_searches;
BEGIN
  UPDATE public.player_saved_searches r
     SET name = coalesce(nullif(btrim(patch->>'name'), ''), r.name),
         discovery_mode = coalesce(patch->>'discoveryMode', r.discovery_mode),
         search_query = coalesce(patch->>'searchQuery', r.search_query),
         filters = coalesce(patch->'filters', r.filters),
         sort_order = coalesce(patch->>'sortOrder', r.sort_order),
         alerts_enabled = coalesce((patch->>'alertsEnabled')::boolean, r.alerts_enabled),
         last_used_at = CASE WHEN (patch->>'lastUsedAt') IS NOT NULL THEN (patch->>'lastUsedAt')::timestamptz ELSE r.last_used_at END,
         updated_at = now()
   WHERE r.id = saved_search_id AND r.user_id = auth.uid()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN RAISE EXCEPTION 'saved_search_not_found' USING ERRCODE='P0001'; END IF;
  RETURN public._saved_search_json(v_row);
END $function$;

CREATE OR REPLACE FUNCTION public.delete_player_saved_search(saved_search_id uuid, viewer_profile_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  DELETE FROM public.player_saved_searches WHERE id = saved_search_id AND user_id = auth.uid();
$function$;

GRANT EXECUTE ON FUNCTION public.list_player_saved_searches(uuid), public.save_player_search(jsonb, uuid), public.update_player_saved_search(uuid, jsonb, uuid), public.delete_player_saved_search(uuid, uuid) TO authenticated, service_role;