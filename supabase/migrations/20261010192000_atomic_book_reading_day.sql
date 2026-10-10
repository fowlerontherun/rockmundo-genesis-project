-- Atomic daily reading claim and progress update. Called only by the
-- service-role Edge Function. Do not grant EXECUTE to browser roles.
CREATE OR REPLACE FUNCTION public.apply_book_reading_day(
  p_session_id uuid,
  p_reading_date date,
  p_skill_slug text,
  p_daily_xp integer,
  p_current_level integer,
  p_current_xp integer,
  p_required_xp integer,
  p_total_days integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session public.player_book_reading_sessions%ROWTYPE;
  v_days integer;
  v_completed boolean;
  v_existing uuid;
BEGIN
  SELECT * INTO v_session FROM public.player_book_reading_sessions
  WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reading session not found'; END IF;
  IF v_session.status <> 'reading' THEN
    RETURN jsonb_build_object('reason', 'not_reading');
  END IF;
  SELECT id INTO v_existing FROM public.player_book_reading_attendance
  WHERE reading_session_id = p_session_id AND reading_date = p_reading_date;
  IF FOUND THEN RETURN jsonb_build_object('reason', 'already_recorded'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.skill_books
    WHERE id = v_session.book_id AND skill_slug = p_skill_slug
  ) THEN RAISE EXCEPTION 'Reading skill does not match book'; END IF;
  IF NOT public.skill_tier_unlocked(v_session.profile_id, p_skill_slug) THEN
    RETURN jsonb_build_object('reason', 'locked_tier');
  END IF;

  v_days := v_session.days_read + 1;
  v_completed := v_days >= greatest(1, p_total_days);
  INSERT INTO public.player_book_reading_attendance
    (reading_session_id, reading_date, skill_xp_earned, was_locked_out)
  VALUES (p_session_id, p_reading_date, greatest(0, p_daily_xp), false);
  INSERT INTO public.skill_progress
    (profile_id, skill_slug, current_level, current_xp, required_xp, last_practiced_at)
  VALUES (v_session.profile_id, p_skill_slug, p_current_level, p_current_xp, p_required_xp, now())
  ON CONFLICT (profile_id, skill_slug) DO UPDATE SET
    current_level=excluded.current_level,
    current_xp=excluded.current_xp,
    required_xp=excluded.required_xp,
    last_practiced_at=excluded.last_practiced_at;
  UPDATE public.player_book_reading_sessions SET
    days_read=v_days,
    total_skill_xp_earned=coalesce(total_skill_xp_earned,0)+greatest(0,p_daily_xp),
    status=CASE WHEN v_completed THEN 'completed'::public.book_reading_status ELSE 'reading'::public.book_reading_status END,
    actual_completion_date=CASE WHEN v_completed THEN now() ELSE NULL END
  WHERE id=p_session_id;
  IF v_completed THEN
    UPDATE public.player_book_purchases SET is_read=true WHERE id=v_session.purchase_id;
  END IF;
  INSERT INTO public.experience_ledger
    (user_id, profile_id, activity_type, skill_slug, xp_amount, metadata)
  VALUES (v_session.user_id,v_session.profile_id,'book_reading',p_skill_slug,
    greatest(0,p_daily_xp),
    jsonb_build_object('book_id',v_session.book_id,'day',v_days,'total_days',p_total_days,'completed',v_completed));
  RETURN jsonb_build_object('days_read',v_days,'completed',v_completed);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_book_reading_day(uuid,date,text,integer,integer,integer,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_book_reading_day(uuid,date,text,integer,integer,integer,integer,integer) TO service_role;
