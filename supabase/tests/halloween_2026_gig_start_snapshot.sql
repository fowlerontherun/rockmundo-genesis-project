-- Real trigger exercise on a REPRESENTATIVE disposable PostgreSQL schema.
-- This tests wardrobe freezing even while Halloween rewards remain disabled.
BEGIN;
DO $$
DECLARE
  v_gig uuid := '30000000-0000-4000-8000-000000000001';
  v_wearer uuid := '10000000-0000-4000-8000-000000000001';
  v_other uuid := '10000000-0000-4000-8000-000000000002';
  v_saved jsonb;
BEGIN
  UPDATE public.gigs
    SET status='in_progress',started_at='2026-10-24T12:00:00+00'::timestamptz
    WHERE id=v_gig;
  IF (SELECT count(*) FROM public.gig_stage_visual_snapshots WHERE gig_id=v_gig)<>2
  THEN RAISE EXCEPTION 'Expected snapshots of both actual gig performers'; END IF;
  SELECT visual_snapshot INTO v_saved FROM public.gig_stage_visual_snapshots
    WHERE gig_id=v_gig AND profile_id=v_wearer;
  IF jsonb_array_length(v_saved->'clothing')<>1
      OR v_saved->'clothing'->0->'item'->>'curated_asset_key'<>'clothing.halloween.2026.pumpkin-hat'
  THEN RAISE EXCEPTION 'Worn Pumpkin Hat missing from frozen performance'; END IF;
  IF (SELECT jsonb_array_length(visual_snapshot->'clothing')
     FROM public.gig_stage_visual_snapshots
     WHERE gig_id=v_gig AND profile_id=v_other)<>0
  THEN RAISE EXCEPTION 'Another character inherited the Pumpkin Hat'; END IF;

  -- Modify the live wardrobe after the show starts: saved costume remains.
  UPDATE public.player_owned_skins SET is_equipped=false
    WHERE profile_id=v_wearer AND item_type='clothing';
  UPDATE public.gigs SET status='ready_for_completion' WHERE id=v_gig;
  IF (SELECT visual_snapshot FROM public.gig_stage_visual_snapshots
      WHERE gig_id=v_gig AND profile_id=v_wearer) IS DISTINCT FROM v_saved
  THEN RAISE EXCEPTION 'Historical gig wardrobe changed after unequip'; END IF;

  -- No Halloween bonus rows may be banked while both gates are off.
  IF EXISTS(SELECT 1 FROM public.halloween_2026_gig_outfits WHERE gig_id=v_gig)
  THEN RAISE EXCEPTION 'Inactive event created a reward-eligible costume'; END IF;
END;
$$;
ROLLBACK;
