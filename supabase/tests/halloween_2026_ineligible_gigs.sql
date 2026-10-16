-- Negative claims on a disposable SQL database; no live data touched.
BEGIN;
DO $$
DECLARE
  v_wearer uuid := '10000000-0000-4000-8000-000000000001';
  v_gig_cancelled uuid := '30000000-0000-4000-8000-000000000002';
  v_gig_empty uuid := '30000000-0000-4000-8000-000000000003';
  v_gig_late uuid := '30000000-0000-4000-8000-000000000004';
  v_gig_absent uuid := '30000000-0000-4000-8000-000000000005';
BEGIN
  UPDATE public.system_settings SET value=
    jsonb_set(jsonb_set(value,'{enabled}','true'::jsonb),
      '{rewards_live}','true'::jsonb)
  WHERE key='halloween_2026_event';
  INSERT INTO public.gigs(id,status) VALUES
    (v_gig_cancelled,'scheduled'),(v_gig_empty,'scheduled'),
    (v_gig_late,'scheduled'),(v_gig_absent,'scheduled');
  INSERT INTO public.gig_performers(id,gig_id,profile_id,lineup_status) VALUES
    ('40000000-0000-4000-8000-000000000012',v_gig_cancelled,v_wearer,'selected'),
    ('40000000-0000-4000-8000-000000000013',v_gig_empty,v_wearer,'selected'),
    ('40000000-0000-4000-8000-000000000014',v_gig_late,v_wearer,'selected'),
    ('40000000-0000-4000-8000-000000000015',v_gig_absent,v_wearer,'absent');

  UPDATE public.gigs SET status='in_progress',started_at='2026-10-25T12:00:00Z'
  WHERE id IN (v_gig_cancelled,v_gig_empty,v_gig_absent);
  UPDATE public.gigs SET status='in_progress',started_at='2026-11-02T12:00:00Z'
  WHERE id=v_gig_late;
  IF EXISTS(SELECT 1 FROM public.halloween_2026_gig_outfits
       WHERE gig_id IN (v_gig_late,v_gig_absent))
  THEN RAISE EXCEPTION 'Late or absent players had eligible outfit snapshots'; END IF;

  INSERT INTO public.gig_outcomes(id,gig_id,completed_at,xp_breakdown) VALUES
    ('60000000-0000-4000-8000-000000000012',v_gig_cancelled,'2026-10-25T12:30:00Z','{}'::jsonb),
    ('60000000-0000-4000-8000-000000000013',v_gig_empty,'2026-10-25T12:30:00Z','{}'::jsonb),
    ('60000000-0000-4000-8000-000000000014',v_gig_late,'2026-11-02T12:30:00Z','{}'::jsonb),
    ('60000000-0000-4000-8000-000000000015',v_gig_absent,'2026-10-25T12:30:00Z','{}'::jsonb);
  INSERT INTO public.gig_song_performances(id,gig_outcome_id) VALUES
    ('70000000-0000-4000-8000-000000000012','60000000-0000-4000-8000-000000000012'),
    ('70000000-0000-4000-8000-000000000014','60000000-0000-4000-8000-000000000014'),
    ('70000000-0000-4000-8000-000000000015','60000000-0000-4000-8000-000000000015');
  UPDATE public.gigs SET status='cancelled',completed_at='2026-10-25T12:30:00Z'
  WHERE id=v_gig_cancelled;
  UPDATE public.gigs SET status='completed',completed_at='2026-10-25T12:30:00Z'
  WHERE id IN (v_gig_empty,v_gig_absent);
  UPDATE public.gigs SET status='completed',completed_at='2026-11-02T12:30:00Z'
  WHERE id=v_gig_late;

  IF EXISTS(SELECT 1 FROM public.halloween_2026_first_rewards WHERE profile_id=v_wearer)
     OR EXISTS(SELECT 1 FROM public.player_achievements WHERE profile_id=v_wearer)
     OR EXISTS(SELECT 1 FROM public.experience_ledger WHERE profile_id=v_wearer)
     OR (SELECT experience FROM public.profiles WHERE id=v_wearer)<>0
  THEN RAISE EXCEPTION 'Cancelled, songless, late or absent gigs paid Halloween rewards'; END IF;
END;
$$;
ROLLBACK;
