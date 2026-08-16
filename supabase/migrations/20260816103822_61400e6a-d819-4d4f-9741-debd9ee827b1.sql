CREATE OR REPLACE FUNCTION public.process_media_submission_reviews(p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_types text[] := ARRAY['newspaper','magazine','podcast','website'];
  v_type text;
  v_table text;
  v_id_col text;
  v_reward_sql text;
  r record;
  v_eval jsonb;
  v_accepted boolean;
  v_feedback text;
  v_fame integer;
  v_fans integer;
  v_pay integer;
  v_total_accepted integer := 0;
  v_total_rejected integer := 0;
BEGIN
  FOREACH v_type IN ARRAY v_types LOOP
    v_table := v_type || '_submissions';
    v_id_col := v_type || '_id';

    FOR r IN EXECUTE format(
      'SELECT id, band_id, %I AS media_id FROM public.%I WHERE status = %L AND submitted_at < now() - interval ''15 minutes'' ORDER BY submitted_at LIMIT %s',
      v_id_col, v_table, 'pending', greatest(1, coalesce(p_limit, 100)))
    LOOP
      IF r.band_id IS NULL THEN
        EXECUTE format('UPDATE public.%I SET status = %L, reviewed_at = now(), rejection_reason = %L, feedback = %L WHERE id = %L',
          v_table, 'rejected', 'No band attached to this pitch', 'This pitch had no band attached, so the desk could not review it.', r.id);
        v_total_rejected := v_total_rejected + 1;
        CONTINUE;
      END IF;

      v_eval := public.evaluate_media_submission(v_type, r.media_id, r.band_id);

      IF v_eval ? 'error' THEN
        EXECUTE format('UPDATE public.%I SET status = %L, reviewed_at = now(), rejection_reason = %L, feedback = %L WHERE id = %L',
          v_table, 'rejected', 'Outlet no longer available', 'This outlet is no longer accepting pitches.', r.id);
        v_total_rejected := v_total_rejected + 1;
        CONTINUE;
      END IF;

      v_accepted := random() * 100 < (v_eval ->> 'chance')::numeric;

      IF v_accepted THEN
        SELECT
          coalesce(fame_boost_min, 5) + floor(random() * greatest(1, coalesce(fame_boost_max, 15) - coalesce(fame_boost_min, 5) + 1)),
          coalesce(fan_boost_min, 10) + floor(random() * greatest(1, coalesce(fan_boost_max, 100) - coalesce(fan_boost_min, 10) + 1)),
          coalesce(compensation_min, 0) + floor(random() * greatest(1, coalesce(compensation_max, 0) - coalesce(compensation_min, 0) + 1))
        INTO v_fame, v_fans, v_pay
        FROM (
          SELECT fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max
          FROM public.newspapers WHERE v_type = 'newspaper' AND id = r.media_id
          UNION ALL
          SELECT fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max
          FROM public.magazines WHERE v_type = 'magazine' AND id = r.media_id
          UNION ALL
          SELECT fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max
          FROM public.podcasts WHERE v_type = 'podcast' AND id = r.media_id
          UNION ALL
          SELECT fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max
          FROM public.websites WHERE v_type = 'website' AND id = r.media_id
        ) src
        LIMIT 1;

        v_fame := coalesce(v_fame, 5);
        v_fans := coalesce(v_fans, 20);
        v_pay := coalesce(v_pay, 0);

        v_feedback := format(
          'Confirmed by %s. Scored %s with a catalogue average of %s against an editorial bar of %s. Booked for +%s fame, +%s fans and a %s fee.',
          v_eval ->> 'outlet_name', v_eval ->> 'score', v_eval ->> 'band_avg_quality',
          v_eval ->> 'quality_bar', v_fame, v_fans, v_pay);

        IF v_type = 'website' THEN
          v_reward_sql := format('fame_gained = %s, fans_gained = %s, compensation_earned = %s', v_fame, v_fans, v_pay);
        ELSE
          v_reward_sql := format('fame_boost = %s, fan_boost = %s, compensation = %s', v_fame, v_fans, v_pay);
        END IF;

        EXECUTE format(
          'UPDATE public.%I SET status = %L, reviewed_at = now(), %s, evaluation = %L, score = %s, feedback = %L WHERE id = %L',
          v_table, 'approved', v_reward_sql, v_eval::text, (v_eval ->> 'score')::numeric, v_feedback, r.id);

        UPDATE public.bands
          SET fame = coalesce(fame, 0) + v_fame,
              total_fans = coalesce(total_fans, 0) + v_fans
        WHERE id = r.band_id;

        v_total_accepted := v_total_accepted + 1;
      ELSE
        v_feedback := format(
          'Turned down by %s. Scored %s (chance %s%%). %s',
          v_eval ->> 'outlet_name', v_eval ->> 'score', v_eval ->> 'chance',
          CASE
            WHEN (v_eval ->> 'band_avg_quality')::numeric < (v_eval ->> 'quality_bar')::numeric
              THEN format('Your catalogue averages %s against an editorial bar of %s, so record stronger material or pitch a smaller outlet.',
                          v_eval ->> 'band_avg_quality', v_eval ->> 'quality_bar')
            WHEN NOT (v_eval ->> 'genre_match')::boolean
              THEN 'Your genre is off-brief here, pitch outlets that cover your style.'
            ELSE format('Build fame towards %s and try again.', v_eval ->> 'required_fame')
          END);

        EXECUTE format(
          'UPDATE public.%I SET status = %L, reviewed_at = now(), evaluation = %L, score = %s, feedback = %L, rejection_reason = %L WHERE id = %L',
          v_table, 'rejected', v_eval::text, (v_eval ->> 'score')::numeric, v_feedback, v_feedback, r.id);

        v_total_rejected := v_total_rejected + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('accepted', v_total_accepted, 'rejected', v_total_rejected);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_media_submission_reviews(integer) TO service_role;

SELECT public.process_media_submission_reviews(200);
SELECT public.process_pending_radio_submissions(100);