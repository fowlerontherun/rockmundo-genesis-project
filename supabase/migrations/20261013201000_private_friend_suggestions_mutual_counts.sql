-- Friends privacy and invitation suggestions. Dependency: the social identity
-- player_profiles migration must be deployed before this one.
DO $$
BEGIN
  IF to_regclass('public.player_profiles') IS NULL THEN
    RAISE EXCEPTION 'FRIEND_SUGGESTIONS_REQUIRE_PLAYER_PROFILES';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_safe_friend_suggestions(
  p_profile_id uuid, p_limit integer DEFAULT 6
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_user_id uuid;v_result jsonb;
BEGIN
  v_user_id:=auth.uid();
  IF v_user_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.profiles viewer
    WHERE viewer.id=p_profile_id AND viewer.user_id=v_user_id
      AND viewer.deleted_at IS NULL AND viewer.died_at IS NULL
  ) THEN RAISE EXCEPTION 'FRIEND_SUGGESTIONS_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;

  -- SECURITY DEFINER ensures a target's own block list is checked, even
  -- when the Data API cannot expose those rows to the requesting viewer.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',candidate.id,
    'username',candidate.username,
    'display_name',candidate.display_name,
    'avatar_url',candidate.avatar_url,
    'city_name',candidate.city_name
  ) ORDER BY candidate.created_at DESC),'[]'::jsonb)
  INTO v_result
  FROM (
    SELECT p.id,p.username,p.display_name,p.avatar_url,
      CASE WHEN social.show_city THEN p.city_name ELSE NULL END city_name,
      p.created_at
    FROM public.profiles p
    JOIN public.player_profiles social ON social.profile_id=p.id
    WHERE p.id<>p_profile_id
      AND p.user_id<>v_user_id
      AND p.deleted_at IS NULL
      AND p.died_at IS NULL
      AND p.is_active IS TRUE
      AND social.visibility::text='public'
      AND NOT EXISTS(
        SELECT 1 FROM public.player_blocks blocked
        WHERE blocked.removed_at IS NULL
          AND (
            (blocked.blocker_id=p_profile_id AND blocked.blocked_id=p.id)
            OR (blocked.blocker_id=p.id AND blocked.blocked_id=p_profile_id)
          )
      )
      AND NOT EXISTS(
        SELECT 1 FROM public.friendships f
        WHERE f.status IN ('accepted','pending')
          AND (
            (f.requestor_id=p_profile_id AND f.addressee_id=p.id)
            OR (f.requestor_id=p.id AND f.addressee_id=p_profile_id)
          )
      )
    ORDER BY p.created_at DESC,p.id DESC
    LIMIT least(greatest(coalesce(p_limit,6),1),20)
  ) candidate;
  RETURN v_result;
END $$;

-- Only reveal overlap *counts* for accepted friends; no third-party
-- friendship identities or private friend lists leave the database.
CREATE OR REPLACE FUNCTION public.get_mutual_friend_counts(
  p_profile_id uuid, p_other_profile_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.profiles viewer
    WHERE viewer.id=p_profile_id AND viewer.user_id=auth.uid()
      AND viewer.deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'FRIEND_COUNTS_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;

  SELECT coalesce(jsonb_object_agg(t.other_id::text,t.mutual_count),'{}'::jsonb)
  INTO v_result
  FROM (
    SELECT DISTINCT targets.other_id,
      (
        SELECT count(DISTINCT shared.friend_id)::integer
        FROM (
          SELECT CASE WHEN f.requestor_id=p_profile_id
            THEN f.addressee_id ELSE f.requestor_id END AS friend_id
          FROM public.friendships f
          WHERE f.status='accepted'
            AND (f.requestor_id=p_profile_id OR f.addressee_id=p_profile_id)
        ) shared
        JOIN public.friendships other_f
          ON other_f.status='accepted'
          AND (
            (other_f.requestor_id=targets.other_id AND other_f.addressee_id=shared.friend_id)
            OR (other_f.addressee_id=targets.other_id AND other_f.requestor_id=shared.friend_id)
          )
        WHERE shared.friend_id<>targets.other_id
      ) AS mutual_count
    FROM unnest(coalesce(p_other_profile_ids,'{}'::uuid[])) AS targets(other_id)
    WHERE targets.other_id<>p_profile_id
      AND EXISTS(
        SELECT 1 FROM public.friendships direct
        WHERE direct.status='accepted'
          AND (
            (direct.requestor_id=p_profile_id AND direct.addressee_id=targets.other_id)
            OR (direct.addressee_id=p_profile_id AND direct.requestor_id=targets.other_id)
          )
      )
  ) t;
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.get_safe_friend_suggestions(uuid,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_mutual_friend_counts(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_safe_friend_suggestions(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutual_friend_counts(uuid,uuid[]) TO authenticated;
