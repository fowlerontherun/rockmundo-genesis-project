-- Fix the XP-spend cap regression introduced when progression spending was
-- standardised around the legacy 20-level tiered skill model. Core canonical
-- skills (Guitar Mastery, Vocals, Drums, etc.) are 100-level skills, while
-- Professional/Mastery tier slugs remain 20-level skills.

CREATE OR REPLACE FUNCTION public.progression_skill_max_level(p_skill_slug text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN p_skill_slug IN (
      'guitar', 'vocals', 'drums', 'bass',
      'performance', 'songwriting', 'composition', 'technical'
    ) THEN 100
    ELSE COALESCE(
      (
        SELECT CASE
          WHEN jsonb_typeof(sd.tier_caps -> 'max_level') = 'number'
            THEN GREATEST(1, (sd.tier_caps ->> 'max_level')::integer)
          ELSE NULL
        END
        FROM public.skill_definitions sd
        WHERE sd.slug::text = p_skill_slug
        LIMIT 1
      ),
      20
    )
  END;
$function$;

COMMENT ON FUNCTION public.progression_skill_max_level(text) IS
  'Returns the authoritative skill level cap. Canonical core skills use level 100; legacy tiered skills use level 20 unless their definition declares max_level.';

CREATE OR REPLACE FUNCTION public.progression_spend_skill_xp(
  p_profile_id uuid,
  p_skill_slug text,
  p_xp integer,
  p_metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_wallet public.player_xp_wallet%rowtype;
  v_skill public.skill_progress%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_max integer;
  v_level integer;
  v_xp integer;
  v_req integer;
  v_wallet_before integer;
  v_spend integer;
  v_to_max integer := 0;
  v_levels integer := 0;
  v_level_before integer;
  v_xp_before integer;
  v_key text := nullif(btrim(coalesce(p_idempotency_key, p_metadata->>'idempotency_key')), '');
  v_existing jsonb;
  v_result jsonb;
  i integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'skill_xp_unauthorised' USING ERRCODE='P0001';
  END IF;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'skill_xp_missing_idempotency_key' USING ERRCODE='P0001';
  END IF;
  IF p_xp IS NULL OR p_xp <= 0 THEN
    RAISE EXCEPTION 'skill_xp_invalid_amount' USING ERRCODE='P0001';
  END IF;
  IF p_skill_slug IS NULL OR btrim(p_skill_slug) = '' THEN
    RAISE EXCEPTION 'skill_xp_skill_not_found' USING ERRCODE='P0001';
  END IF;

  SELECT result INTO v_existing
  FROM public.skill_xp_spend_ledger
  WHERE profile_id = p_profile_id AND idempotency_key = v_key;
  IF FOUND THEN
    RETURN v_existing || jsonb_build_object('duplicate', true);
  END IF;

  PERFORM 1
  FROM public.profiles
  WHERE id = p_profile_id
    AND user_id = auth.uid()
    AND is_active IS TRUE
    AND died_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'skill_xp_profile_not_authorised' USING ERRCODE='P0001';
  END IF;

  PERFORM 1 FROM public.skill_definitions WHERE slug::text = p_skill_slug;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'skill_xp_skill_not_found' USING ERRCODE='P0001';
  END IF;

  IF public.skill_tier_unlocked(p_profile_id, p_skill_slug) IS FALSE THEN
    RAISE EXCEPTION 'skill_xp_skill_locked' USING ERRCODE='P0001';
  END IF;

  v_max := public.progression_skill_max_level(p_skill_slug);

  SELECT * INTO v_wallet
  FROM public.player_xp_wallet
  WHERE profile_id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.player_xp_wallet (profile_id)
    VALUES (p_profile_id)
    ON CONFLICT (profile_id) DO NOTHING;

    SELECT * INTO v_wallet
    FROM public.player_xp_wallet
    WHERE profile_id = p_profile_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'skill_xp_wallet_missing' USING ERRCODE='P0001';
    END IF;
  END IF;

  v_wallet_before := greatest(0, coalesce(v_wallet.skill_xp_balance, v_wallet.xp_balance, 0));

  SELECT * INTO v_skill
  FROM public.skill_progress
  WHERE profile_id = p_profile_id AND skill_slug = p_skill_slug
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.skill_progress (profile_id, skill_slug, current_level, current_xp, required_xp)
    VALUES (p_profile_id, p_skill_slug, 0, 0, public.progression_skill_required_xp(0))
    ON CONFLICT (profile_id, skill_slug) DO NOTHING;

    SELECT * INTO v_skill
    FROM public.skill_progress
    WHERE profile_id = p_profile_id AND skill_slug = p_skill_slug
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'skill_xp_skill_locked' USING ERRCODE='P0001';
    END IF;
  END IF;

  v_level := least(greatest(coalesce(v_skill.current_level, 0), 0), v_max);
  v_xp := greatest(coalesce(v_skill.current_xp, 0), 0);
  v_level_before := v_level;
  v_xp_before := v_xp;

  IF v_level >= v_max THEN
    RAISE EXCEPTION 'skill_xp_max_level_reached' USING ERRCODE='P0001';
  END IF;

  v_req := coalesce(nullif(v_skill.required_xp, 0), public.progression_skill_required_xp(v_level));
  v_to_max := greatest(v_req - least(v_xp, v_req), 0);

  IF v_level + 1 <= v_max - 1 THEN
    FOR i IN (v_level + 1)..(v_max - 1) LOOP
      v_to_max := v_to_max + public.progression_skill_required_xp(i);
    END LOOP;
  END IF;

  IF v_wallet_before < p_xp THEN
    RAISE EXCEPTION 'skill_xp_insufficient_funds' USING ERRCODE='P0001';
  END IF;

  v_spend := least(p_xp, v_to_max);
  IF v_spend <= 0 THEN
    RAISE EXCEPTION 'skill_xp_invalid_amount' USING ERRCODE='P0001';
  END IF;

  v_xp := least(v_xp, v_req) + v_spend;
  WHILE v_level < v_max AND v_xp >= v_req LOOP
    v_xp := v_xp - v_req;
    v_level := v_level + 1;
    v_levels := v_levels + 1;
    IF v_level < v_max THEN
      v_req := public.progression_skill_required_xp(v_level);
    END IF;
  END LOOP;

  IF v_level >= v_max THEN
    v_level := v_max;
    v_xp := 0;
    v_req := 0;
  END IF;

  UPDATE public.player_xp_wallet
  SET skill_xp_balance = v_wallet_before - v_spend,
      xp_balance = v_wallet_before - v_spend,
      skill_xp_spent = coalesce(skill_xp_spent, xp_spent, 0) + v_spend,
      xp_spent = coalesce(xp_spent, skill_xp_spent, 0) + v_spend,
      last_recalculated = v_now
  WHERE profile_id = p_profile_id;

  UPDATE public.skill_progress
  SET current_level = v_level,
      current_xp = v_xp,
      required_xp = v_req,
      updated_at = v_now,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('balance_version', 'progression_v2.0.1')
  WHERE id = v_skill.id
  RETURNING * INTO v_skill;

  v_result := jsonb_build_object(
    'skill_slug', p_skill_slug,
    'xp_spent', v_spend,
    'levels_gained', v_levels,
    'wallet_after', v_wallet_before - v_spend,
    'current_level', v_skill.current_level,
    'current_xp', v_skill.current_xp,
    'required_xp', v_skill.required_xp,
    'skill_progress', to_jsonb(v_skill)
  );

  INSERT INTO public.skill_xp_spend_ledger (
    profile_id,
    skill_slug,
    xp_spent,
    level_before,
    level_after,
    xp_progress_before,
    xp_progress_after,
    wallet_before,
    wallet_after,
    balance_version,
    idempotency_key,
    result
  ) VALUES (
    p_profile_id,
    p_skill_slug,
    v_spend,
    v_level_before,
    v_level,
    v_xp_before,
    v_xp,
    v_wallet_before,
    v_wallet_before - v_spend,
    'progression_v2.0.1',
    v_key,
    v_result
  );

  RETURN v_result;
END;
$function$;

-- Backfill one active learning book for every Professional/Mastery skill that
-- has no book. Tier unlocks are still enforced by the reading attendance job.
INSERT INTO public.skill_books (
  skill_slug,
  title,
  author,
  description,
  price,
  base_reading_days,
  skill_percentage_gain,
  required_skill_level,
  daily_reading_time,
  reading_hour,
  is_active,
  category
)
SELECT
  sd.slug::text,
  CASE
    WHEN sd.slug::text LIKE '%\_mastery\_%' ESCAPE '\'
      THEN coalesce(sd.display_name, initcap(replace(sd.slug::text, '_', ' '))) || ': Masterclass Handbook'
    ELSE coalesce(sd.display_name, initcap(replace(sd.slug::text, '_', ' '))) || ': Professional Handbook'
  END,
  'RockMundo Press',
  CASE
    WHEN sd.slug::text LIKE '%\_mastery\_%' ESCAPE '\'
      THEN 'An intensive reference for mastery-level techniques, decision-making and practice.'
    ELSE 'A practical guide to professional-level techniques and structured practice.'
  END,
  CASE WHEN sd.slug::text LIKE '%\_mastery\_%' ESCAPE '\' THEN 220 ELSE 120 END,
  4,
  CASE WHEN sd.slug::text LIKE '%\_mastery\_%' ESCAPE '\' THEN 0.18 ELSE 0.12 END,
  0,
  CASE WHEN sd.slug::text LIKE '%\_mastery\_%' ESCAPE '\' THEN 60 ELSE 45 END,
  20,
  true,
  initcap(split_part(sd.slug::text, '_', 1))
FROM public.skill_definitions sd
WHERE (
    sd.slug::text LIKE '%\_professional\_%' ESCAPE '\'
    OR sd.slug::text LIKE '%\_mastery\_%' ESCAPE '\'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.skill_books b
    WHERE b.skill_slug = sd.slug::text
      AND b.is_active IS TRUE
  );

-- Backfill higher-tier video-learning entries. The existing PooTube learning
-- system uses these rows as lessons; the URL also gives the resource a useful
-- external discovery target if/when the UI exposes source links.
INSERT INTO public.education_youtube_resources (
  title,
  description,
  video_url,
  category,
  difficulty_level,
  duration_minutes,
  tags,
  skill_slug,
  channel_name,
  is_featured
)
SELECT
  'Find ' || coalesce(sd.display_name, initcap(replace(sd.slug::text, '_', ' '))) || ' tutorials',
  'Open YouTube search results for tutorials focused on this skill tier.',
  'https://www.youtube.com/results?search_query=' ||
    regexp_replace(
      regexp_replace(
        lower(coalesce(sd.display_name, replace(sd.slug::text, '_', ' '))),
        '[^a-z0-9 ]+',
        ' ',
        'g'
      ),
      '[[:space:]]+',
      '+',
      'g'
    ) || '+tutorial',
  CASE WHEN sd.slug::text LIKE '%\_mastery\_%' ESCAPE '\' THEN 'Mastery' ELSE 'Professional' END,
  CASE WHEN sd.slug::text LIKE '%\_mastery\_%' ESCAPE '\' THEN 5 ELSE 4 END,
  NULL,
  ARRAY[
    CASE WHEN sd.slug::text LIKE '%\_mastery\_%' ESCAPE '\' THEN 'mastery' ELSE 'professional' END,
    'skill-learning'
  ]::text[],
  sd.slug::text,
  'YouTube Search',
  false
FROM public.skill_definitions sd
WHERE (
    sd.slug::text LIKE '%\_professional\_%' ESCAPE '\'
    OR sd.slug::text LIKE '%\_mastery\_%' ESCAPE '\'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.education_youtube_resources y
    WHERE y.skill_slug = sd.slug::text
  );
