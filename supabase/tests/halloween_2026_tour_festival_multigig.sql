-- Full cross-gig regression on disposable PostgreSQL only.
-- Festival and tour shows use the SAME authoritative snapshot/reward path.
-- The transaction is rolled back, with no production player writes.
BEGIN;

-- The isolated schema omits optional gig classification fields; restore them
-- inside the rollback transaction to exercise the real gig-type contract.
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS show_type text;
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS tour_id uuid;

DO $halloween_multi$
DECLARE
  v_festival uuid := '30000000-0000-4000-8000-000000000001';
  v_tour uuid := '30000000-0000-4000-8000-000000000020';
  v_a uuid := '10000000-0000-4000-8000-000000000001';
  v_b uuid := '10000000-0000-4000-8000-000000000002';
  v_hat uuid := '50000000-0000-4000-8000-000000000001';
  v_outcome_f uuid := '60000000-0000-4000-8000-000000000020';
  v_outcome_t uuid := '60000000-0000-4000-8000-000000000021';
  v_festival_bonus integer;
  v_tour_bonus integer;
  v_festival_costume jsonb;
  v_tour_costume jsonb;
  v_festival_audit jsonb;
  v_tour_audit jsonb;
BEGIN
  UPDATE public.system_settings
     SET value=jsonb_set(jsonb_set(value,'{enabled}','true'::jsonb),
                         '{rewards_live}','true'::jsonb)
   WHERE key='halloween_2026_event';
  UPDATE public.gigs SET show_type='festival' WHERE id=v_festival;
  INSERT INTO public.gigs(id,status,show_type,tour_id)
  VALUES (v_tour,'scheduled','concert','90000000-0000-4000-8000-000000000020');
  INSERT INTO public.gig_performers(id,gig_id,profile_id,lineup_status)
  VALUES
    ('40000000-0000-4000-8000-000000000020',v_tour,v_a,'selected'),
    ('40000000-0000-4000-8000-000000000021',v_tour,v_b,'selected');

  -- Festival starts with A wearing the hat and B WITHOUT it.
  UPDATE public.gigs
     SET status='in_progress',started_at='2026-10-25T11:00:00Z'
   WHERE id=v_festival;
  IF (SELECT count(*) FROM public.halloween_2026_gig_outfits
      WHERE gig_id=v_festival)<>2
     OR NOT EXISTS (SELECT 1 FROM public.halloween_2026_gig_outfits
       WHERE gig_id=v_festival AND profile_id=v_a AND was_equipped AND performance_pct IN (5,10,15))
     OR NOT EXISTS (SELECT 1 FROM public.halloween_2026_gig_outfits
       WHERE gig_id=v_festival AND profile_id=v_b AND NOT was_equipped AND performance_pct=0)
  THEN RAISE EXCEPTION 'Festival did not freeze independent costume eligibility'; END IF;

  SELECT performance_pct INTO v_festival_bonus
    FROM public.halloween_2026_gig_outfits
    WHERE gig_id=v_festival AND profile_id=v_a;
  SELECT visual_snapshot INTO v_festival_costume
    FROM public.gig_stage_visual_snapshots
    WHERE gig_id=v_festival AND profile_id=v_a;

  -- B equips AFTER the festival begins: should qualify for the later tour,
  -- but must not get an earlier festival reward retroactively.
  INSERT INTO public.player_owned_skins(profile_id,item_id,item_type,is_equipped)
    VALUES(v_b,v_hat,'clothing',true);
  UPDATE public.gigs
     SET status='in_progress',started_at='2026-10-25T15:00:00Z'
   WHERE id=v_tour;
  IF (SELECT count(*) FROM public.halloween_2026_gig_outfits
      WHERE gig_id=v_tour AND was_equipped)<>2
  THEN RAISE EXCEPTION 'Tour did not include both hatted performers'; END IF;
  SELECT performance_pct INTO v_tour_bonus
    FROM public.halloween_2026_gig_outfits
    WHERE gig_id=v_tour AND profile_id=v_a;
  SELECT visual_snapshot INTO v_tour_costume
    FROM public.gig_stage_visual_snapshots
    WHERE gig_id=v_tour AND profile_id=v_a;

  -- A removes the hat AFTER both shows have begun; stage recordings,
  -- reward eligibility and deterministic roll MUST stay frozen.
  UPDATE public.player_owned_skins
     SET is_equipped=false WHERE profile_id=v_a AND item_type='clothing' AND item_id=v_hat;
  UPDATE public.gigs SET status='ready_for_completion'
    WHERE id IN (v_festival,v_tour);
  IF (SELECT performance_pct FROM public.halloween_2026_gig_outfits
      WHERE gig_id=v_festival AND profile_id=v_a)<>v_festival_bonus
     OR (SELECT performance_pct FROM public.halloween_2026_gig_outfits
      WHERE gig_id=v_tour AND profile_id=v_a)<>v_tour_bonus
     OR (SELECT visual_snapshot FROM public.gig_stage_visual_snapshots
      WHERE gig_id=v_festival AND profile_id=v_a) IS DISTINCT FROM v_festival_costume
     OR (SELECT visual_snapshot FROM public.gig_stage_visual_snapshots
      WHERE gig_id=v_tour AND profile_id=v_a) IS DISTINCT FROM v_tour_costume
  THEN RAISE EXCEPTION 'After-start outfit changes modified recorded gigs'; END IF;

  INSERT INTO public.gig_outcomes(id,gig_id,completed_at,xp_breakdown)
  VALUES
    (v_outcome_f,v_festival,'2026-10-25T12:00:00Z','{}'::jsonb),
    (v_outcome_t,v_tour,'2026-10-25T16:00:00Z','{}'::jsonb);
  INSERT INTO public.gig_song_performances(id,gig_outcome_id)
  VALUES
    ('70000000-0000-4000-8000-000000000020',v_outcome_f),
    ('70000000-0000-4000-8000-000000000021',v_outcome_t);
  UPDATE public.gigs
     SET status='completed',completed_at='2026-10-25T12:00:00Z'
   WHERE id=v_festival;
  UPDATE public.gigs
     SET status='completed',completed_at='2026-10-25T16:00:00Z'
   WHERE id=v_tour;

  -- A's first hatted event is the festival; B's is the tour. A MUST NOT
  -- get an extra 500 XP just because the second gig is also eligible.
  IF (SELECT experience FROM public.profiles WHERE id=v_a)<>500
     OR (SELECT experience FROM public.profiles WHERE id=v_b)<>500
     OR (SELECT count(*) FROM public.halloween_2026_first_rewards)<>2
     OR (SELECT count(*) FROM public.halloween_2026_first_rewards
          WHERE (profile_id=v_a AND gig_id=v_festival)
             OR (profile_id=v_b AND gig_id=v_tour))<>2
     OR (SELECT count(*) FROM public.experience_ledger
          WHERE activity_type='halloween_gig')<>2
     OR (SELECT count(*) FROM public.player_achievements pa
          JOIN public.achievements a ON a.id=pa.achievement_id
          WHERE a.slug='pumpkin-headliner-2026')<>2
  THEN RAISE EXCEPTION 'Tour and festival first-time rewards were duplicated or missed'; END IF;

  SELECT xp_breakdown->'halloween_2026_first_rewards'->'awarded_profiles'
    INTO v_festival_audit FROM public.gig_outcomes WHERE id=v_outcome_f;
  SELECT xp_breakdown->'halloween_2026_first_rewards'->'awarded_profiles'
    INTO v_tour_audit FROM public.gig_outcomes WHERE id=v_outcome_t;
  IF v_festival_audit<>jsonb_build_array(v_a)
    OR v_tour_audit<>jsonb_build_array(v_b)
  THEN RAISE EXCEPTION 'Character-specific gig reports disclosed wrong first-time rewards: % / %',
    v_festival_audit,v_tour_audit; END IF;

  -- A historical worker replay must never retry rewards, rewrite the
  -- frozen costume, or overwrite either gig report's award evidence.
  UPDATE public.gigs SET status='processing_outcome'
    WHERE id IN (v_festival,v_tour);
  UPDATE public.gigs SET status='completed'
    WHERE id IN (v_festival,v_tour);
  IF (SELECT sum(experience) FROM public.profiles WHERE id IN (v_a,v_b))<>1000
     OR (SELECT count(*) FROM public.experience_ledger
          WHERE activity_type='halloween_gig')<>2
     OR (SELECT xp_breakdown->'halloween_2026_first_rewards'->'awarded_profiles'
          FROM public.gig_outcomes WHERE id=v_outcome_f)<>v_festival_audit
     OR (SELECT xp_breakdown->'halloween_2026_first_rewards'->'awarded_profiles'
          FROM public.gig_outcomes WHERE id=v_outcome_t)<>v_tour_audit
  THEN RAISE EXCEPTION 'Festival/tour retry duplicated XP or mutated permanent results'; END IF;
END;
$halloween_multi$;
ROLLBACK;
