-- Read-only live/staging preflight. Requires staged pumpkin hat and disabled event.
-- No fixtures, writes or player balance changes.
DO $preflight$
DECLARE v_hat uuid;v_playable bigint;v_owned bigint;v_equipped bigint;v_settings jsonb;
BEGIN
 SELECT id INTO STRICT v_hat FROM public.avatar_clothing_items
 WHERE curated_asset_key='clothing.halloween.2026.pumpkin-hat';
 IF NOT EXISTS (SELECT 1 FROM public.avatar_clothing_items WHERE id=v_hat
    AND price=0 AND wearable_slot='headwear'
    AND curated_asset_status='asset_ready' AND featured=false
    AND render_config->>'headwearStyle'='pumpkin')
 THEN RAISE EXCEPTION 'Pumpkin item is not safely staged'; END IF;
 SELECT count(*) INTO v_playable FROM public.profiles WHERE user_id IS NOT NULL;
 SELECT count(*) INTO v_owned FROM public.player_owned_skins pos
 JOIN public.profiles p ON p.id=pos.profile_id
 WHERE p.user_id IS NOT NULL AND pos.item_type='clothing' AND pos.item_id=v_hat;
 SELECT count(*) INTO v_equipped FROM public.player_owned_skins
 WHERE item_id=v_hat AND is_equipped IS TRUE;
 IF v_playable<>v_owned OR v_equipped<>0 THEN
   RAISE EXCEPTION 'Pumpkin ownership/equip mismatch: % profiles, % gifts, % equipped',
     v_playable,v_owned,v_equipped;
 END IF;
 SELECT value INTO v_settings FROM public.system_settings WHERE key='halloween_2026_event';
 IF v_settings->>'enabled' IS DISTINCT FROM 'false'
   OR v_settings->>'rewards_live' IS DISTINCT FROM 'false'
 THEN RAISE EXCEPTION 'Halloween event was prematurely enabled'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.profiles'::regclass
   AND tgname='grant_halloween_2026_pumpkin_hat_on_profile' AND tgenabled<>'D')
 THEN RAISE EXCEPTION 'New playable profile gift trigger missing'; END IF;
END $preflight$;
