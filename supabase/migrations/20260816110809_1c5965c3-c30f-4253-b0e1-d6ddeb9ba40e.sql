CREATE OR REPLACE FUNCTION public.generate_company_shifts()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; v_created integer := 0; v_open integer; v_target integer;
BEGIN
  UPDATE public.company_shifts
     SET status='expired', updated_at=now()
   WHERE status IN ('open','full') AND expires_at IS NOT NULL AND expires_at < now();

  FOR r IN
    SELECT c.id, c.company_type, COALESCE(d.demand_weight,1.0)::numeric AS w
      FROM public.companies c
      LEFT JOIN public.company_type_definitions d ON d.type_key = c.company_type
     WHERE c.status='active' AND c.is_bankrupt = false
       AND COALESCE(d.supports_shifts, true) = true
  LOOP
    SELECT COUNT(*) INTO v_open FROM public.company_shifts
      WHERE company_id = r.id AND status='open' AND (expires_at IS NULL OR expires_at > now());
    v_target := GREATEST(2, LEAST(6, CEIL(r.w * 3)::int));
    IF v_open >= v_target THEN CONTINUE; END IF;

    INSERT INTO public.company_shifts (company_id, role, description, wage_per_hour, duration_hours, slots_total, status, starts_at, expires_at)
    SELECT r.id, 'staff',
           'Auto-generated operational shift',
           ROUND((20 + (r.w * 10) + (random() * 15)::numeric), 2),
           (ARRAY[3,4,6])[1 + floor(random()*3)::int],
           1 + floor(random()*2)::int,
           'open',
           date_trunc('hour', now()) + ((1 + floor(random()*10))::int * interval '1 hour'),
           now() + interval '2 days'
      FROM generate_series(1, v_target - v_open);
    v_created := v_created + (v_target - v_open);
  END LOOP;
  RETURN v_created;
END;
$$;