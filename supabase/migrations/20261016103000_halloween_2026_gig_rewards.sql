-- The Haunted Stage 2026: one immutable outfit snapshot per gig performer,
-- a deterministic seeded performance roll, and a once-per-character XP claim.
-- This migration does not enable the event; the existing halloween_2026_event
-- system setting must be enabled AFTER the deployment and tests pass.

CREATE TABLE IF NOT EXISTS public.halloween_2026_gig_outfits (
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snapshotted_at timestamptz NOT NULL DEFAULT now(),
  was_equipped boolean NOT NULL,
  performance_pct integer NOT NULL DEFAULT 0
    CHECK (performance_pct IN (0, 5, 10, 15)),
  first_reward_awarded boolean NOT NULL DEFAULT false,
  PRIMARY KEY (gig_id, profile_id),
  CHECK ((was_equipped AND performance_pct IN (5,10,15))
     OR (NOT was_equipped AND performance_pct = 0))
);
CREATE INDEX IF NOT EXISTS halloween_2026_gig_outfits_profile_idx
  ON public.halloween_2026_gig_outfits(profile_id, gig_id);
ALTER TABLE public.halloween_2026_gig_outfits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.halloween_2026_gig_outfits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.halloween_2026_gig_outfits TO service_role;

CREATE TABLE IF NOT EXISTS public.halloween_2026_first_rewards (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  gig_id uuid NOT NULL REFERENCES public.gigs(id),
  granted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.halloween_2026_first_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.halloween_2026_first_rewards FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.halloween_2026_first_rewards TO service_role;

INSERT INTO public.achievements
  (name, description, category, icon, rarity, requirements, rewards, slug)
VALUES (
  'Pumpkin Headliner 2026',
  'Complete a Halloween gig wearing the Haunted Pumpkin Hat during The Haunted Stage 2026.',
  'special', 'trophy', 'rare',
  '{"event":"haunted-stage-2026","requires_hat":"clothing.halloween.2026.pumpkin-hat"}'::jsonb,
  '{"badge":"pumpkin-headliner-2026"}'::jsonb,
  'pumpkin-headliner-2026'
)
ON CONFLICT (slug) DO UPDATE SET
  name=EXCLUDED.name, description=EXCLUDED.description,
  requirements=EXCLUDED.requirements, rewards=EXCLUDED.rewards;

-- A pure deterministic mapping that is easy to certify at 0,49,50,84,85,99.
CREATE OR REPLACE FUNCTION public.halloween_2026_bonus_for_roll(p_roll integer)
RETURNS integer
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_roll BETWEEN 0 AND 49 THEN 5
    WHEN p_roll BETWEEN 50 AND 84 THEN 10
    WHEN p_roll BETWEEN 85 AND 99 THEN 15
    ELSE 0
  END
$$;

-- Snapshot clothing AT THE SERVER-AUTHORITATIVE GIG START, not when the
-- browser opens the gig viewer or when the final outcome is generated.
CREATE OR REPLACE FUNCTION public.capture_halloween_2026_gig_outfits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_start timestamptz := ('2026-10-24 00:00 Europe/London')::timestamptz;
  v_end timestamptz := ('2026-11-02 00:00 Europe/London')::timestamptz;
BEGIN
  IF NEW.started_at IS NULL
     OR NEW.started_at < v_start OR NEW.started_at >= v_end
     OR NEW.status NOT IN ('in_progress','live')
     OR NOT (OLD.started_at IS NULL OR OLD.status NOT IN ('in_progress','live'))
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
REVOKE ALL ON FUNCTION public.capture_halloween_2026_gig_outfits() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_capture_halloween_2026_gig_outfits ON public.gigs;
CREATE TRIGGER trg_capture_halloween_2026_gig_outfits
AFTER UPDATE OF status, started_at ON public.gigs
FOR EACH ROW EXECUTE FUNCTION public.capture_halloween_2026_gig_outfits();

-- Read only the immutable start-of-gig snapshot. Service role only: clients
-- must not supply eligible characters or bonus rolls to this calculation.
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
    OR now() < v_start OR now() >= v_end THEN
    RETURN jsonb_build_object('performance_pct',0,'qualifying_members',0,'members','[]'::jsonb);
  END IF;
  SELECT * INTO v_gig FROM public.gigs WHERE id=p_gig_id;
  IF NOT FOUND OR v_gig.status IN ('completed','cancelled','failed')
     OR v_gig.started_at IS NULL
     OR v_gig.started_at < v_start OR v_gig.started_at >= v_end THEN
    RETURN jsonb_build_object('performance_pct',0,'qualifying_members',0,'members','[]'::jsonb);
  END IF;

  SELECT coalesce(avg(o.performance_pct),0), count(*)::integer,
    coalesce(jsonb_agg(jsonb_build_object('profile_id',o.profile_id,'performance_pct',o.performance_pct)
      ORDER BY o.profile_id),'[]'::jsonb)
  INTO v_pct,v_count,v_members
  FROM public.halloween_2026_gig_outfits o
  JOIN public.gig_performers gp
   ON gp.gig_id=o.gig_id AND gp.profile_id=o.profile_id
  WHERE o.gig_id=p_gig_id AND o.was_equipped
    AND gp.lineup_status IN ('selected','performed');
  RETURN jsonb_build_object('performance_pct',v_pct,
    'qualifying_members',v_count,'members',v_members);
END;
$$;
REVOKE ALL ON FUNCTION public.get_halloween_2026_gig_bonus(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_halloween_2026_gig_bonus(uuid) TO service_role;

-- This AFTER-completion trigger is transactional with the canonical gig status
-- change, and the first-reward primary key serializes concurrent gig claims.
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

  UPDATE public.gig_outcomes
  SET xp_breakdown = coalesce(xp_breakdown,'{}'::jsonb) ||
    jsonb_build_object('halloween_2026_first_rewards',
      jsonb_build_object('awarded_profiles',v_awarded,'xp_each',500))
  WHERE id=v_outcome_id;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.settle_halloween_2026_first_rewards() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_settle_halloween_2026_first_rewards ON public.gigs;
CREATE TRIGGER trg_settle_halloween_2026_first_rewards
AFTER UPDATE OF status ON public.gigs FOR EACH ROW
EXECUTE FUNCTION public.settle_halloween_2026_first_rewards();

NOTIFY pgrst,'reload schema';
