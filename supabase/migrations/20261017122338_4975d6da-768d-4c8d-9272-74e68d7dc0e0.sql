CREATE TABLE IF NOT EXISTS public.time_away_type_config (
  type text PRIMARY KEY, label text NOT NULL, description text NOT NULL DEFAULT '',
  min_days int NOT NULL, max_days int NOT NULL, min_fame int NOT NULL DEFAULT 0,
  base_cost int NOT NULL DEFAULT 0, daily_cost int NOT NULL DEFAULT 0,
  daily_effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  notice_days int NOT NULL DEFAULT 0, cooldown_days int NOT NULL DEFAULT 0,
  refund_until_days int NOT NULL DEFAULT 0, always_band_approval boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.time_away_type_config TO authenticated;
GRANT ALL ON public.time_away_type_config TO service_role;
ALTER TABLE public.time_away_type_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read break types" ON public.time_away_type_config FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.time_away_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL REFERENCES public.time_away_type_config(type),
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('pending_approval','booked','active','completed','cancelled','rejected')),
  start_date date NOT NULL, end_date date NOT NULL CHECK (end_date >= start_date),
  cost int NOT NULL DEFAULT 0, refunded int NOT NULL DEFAULT 0,
  band_id uuid, conflict_gigs int NOT NULL DEFAULT 0,
  days_processed int NOT NULL DEFAULT 0, last_processed_on date,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid, decided_at timestamptz, cancelled_at timestamptz);
CREATE INDEX IF NOT EXISTS time_away_bookings_profile_idx ON public.time_away_bookings(profile_id, start_date DESC);
CREATE INDEX IF NOT EXISTS time_away_bookings_band_idx ON public.time_away_bookings(band_id, status);
GRANT SELECT ON public.time_away_bookings TO authenticated;
GRANT ALL ON public.time_away_bookings TO service_role;
ALTER TABLE public.time_away_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view own breaks" ON public.time_away_bookings FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR band_id IN (SELECT b.id FROM public.bands b WHERE b.leader_id = auth.uid() OR b.leader_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())));

INSERT INTO public.time_away_type_config (type,label,description,min_days,max_days,min_fame,base_cost,daily_cost,daily_effects,notice_days,cooldown_days,refund_until_days,always_band_approval,sort_order) VALUES
('rest_day','Rest Day','A quiet day at home.',1,1,0,0,0,'{"energy":9,"fatigue":-12,"stress":-5,"sleep_quality":4,"burnout_risk":-3}',0,1,0,false,1),
('staycation','Staycation','A few lazy days around your home city.',2,7,0,0,12,'{"energy":7,"fatigue":-8,"stress":-7,"sleep_quality":7,"burnout_risk":-4}',1,7,0,false,2),
('city_break','City Break','A short trip somewhere new.',2,5,0,150,85,'{"energy":5,"fatigue":-5,"stress":-5,"sleep_quality":3,"motivation":3,"burnout_risk":-3}',2,10,3,false,3),
('standard_holiday','Holiday','A proper holiday away from it all.',3,14,500,250,120,'{"energy":6,"fatigue":-7,"stress":-8,"sleep_quality":5,"burnout_risk":-5}',3,21,7,false,4),
('band_retreat','Band Retreat','Time away together as a band.',2,7,500,300,90,'{"energy":4,"fatigue":-5,"stress":-6,"sleep_quality":3,"motivation":4,"burnout_risk":-4}',7,30,7,true,5),
('wellness_retreat','Wellness Retreat','Therapy, massage and healthy meals.',2,14,2000,450,180,'{"energy":6,"fatigue":-7,"stress":-10,"sleep_quality":7,"burnout_risk":-7}',5,28,10,false,6),
('creative_retreat','Creative Retreat','Recharge your ideas somewhere calm.',2,14,2000,300,100,'{"energy":4,"fatigue":-5,"stress":-7,"sleep_quality":4,"motivation":7,"burnout_risk":-4}',4,21,7,false,7),
('fitness_retreat','Fitness Retreat','Training, physio and early nights.',2,10,2000,350,140,'{"health":3,"energy":3,"fatigue":-3,"stress":-5,"sleep_quality":4,"burnout_risk":-3}',5,28,7,false,8),
('career_break','Career Break','Step back from music for a while.',14,120,2000,0,25,'{"energy":4,"fatigue":-5,"stress":-8,"sleep_quality":6,"burnout_risk":-8}',14,90,0,false,9),
('sabbatical','Sabbatical','A long break for established stars.',30,365,10000,0,35,'{"energy":3,"fatigue":-4,"stress":-9,"sleep_quality":7,"burnout_risk":-9}',30,365,0,false,10)
ON CONFLICT (type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.book_time_away(p_profile_id uuid, p_type text, p_start date, p_end date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c time_away_type_config%rowtype; v_days int; v_cost int; v_cash bigint; v_fame int; v_band uuid; v_conf int := 0; v_status text; v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'Not your character'; END IF;
  SELECT * INTO c FROM time_away_type_config WHERE type = p_type;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown break type'; END IF;
  v_days := (p_end - p_start) + 1;
  IF v_days < c.min_days OR v_days > c.max_days THEN RAISE EXCEPTION '% must be % to % days', c.label, c.min_days, c.max_days; END IF;
  IF p_start < CURRENT_DATE + c.notice_days THEN RAISE EXCEPTION '% needs % days notice', c.label, c.notice_days; END IF;
  SELECT cash, coalesce(fame,0) INTO v_cash, v_fame FROM profiles WHERE id = p_profile_id FOR UPDATE;
  IF v_fame < c.min_fame THEN RAISE EXCEPTION '% unlocks at % fame', c.label, c.min_fame; END IF;
  IF EXISTS (SELECT 1 FROM time_away_bookings WHERE profile_id = p_profile_id AND status IN ('pending_approval','booked','active') AND start_date <= p_end AND end_date >= p_start) THEN
    RAISE EXCEPTION 'You already have a break on those dates'; END IF;
  IF EXISTS (SELECT 1 FROM time_away_bookings WHERE profile_id = p_profile_id AND type = p_type AND status IN ('booked','active','completed') AND end_date > p_start - c.cooldown_days) THEN
    RAISE EXCEPTION 'You took a % recently. Wait % days between them.', c.label, c.cooldown_days; END IF;
  v_cost := c.base_cost + c.daily_cost * v_days;
  IF coalesce(v_cash,0) < v_cost THEN RAISE EXCEPTION 'Not enough cash (need $%)', v_cost; END IF;
  SELECT bm.band_id INTO v_band FROM band_members bm WHERE bm.profile_id = p_profile_id AND bm.member_status = 'active' LIMIT 1;
  IF v_band IS NOT NULL THEN
    SELECT count(*) INTO v_conf FROM gigs g WHERE g.band_id = v_band AND g.status NOT IN ('cancelled','completed')
      AND g.scheduled_date::date BETWEEN p_start AND p_end;
  END IF;
  v_status := CASE WHEN v_band IS NOT NULL AND (v_conf > 0 OR c.always_band_approval)
    AND NOT EXISTS (SELECT 1 FROM bands b WHERE b.id = v_band AND (b.leader_id = auth.uid() OR b.leader_id = p_profile_id))
    THEN 'pending_approval' ELSE 'booked' END;
  UPDATE profiles SET cash = cash - v_cost WHERE id = p_profile_id;
  INSERT INTO time_away_bookings (profile_id,type,status,start_date,end_date,cost,band_id,conflict_gigs)
  VALUES (p_profile_id,p_type,v_status,p_start,p_end,v_cost,v_band,v_conf) RETURNING id INTO v_id;
  RETURN jsonb_build_object('booking_id', v_id, 'status', v_status, 'cost', v_cost, 'conflict_gigs', v_conf);
END $$;

CREATE OR REPLACE FUNCTION public.cancel_time_away(p_profile_id uuid, p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b time_away_bookings%rowtype; c time_away_type_config%rowtype; v_refund int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'Not your character'; END IF;
  SELECT * INTO b FROM time_away_bookings WHERE id = p_booking_id AND profile_id = p_profile_id FOR UPDATE;
  IF NOT FOUND OR b.status NOT IN ('pending_approval','booked','active') THEN RAISE EXCEPTION 'This break cannot be cancelled'; END IF;
  SELECT * INTO c FROM time_away_type_config WHERE type = b.type;
  v_refund := CASE WHEN b.status = 'pending_approval' THEN b.cost
    WHEN b.status = 'active' THEN 0
    WHEN b.start_date - CURRENT_DATE >= c.refund_until_days THEN b.cost
    ELSE (b.cost / 2) END;
  UPDATE time_away_bookings SET status = CASE WHEN status = 'active' THEN 'completed' ELSE 'cancelled' END,
    refunded = v_refund, cancelled_at = now(), updated_at = now() WHERE id = b.id;
  IF v_refund > 0 THEN UPDATE profiles SET cash = cash + v_refund WHERE id = p_profile_id; END IF;
  RETURN jsonb_build_object('refund', v_refund);
END $$;

CREATE OR REPLACE FUNCTION public.decide_time_away(p_booking_id uuid, p_approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b time_away_bookings%rowtype;
BEGIN
  SELECT * INTO b FROM time_away_bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR b.status <> 'pending_approval' THEN RAISE EXCEPTION 'Request not pending'; END IF;
  IF NOT EXISTS (SELECT 1 FROM bands x WHERE x.id = b.band_id AND (x.leader_id = auth.uid() OR x.leader_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))) THEN
    RAISE EXCEPTION 'Only the band leader can decide'; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = b.profile_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'You cannot approve your own break'; END IF;
  UPDATE time_away_bookings SET status = CASE WHEN p_approve THEN 'booked' ELSE 'rejected' END,
    refunded = CASE WHEN p_approve THEN 0 ELSE cost END, decided_by = auth.uid(), decided_at = now(), updated_at = now() WHERE id = b.id;
  IF NOT p_approve THEN UPDATE profiles SET cash = cash + b.cost WHERE id = b.profile_id; END IF;
  RETURN jsonb_build_object('status', CASE WHEN p_approve THEN 'booked' ELSE 'rejected' END);
END $$;

CREATE OR REPLACE FUNCTION public.process_time_away_daily()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0; e jsonb;
BEGIN
  UPDATE time_away_bookings SET status = 'completed', updated_at = now() WHERE status IN ('booked','active') AND end_date < CURRENT_DATE;
  UPDATE time_away_bookings SET status = 'rejected', refunded = cost, updated_at = now() WHERE status = 'pending_approval' AND start_date <= CURRENT_DATE
    RETURNING profile_id, cost INTO r;
  FOR r IN SELECT b.*, c.daily_effects FROM time_away_bookings b JOIN time_away_type_config c ON c.type = b.type
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

REVOKE ALL ON FUNCTION public.book_time_away(uuid,text,date,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_time_away(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_time_away(uuid,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_time_away_daily() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_time_away(uuid,text,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_time_away(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_time_away(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_time_away_daily() TO service_role;

SELECT cron.schedule('process-time-away-daily', '15 0 * * *', $c$SELECT public.process_time_away_daily()$c$);