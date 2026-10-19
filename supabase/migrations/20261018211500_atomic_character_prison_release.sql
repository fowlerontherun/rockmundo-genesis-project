-- Release a due sentence in ONE transaction for exactly the owning character.
-- Worker uses the service_role key; browser roles have no EXECUTE permission.
-- Fail closed for historical imprisonment rows without an unambiguous profile_id.
CREATE UNIQUE INDEX IF NOT EXISTS player_criminal_record_one_per_imprisonment_idx
  ON public.player_criminal_record(imprisonment_id);

CREATE OR REPLACE FUNCTION public.release_due_prisoner_atomic(
  p_imprisonment_id uuid,
  p_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_prisoner public.player_imprisonments%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_band_id uuid;
  v_old_morale numeric;
  v_old_reputation numeric;
  v_new_morale numeric;
  v_new_reputation numeric;
  v_behavior_rating text;
  v_message text;
  v_early_days integer;
  v_morale_boost integer;
  v_reputation_boost integer;
  v_remaining_active boolean;
BEGIN
  IF p_imprisonment_id IS NULL THEN
    RAISE EXCEPTION 'IMPRISONMENT_ID_REQUIRED';
  END IF;

  -- Serialize concurrent cron runs and retry deliveries on the exact sentence.
  SELECT * INTO v_prisoner FROM public.player_imprisonments
  WHERE id = p_imprisonment_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('released', false, 'reason', 'not_found');
  END IF;

  IF v_prisoner.status <> 'imprisoned' THEN
    RETURN jsonb_build_object('released', false, 'reason', 'already_finalized');
  END IF;

  IF v_prisoner.release_date > p_at THEN
    RETURN jsonb_build_object('released', false, 'reason', 'not_due');
  END IF;

  IF v_prisoner.profile_id IS NULL THEN
    RAISE EXCEPTION 'PRISON_RELEASE_UNATTRIBUTED_CHARACTER: imprisonment % requires manual attribution', p_imprisonment_id;
  END IF;

  SELECT * INTO v_profile FROM public.profiles
  WHERE id = v_prisoner.profile_id AND user_id = v_prisoner.user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRISON_RELEASE_PROFILE_OWNER_MISMATCH: %', p_imprisonment_id;
  END IF;

  -- A prior criminal-record write without a finalized sentence is inconsistent:
  -- stop rather than inventing an additional notification or reward.
  IF EXISTS (
    SELECT 1 FROM public.player_criminal_record
    WHERE imprisonment_id = p_imprisonment_id
  ) THEN
    RAISE EXCEPTION 'PRISON_RELEASE_PARTIAL_LEGACY_SETTLEMENT: %', p_imprisonment_id;
  END IF;

  v_early_days := greatest(0, v_prisoner.good_behavior_days_earned);
  v_behavior_rating := CASE
    WHEN v_prisoner.behavior_score >= 90 THEN 'exemplary'
    WHEN v_prisoner.behavior_score >= 70 THEN 'good'
    WHEN v_prisoner.behavior_score >= 50 THEN 'average'
    ELSE 'poor'
  END;
  v_message := CASE
    WHEN v_early_days > 0 THEN
      '🔓 You have been released early for good behavior! (' || v_early_days::text ||
      ' days off) Songs written: ' || v_prisoner.songs_written::text
    ELSE
      '🔓 You have been released from prison. Stay out of debt! Songs written: ' ||
      v_prisoner.songs_written::text
  END;

  UPDATE public.player_imprisonments
    SET status = 'released', released_at = p_at, remaining_sentence_days = 0
  WHERE id = p_imprisonment_id AND status = 'imprisoned';

  -- A second sentence for the SAME character may still be active.
  SELECT EXISTS (
    SELECT 1 FROM public.player_imprisonments
    WHERE profile_id = v_prisoner.profile_id AND status = 'imprisoned'
  ) INTO v_remaining_active;

  UPDATE public.profiles
    SET is_imprisoned = v_remaining_active
  WHERE id = v_prisoner.profile_id AND user_id = v_prisoner.user_id;

  INSERT INTO public.player_criminal_record(
    user_id, profile_id, imprisonment_id, offense_type,
    sentence_served_days, behavior_rating, escaped, pardoned
  )
  VALUES (
    v_prisoner.user_id, v_prisoner.profile_id, v_prisoner.id, v_prisoner.reason,
    greatest(0, v_prisoner.original_sentence_days - v_early_days),
    v_behavior_rating, false, false
  );

  INSERT INTO public.activity_feed(user_id, profile_id, activity_type, message, metadata)
  VALUES (
    v_prisoner.user_id, v_prisoner.profile_id, 'released', v_message,
    jsonb_build_object(
      'imprisonment_id', v_prisoner.id,
      'profile_id', v_prisoner.profile_id,
      'behavior_rating', v_behavior_rating,
      'songs_written', v_prisoner.songs_written,
      'early_release', v_early_days > 0,
      'days_reduced', v_early_days
    )
  );

  -- Only this character's active, non-touring band may receive the benefit.
  SELECT bm.band_id INTO v_band_id
  FROM public.band_members bm
  WHERE bm.profile_id = v_prisoner.profile_id
    AND bm.member_status = 'active'
    AND coalesce(bm.is_touring_member, false) = false
  ORDER BY bm.id LIMIT 1;

  IF v_band_id IS NOT NULL THEN
    SELECT morale, reputation_score INTO v_old_morale, v_old_reputation
    FROM public.bands WHERE id = v_band_id FOR UPDATE;
    IF FOUND THEN
      v_morale_boost := CASE
        WHEN v_prisoner.behavior_score >= 90 THEN 10
        WHEN v_prisoner.behavior_score >= 70 THEN 7
        WHEN v_prisoner.behavior_score >= 50 THEN 4
        ELSE 2
      END;
      v_reputation_boost := CASE WHEN v_prisoner.behavior_score >= 70 THEN 3 ELSE 1 END;
      UPDATE public.bands
      SET morale = least(100, greatest(0, coalesce(morale, 50)) + v_morale_boost),
          reputation_score = least(100, greatest(0, coalesce(reputation_score, 0)) + v_reputation_boost)
      WHERE id = v_band_id
      RETURNING morale, reputation_score INTO v_new_morale, v_new_reputation;

      INSERT INTO public.band_health_events(band_id, event_type, delta, new_value, source, description)
      VALUES
        (v_band_id, 'morale', round(v_new_morale - coalesce(v_old_morale, 50))::integer,
         round(v_new_morale)::integer, 'prison_release',
         'Released from prison (behavior: ' || v_behavior_rating || ')'),
        (v_band_id, 'reputation', round(v_new_reputation - coalesce(v_old_reputation, 0))::integer,
         round(v_new_reputation)::integer, 'prison_release',
         'Served sentence, debt to society paid');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'released', true, 'imprisonment_id', v_prisoner.id,
    'profile_id', v_prisoner.profile_id, 'user_id', v_prisoner.user_id,
    'early_release', v_early_days > 0, 'still_imprisoned', v_remaining_active
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.release_due_prisoner_atomic(uuid,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_due_prisoner_atomic(uuid,timestamptz)
  TO service_role;
