-- Repair missed Halloween first rewards when the normal completion transition
-- precedes gig_outcomes.completed_at or the final performed song. No gig status
-- transition is replayed, so other gig settlements and fan rewards are untouched.
-- All paths share one exact-once claim/XP/achievement settlement, including retry
-- audit reconstruction from the immutable first-gig ledger. Restrict to gigs
-- genuinely started and completed inside the UK Halloween event window and only
-- if both server-side release flags are enabled.
CREATE OR REPLACE FUNCTION public.reconcile_halloween_2026_first_rewards(p_gig_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_settings jsonb;
  v_start timestamptz := ('2026-10-24 00:00 Europe/London')::timestamptz;
  v_end timestamptz := ('2026-11-02 00:00 Europe/London')::timestamptz;
  v_member record;
  v_achievement uuid;
  v_inserted uuid;
  v_awarded jsonb := '[]'::jsonb;
  v_outcome_id uuid;
  v_gig public.gigs%ROWTYPE;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id=p_gig_id;
  IF NOT FOUND OR v_gig.status <> 'completed'
     OR v_gig.started_at IS NULL OR v_gig.completed_at IS NULL
     OR v_gig.started_at < v_start OR v_gig.started_at >= v_end
     OR v_gig.completed_at < v_start OR v_gig.completed_at >= v_end
  THEN RETURN; END IF;

  SELECT value INTO v_settings FROM public.system_settings
    WHERE key='halloween_2026_event';
  IF coalesce(v_settings->>'enabled','false') <> 'true'
    OR coalesce(v_settings->>'rewards_live','false') <> 'true'
  THEN RETURN; END IF;

  SELECT go.id INTO v_outcome_id FROM public.gig_outcomes go
   WHERE go.gig_id=v_gig.id AND go.completed_at IS NOT NULL;
  IF v_outcome_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.gig_song_performances sp
    WHERE sp.gig_outcome_id=v_outcome_id
  ) THEN RETURN; END IF;

  SELECT id INTO v_achievement FROM public.achievements
   WHERE slug='pumpkin-headliner-2026';

  FOR v_member IN
    SELECT o.profile_id, p.user_id
    FROM public.halloween_2026_gig_outfits o
    JOIN public.gig_performers gp ON gp.gig_id=o.gig_id
      AND gp.profile_id=o.profile_id
    JOIN public.profiles p ON p.id=o.profile_id
    WHERE o.gig_id=v_gig.id AND o.was_equipped
      AND gp.lineup_status IN ('selected','performed')
      AND p.user_id IS NOT NULL
    GROUP BY o.profile_id,p.user_id
  LOOP
    v_inserted := NULL;
    INSERT INTO public.halloween_2026_first_rewards(profile_id,gig_id)
    VALUES(v_member.profile_id,v_gig.id)
    ON CONFLICT (profile_id) DO NOTHING
    RETURNING profile_id INTO v_inserted;

    IF v_inserted IS NULL THEN CONTINUE; END IF;
    UPDATE public.profiles SET experience=coalesce(experience,0)+500
     WHERE id=v_member.profile_id;
    INSERT INTO public.experience_ledger
      (user_id,profile_id,activity_type,xp_amount,metadata)
    VALUES(v_member.user_id,v_member.profile_id,'halloween_gig',500,
      jsonb_build_object('event','haunted-stage-2026','gig_id',v_gig.id));

    IF v_achievement IS NOT NULL THEN
      INSERT INTO public.player_achievements
        (user_id,profile_id,achievement_id,unlocked_at,progress)
      VALUES(v_member.user_id,v_member.profile_id,v_achievement,now(),
        '{"haunted_stage_2026":true}'::jsonb)
      ON CONFLICT DO NOTHING;
    END IF;

    UPDATE public.halloween_2026_gig_outfits SET first_reward_awarded=true
     WHERE gig_id=v_gig.id AND profile_id=v_member.profile_id;
    v_awarded := v_awarded || jsonb_build_array(v_member.profile_id);
  END LOOP;

  -- The first-reward ledger is the durable source of truth. Rebuild the
  -- saved report from claims whose FIRST qualifying gig is this one, including
  -- after outcome reprocessing has replaced xp_breakdown before this trigger.
  SELECT coalesce(jsonb_agg(fr.profile_id ORDER BY fr.profile_id),'[]'::jsonb)
    INTO v_awarded
  FROM public.halloween_2026_first_rewards fr
  WHERE fr.gig_id=v_gig.id;

  UPDATE public.gig_outcomes
  SET xp_breakdown = coalesce(xp_breakdown,'{}'::jsonb) ||
    jsonb_build_object('halloween_2026_first_rewards',
      jsonb_build_object('awarded_profiles',v_awarded,'xp_each',500))
  WHERE id=v_outcome_id;

  RETURN;
END;
$$;
CREATE OR REPLACE FUNCTION public.settle_halloween_2026_first_rewards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    PERFORM public.reconcile_halloween_2026_first_rewards(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_halloween_2026_outcome_ready()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL THEN
    PERFORM public.reconcile_halloween_2026_first_rewards(NEW.gig_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconcile_halloween_2026_outcome_ready ON public.gig_outcomes;
CREATE TRIGGER trg_reconcile_halloween_2026_outcome_ready
AFTER INSERT OR UPDATE OF completed_at ON public.gig_outcomes
FOR EACH ROW EXECUTE FUNCTION public.reconcile_halloween_2026_outcome_ready();

CREATE OR REPLACE FUNCTION public.reconcile_halloween_2026_performed_song_ready()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_gig_id uuid;
BEGIN
  SELECT go.gig_id INTO v_gig_id FROM public.gig_outcomes go WHERE go.id=NEW.gig_outcome_id;
  IF v_gig_id IS NOT NULL THEN
    PERFORM public.reconcile_halloween_2026_first_rewards(v_gig_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconcile_halloween_2026_performed_song_ready
 ON public.gig_song_performances;
CREATE TRIGGER trg_reconcile_halloween_2026_performed_song_ready
AFTER INSERT ON public.gig_song_performances
FOR EACH ROW EXECUTE FUNCTION public.reconcile_halloween_2026_performed_song_ready();

REVOKE ALL ON FUNCTION public.reconcile_halloween_2026_first_rewards(uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.settle_halloween_2026_first_rewards()
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reconcile_halloween_2026_outcome_ready()
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reconcile_halloween_2026_performed_song_ready()
  FROM PUBLIC,anon,authenticated;

NOTIFY pgrst, 'reload schema';
