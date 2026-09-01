-- Ensure the booking quote/fee uses the same fan-led demand model as ticket sales.
DO $$
DECLARE
  v_sql text;
  v_before text;
BEGIN
  SELECT pg_get_functiondef('public.book_gig(uuid,uuid,uuid,date,text,integer,uuid,uuid,text)'::regprocedure) INTO v_sql;
  v_before := v_sql;

  v_sql := regexp_replace(
    v_sql,
    'v_estimated_attendance := LEAST\(v_capacity, GREATEST\(1, round\(v_capacity \* LEAST\(1\.0,[\s\S]*?\)\)::integer\);',
    E'v_estimated_attendance := public.calculate_realistic_gig_demand(\n    p_band_id, p_venue_id, v_start, p_ticket_price, v_multiplier\n  );'
  );

  IF v_sql = v_before OR position('calculate_realistic_gig_demand' in v_sql) = 0 THEN
    RAISE EXCEPTION 'book_gig realistic demand patch did not match';
  END IF;

  EXECUTE v_sql;
END $$;
