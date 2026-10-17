CREATE OR REPLACE FUNCTION public.process_time_away_daily()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0; e jsonb;
BEGIN
  UPDATE time_away_bookings SET status = 'completed', updated_at = now() WHERE status IN ('booked','active') AND end_date < CURRENT_DATE;
  FOR r IN UPDATE time_away_bookings SET status = 'rejected', refunded = cost, updated_at = now()
    WHERE status = 'pending_approval' AND start_date <= CURRENT_DATE RETURNING profile_id, cost LOOP
    IF r.cost > 0 THEN UPDATE profiles SET cash = cash + r.cost WHERE id = r.profile_id; END IF;
  END LOOP;
  FOR r IN SELECT b.id, b.profile_id, c.daily_effects FROM time_away_bookings b JOIN time_away_type_config c ON c.type = b.type
    WHERE b.status IN ('booked','active') AND CURRENT_DATE BETWEEN b.start_date AND b.end_date
      AND (b.last_processed_on IS NULL OR b.last_processed_on < CURRENT_DATE) FOR UPDATE OF b LOOP
    e := r.daily_effects;
    UPDATE profiles SET
      health = LEAST(100, GREATEST(0, coalesce(health,100) + coalesce((e->>'health')::int,0))),
      energy = LEAST(100, GREATEST(0, coalesce(energy,80) + coalesce((e->>'energy')::int,0))),
      fatigue = LEAST(100, GREATEST(0, coalesce(fatigue,35) + coalesce((e->>'fatigue')::int,0))),
      stress = LEAST(100, GREATEST(0, coalesce(stress,28) + coalesce((e->>'stress')::int,0))),
      sleep_quality = LEAST(100, GREATEST(0, coalesce(sleep_quality,72) + coalesce((e->>'sleep_quality')::int,0))),
      motivation = LEAST(100, GREATEST(0, coalesce(motivation,72) + coalesce((e->>'motivation')::int,0))),
      burnout_risk = LEAST(100, GREATEST(0, coalesce(burnout_risk,18) + coalesce((e->>'burnout_risk')::int,0)))
    WHERE id = r.profile_id;
    UPDATE time_away_bookings SET status = 'active', days_processed = days_processed + 1, last_processed_on = CURRENT_DATE, updated_at = now() WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.process_time_away_daily() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_time_away_daily() TO service_role;