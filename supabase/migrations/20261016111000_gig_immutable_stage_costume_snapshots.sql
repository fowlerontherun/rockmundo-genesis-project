-- Persist stage wardrobe and Avatar V1 appearance at gig start, not at
-- replay generation time. The snapshots are immutable and private; the
-- service-role replay generator can publish a render-only projection.
CREATE TABLE IF NOT EXISTS public.gig_stage_visual_snapshots (
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  visual_snapshot jsonb NOT NULL,
  PRIMARY KEY (gig_id, profile_id),
  CONSTRAINT gig_stage_visual_snapshot_is_object
    CHECK (jsonb_typeof(visual_snapshot)='object')
);
ALTER TABLE public.gig_stage_visual_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gig_stage_visual_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.gig_stage_visual_snapshots TO service_role;

-- This trigger runs under a trusted gig transition and is intentionally NOT
-- client-callable. It records only public stage appearance and equipped outfit
-- presentation, not all purchases or unrelated inventory.
CREATE OR REPLACE FUNCTION public.capture_gig_stage_visual_snapshots()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.started_at IS NULL
    OR NEW.status NOT IN ('in_progress','live')
    OR NOT (OLD.started_at IS NULL OR OLD.status NOT IN ('in_progress','live'))
  THEN RETURN NEW; END IF;

  INSERT INTO public.gig_stage_visual_snapshots (gig_id, profile_id, visual_snapshot)
  SELECT NEW.id, performers.profile_id,
    jsonb_build_object(
      'version', 1,
      'appearance', psa.appearance,
      'legacy', CASE WHEN pac.profile_id IS NULL THEN NULL ELSE jsonb_build_object(
        'profile_id', performers.profile_id,
        'gender', pac.gender, 'skin_tone', pac.skin_tone,
        'hair_color', pac.hair_color, 'height', pac.height,
        'shirt_color', pac.shirt_color, 'pants_color', pac.pants_color,
        'shoes_color', pac.shoes_color
      ) END,
      'clothing', coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'item', to_jsonb(aci),
            'selectedVariantKey', pos.selected_variant_key,
            'customizationConfig', coalesce(pos.customization_config,'{}'::jsonb)
          ) ORDER BY public.clothing_equip_slot(aci.wearable_slot,aci.category),aci.id
        )
        FROM public.player_owned_skins pos
        JOIN public.avatar_clothing_items aci ON aci.id=pos.item_id
        WHERE pos.profile_id=performers.profile_id
          AND pos.item_type='clothing' AND pos.is_equipped IS TRUE
      ), '[]'::jsonb)
    )
  FROM (
    SELECT DISTINCT gp.profile_id
    FROM public.gig_performers gp
    WHERE gp.gig_id=NEW.id
      AND gp.profile_id IS NOT NULL
      AND gp.lineup_status IN ('selected','performed')
  ) performers
  LEFT JOIN public.player_stage_appearances psa ON psa.profile_id=performers.profile_id
  LEFT JOIN public.player_avatar_config pac ON pac.profile_id=performers.profile_id
  ON CONFLICT (gig_id,profile_id) DO NOTHING;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_gig_stage_visual_snapshots()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_capture_gig_stage_visual_snapshots ON public.gigs;
CREATE TRIGGER trg_capture_gig_stage_visual_snapshots
AFTER UPDATE OF status,started_at ON public.gigs
FOR EACH ROW EXECUTE FUNCTION public.capture_gig_stage_visual_snapshots();

-- Preserve the first captured truth even under an accidental privileged
-- replay retry or duplicate start transition. Updates are blocked but ON
-- DELETE CASCADE must remain functional for gig/profile erasure requests.
CREATE OR REPLACE FUNCTION public.reject_gig_stage_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'gig_stage_visual_snapshot_immutable' USING ERRCODE='P0001';
END;
$$;
REVOKE ALL ON FUNCTION public.reject_gig_stage_snapshot_mutation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_immutable_gig_stage_visual_snapshots ON public.gig_stage_visual_snapshots;
CREATE TRIGGER trg_immutable_gig_stage_visual_snapshots
BEFORE UPDATE ON public.gig_stage_visual_snapshots
FOR EACH ROW EXECUTE FUNCTION public.reject_gig_stage_snapshot_mutation();

NOTIFY pgrst, 'reload schema';
