-- Wellness time-away, career breaks and longevity management.
-- Additive, server-authoritative schema that extends existing wellness/schedule/travel primitives.

CREATE TABLE IF NOT EXISTS public.time_away_type_config (
  type text PRIMARY KEY,
  label text NOT NULL,
  min_days integer NOT NULL CHECK (min_days > 0),
  max_days integer NOT NULL CHECK (max_days >= min_days),
  unlock_tier text NOT NULL CHECK (unlock_tier IN ('new_artist','active_musician','professional_artist','superstar')),
  cost_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  eligibility_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  allowed_activities text[] NOT NULL DEFAULT '{}',
  restricted_activities text[] NOT NULL DEFAULT '{}',
  wellness_effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  burnout_effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  lifestyle_effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  career_momentum_effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  fame_effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  relationship_effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  cancellation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  cooldown_days integer NOT NULL DEFAULT 0,
  required_notice_days integer NOT NULL DEFAULT 0,
  requires_band_approval text NOT NULL DEFAULT 'on_conflict' CHECK (requires_band_approval IN ('never','on_conflict','always')),
  requires_employment_leave boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.time_away_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL REFERENCES public.time_away_type_config(type),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','forecasted','pending_approval','booked','active','completed','cancelled')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  destination_city_id uuid,
  accommodation_source_table text,
  accommodation_source_id uuid,
  travel_plan_id uuid,
  budget_cents integer NOT NULL DEFAULT 0 CHECK (budget_cents >= 0),
  estimated_total_cost_cents integer NOT NULL DEFAULT 0 CHECK (estimated_total_cost_cents >= 0),
  recovery_focus text NOT NULL CHECK (recovery_focus IN ('complete_rest','burnout_recovery','sleep_reset','physical_recovery','mental_recovery','relationship_time','fitness','creative_reset','social_enjoyment','balanced_recovery')),
  itinerary_mode text NOT NULL DEFAULT 'recommended' CHECK (itinerary_mode IN ('manual','recommended','assisted','managed_retreat')),
  automation_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  professional_support jsonb NOT NULL DEFAULT '{}'::jsonb,
  return_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  forecast jsonb NOT NULL DEFAULT '{}'::jsonb,
  privacy text NOT NULL DEFAULT 'private' CHECK (privacy IN ('private','band','friends','public')),
  public_communication text NOT NULL DEFAULT 'keep_private' CHECK (public_communication IN ('keep_private','announce_holiday','announce_short_break','announce_creative_retreat','announce_career_break','announce_sabbatical','limited_updates','media_silence')),
  idempotency_key text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  completed_at timestamptz,
  CHECK (end_date >= start_date),
  UNIQUE (profile_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.time_away_itinerary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.time_away_bookings(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_slug text NOT NULL,
  scheduled_activity_id uuid,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  source text NOT NULL CHECK (source IN ('manual','recommended','assisted','managed_retreat')),
  included_in_package boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','skipped','completed','cancelled')),
  effect_key text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (scheduled_end > scheduled_start),
  UNIQUE (booking_id, activity_slug, scheduled_start)
);

CREATE TABLE IF NOT EXISTS public.time_away_companion_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.time_away_bookings(id) ON DELETE CASCADE,
  inviter_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  cost_share_cents integer NOT NULL DEFAULT 0 CHECK (cost_share_cents >= 0),
  privacy text NOT NULL DEFAULT 'private' CHECK (privacy IN ('private','booking_party','public')),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, invitee_profile_id),
  CHECK (inviter_profile_id <> invitee_profile_id)
);

CREATE TABLE IF NOT EXISTS public.time_away_band_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.time_away_bookings(id) ON DELETE CASCADE,
  band_id uuid NOT NULL,
  conflict_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, band_id)
);

CREATE TABLE IF NOT EXISTS public.career_momentum_summaries (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  momentum_score integer NOT NULL DEFAULT 50 CHECK (momentum_score BETWEEN 0 AND 100),
  momentum_state text NOT NULL DEFAULT 'active' CHECK (momentum_state IN ('surging','strong','active','quiet','dormant')),
  recent_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  permanent_fame_protected boolean NOT NULL DEFAULT true,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.career_sustainability_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_days integer NOT NULL CHECK (window_days IN (30,90,365)),
  sustainability_score integer NOT NULL CHECK (sustainability_score BETWEEN 0 AND 100),
  sustainability_state text NOT NULL CHECK (sustainability_state IN ('sustainable','healthy_workload','high_pressure','overextended','at_risk','unsustainable')),
  workload_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  main_risk_factor text,
  main_protective_factor text,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, window_days)
);

CREATE TABLE IF NOT EXISTS public.time_away_processing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.time_away_bookings(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  processing_key text NOT NULL,
  processing_kind text NOT NULL CHECK (processing_kind IN ('day_recovery','travel','accommodation','itinerary','payment','refund','companion','band_retreat','career_break_start','career_break_end','momentum','return_bonus')),
  processed_on date NOT NULL DEFAULT CURRENT_DATE,
  effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, profile_id, processing_key)
);

ALTER TABLE public.time_away_type_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_away_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_away_itinerary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_away_companion_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_away_band_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_momentum_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_sustainability_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_away_processing_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read time away config" ON public.time_away_type_config FOR SELECT USING (true);
CREATE POLICY "owners read time away bookings" ON public.time_away_bookings FOR SELECT USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "owners read time away itinerary" ON public.time_away_itinerary_items FOR SELECT USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "companions read own invitations" ON public.time_away_companion_invitations FOR SELECT USING (invitee_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR inviter_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "owners read momentum" ON public.career_momentum_summaries FOR SELECT USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "owners read sustainability" ON public.career_sustainability_summaries FOR SELECT USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "owners read processing records" ON public.time_away_processing_records FOR SELECT USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

INSERT INTO public.time_away_type_config (type,label,min_days,max_days,unlock_tier,cost_rules,eligibility_rules,allowed_activities,restricted_activities,wellness_effects,burnout_effects,lifestyle_effects,career_momentum_effects,fame_effects,relationship_effects,cancellation_rules,cooldown_days,required_notice_days,requires_band_approval,requires_employment_leave)
VALUES
('rest_day','Rest Day',1,1,'new_artist','{"base":0,"daily":0}','{"allows_home":true,"requires_travel":false}',ARRAY['sleep','relaxation','quiet_time'],ARRAY['gig','tour','recording'],'{"energy":9,"fatigue":-12,"stress":-5,"sleep":4}','{"risk":-3}','{"routine_stability":2}','{"daily_cost":0}','{"engagement_daily_cost":0}','{"home_life":1}','{"refundable_until_days":0,"late_fee_rate":0}',1,0,'on_conflict',false),
('staycation','Staycation',2,7,'new_artist','{"base":0,"daily":1200}','{"allows_home":true,"requires_travel":false}',ARRAY['sleep','healthy_meals','relationship_activities','walking','quiet_time'],ARRAY['gig','tour','recording','major_contract'],'{"energy":7,"fatigue":-8,"stress":-7,"sleep":7}','{"risk":-4}','{"routine_stability":6,"sleep_consistency":6}','{"daily_cost":0.05}','{"engagement_daily_cost":0.02}','{"home_life":5}','{"refundable_until_days":0,"late_fee_rate":0}',7,1,'on_conflict',false),
('city_break','City Break',2,5,'new_artist','{"base":15000,"daily":8500}','{"allows_home":false,"requires_travel":true,"requires_accommodation":true}',ARRAY['sleep','sightseeing','social_activities','walking'],ARRAY['tour','demanding_recording'],'{"energy":5,"fatigue":-5,"stress":-5,"sleep":3}','{"risk":-3}','{"novelty":5}','{"daily_cost":0.08}','{"engagement_daily_cost":0.04}','{"shared_memory":3}','{"refundable_until_days":3,"late_fee_rate":0.25}',10,2,'on_conflict',false),
('standard_holiday','Standard Holiday',3,14,'active_musician','{"base":25000,"daily":12000}','{"requires_travel":true,"requires_accommodation":true}',ARRAY['sleep','relaxation','sightseeing','relationship_activities','swimming'],ARRAY['gig','tour','recording','major_contract'],'{"energy":6,"fatigue":-7,"stress":-8,"sleep":5}','{"risk":-5}','{"downtime_quality":6}','{"daily_cost":0.12}','{"engagement_daily_cost":0.05}','{"shared_memory":4}','{"refundable_until_days":7,"late_fee_rate":0.35}',21,3,'on_conflict',true),
('wellness_retreat','Wellness Retreat',2,14,'professional_artist','{"base":45000,"daily":18000}','{"requires_accommodation":true,"supports_provider_package":true}',ARRAY['sleep','therapy','meditation','massage','healthy_meals','professional_consultation'],ARRAY['gig','tour','nightlife','intensive_rehearsal'],'{"energy":6,"fatigue":-7,"stress":-10,"sleep":7}','{"risk":-7,"diminishing_returns":true}','{"lifestyle_reset":7}','{"daily_cost":0.10}','{"engagement_daily_cost":0.04}','{"privacy_required":true}','{"refundable_until_days":10,"late_fee_rate":0.50}',28,5,'on_conflict',true),
('creative_retreat','Creative Retreat',2,14,'professional_artist','{"base":30000,"daily":10000}','{"allows_home":true}',ARRAY['sleep','quiet_time','light_songwriting','walking','cultural_activity'],ARRAY['gig','tour','media_blitz'],'{"energy":4,"fatigue":-5,"stress":-7,"sleep":4,"motivation":7}','{"risk":-4}','{"pressure_reduction":6}','{"daily_cost":0.07}','{"engagement_daily_cost":0.03}','{"private_by_default":true}','{"refundable_until_days":7,"late_fee_rate":0.30}',21,4,'on_conflict',true),
('fitness_retreat','Fitness Retreat',2,10,'professional_artist','{"base":35000,"daily":14000}','{"requires_accommodation":true}',ARRAY['sleep','exercise','healthy_meals','physiotherapy','walking'],ARRAY['gig','tour','nightlife'],'{"energy":3,"fatigue":-3,"stress":-5,"sleep":4,"fitness":5}','{"risk":-3}','{"discipline":6}','{"daily_cost":0.08}','{"engagement_daily_cost":0.03}','{}','{"refundable_until_days":7,"late_fee_rate":0.40}',28,5,'on_conflict',true),
('band_retreat','Band Retreat',2,7,'active_musician','{"base":30000,"daily":9000}','{"attendees_only":true,"diminishing_group_returns":true}',ARRAY['sleep','planning','light_rehearsal','light_songwriting','conflict_resolution','social_activities'],ARRAY['public_gig','tour_leg'],'{"energy":4,"fatigue":-5,"stress":-6,"sleep":3}','{"risk":-4}','{"team_stability":5}','{"daily_cost":0.04}','{"engagement_daily_cost":0.02}','{"band_chemistry":5,"attendees_only":true}','{"refundable_until_days":7,"late_fee_rate":0.35}',30,7,'always',false),
('career_break','Career Break',14,120,'professional_artist','{"base":0,"daily":2500,"lost_income_forecast":true}','{"allows_home":true,"reduced_workload_required":true}',ARRAY['sleep','education','light_songwriting','relationships','low_intensity_wellness','finance_review'],ARRAY['gig','tour','recording','intensive_rehearsal','major_contract'],'{"energy":4,"fatigue":-5,"stress":-8,"sleep":6}','{"risk":-8,"minimum_sustained_days":14}','{"life_balance":8}','{"daily_cost":0.35,"gradual":true}','{"engagement_daily_cost":0.12}','{"personal_life":6}','{"refundable_until_days":0,"late_fee_rate":0.05}',90,14,'on_conflict',true),
('sabbatical','Sabbatical',30,365,'superstar','{"base":0,"daily":3500,"lost_income_forecast":true}','{"allows_home":true,"structured_return_required":true}',ARRAY['sleep','relationships','education','low_intensity_wellness','creative_reset','remote_admin'],ARRAY['gig','tour','recording','intensive_rehearsal','major_contract','media_blitz'],'{"energy":3,"fatigue":-4,"stress":-9,"sleep":7}','{"risk":-9,"minimum_sustained_days":30}','{"reinvention_hooks":true}','{"daily_cost":0.55,"gradual":true}','{"engagement_daily_cost":0.18}','{"personal_life":8}','{"refundable_until_days":0,"late_fee_rate":0.05}',365,30,'on_conflict',true)
ON CONFLICT (type) DO UPDATE SET label=EXCLUDED.label,min_days=EXCLUDED.min_days,max_days=EXCLUDED.max_days,unlock_tier=EXCLUDED.unlock_tier,cost_rules=EXCLUDED.cost_rules,eligibility_rules=EXCLUDED.eligibility_rules,allowed_activities=EXCLUDED.allowed_activities,restricted_activities=EXCLUDED.restricted_activities,wellness_effects=EXCLUDED.wellness_effects,burnout_effects=EXCLUDED.burnout_effects,lifestyle_effects=EXCLUDED.lifestyle_effects,career_momentum_effects=EXCLUDED.career_momentum_effects,fame_effects=EXCLUDED.fame_effects,relationship_effects=EXCLUDED.relationship_effects,cancellation_rules=EXCLUDED.cancellation_rules,cooldown_days=EXCLUDED.cooldown_days,required_notice_days=EXCLUDED.required_notice_days,requires_band_approval=EXCLUDED.requires_band_approval,requires_employment_leave=EXCLUDED.requires_employment_leave,updated_at=now();

CREATE OR REPLACE FUNCTION public.forecast_time_away(_profile_id uuid, _type text, _start_date date, _end_date date, _focus text DEFAULT 'balanced_recovery')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p profiles%rowtype;
  c time_away_type_config%rowtype;
  days int;
  base_cost int;
  daily_cost int;
  burnout_delta numeric;
  momentum_delta numeric;
BEGIN
  SELECT * INTO p FROM profiles WHERE id = _profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
  SELECT * INTO c FROM time_away_type_config WHERE type = _type;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown time away type'; END IF;
  days := (_end_date - _start_date) + 1;
  IF _start_date < CURRENT_DATE THEN RAISE EXCEPTION 'breaks cannot begin in the past'; END IF;
  IF days < c.min_days OR days > c.max_days THEN RAISE EXCEPTION '% must be between % and % days', c.label, c.min_days, c.max_days; END IF;
  base_cost := COALESCE((c.cost_rules->>'base')::int,0);
  daily_cost := COALESCE((c.cost_rules->>'daily')::int,0);
  burnout_delta := COALESCE((c.burnout_effects->>'risk')::numeric,0) * LEAST(1.0, 0.72 + LN(days + 1) / LN(2) / 7);
  momentum_delta := -LEAST(35, GREATEST(0, days * COALESCE((c.career_momentum_effects->>'daily_cost')::numeric,0)));
  RETURN jsonb_build_object(
    'type', c.type, 'label', c.label, 'days', days,
    'estimated_total_cost_cents', base_cost + daily_cost * days,
    'wellness', jsonb_build_object('energy', LEAST(100, COALESCE(p.energy,80) + ((c.wellness_effects->>'energy')::numeric * days / 3)), 'fatigue', GREATEST(0, COALESCE(p.fatigue,35) + ((c.wellness_effects->>'fatigue')::numeric * days / 3)), 'stress', GREATEST(0, COALESCE(p.stress,28) + ((c.wellness_effects->>'stress')::numeric * days / 3)), 'sleep_quality', LEAST(100, COALESCE(p.sleep_quality,72) + ((c.wellness_effects->>'sleep')::numeric * days / 3)), 'burnout_risk', LEAST(100, GREATEST(0, COALESCE(p.burnout_risk,18) + burnout_delta))),
    'career_momentum_delta', momentum_delta,
    'permanent_fame_protected', true,
    'requires_band_approval', c.requires_band_approval,
    'requires_employment_leave', c.requires_employment_leave,
    'server_authoritative', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.book_time_away(_profile_id uuid, _type text, _start_date date, _end_date date, _focus text, _idempotency_key text, _budget_cents integer DEFAULT 0, _privacy text DEFAULT 'private')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  forecast jsonb;
  existing time_away_bookings%rowtype;
  booking_id uuid;
BEGIN
  SELECT * INTO existing FROM time_away_bookings WHERE profile_id = _profile_id AND idempotency_key = _idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'booking_id', existing.id, 'forecast', existing.forecast);
  END IF;
  forecast := forecast_time_away(_profile_id, _type, _start_date, _end_date, _focus);
  IF _budget_cents > 0 AND (forecast->>'estimated_total_cost_cents')::int > _budget_cents THEN
    RAISE EXCEPTION 'insufficient approved budget for time away booking';
  END IF;
  INSERT INTO time_away_bookings(profile_id,type,status,start_date,end_date,budget_cents,estimated_total_cost_cents,recovery_focus,forecast,privacy,idempotency_key,created_by)
  VALUES (_profile_id,_type,'booked',_start_date,_end_date,_budget_cents,(forecast->>'estimated_total_cost_cents')::int,_focus,forecast,_privacy,_idempotency_key,_profile_id)
  RETURNING id INTO booking_id;
  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'booking_id', booking_id, 'forecast', forecast);
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO existing FROM time_away_bookings WHERE profile_id = _profile_id AND idempotency_key = _idempotency_key;
  RETURN jsonb_build_object('ok', true, 'idempotent', true, 'booking_id', existing.id, 'forecast', existing.forecast);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_time_away_day(_booking_id uuid, _profile_id uuid, _day date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b time_away_bookings%rowtype;
  c time_away_type_config%rowtype;
  key text;
BEGIN
  SELECT * INTO b FROM time_away_bookings WHERE id = _booking_id AND profile_id = _profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;
  SELECT * INTO c FROM time_away_type_config WHERE type = b.type;
  key := 'time-away-day:' || _booking_id::text || ':' || _day::text;
  IF EXISTS (SELECT 1 FROM time_away_processing_records WHERE booking_id = _booking_id AND profile_id = _profile_id AND processing_key = key) THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true);
  END IF;
  IF _day < b.start_date OR _day > b.end_date THEN
    RETURN jsonb_build_object('ok', false, 'skipped', 'outside booking dates');
  END IF;
  UPDATE profiles SET
    energy = LEAST(100, COALESCE(energy,80) + COALESCE((c.wellness_effects->>'energy')::int,0)),
    fatigue = GREATEST(0, COALESCE(fatigue,35) + COALESCE((c.wellness_effects->>'fatigue')::int,0)),
    stress = GREATEST(0, COALESCE(stress,28) + COALESCE((c.wellness_effects->>'stress')::int,0)),
    sleep_quality = LEAST(100, COALESCE(sleep_quality,72) + COALESCE((c.wellness_effects->>'sleep')::int,0)),
    motivation = LEAST(100, COALESCE(motivation,72) + COALESCE((c.wellness_effects->>'motivation')::int,0)),
    burnout_risk = LEAST(100, GREATEST(0, COALESCE(burnout_risk,18) + COALESCE((c.burnout_effects->>'risk')::int,0)))
  WHERE id = _profile_id;
  INSERT INTO time_away_processing_records(booking_id,profile_id,processing_key,processing_kind,processed_on,effects)
  VALUES (_booking_id,_profile_id,key,'day_recovery',_day,jsonb_build_object('type',b.type,'capped',true));
  RETURN jsonb_build_object('ok', true, 'idempotent', false);
END;
$$;

COMMENT ON TABLE public.time_away_processing_records IS 'Idempotency ledger ensuring each booked day, refund, payment, itinerary activity, companion effect and return bonus is applied once.';
