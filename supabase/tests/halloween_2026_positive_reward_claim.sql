-- A future-dated gig fixture tests the real transactional claims today,
-- before the calendar event begins. All writes are rolled back.
BEGIN;
DO $$
DECLARE
  v_gig uuid := '30000000-0000-4000-8000-000000000001';
  v_wearer uuid := '10000000-0000-4000-8000-000000000001';
  v_other uuid := '10000000-0000-4000-8000-000000000002';
  v_outcome uuid := '60000000-0000-4000-8000-000000000001';
  v_song uuid := '70000000-0000-4000-8000-000000000001';
  v_reward_audit jsonb;
BEGIN
  UPDATE public.system_settings
    SET value=jsonb_set(jsonb_set(value,'{enabled}','true'::jsonb),
                        '{rewards_live}','true'::jsonb)
  WHERE key='halloween_2026_event';

  INSERT INTO public.gig_outcomes (id,gig_id,completed_at,xp_breakdown)
    VALUES (v_outcome,v_gig,'2026-10-25T12:30:00Z','{"halloween_2026":{"performance_pct":5}}'::jsonb);
  INSERT INTO public.gig_song_performances (id,gig_outcome_id)
    VALUES (v_song,v_outcome);
  UPDATE public.gigs
    SET status='in_progress',started_at='2026-10-25T12:00:00Z'
  WHERE id=v_gig;
  IF NOT EXISTS (
    SELECT 1 FROM public.halloween_2026_gig_outfits
    WHERE gig_id=v_gig AND profile_id=v_wearer AND was_equipped IS TRUE
      AND performance_pct IN (5,10,15)
  ) THEN RAISE EXCEPTION 'Active event missed start-time Pumpkin Hat claim'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.halloween_2026_gig_outfits
    WHERE gig_id=v_gig AND profile_id=v_other AND was_equipped IS FALSE
      AND performance_pct=0
  ) THEN RAISE EXCEPTION 'Event gave a non-wearing bandmate a bonus'; END IF;

  UPDATE public.gigs
    SET status='completed',completed_at='2026-10-25T12:30:00Z'
  WHERE id=v_gig;
  IF (SELECT experience FROM public.profiles WHERE id=v_wearer)<>500
    OR (SELECT experience FROM public.profiles WHERE id=v_other)<>0
  THEN RAISE EXCEPTION 'Incorrect Halloween XP distribution'; END IF;
  IF (SELECT count(*) FROM public.experience_ledger
      WHERE profile_id=v_wearer AND activity_type='halloween_gig')<>1
  THEN RAISE EXCEPTION 'Halloween XP ledger not unique'; END IF;
  IF (SELECT count(*) FROM public.player_achievements pa
      JOIN public.achievements a ON a.id=pa.achievement_id
      WHERE pa.profile_id=v_wearer AND a.slug='pumpkin-headliner-2026')<>1
  THEN RAISE EXCEPTION 'Halloween achievement not awarded exactly once'; END IF;
  IF (SELECT count(*) FROM public.halloween_2026_first_rewards
      WHERE profile_id=v_wearer)<>1
  THEN RAISE EXCEPTION 'First-time Halloween reward claim not recorded'; END IF;

  -- Simulate a worker retry after the first successful completion.
  UPDATE public.gigs SET status='processing_outcome' WHERE id=v_gig;
  UPDATE public.gigs SET status='completed' WHERE id=v_gig;
  IF (SELECT experience FROM public.profiles WHERE id=v_wearer)<>500
    OR (SELECT count(*) FROM public.experience_ledger
        WHERE profile_id=v_wearer AND activity_type='halloween_gig')<>1
  THEN RAISE EXCEPTION 'A retried gig paid Halloween XP twice'; END IF;
  SELECT xp_breakdown->'halloween_2026_first_rewards'
    INTO v_reward_audit FROM public.gig_outcomes WHERE id=v_outcome;
  IF coalesce(v_reward_audit->'awarded_profiles','[]'::jsonb)
      <> jsonb_build_array(v_wearer) THEN
    RAISE EXCEPTION 'Gig retry erased immutable Halloween reward evidence: %',v_reward_audit;
  END IF;
END;
$$;
ROLLBACK;
