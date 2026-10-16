-- Expose a previously missing launch blocker: gifting is not publication.
-- The Haunted Stage must not appear release-ready until the real procedural
-- Pumpkin Hat has received genuine visual QA and is officially published.
-- This does NOT forge QA evidence, bypass the publication guard or arm rewards.
CREATE OR REPLACE FUNCTION public.admin_halloween_2026_launch_preflight()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_cfg jsonb;
  v_player_count integer := 0;
  v_gifted_count integer := 0;
  v_database boolean := false;
  v_hats boolean := false;
  v_hat_published boolean := false;
  v_gifts boolean := false;
  v_achievement boolean := false;
  v_triggers boolean := false;
  v_rls boolean := false;
  v_acl boolean := false;
  v_dates boolean := false;
  v_started_gigs integer := 0;
  v_expected_performers integer := 0;
  v_snapshotted_performers integer := 0;
  v_reward_claims integer := 0;
BEGIN
  IF NOT coalesce(public.has_role((SELECT auth.uid()), 'admin'::public.app_role),false)
     AND (SELECT auth.role()) IS DISTINCT FROM 'service_role'
     AND pg_catalog.current_setting('role',true) IS DISTINCT FROM 'service_role'
  THEN
    RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501';
  END IF;

  SELECT s.value INTO v_cfg FROM public.system_settings s
   WHERE s.key='halloween_2026_event';

  v_database := to_regclass('public.halloween_2026_gig_outfits') IS NOT NULL
    AND to_regclass('public.halloween_2026_first_rewards') IS NOT NULL
    AND to_regclass('public.gig_stage_visual_snapshots') IS NOT NULL
    AND to_regprocedure('public.get_halloween_2026_gig_bonus(uuid)') IS NOT NULL
    AND to_regprocedure('public.halloween_2026_bonus_for_roll(integer)') IS NOT NULL;

  SELECT count(*) INTO v_player_count
  FROM public.profiles p WHERE p.user_id IS NOT NULL;
  SELECT count(DISTINCT pos.profile_id) INTO v_gifted_count
  FROM public.player_owned_skins pos
  JOIN public.avatar_clothing_items item ON item.id=pos.item_id
  JOIN public.profiles p ON p.id=pos.profile_id
  WHERE p.user_id IS NOT NULL AND pos.item_type='clothing'
    AND item.curated_asset_key='clothing.halloween.2026.pumpkin-hat';
  v_hats := (SELECT count(*)=1 FROM public.avatar_clothing_items
    WHERE curated_asset_key='clothing.halloween.2026.pumpkin-hat'
      AND wearable_slot='headwear' AND price=0);
  v_hat_published := (SELECT count(*)=1 FROM public.avatar_clothing_items
    WHERE curated_asset_key='clothing.halloween.2026.pumpkin-hat'
      AND curated_asset_status='published');
  v_gifts := v_hats AND v_player_count=v_gifted_count;

  v_achievement := (SELECT count(*)=1 FROM public.achievements
    WHERE slug='pumpkin-headliner-2026');

  SELECT count(*)=4 INTO v_triggers FROM pg_catalog.pg_trigger t
  WHERE NOT t.tgisinternal
    AND t.tgname IN (
      'trg_capture_halloween_2026_gig_outfits',
      'trg_settle_halloween_2026_first_rewards',
      'trg_capture_gig_stage_visual_snapshots',
      'trg_immutable_gig_stage_visual_snapshots'
    );

  IF v_database THEN
    SELECT count(*)=3 INTO v_rls
    FROM pg_catalog.pg_class c
  WHERE c.oid IN (
    'public.halloween_2026_gig_outfits'::pg_catalog.regclass,
    'public.halloween_2026_first_rewards'::pg_catalog.regclass,
    'public.gig_stage_visual_snapshots'::pg_catalog.regclass
  ) AND c.relrowsecurity;

  v_acl := NOT pg_catalog.has_function_privilege('anon',
         'public.get_halloween_2026_gig_bonus(uuid)','EXECUTE')
    AND NOT pg_catalog.has_function_privilege('authenticated',
         'public.get_halloween_2026_gig_bonus(uuid)','EXECUTE')
    AND NOT pg_catalog.has_table_privilege('authenticated',
         'public.halloween_2026_first_rewards','INSERT')
    AND NOT pg_catalog.has_table_privilege('authenticated',
         'public.gig_stage_visual_snapshots','SELECT');

  END IF;

  -- Informational smoke metrics only. A captured snapshot is NOT visual QA
  -- and must not auto-arm the event. Never return performer IDs or private outfits.
  IF v_database THEN
    SELECT count(*) INTO v_started_gigs
    FROM public.gigs g
    WHERE g.started_at >= '2026-10-16T10:27:18Z'::timestamptz;

    WITH selected_performers AS (
      SELECT DISTINCT gp.gig_id, gp.profile_id
      FROM public.gigs g
      JOIN public.gig_performers gp ON gp.gig_id=g.id
      WHERE g.started_at >= '2026-10-16T10:27:18Z'::timestamptz
        AND gp.profile_id IS NOT NULL
        AND gp.lineup_status IN ('selected','performed')
    )
    SELECT count(*)::integer,
      count(s.profile_id)::integer
      INTO v_expected_performers,v_snapshotted_performers
    FROM selected_performers gp
    LEFT JOIN public.gig_stage_visual_snapshots s
      ON s.gig_id=gp.gig_id AND s.profile_id=gp.profile_id;

    SELECT count(*) INTO v_reward_claims
    FROM public.halloween_2026_first_rewards;
  END IF;

  v_dates := coalesce((v_cfg->>'starts_at')::timestamptz =
     '2026-10-23T23:00:00Z'::timestamptz,false)
    AND coalesce((v_cfg->>'ends_at')::timestamptz =
     '2026-11-02T00:00:00Z'::timestamptz,false);

  RETURN pg_catalog.jsonb_build_object(
    'database_ready', v_database AND v_hats AND v_hat_published AND v_gifts
       AND v_achievement AND v_triggers AND v_rls AND v_acl AND v_dates,
    'checked_at', pg_catalog.now(),
    'live_gig_evidence', pg_catalog.jsonb_build_object(
      'gigs_started_since_install',v_started_gigs,
      'expected_performer_snapshots',v_expected_performers,
      'captured_performer_snapshots',v_snapshotted_performers,
      'missing_performer_snapshots',v_expected_performers-v_snapshotted_performers,
      'first_reward_claims',v_reward_claims,
      'requires_human_visual_inspection',true
    ),
    'characters', v_player_count,
    'characters_gifted', v_gifted_count,
    'checks', pg_catalog.jsonb_build_object(
       'reward_schema',v_database, 'pumpkin_hat_catalogue',v_hats,
       'pumpkin_hat_published',v_hat_published,
       'all_characters_gifted',v_gifts, 'permanent_achievement',v_achievement,
       'settlement_and_snapshot_triggers',v_triggers,
       'row_security',v_rls, 'private_permissions',v_acl,
       'uk_calendar_window',v_dates
    ),
    'event_enabled',coalesce((v_cfg->>'enabled')::boolean,false),
    'rewards_armed',coalesce((v_cfg->>'rewards_live')::boolean,false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_halloween_2026_launch_preflight()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_halloween_2026_launch_preflight()
  TO authenticated,service_role;

COMMENT ON FUNCTION public.admin_halloween_2026_launch_preflight()
IS 'Admin-only read-only Halloween DB readiness; cannot verify deployed Edge versions or real gig QA.';
NOTIFY pgrst, 'reload schema';
