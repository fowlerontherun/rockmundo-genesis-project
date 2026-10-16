-- Halloween 2026 publication interlock. Both admin flags may be enabled while
-- the real Avatar V1 Pumpkin Hat is still pending human visual QA.
-- Public UI correctly stays hidden until publication; the payout authorities
-- must fail closed too. Never forge validation notes or auto-publish the hat.
-- Additive replacement only: no historical outfit/XP/achievement mutations.
--
-- Snapshot eligibility is fixed at gig start. A hat published after that
-- start does NOT retrospectively make the gig eligible.
CREATE OR REPLACE FUNCTION public.halloween_2026_hat_is_published()
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.avatar_clothing_items
    WHERE curated_asset_key='clothing.halloween.2026.pumpkin-hat'
      AND curated_asset_status='published'
  );
$$;
REVOKE ALL ON FUNCTION public.halloween_2026_hat_is_published()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.halloween_2026_hat_is_published()
  TO service_role;

-- Preserve the existing deterministic rolls, frozen snapshots and private
-- grant model. Only add the publication requirement to the two other gates.
CREATE OR REPLACE FUNCTION public.capture_halloween_2026_gig_outfits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_start timestamptz := ('2026-10-24 00:00 Europe/London')::timestamptz;
  v_end timestamptz := ('2026-11-02 00:00 Europe/London')::timestamptz;
  v_settings jsonb;
BEGIN
  IF NEW.started_at IS NULL
     OR NEW.started_at < v_start OR NEW.started_at >= v_end
     OR NEW.status NOT IN ('in_progress','live')
     OR NOT (OLD.started_at IS NULL OR OLD.status NOT IN ('in_progress','live'))
  THEN RETURN NEW; END IF;

  SELECT value INTO v_settings FROM public.system_settings
   WHERE key = 'halloween_2026_event';
  IF coalesce(v_settings->>'enabled','false') <> 'true'
     OR coalesce(v_settings->>'rewards_live','false') <> 'true'
    OR NOT public.halloween_2026_hat_is_published()
  THEN RETURN NEW; END IF;

  INSERT INTO public.halloween_2026_gig_outfits
    (gig_id, profile_id, snapshotted_at, was_equipped, performance_pct)
  SELECT NEW.id, participants.profile_id, now(), participants.wearing,
    CASE WHEN participants.wearing
      THEN public.halloween_2026_bonus_for_roll(participants.roll)
      ELSE 0 END
  FROM (
    SELECT DISTINCT gp.profile_id,
      EXISTS (
        SELECT 1 FROM public.player_owned_skins pos
        JOIN public.avatar_clothing_items item ON item.id = pos.item_id
        WHERE pos.profile_id = gp.profile_id
          AND pos.item_type = 'clothing'
          AND pos.is_equipped IS TRUE
          AND item.curated_asset_key = 'clothing.halloween.2026.pumpkin-hat'
      ) AS wearing,
      (
        (get_byte(decode(md5(NEW.id::text || ':' || gp.profile_id::text || ':haunted-stage-2026'), 'hex'), 0) * 65536
        +get_byte(decode(md5(NEW.id::text || ':' || gp.profile_id::text || ':haunted-stage-2026'), 'hex'), 1) * 256
        +get_byte(decode(md5(NEW.id::text || ':' || gp.profile_id::text || ':haunted-stage-2026'), 'hex'), 2)
        ) % 100
      )::integer AS roll
    FROM public.gig_performers gp
    WHERE gp.gig_id = NEW.id AND gp.profile_id IS NOT NULL
      AND gp.lineup_status IN ('selected','performed')
  ) participants
  ON CONFLICT (gig_id, profile_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_halloween_2026_gig_bonus(p_gig_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_settings jsonb;
  v_gig public.gigs%ROWTYPE;
  v_start timestamptz := ('2026-10-24 00:00 Europe/London')::timestamptz;
  v_end timestamptz := ('2026-11-02 00:00 Europe/London')::timestamptz;
  v_pct numeric := 0;
  v_count integer := 0;
  v_members jsonb := '[]'::jsonb;
BEGIN
  SELECT value INTO v_settings FROM public.system_settings
   WHERE key='halloween_2026_event';
  IF coalesce(v_settings->>'enabled','false') <> 'true'
    OR coalesce(v_settings->>'rewards_live','false') <> 'true'
    OR NOT public.halloween_2026_hat_is_published()
    OR now() < v_start OR now() >= v_end THEN
    RETURN jsonb_build_object('performance_pct',0,'qualifying_members',0,'members','[]'::jsonb);
  END IF;
  SELECT * INTO v_gig FROM public.gigs WHERE id=p_gig_id;
  IF NOT FOUND OR v_gig.status IN ('completed','cancelled','failed')
     OR v_gig.started_at IS NULL
     OR v_gig.started_at < v_start OR v_gig.started_at >= v_end THEN
    RETURN jsonb_build_object('performance_pct',0,'qualifying_members',0,'members','[]'::jsonb);
  END IF;

  SELECT coalesce(avg(o.performance_pct),0), count(*) FILTER (WHERE o.was_equipped)::integer,
    coalesce(jsonb_agg(jsonb_build_object('profile_id',o.profile_id,'performance_pct',o.performance_pct)
      ORDER BY o.profile_id) FILTER (WHERE o.was_equipped),'[]'::jsonb)
  INTO v_pct,v_count,v_members
  FROM public.halloween_2026_gig_outfits o
  WHERE o.gig_id=p_gig_id
    AND EXISTS (
      SELECT 1 FROM public.gig_performers gp
      WHERE gp.gig_id=o.gig_id AND gp.profile_id=o.profile_id
        AND gp.lineup_status IN ('selected','performed')
    );
  RETURN jsonb_build_object('performance_pct',v_pct,
    'qualifying_members',v_count,'members',v_members);
END;
$$;

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
    OR NOT public.halloween_2026_hat_is_published()
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

-- Existing trigger bindings invoke the replaced functions without recreation.
-- New behaviour applies to all ordinary, tour and festival gigs.
COMMENT ON FUNCTION public.halloween_2026_hat_is_published()
  IS 'Read-only Halloween payout interlock: requires human-QA-published real Pumpkin Hat.';
NOTIFY pgrst, 'reload schema';
