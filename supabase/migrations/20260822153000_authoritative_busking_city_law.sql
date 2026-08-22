-- Make busking server authoritative and wire the mayor's busking licence fee into
-- the canonical player finance ledger and the City Hall treasury projection.
--
-- This migration deliberately does not depend on the later historical 2026/2029
-- busking/progression migrations so it can be applied safely to the live 2026
-- production schema as well as a clean build.

CREATE TABLE IF NOT EXISTS public.city_busking_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key text NOT NULL,
  spot_key text NOT NULL,
  name text NOT NULL,
  neighborhood text NOT NULL,
  description text NOT NULL,
  vibe text NOT NULL,
  tip text NOT NULL,
  xp_30 integer NOT NULL CHECK (xp_30 > 0),
  cash_30 integer NOT NULL CHECK (cash_30 >= 0),
  xp_60 integer NOT NULL CHECK (xp_60 > 0),
  cash_60 integer NOT NULL CHECK (cash_60 >= 0),
  xp_120 integer NOT NULL CHECK (xp_120 > 0),
  cash_120 integer NOT NULL CHECK (cash_120 >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_key, spot_key)
);

ALTER TABLE public.city_busking_spots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.city_busking_spots FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.city_busking_spots TO service_role;

INSERT INTO public.city_busking_spots
  (scope_key, spot_key, name, neighborhood, description, vibe, tip,
   xp_30, cash_30, xp_60, cash_60, xp_120, cash_120)
VALUES
  ('*','market-square','Market Square','Old Town','Bustling stalls and coffee carts keep lunchtime crowds lingering.','Midday bustle','Great spot for upbeat covers that catch shoppers on the move.',45,32,90,74,180,150),
  ('*','river-promenade','River Promenade','Harborfront','Evening strollers and bus tours bring a steady flow of tipsy tippers.','Sunset rush','Lean into soulful ballads as the lights bounce off the water.',55,40,110,92,210,175),
  ('*','night-market','Neon Night Market','Arts District','Street food, neon booths, and late-night creatives pack the walkways.','After-dark energy','Long-form jams thrive as the crowd settles in for the night.',70,52,135,108,260,210),
  ('London','camden-market','Camden Market','Camden Town','Punk history meets tourist crowds at London''s iconic alternative market.','Alternative buzz','Punk, indie, and folk play well here. Channel the spirit of The Clash.',55,45,110,95,220,190),
  ('London','south-bank','South Bank','Lambeth','The Thames-side cultural strip draws theatregoers and international visitors.','Cultural mile','Classical and jazz resonate well against the river backdrop.',60,50,120,105,240,210),
  ('London','covent-garden','Covent Garden Piazza','West End','London''s premier busking spot — you need to be good to hold this crowd.','World stage','Showmanship matters here. Big performances draw big tips.',75,60,150,125,300,250),
  ('New York','washington-sq','Washington Square Park','Greenwich Village','Dylan played here. So can you. The fountain crowd is always listening.','Folk legend','Singer-songwriter sets feel right at home in the Village.',60,48,120,100,240,200),
  ('New York','times-square-subway','Times Square Subway','Midtown','Underground platform stages draw millions of daily commuters.','Rush hour','Keep it energetic — you have 30 seconds to grab attention.',50,55,105,115,210,230),
  ('New York','central-park','Central Park Bethesda','Upper West Side','The angel fountain plaza is a natural amphitheater for weekend crowds.','Park serenity','Acoustic sets and gentle vocals carry beautifully here.',65,52,130,108,260,215),
  ('Tokyo','shibuya-crossing','Shibuya Crossing','Shibuya','The world''s busiest intersection — if you can hold a crowd here, you''ve made it.','Neon chaos','Visual performance matters as much as the music.',70,55,140,115,280,230),
  ('Tokyo','yoyogi-park','Yoyogi Park','Harajuku','Weekend performers, cosplayers, and rockabilly dancers share the space.','Subculture hub','Genre creativity is celebrated. The weirder, the better.',60,45,120,95,240,190),
  ('Tokyo','ueno-park','Ueno Park','Taito','Cherry blossoms and museum crowds create a contemplative busking spot.','Cultural calm','Acoustic and classical pieces resonate with the park atmosphere.',50,40,100,85,200,170),
  ('Paris','montmartre-steps','Montmartre Steps','Montmartre','Artists, tourists and lovers gather on the steps of Sacré-Cœur.','Romantic bohemia','French chanson and accordion-driven sets are crowd favorites.',60,50,120,105,240,210),
  ('Paris','pont-des-arts','Pont des Arts','Seine','The famous love-lock bridge draws couples and picnickers year-round.','Seine serenade','Romantic ballads and jazz standards earn the best tips.',55,48,110,100,220,200),
  ('Paris','metro-chatelet','Métro Châtelet','Les Halles','Paris''s busiest metro hub. Licensed buskers get prime underground spots.','Underground pulse','Upbeat world music and pop covers move through the tunnels.',50,55,100,115,200,230),
  ('Berlin','mauerpark','Mauerpark','Prenzlauer Berg','Sunday flea market and the famous karaoke amphitheater.','Sunday circus','Eclectic sets thrive — punk, techno-acoustic, experimental.',65,45,130,95,260,190),
  ('Berlin','alexanderplatz','Alexanderplatz','Mitte','The TV Tower plaza pulls crowds from every direction.','Urban crossroads','High energy draws the commuter crowd between trains.',55,50,110,105,220,210),
  ('Berlin','warschauer','Warschauer Straße','Friedrichshain','Club-goers spilling out at dawn make for an adventurous audience.','After-party dawn','Electronic-influenced acoustic sets hit differently at 6am.',70,55,140,115,280,230)
ON CONFLICT (scope_key, spot_key) DO UPDATE SET
  name = EXCLUDED.name,
  neighborhood = EXCLUDED.neighborhood,
  description = EXCLUDED.description,
  vibe = EXCLUDED.vibe,
  tip = EXCLUDED.tip,
  xp_30 = EXCLUDED.xp_30,
  cash_30 = EXCLUDED.cash_30,
  xp_60 = EXCLUDED.xp_60,
  cash_60 = EXCLUDED.cash_60,
  xp_120 = EXCLUDED.xp_120,
  cash_120 = EXCLUDED.cash_120,
  is_active = true,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.authoritative_busking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE RESTRICT,
  spot_key text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes IN (30,60,120)),
  base_cash integer NOT NULL CHECK (base_cash >= 0),
  base_xp integer NOT NULL CHECK (base_xp > 0),
  performance_roll numeric(6,4) NOT NULL,
  city_demand_multiplier numeric(6,4) NOT NULL DEFAULT 1,
  gross_tips integer NOT NULL CHECK (gross_tips >= 0),
  licence_fee integer NOT NULL CHECK (licence_fee >= 0),
  net_cash_change integer NOT NULL,
  xp_award integer NOT NULL CHECK (xp_award > 0),
  performance_descriptor text NOT NULL,
  started_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  finance_tip_transaction_id uuid,
  finance_licence_transaction_id uuid,
  idempotency_key uuid NOT NULL,
  result_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS authoritative_busking_sessions_profile_created_idx
  ON public.authoritative_busking_sessions(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS authoritative_busking_sessions_city_created_idx
  ON public.authoritative_busking_sessions(city_id, created_at DESC);

ALTER TABLE public.authoritative_busking_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.authoritative_busking_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.authoritative_busking_sessions TO service_role;

CREATE OR REPLACE FUNCTION public.get_authoritative_busking_options(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_city_name text;
  v_scope text := '*';
  v_licence_fee integer := 0;
  v_demand_multiplier numeric := 1;
  v_spots jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id
    AND coalesce(is_active, true) = true
    AND died_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'busking_profile_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_profile.current_city_id IS NULL THEN
    RAISE EXCEPTION 'busking_city_not_set' USING ERRCODE = 'P0001';
  END IF;

  SELECT name INTO v_city_name FROM public.cities WHERE id = v_profile.current_city_id;

  IF EXISTS (
    SELECT 1 FROM public.city_busking_spots
    WHERE scope_key = v_city_name AND is_active
  ) THEN
    v_scope := v_city_name;
  END IF;

  SELECT round(coalesce(busking_license_fee, 0))::integer
  INTO v_licence_fee
  FROM public.city_laws
  WHERE city_id = v_profile.current_city_id
    AND effective_from <= now()
    AND (effective_until IS NULL OR effective_until > now())
  ORDER BY effective_from DESC
  LIMIT 1;
  v_licence_fee := coalesce(v_licence_fee, 0);

  BEGIN
    SELECT audience_demand_multiplier INTO v_demand_multiplier
    FROM public.city_gameplay_modifiers(v_profile.current_city_id);
  EXCEPTION WHEN undefined_function THEN
    v_demand_multiplier := 1;
  END;
  v_demand_multiplier := coalesce(v_demand_multiplier, 1);

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', spot_key,
      'name', name,
      'neighborhood', neighborhood,
      'description', description,
      'vibe', vibe,
      'tip', tip,
      'rewards', jsonb_build_object(
        '30', jsonb_build_object('experience', xp_30, 'cash', cash_30),
        '60', jsonb_build_object('experience', xp_60, 'cash', cash_60),
        '120', jsonb_build_object('experience', xp_120, 'cash', cash_120)
      )
    ) ORDER BY name
  ), '[]'::jsonb)
  INTO v_spots
  FROM public.city_busking_spots
  WHERE scope_key = v_scope AND is_active;

  RETURN jsonb_build_object(
    'profileId', v_profile.id,
    'cityId', v_profile.current_city_id,
    'cityName', v_city_name,
    'licenceFee', v_licence_fee,
    'audienceDemandMultiplier', v_demand_multiplier,
    'spots', v_spots
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.perform_authoritative_busking(
  p_user_id uuid,
  p_location_key text,
  p_duration_minutes integer,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_existing jsonb;
  v_city_name text;
  v_scope text := '*';
  v_spot public.city_busking_spots%ROWTYPE;
  v_start timestamptz := now();
  v_end timestamptz;
  v_status record;
  v_conflict boolean := false;
  v_base_cash integer;
  v_base_xp integer;
  v_roll numeric;
  v_city_multiplier numeric := 1;
  v_xp_city_multiplier numeric := 1;
  v_gross integer;
  v_xp integer;
  v_licence_fee integer := 0;
  v_net integer;
  v_descriptor text;
  v_session_id uuid := gen_random_uuid();
  v_tip_tx uuid;
  v_licence_tx uuid;
  v_account_balance_minor bigint;
  v_result jsonb;
BEGIN
  IF p_user_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'busking_invalid_request' USING ERRCODE = '22023';
  END IF;
  IF p_duration_minutes NOT IN (30,60,120) THEN
    RAISE EXCEPTION 'busking_invalid_duration' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(p_location_key), '') IS NULL THEN
    RAISE EXCEPTION 'busking_location_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id
    AND coalesce(is_active, true) = true
    AND died_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'busking_profile_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT result_snapshot INTO v_existing
  FROM public.authoritative_busking_sessions
  WHERE profile_id = v_profile.id AND idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing || jsonb_build_object('idempotent', true);
  END IF;

  IF v_profile.current_city_id IS NULL THEN
    RAISE EXCEPTION 'busking_city_not_set' USING ERRCODE = 'P0001';
  END IF;
  SELECT name INTO v_city_name FROM public.cities WHERE id = v_profile.current_city_id;

  IF EXISTS (
    SELECT 1 FROM public.city_busking_spots
    WHERE scope_key = v_city_name AND is_active
  ) THEN
    v_scope := v_city_name;
  END IF;

  SELECT * INTO v_spot
  FROM public.city_busking_spots
  WHERE scope_key = v_scope
    AND spot_key = p_location_key
    AND is_active
  LIMIT 1;
  IF v_spot.id IS NULL THEN
    RAISE EXCEPTION 'busking_invalid_location' USING ERRCODE = 'P0001';
  END IF;

  v_end := v_start + make_interval(mins => p_duration_minutes);

  SELECT * INTO v_status
  FROM public.profile_activity_statuses
  WHERE profile_id = v_profile.id
  FOR UPDATE;
  IF v_status IS NOT NULL
     AND coalesce(v_status.status, 'active') NOT IN ('idle','completed','cancelled')
     AND (v_status.ends_at IS NULL OR v_status.ends_at > v_start) THEN
    RAISE EXCEPTION 'busking_player_busy' USING ERRCODE = 'P0001';
  END IF;

  SELECT public.check_scheduling_conflict(p_user_id, v_start, v_end, NULL)
  INTO v_conflict;
  IF coalesce(v_conflict, false) THEN
    RAISE EXCEPTION 'busking_schedule_conflict' USING ERRCODE = 'P0001';
  END IF;

  CASE p_duration_minutes
    WHEN 30 THEN v_base_cash := v_spot.cash_30; v_base_xp := v_spot.xp_30;
    WHEN 60 THEN v_base_cash := v_spot.cash_60; v_base_xp := v_spot.xp_60;
    WHEN 120 THEN v_base_cash := v_spot.cash_120; v_base_xp := v_spot.xp_120;
  END CASE;

  SELECT round(coalesce(busking_license_fee, 0))::integer
  INTO v_licence_fee
  FROM public.city_laws
  WHERE city_id = v_profile.current_city_id
    AND effective_from <= v_start
    AND (effective_until IS NULL OR effective_until > v_start)
  ORDER BY effective_from DESC
  LIMIT 1;
  v_licence_fee := greatest(0, coalesce(v_licence_fee, 0));

  IF coalesce(v_profile.cash, 0) < v_licence_fee THEN
    RAISE EXCEPTION 'busking_insufficient_funds_for_licence' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    SELECT audience_demand_multiplier INTO v_city_multiplier
    FROM public.city_gameplay_modifiers(v_profile.current_city_id);
  EXCEPTION WHEN undefined_function THEN
    v_city_multiplier := 1;
  END;
  v_city_multiplier := greatest(0.85, least(1.15, coalesce(v_city_multiplier, 1)));
  v_xp_city_multiplier := greatest(0.90, least(1.10, v_city_multiplier));

  -- Server-owned roll. The idempotency record below freezes the outcome so retries
  -- can never reroll, repay tips, or recharge the licence.
  v_roll := 0.85 + random() * 0.45;
  v_gross := greatest(5, round(v_base_cash * v_roll * v_city_multiplier)::integer);
  v_xp := greatest(5, round(v_base_xp * v_roll * v_xp_city_multiplier)::integer);
  v_net := v_gross - v_licence_fee;
  v_descriptor := CASE
    WHEN v_roll >= 1.25 THEN 'Electric crowd surge'
    WHEN v_roll >= 1.10 THEN 'Strong engagement and steady tips'
    WHEN v_roll >= 0.95 THEN 'Solid flow with a supportive audience'
    ELSE 'Tough crowd — every coin counted'
  END;

  IF v_licence_fee > 0 THEN
    v_licence_tx := public.finance_transfer(
      'player', v_profile.id,
      'city', v_profile.current_city_id,
      v_licence_fee::bigint * 100,
      'licence_fee',
      'City busking licence fee',
      'busking-licence:' || p_idempotency_key::text,
      'busking_session', v_session_id,
      v_profile.id,
      jsonb_build_object('source', 'authoritative_busking', 'cityId', v_profile.current_city_id)
    );

    PERFORM public.credit_city_treasury(
      v_profile.current_city_id,
      v_licence_fee,
      'busking_licence_fee',
      'Busking licence paid by ' || coalesce(v_profile.display_name, v_profile.username, 'artist'),
      v_session_id
    );
  END IF;

  v_tip_tx := public.finance_credit_owner(
    'player', v_profile.id,
    v_gross::bigint * 100,
    'gig_payment',
    'Busking tips at ' || v_spot.name,
    'busking-tips:' || p_idempotency_key::text,
    v_profile.id,
    jsonb_build_object(
      'source', 'authoritative_busking',
      'sessionId', v_session_id,
      'cityId', v_profile.current_city_id,
      'spotKey', v_spot.spot_key
    )
  );

  SELECT current_balance_minor INTO v_account_balance_minor
  FROM public.financial_accounts
  WHERE owner_type = 'player' AND owner_id = v_profile.id AND is_primary
  LIMIT 1;

  UPDATE public.profiles
  SET cash = coalesce(v_account_balance_minor, 0)::numeric / 100.0
  WHERE id = v_profile.id;

  INSERT INTO public.profile_activity_statuses(
    profile_id, status, started_at, duration_minutes, metadata
  ) VALUES (
    v_profile.id, 'active', v_start, p_duration_minutes,
    jsonb_build_object(
      'activity_type', 'busking_session',
      'busking_session_id', v_session_id,
      'location_id', v_spot.spot_key,
      'location_name', v_spot.name,
      'city_id', v_profile.current_city_id
    )
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    status = EXCLUDED.status,
    started_at = EXCLUDED.started_at,
    duration_minutes = EXCLUDED.duration_minutes,
    metadata = EXCLUDED.metadata;

  INSERT INTO public.player_scheduled_activities(
    user_id, profile_id, activity_type, scheduled_start, scheduled_end,
    status, title, description, metadata
  ) VALUES (
    p_user_id, v_profile.id, 'busking', v_start, v_end,
    'in_progress', 'Busking at ' || v_spot.name,
    'Street performance in ' || coalesce(v_city_name, 'the city'),
    jsonb_build_object(
      'busking_session_id', v_session_id,
      'location_id', v_spot.spot_key,
      'gross_tips', v_gross,
      'licence_fee', v_licence_fee,
      'xp_award', v_xp
    )
  );

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_feed' AND column_name = 'profile_id'
  ) THEN
    EXECUTE $sql$
      INSERT INTO public.activity_feed(user_id, profile_id, activity_type, message, earnings, metadata)
      VALUES ($1,$2,'busking_session',$3,$4,$5)
    $sql$
    USING p_user_id, v_profile.id,
      'Played a ' || p_duration_minutes || '-minute busking set at ' || v_spot.name,
      v_net,
      jsonb_build_object(
        'busking_session_id', v_session_id,
        'location_id', v_spot.spot_key,
        'location_name', v_spot.name,
        'duration_minutes', p_duration_minutes,
        'gross_tips', v_gross,
        'licence_fee', v_licence_fee,
        'net_cash_change', v_net,
        'xp_gained', v_xp,
        'performance_roll', v_roll,
        'performance_descriptor', v_descriptor,
        'city_demand_multiplier', v_city_multiplier
      );
  ELSE
    EXECUTE $sql$
      INSERT INTO public.activity_feed(user_id, activity_type, message, earnings, metadata)
      VALUES ($1,'busking_session',$2,$3,$4)
    $sql$
    USING p_user_id,
      'Played a ' || p_duration_minutes || '-minute busking set at ' || v_spot.name,
      v_net,
      jsonb_build_object(
        'busking_session_id', v_session_id,
        'location_id', v_spot.spot_key,
        'location_name', v_spot.name,
        'duration_minutes', p_duration_minutes,
        'gross_tips', v_gross,
        'licence_fee', v_licence_fee,
        'net_cash_change', v_net,
        'xp_gained', v_xp,
        'performance_roll', v_roll,
        'performance_descriptor', v_descriptor,
        'city_demand_multiplier', v_city_multiplier
      );
  END IF;

  v_result := jsonb_build_object(
    'sessionId', v_session_id,
    'profileId', v_profile.id,
    'cityId', v_profile.current_city_id,
    'cityName', v_city_name,
    'locationId', v_spot.spot_key,
    'locationName', v_spot.name,
    'duration', p_duration_minutes,
    'xpGained', v_xp,
    'cashEarned', v_gross,
    'licenceFee', v_licence_fee,
    'netCashChange', v_net,
    'startedAt', v_start,
    'endsAt', v_end,
    'performanceRoll', round(v_roll, 4),
    'performanceDescriptor', v_descriptor,
    'cityDemandMultiplier', v_city_multiplier,
    'idempotent', false
  );

  INSERT INTO public.authoritative_busking_sessions(
    id, user_id, profile_id, city_id, spot_key, duration_minutes,
    base_cash, base_xp, performance_roll, city_demand_multiplier,
    gross_tips, licence_fee, net_cash_change, xp_award,
    performance_descriptor, started_at, ends_at,
    finance_tip_transaction_id, finance_licence_transaction_id,
    idempotency_key, result_snapshot
  ) VALUES (
    v_session_id, p_user_id, v_profile.id, v_profile.current_city_id,
    v_spot.spot_key, p_duration_minutes, v_base_cash, v_base_xp,
    v_roll, v_city_multiplier, v_gross, v_licence_fee, v_net, v_xp,
    v_descriptor, v_start, v_end, v_tip_tx, v_licence_tx,
    p_idempotency_key, v_result
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_authoritative_busking_options(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.perform_authoritative_busking(uuid, text, integer, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_authoritative_busking_options(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.perform_authoritative_busking(uuid, text, integer, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
