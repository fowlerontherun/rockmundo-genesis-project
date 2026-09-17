-- Top of the Pops phase 3 polish: freeze the exact performer visuals used by an archived broadcast.
-- The snapshot contains render-only appearance/clothing state; it deliberately excludes purchase history,
-- balances, private inventory metadata and account data.

CREATE OR REPLACE FUNCTION public.totp_lock_performer_visual_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member jsonb;
  v_members jsonb := '[]'::jsonb;
  v_profile_id uuid;
  v_appearance jsonb;
  v_legacy jsonb;
  v_clothing jsonb;
BEGIN
  FOR v_member IN
    SELECT value
    FROM jsonb_array_elements(coalesce(NEW.payload #> '{band,members}', '[]'::jsonb))
  LOOP
    v_profile_id := NULL;
    BEGIN
      v_profile_id := nullif(v_member->>'profile_id','')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_profile_id := NULL;
    END;

    v_appearance := NULL;
    v_legacy := NULL;
    v_clothing := '[]'::jsonb;

    IF v_profile_id IS NOT NULL THEN
      SELECT psa.appearance
      INTO v_appearance
      FROM public.player_stage_appearances psa
      WHERE psa.profile_id = v_profile_id
      LIMIT 1;

      IF v_appearance IS NULL THEN
        SELECT jsonb_build_object(
          'gender', pac.gender,
          'skin_tone', pac.skin_tone,
          'hair_color', pac.hair_color,
          'height', pac.height,
          'shirt_color', pac.shirt_color,
          'pants_color', pac.pants_color,
          'shoes_color', pac.shoes_color
        )
        INTO v_legacy
        FROM public.player_avatar_config pac
        WHERE pac.profile_id = v_profile_id
        LIMIT 1;
      END IF;

      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'item', to_jsonb(aci),
        'selectedVariantKey', pos.selected_variant_key,
        'customizationConfig', coalesce(pos.customization_config, '{}'::jsonb)
      ) ORDER BY public.clothing_equip_slot(aci.wearable_slot, aci.category), pos.item_id), '[]'::jsonb)
      INTO v_clothing
      FROM public.player_owned_skins pos
      JOIN public.avatar_clothing_items aci ON aci.id = pos.item_id
      WHERE pos.profile_id = v_profile_id
        AND pos.item_type = 'clothing'
        AND pos.is_equipped = true;
    END IF;

    v_members := v_members || jsonb_build_array(
      v_member || jsonb_build_object(
        'visual_snapshot', jsonb_build_object(
          'appearance', v_appearance,
          'legacyAvatar', v_legacy,
          'richClothing', v_clothing
        )
      )
    );
  END LOOP;

  NEW.payload := jsonb_set(NEW.payload, '{band,members}', v_members, true);
  NEW.payload := NEW.payload || jsonb_build_object(
    'visualSnapshotVersion', 1,
    'visualSnapshotLockedAt', now()
  );
  NEW.replay_version := greatest(4, NEW.replay_version);
  NEW.checksum := md5(NEW.payload::text);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_lock_performer_visual_snapshot() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS totp_lock_performer_visual_snapshot_trigger ON public.totp_broadcast_replays;
CREATE TRIGGER totp_lock_performer_visual_snapshot_trigger
BEFORE INSERT ON public.totp_broadcast_replays
FOR EACH ROW
EXECUTE FUNCTION public.totp_lock_performer_visual_snapshot();

COMMENT ON FUNCTION public.totp_lock_performer_visual_snapshot() IS
  'Freezes render-only performer appearance and equipped clothing into canonical TOTP replay v4 so historical broadcasts never resolve current outfits.';
