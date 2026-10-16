-- Preserve permanent first-time reward evidence across gig-completion retries.
-- The original settlement function used only new awards from this invocation,
-- so a retry would erase awarded_profiles in xp_breakdown even though XP and
-- achievements were correctly deduplicated. Reconstruct from durable claims.
-- Additive CREATE OR REPLACE: no profile XP is mutated by this migration.
CREATE OR REPLACE FUNCTION public.settle_halloween_2026_first_rewards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
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
BEGIN
  IF NEW.status <> 'completed' OR OLD.status='completed'
     OR NEW.started_at IS NULL OR NEW.completed_at IS NULL
     OR NEW.started_at < v_start OR NEW.started_at >= v_end
     OR NEW.completed_at < v_start OR NEW.completed_at >= v_end
  THEN RETURN NEW; END IF;

  SELECT value INTO v_settings FROM public.system_settings
    WHERE key='halloween_2026_event';
  IF coalesce(v_settings->>'enabled','false') <> 'true'
    OR coalesce(v_settings->>'rewards_live','false') <> 'true'
  THEN RETURN NEW; END IF;

  SELECT go.id INTO v_outcome_id FROM public.gig_outcomes go
   WHERE go.gig_id=NEW.id AND go.completed_at IS NOT NULL;
  IF v_outcome_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.gig_song_performances sp
    WHERE sp.gig_outcome_id=v_outcome_id
  ) THEN RETURN NEW; END IF;

  SELECT id INTO v_achievement FROM public.achievements
   WHERE slug='pumpkin-headliner-2026';

  FOR v_member IN
    SELECT o.profile_id, p.user_id
    FROM public.halloween_2026_gig_outfits o
    JOIN public.gig_performers gp ON gp.gig_id=o.gig_id
      AND gp.profile_id=o.profile_id
    JOIN public.profiles p ON p.id=o.profile_id
    WHERE o.gig_id=NEW.id AND o.was_equipped
      AND gp.lineup_status IN ('selected','performed')
      AND p.user_id IS NOT NULL
    GROUP BY o.profile_id,p.user_id
  LOOP
    v_inserted := NULL;
    INSERT INTO public.halloween_2026_first_rewards(profile_id,gig_id)
    VALUES(v_member.profile_id,NEW.id)
    ON CONFLICT (profile_id) DO NOTHING
    RETURNING profile_id INTO v_inserted;

    IF v_inserted IS NULL THEN CONTINUE; END IF;
    UPDATE public.profiles SET experience=coalesce(experience,0)+500
     WHERE id=v_member.profile_id;
    INSERT INTO public.experience_ledger
      (user_id,profile_id,activity_type,xp_amount,metadata)
    VALUES(v_member.user_id,v_member.profile_id,'halloween_gig',500,
      jsonb_build_object('event','haunted-stage-2026','gig_id',NEW.id));

    IF v_achievement IS NOT NULL THEN
      INSERT INTO public.player_achievements
        (user_id,profile_id,achievement_id,unlocked_at,progress)
      VALUES(v_member.user_id,v_member.profile_id,v_achievement,now(),
        '{"haunted_stage_2026":true}'::jsonb)
      ON CONFLICT DO NOTHING;
    END IF;

    UPDATE public.halloween_2026_gig_outfits SET first_reward_awarded=true
     WHERE gig_id=NEW.id AND profile_id=v_member.profile_id;
    v_awarded := v_awarded || jsonb_build_array(v_member.profile_id);
  END LOOP;

  -- The first-reward ledger is the durable source of truth. Rebuild the
  -- saved report from claims whose FIRST qualifying gig is this one, including
  -- after outcome reprocessing has replaced xp_breakdown before this trigger.
  SELECT coalesce(jsonb_agg(fr.profile_id ORDER BY fr.profile_id),'[]'::jsonb)
    INTO v_awarded
  FROM public.halloween_2026_first_rewards fr
  WHERE fr.gig_id=NEW.id;

  UPDATE public.gig_outcomes
  SET xp_breakdown = coalesce(xp_breakdown,'{}'::jsonb) ||
    jsonb_build_object('halloween_2026_first_rewards',
      jsonb_build_object('awarded_profiles',v_awarded,'xp_each',500))
  WHERE id=v_outcome_id;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.settle_halloween_2026_first_rewards() FROM PUBLIC, anon, authenticated;


NOTIFY pgrst, 'reload schema';
