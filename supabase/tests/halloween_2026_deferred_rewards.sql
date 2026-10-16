-- Deferred outcome and performed-song settlement on disposable PostgreSQL.
-- Proves exactly-once XP and achievement after a gig already completed.
-- No production players, XP, scheduled gigs or rewards are touched.
BEGIN;
DO $halloween_late$
DECLARE
  v_gig_a uuid := '30000000-0000-4000-8000-000000000001';
  v_gig_b uuid := '30000000-0000-4000-8000-000000000002';
  v_gig_c uuid := '30000000-0000-4000-8000-000000000003';
  v_wearer_a uuid := '10000000-0000-4000-8000-000000000001';
  v_wearer_b uuid := '10000000-0000-4000-8000-000000000002';
  v_hat uuid := '50000000-0000-4000-8000-000000000001';
  v_outcome_a uuid := '60000000-0000-4000-8000-000000000001';
  v_outcome_b uuid := '60000000-0000-4000-8000-000000000002';
  v_outcome_c uuid := '60000000-0000-4000-8000-000000000003';
BEGIN
  INSERT INTO public.gigs(id,status) VALUES(v_gig_b,'scheduled'),(v_gig_c,'scheduled');
  INSERT INTO public.gig_performers(id,gig_id,profile_id,lineup_status)
  VALUES ('40000000-0000-4000-8000-000000000012',v_gig_b,v_wearer_b,'selected'),
         ('40000000-0000-4000-8000-000000000013',v_gig_c,v_wearer_a,'selected');
  INSERT INTO public.player_owned_skins(profile_id,item_id,item_type,is_equipped)
  VALUES(v_wearer_b,v_hat,'clothing',true);

  -- A gig started while disabled must NOT bank a later reward eligibility.
  UPDATE public.gigs
     SET status='in_progress',started_at='2026-10-25T11:00:00Z'
   WHERE id=v_gig_c;

  UPDATE public.system_settings
     SET value=jsonb_set(jsonb_set(value,'{enabled}','true'::jsonb),
                         '{rewards_live}','true'::jsonb)
   WHERE key='halloween_2026_event';

  UPDATE public.gigs
     SET status='in_progress',started_at='2026-10-25T12:00:00Z'
   WHERE id IN (v_gig_a,v_gig_b);
  IF (SELECT count(*) FROM public.halloween_2026_gig_outfits
      WHERE gig_id IN (v_gig_a,v_gig_b) AND was_equipped)=2
  THEN NULL;
  ELSE RAISE EXCEPTION 'Frozen eligible snapshots were not captured: %, config %, gigs %',
    (SELECT coalesce(jsonb_agg(jsonb_build_object('gig',gig_id,'wearer',profile_id,
      'worn',was_equipped)),'[]'::jsonb) FROM public.halloween_2026_gig_outfits),
    (SELECT value FROM public.system_settings WHERE key='halloween_2026_event'),
    (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,
      'started',started_at)),'[]'::jsonb) FROM public.gigs);
  END IF;

  -- Completed gigs can precede performed song rows and outcome completion.
  UPDATE public.gigs
     SET status='completed',completed_at='2026-10-25T12:30:00Z'
   WHERE id IN (v_gig_a,v_gig_b,v_gig_c);
  IF EXISTS(SELECT 1 FROM public.halloween_2026_first_rewards) THEN
    RAISE EXCEPTION 'Rewarded before a complete outcome and performed song';
  END IF;

  -- Case A: completed outcome arrives, but no song yet. Wait for performed song.
  INSERT INTO public.gig_outcomes(id,gig_id,completed_at,xp_breakdown)
   VALUES(v_outcome_a,v_gig_a,'2026-10-25T12:30:00Z','{}'::jsonb);
  IF (SELECT experience FROM public.profiles WHERE id=v_wearer_a)<>0
  THEN RAISE EXCEPTION 'A songless gig awarded XP'; END IF;
  INSERT INTO public.gig_song_performances(id,gig_outcome_id)
   VALUES('70000000-0000-4000-8000-000000000001',v_outcome_a);
  IF (SELECT experience FROM public.profiles WHERE id=v_wearer_a)<>500
    OR (SELECT count(*) FROM public.halloween_2026_first_rewards WHERE profile_id=v_wearer_a)<>1
    OR (SELECT count(*) FROM public.experience_ledger WHERE profile_id=v_wearer_a AND activity_type='halloween_gig')<>1
  THEN RAISE EXCEPTION 'Late performed song did not reconcile first 500 XP'; END IF;
  INSERT INTO public.gig_song_performances(id,gig_outcome_id)
   VALUES('70000000-0000-4000-8000-000000000002',v_outcome_a);
  IF (SELECT experience FROM public.profiles WHERE id=v_wearer_a)<>500
  THEN RAISE EXCEPTION 'Second performed song awarded duplicate XP'; END IF;

  -- Case B: a song exists, but outcome completed_at is populated late.
  INSERT INTO public.gig_outcomes(id,gig_id,completed_at,xp_breakdown)
   VALUES(v_outcome_b,v_gig_b,NULL,'{}'::jsonb);
  INSERT INTO public.gig_song_performances(id,gig_outcome_id)
   VALUES('70000000-0000-4000-8000-000000000003',v_outcome_b);
  IF (SELECT experience FROM public.profiles WHERE id=v_wearer_b)<>0
  THEN RAISE EXCEPTION 'Incomplete gig outcome awarded XP'; END IF;
  UPDATE public.gig_outcomes
    SET completed_at='2026-10-25T12:30:00Z'
    WHERE id=v_outcome_b;
  IF (SELECT experience FROM public.profiles WHERE id=v_wearer_b)<>500
    OR (SELECT count(*) FROM public.player_achievements pa
        JOIN public.achievements a ON a.id=pa.achievement_id
        WHERE pa.profile_id=v_wearer_b AND a.slug='pumpkin-headliner-2026')<>1
  THEN RAISE EXCEPTION 'Late completed outcome did not settle XP/achievement'; END IF;

  -- Case C: even after gates are enabled, a pre-activation start remains excluded.
  INSERT INTO public.gig_outcomes(id,gig_id,completed_at,xp_breakdown)
   VALUES(v_outcome_c,v_gig_c,'2026-10-25T12:30:00Z','{}'::jsonb);
  INSERT INTO public.gig_song_performances(id,gig_outcome_id)
   VALUES('70000000-0000-4000-8000-000000000004',v_outcome_c);
  IF (SELECT count(*) FROM public.halloween_2026_first_rewards)<>2
    OR (SELECT count(*) FROM public.experience_ledger WHERE activity_type='halloween_gig')<>2
  THEN RAISE EXCEPTION 'Disabled gig received retroactive XP or a later event duplicated claims'; END IF;
END;
$halloween_late$;
ROLLBACK;
