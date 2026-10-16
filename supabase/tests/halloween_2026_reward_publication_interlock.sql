-- Disposable PostgreSQL regression: even with BOTH admin event switches armed,
-- an unpublished Pumpkin Hat must never earn a gig bonus or a first XP reward.
-- Real human QA is required before publication. All fixture writes are rolled back.
BEGIN;
DO $halloween_publish$
DECLARE
  v_first uuid := '30000000-0000-4000-8000-000000000001';
  v_second uuid := '30000000-0000-4000-8000-000000000022';
  v_wearer uuid := '10000000-0000-4000-8000-000000000001';
  v_hat uuid := '50000000-0000-4000-8000-000000000001';
  v_bonus jsonb;
BEGIN
  UPDATE public.system_settings SET value =
    jsonb_set(jsonb_set(value,'{enabled}','true'::jsonb),
                         '{rewards_live}','true'::jsonb)
  WHERE key='halloween_2026_event';

  -- Live release state: gifted, wearable, but curated QA not yet published.
  UPDATE public.avatar_clothing_items SET curated_asset_status='asset_ready'
  WHERE id=v_hat;
  IF public.halloween_2026_hat_is_published() THEN
    RAISE EXCEPTION 'Unpublished Pumpkin Hat incorrectly certified';
  END IF;
  UPDATE public.gigs
  SET status='in_progress',started_at='2026-10-25T12:00:00Z'
  WHERE id=v_first;
  IF EXISTS(SELECT 1 FROM public.halloween_2026_gig_outfits
    WHERE gig_id=v_first) THEN
    RAISE EXCEPTION 'Unpublished hat captured an eligible reward snapshot';
  END IF;
  v_bonus := public.get_halloween_2026_gig_bonus(v_first);
  IF (v_bonus->>'performance_pct')::numeric <> 0 THEN
    RAISE EXCEPTION 'Unpublished Pumpkin Hat applied a performance boost';
  END IF;

  -- Publishing later cannot retrospectively award this first gig.
  UPDATE public.avatar_clothing_items SET curated_asset_status='published'
  WHERE id=v_hat;
  IF NOT public.halloween_2026_hat_is_published() THEN
    RAISE EXCEPTION 'Published Pumpkin Hat not recognised';
  END IF;
  INSERT INTO public.gig_outcomes(id,gig_id,completed_at,xp_breakdown)
  VALUES('60000000-0000-4000-8000-000000000022',v_first,
         '2026-10-25T12:30:00Z','{}'::jsonb);
  INSERT INTO public.gig_song_performances(id,gig_outcome_id)
  VALUES('70000000-0000-4000-8000-000000000022',
         '60000000-0000-4000-8000-000000000022');
  UPDATE public.gigs SET status='completed',
    completed_at='2026-10-25T12:30:00Z' WHERE id=v_first;
  IF EXISTS(SELECT 1 FROM public.halloween_2026_first_rewards
            WHERE gig_id=v_first)
    OR (SELECT experience FROM public.profiles WHERE id=v_wearer)<>0
  THEN RAISE EXCEPTION 'Late publishing retroactively awarded an old gig'; END IF;

  -- A new gig actually starting after publication becomes eligible.
  INSERT INTO public.gigs(id,status) VALUES(v_second,'scheduled');
  INSERT INTO public.gig_performers(id,gig_id,profile_id,lineup_status)
  VALUES('40000000-0000-4000-8000-000000000022',v_second,
         v_wearer,'selected');
  UPDATE public.gigs SET status='in_progress',
    started_at='2026-10-25T14:00:00Z' WHERE id=v_second;
  IF (SELECT count(*) FROM public.halloween_2026_gig_outfits
      WHERE gig_id=v_second AND profile_id=v_wearer AND was_equipped
        AND performance_pct IN (5,10,15))<>1
  THEN RAISE EXCEPTION 'Published hat did not freeze eligible performance'; END IF;
  -- The actual bonus resolver deliberately refuses payout outside real-world
  -- 24 Oct–1 Nov, even with a future-dated synthetic gig. Never fake DB time
  -- or weaken this production gate for a pre-launch test.
  v_bonus := public.get_halloween_2026_gig_bonus(v_second);
  IF pg_catalog.now() < '2026-10-23T23:00:00Z'::timestamptz
     OR pg_catalog.now() >= '2026-11-02T00:00:00Z'::timestamptz THEN
    IF (v_bonus->>'performance_pct')::numeric <> 0 THEN
      RAISE EXCEPTION 'Bonus resolver ignored the live calendar window'; END IF;
  ELSIF (v_bonus->>'performance_pct')::numeric NOT IN (5,10,15) THEN
    RAISE EXCEPTION 'Published hat did not produce the frozen boost: %',v_bonus;
  END IF;

  -- Demoting publication again suppresses both score and completed XP.
  UPDATE public.avatar_clothing_items SET curated_asset_status='asset_ready'
  WHERE id=v_hat;
  v_bonus := public.get_halloween_2026_gig_bonus(v_second);
  IF (v_bonus->>'performance_pct')::numeric <> 0 THEN
    RAISE EXCEPTION 'Demoted hat still earned a performance boost'; END IF;
  INSERT INTO public.gig_outcomes(id,gig_id,completed_at,xp_breakdown)
  VALUES('60000000-0000-4000-8000-000000000023',v_second,
         '2026-10-25T14:30:00Z','{}'::jsonb);
  INSERT INTO public.gig_song_performances(id,gig_outcome_id)
  VALUES('70000000-0000-4000-8000-000000000023',
         '60000000-0000-4000-8000-000000000023');
  UPDATE public.gigs SET status='completed',
    completed_at='2026-10-25T14:30:00Z' WHERE id=v_second;
  IF EXISTS(SELECT 1 FROM public.halloween_2026_first_rewards)
    OR (SELECT experience FROM public.profiles WHERE id=v_wearer)<>0
  THEN RAISE EXCEPTION 'Unpublished hat paid first reward after completion'; END IF;

  -- Idempotent settlement becomes possible only after valid publication.
  UPDATE public.avatar_clothing_items SET curated_asset_status='published'
  WHERE id=v_hat;
  PERFORM public.reconcile_halloween_2026_first_rewards(v_second);
  PERFORM public.reconcile_halloween_2026_first_rewards(v_second);
  IF (SELECT experience FROM public.profiles WHERE id=v_wearer)<>500
    OR (SELECT count(*) FROM public.experience_ledger
        WHERE profile_id=v_wearer AND activity_type='halloween_gig')<>1
    OR (SELECT count(*) FROM public.halloween_2026_first_rewards
        WHERE profile_id=v_wearer AND gig_id=v_second)<>1
  THEN RAISE EXCEPTION 'Published retry did not award 500 XP exactly once'; END IF;
END;
$halloween_publish$;
ROLLBACK;
