-- Slow support-gig fame/fan gains as bands grow.
DO $$
DECLARE v_sql text;
BEGIN
  SELECT pg_get_functiondef('public.settle_support_band_gig(uuid)'::regprocedure) INTO v_sql;
  v_sql := replace(v_sql,
    'v_support_fans := LEAST(1000, GREATEST(10, round(COALESCE(o.actual_attendance,0) * 0.04)::integer));',
    'v_support_fans := public.support_fan_gain_for_gig(slot.support_band_id, COALESCE(o.actual_attendance,0), COALESCE(o.overall_rating,10));');
  v_sql := replace(v_sql,
    'v_support_fame := LEAST(250, GREATEST(5, round((COALESCE(o.actual_attendance,0) / 75.0) + (v_headliner_fame_current / 500.0))::integer));',
    'v_support_fame := LEAST(80, GREATEST(1, round(((COALESCE(o.actual_attendance,0) / 180.0) + (v_headliner_fame_current / 1800.0)) / (1 + ln(1 + GREATEST(COALESCE((SELECT fame FROM public.bands WHERE id=slot.support_band_id),0),0)::numeric) / 7.0))::integer));');
  v_sql := replace(v_sql,
    'v_headliner_fame := LEAST(80, GREATEST(2, round(COALESCE(o.actual_attendance,0) / 250.0)::integer));',
    'v_headliner_fame := LEAST(30, GREATEST(1, round((COALESCE(o.actual_attendance,0) / 500.0) / (1 + ln(1 + GREATEST(v_headliner_fame_current,0)::numeric) / 7.0))::integer));');
  EXECUTE v_sql;
END $$;
