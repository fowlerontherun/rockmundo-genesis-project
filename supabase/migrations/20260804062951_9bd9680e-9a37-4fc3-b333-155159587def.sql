
-- =========================================================
-- Festival upgrades + licences (setup completion)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.festival_upgrade_catalogue_versions(
  version integer PRIMARY KEY,
  status text NOT NULL CHECK(status IN('draft','published','retired')),
  published_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.festival_upgrade_catalogue_versions TO authenticated, anon;
GRANT ALL ON public.festival_upgrade_catalogue_versions TO service_role;
ALTER TABLE public.festival_upgrade_catalogue_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalogue versions readable" ON public.festival_upgrade_catalogue_versions FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.festival_upgrade_categories(
  key text PRIMARY KEY,
  display_name text NOT NULL,
  description text NOT NULL,
  display_order smallint NOT NULL,
  active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.festival_upgrade_categories TO authenticated, anon;
GRANT ALL ON public.festival_upgrade_categories TO service_role;
ALTER TABLE public.festival_upgrade_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "upgrade categories readable" ON public.festival_upgrade_categories FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.festival_upgrade_levels(
  catalogue_version integer NOT NULL REFERENCES public.festival_upgrade_catalogue_versions(version),
  category_key text NOT NULL REFERENCES public.festival_upgrade_categories(key),
  level smallint NOT NULL CHECK(level BETWEEN 1 AND 50),
  level_name text NOT NULL,
  purchase_cost_minor bigint NOT NULL CHECK(purchase_cost_minor > 0),
  weekly_upkeep_minor bigint NOT NULL CHECK(weekly_upkeep_minor >= 0),
  build_duration interval NOT NULL,
  minimum_licence_rank smallint NOT NULL DEFAULT 1,
  minimum_company_reputation integer NOT NULL DEFAULT 0,
  effects jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY(catalogue_version, category_key, level)
);
GRANT SELECT ON public.festival_upgrade_levels TO authenticated, anon;
GRANT ALL ON public.festival_upgrade_levels TO service_role;
ALTER TABLE public.festival_upgrade_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "upgrade levels readable" ON public.festival_upgrade_levels FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.festival_licence_tiers(
  key text PRIMARY KEY,
  rank smallint UNIQUE NOT NULL CHECK(rank BETWEEN 1 AND 5),
  display_name text NOT NULL,
  max_attendance integer NOT NULL,
  max_days smallint NOT NULL,
  max_stages smallint NOT NULL,
  max_acts_per_day smallint NOT NULL,
  camping_allowed boolean NOT NULL,
  minimum_reputation integer NOT NULL,
  fee_minor bigint NOT NULL,
  validity_days integer NOT NULL,
  requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.festival_licence_tiers TO authenticated, anon;
GRANT ALL ON public.festival_licence_tiers TO service_role;
ALTER TABLE public.festival_licence_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "licence tiers readable" ON public.festival_licence_tiers FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.festival_company_licences(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  tier_key text NOT NULL REFERENCES public.festival_licence_tiers(key),
  status text NOT NULL CHECK(status IN('active','expired','revoked')),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS festival_company_licences_active_idx
  ON public.festival_company_licences(festival_company_id) WHERE status='active';
GRANT SELECT ON public.festival_company_licences TO authenticated;
GRANT ALL ON public.festival_company_licences TO service_role;
ALTER TABLE public.festival_company_licences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read own festival licences" ON public.festival_company_licences FOR SELECT TO authenticated
USING (EXISTS(SELECT 1 FROM public.festival_companies f WHERE f.id = festival_company_id AND f.owner_profile_id = public._caller_profile_id())
       OR public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.festival_company_upgrades(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  category_key text NOT NULL REFERENCES public.festival_upgrade_categories(key),
  catalogue_version integer NOT NULL,
  owned_level smallint NOT NULL CHECK(owned_level BETWEEN 1 AND 50),
  active_level smallint NOT NULL CHECK(active_level BETWEEN 0 AND 50),
  status text NOT NULL CHECK(status IN('purchased','building','active','cancelled','failed')),
  build_started_at timestamptz,
  build_completes_at timestamptz,
  activated_at timestamptz,
  missed_upkeep_weeks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(festival_company_id, category_key)
);
GRANT SELECT ON public.festival_company_upgrades TO authenticated;
GRANT ALL ON public.festival_company_upgrades TO service_role;
ALTER TABLE public.festival_company_upgrades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read own festival upgrades" ON public.festival_company_upgrades FOR SELECT TO authenticated
USING (EXISTS(SELECT 1 FROM public.festival_companies f WHERE f.id = festival_company_id AND f.owner_profile_id = public._caller_profile_id())
       OR public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.festival_upgrade_purchase_operations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  actor_profile_id uuid NOT NULL,
  category_key text NOT NULL,
  requested_level smallint NOT NULL,
  idempotency_key uuid NOT NULL,
  status text NOT NULL CHECK(status IN('succeeded','failed')),
  amount_minor bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(actor_profile_id, idempotency_key)
);
GRANT SELECT ON public.festival_upgrade_purchase_operations TO authenticated;
GRANT ALL ON public.festival_upgrade_purchase_operations TO service_role;
ALTER TABLE public.festival_upgrade_purchase_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read own festival purchases" ON public.festival_upgrade_purchase_operations FOR SELECT TO authenticated
USING (EXISTS(SELECT 1 FROM public.festival_companies f WHERE f.id = festival_company_id AND f.owner_profile_id = public._caller_profile_id())
       OR public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.festival_upgrade_audit(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  festival_company_id uuid,
  actor_profile_id uuid,
  event_type text NOT NULL,
  reason text,
  after_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.festival_upgrade_audit TO authenticated;
GRANT ALL ON public.festival_upgrade_audit TO service_role;
ALTER TABLE public.festival_upgrade_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read festival upgrade audit" ON public.festival_upgrade_audit FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role));

ALTER TABLE public.festival_companies
  ADD COLUMN IF NOT EXISTS upgrade_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS licence_version integer NOT NULL DEFAULT 0;

-- ---------------- catalogue seed ----------------
INSERT INTO public.festival_upgrade_catalogue_versions(version,status,published_at)
VALUES (2,'published',now()) ON CONFLICT (version) DO NOTHING;

INSERT INTO public.festival_upgrade_categories(key,display_name,description,display_order) VALUES
 ('site_infrastructure','Site Infrastructure','Ground works, fencing, power distribution and site capacity.',1),
 ('stages_production','Stages & Production','Stage builds, PA, lighting rigs and production quality.',2),
 ('security_crowd_control','Security & Crowd Control','Stewards, barriers, pit security and crowd safety planning.',3),
 ('medical_welfare','Medical & Welfare','Medical tents, paramedics and welfare services.',4),
 ('sanitation_utilities','Sanitation & Utilities','Toilets, water, waste management and utilities.',5),
 ('artist_backstage','Artist & Backstage','Dressing rooms, hospitality, riders and artist logistics.',6),
 ('audience_facilities','Audience Facilities','Bars, food courts, seating, shade and viewing platforms.',7),
 ('camping_accommodation','Camping & Accommodation','Campsites, glamping, showers and overnight capacity.',8),
 ('transport_access','Transport & Access','Parking, shuttles, road access and accessibility.',9),
 ('marketing_media','Marketing & Media','Advertising reach, press accreditation and broadcast.',10),
 ('sustainability_technology','Sustainability & Technology','Green power, cashless systems, apps and data.',11)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.festival_upgrade_levels(
  catalogue_version,category_key,level,level_name,purchase_cost_minor,weekly_upkeep_minor,
  build_duration,minimum_licence_rank,minimum_company_reputation,effects)
SELECT 2, c.key, g.level,
  (ARRAY['Basic','Established','Professional','Major','World Class'])[ceil(g.level/10.0)::int],
  (25000 + (g.level * g.level * 900) + (c.display_order * 1500))::bigint,
  (1200 + g.level * 260)::bigint,
  make_interval(hours => 4 + g.level),
  least(5, greatest(1, ceil(g.level/10.0)::int))::smallint,
  (g.level * 12)::int,
  jsonb_build_object(
    'capacity', g.level * (CASE WHEN c.key IN ('site_infrastructure','camping_accommodation','audience_facilities') THEN 400 ELSE 90 END),
    'qualityBasisPoints', g.level * (CASE WHEN c.key IN ('stages_production','artist_backstage') THEN 55 ELSE 22 END),
    'riskReductionBasisPoints', g.level * (CASE WHEN c.key IN ('security_crowd_control','medical_welfare','sanitation_utilities') THEN 60 ELSE 15 END),
    'revenueBasisPoints', g.level * (CASE WHEN c.key IN ('marketing_media','audience_facilities','sustainability_technology') THEN 45 ELSE 14 END))
FROM public.festival_upgrade_categories c CROSS JOIN generate_series(1,50) g(level)
ON CONFLICT DO NOTHING;

INSERT INTO public.festival_licence_tiers(key,rank,display_name,max_attendance,max_days,max_stages,max_acts_per_day,camping_allowed,minimum_reputation,fee_minor,validity_days,requirements) VALUES
 ('community',1,'Community Licence',2500,1,1,6,false,0,50000,365,'{}'::jsonb),
 ('local',2,'Local Licence',10000,2,2,10,false,40,250000,365,'{"site_infrastructure":8,"security_crowd_control":8}'::jsonb),
 ('regional',3,'Regional Licence',35000,3,3,16,true,120,900000,365,'{"site_infrastructure":16,"security_crowd_control":16,"medical_welfare":12,"sanitation_utilities":12}'::jsonb),
 ('national',4,'National Licence',80000,4,5,24,true,260,2600000,365,'{"site_infrastructure":26,"security_crowd_control":26,"medical_welfare":22,"sanitation_utilities":22,"transport_access":18}'::jsonb),
 ('international',5,'International Licence',180000,5,8,32,true,450,7500000,365,'{"site_infrastructure":36,"stages_production":34,"security_crowd_control":36,"medical_welfare":32,"sanitation_utilities":32,"transport_access":28,"camping_accommodation":26}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------------- helpers ----------------
CREATE OR REPLACE FUNCTION public._festival_upgrade_authorised(p_festival_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.festival_companies f
    WHERE f.id = p_festival_company_id
      AND (f.owner_profile_id = public._caller_profile_id()
           OR coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false)))
$$;

CREATE OR REPLACE FUNCTION public._festival_company_balance_minor(p_festival_company_id uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(round(c.balance * 100)::bigint, 0)
  FROM public.festival_companies f JOIN public.companies c ON c.id = f.company_id
  WHERE f.id = p_festival_company_id
$$;

CREATE OR REPLACE FUNCTION public._festival_upgrade_window(p_festival_company_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH recent AS (
    SELECT completed_at FROM public.festival_upgrade_purchase_operations
    WHERE festival_company_id = p_festival_company_id AND status='succeeded'
      AND completed_at > now() - interval '30 days'),
  x AS (SELECT count(*)::int used, min(completed_at) oldest FROM recent)
  SELECT jsonb_build_object(
    'limit',2,'used',least(used,2),'remaining',greatest(0,2-used),'windowDays',30,
    'serverNow',now(),
    'nextAvailableAt', CASE WHEN used>=2 THEN oldest + interval '30 days' ELSE NULL END)
  FROM x
$$;

CREATE OR REPLACE FUNCTION public._festival_effect_delta(cur jsonb, nxt jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN nxt IS NULL THEN NULL ELSE (
    SELECT jsonb_object_agg(k, jsonb_build_object(
      'kind','number',
      'current', coalesce((cur->>k)::numeric,0),
      'next', coalesce((nxt->>k)::numeric,0),
      'delta', coalesce((nxt->>k)::numeric,0) - coalesce((cur->>k)::numeric,0)))
    FROM jsonb_object_keys(nxt) k) END
$$;

CREATE OR REPLACE FUNCTION public.get_festival_licence_progress(p_festival_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_fc public.festival_companies%ROWTYPE;
  v_rep integer;
  v_balance bigint := public._festival_company_balance_minor(p_festival_company_id);
  v_cur record;
  v_target public.festival_licence_tiers%ROWTYPE;
  v_highest public.festival_licence_tiers%ROWTYPE;
  v_reqs jsonb := '[]'::jsonb;
  v_all_complete boolean := true;
  v_action text;
  r record;
  v_tier_json jsonb;
BEGIN
  SELECT * INTO v_fc FROM public.festival_companies WHERE id = p_festival_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_LICENCE_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
  SELECT coalesce(reputation_score,0) INTO v_rep FROM public.companies WHERE id = v_fc.company_id;

  SELECT l.*, t.rank, t.display_name, t.fee_minor, t.max_attendance, t.max_days, t.max_stages,
         t.max_acts_per_day, t.camping_allowed, t.validity_days
    INTO v_cur
  FROM public.festival_company_licences l JOIN public.festival_licence_tiers t ON t.key = l.tier_key
  WHERE l.festival_company_id = p_festival_company_id AND l.status='active' AND l.valid_until > now();

  SELECT * INTO v_target FROM public.festival_licence_tiers
  WHERE active AND rank = coalesce(v_cur.rank, 0) + 1 ORDER BY rank LIMIT 1;

  IF v_target.key IS NULL AND v_cur.tier_key IS NOT NULL THEN
    SELECT * INTO v_target FROM public.festival_licence_tiers WHERE key = v_cur.tier_key;
    v_action := 'renew';
  ELSIF v_target.key IS NOT NULL THEN
    v_action := CASE WHEN v_cur.tier_key IS NULL THEN 'apply' ELSE 'upgrade' END;
  END IF;

  IF v_target.key IS NOT NULL THEN
    v_reqs := v_reqs || jsonb_build_array(jsonb_build_object(
      'code','reputation','description','Company reputation',
      'complete', v_rep >= v_target.minimum_reputation,
      'currentValue', v_rep, 'requiredValue', v_target.minimum_reputation));
    IF v_rep < v_target.minimum_reputation THEN v_all_complete := false; END IF;

    FOR r IN SELECT key, value::text::int AS lvl FROM jsonb_each_text(v_target.requirements) AS t(key,value) LOOP
      DECLARE v_owned int; v_name text; BEGIN
        SELECT coalesce(u.owned_level,0) INTO v_owned FROM public.festival_company_upgrades u
        WHERE u.festival_company_id = p_festival_company_id AND u.category_key = r.key;
        v_owned := coalesce(v_owned,0);
        SELECT display_name INTO v_name FROM public.festival_upgrade_categories WHERE key = r.key;
        v_reqs := v_reqs || jsonb_build_array(jsonb_build_object(
          'code', r.key, 'description', coalesce(v_name, r.key) || ' level ' || r.lvl,
          'complete', v_owned >= r.lvl, 'currentValue', v_owned, 'requiredValue', r.lvl));
        IF v_owned < r.lvl THEN v_all_complete := false; END IF;
      END;
    END LOOP;
  END IF;

  SELECT * INTO v_highest FROM public.festival_licence_tiers t
  WHERE t.active AND t.minimum_reputation <= v_rep ORDER BY t.rank DESC LIMIT 1;

  v_tier_json := CASE WHEN v_target.key IS NULL THEN NULL ELSE jsonb_build_object(
    'key',v_target.key,'name',v_target.display_name,'rank',v_target.rank,'feeMinor',v_target.fee_minor,
    'maxAttendance',v_target.max_attendance,'maxDays',v_target.max_days,'maxStages',v_target.max_stages,
    'maxActsPerDay',v_target.max_acts_per_day,'campingAllowed',v_target.camping_allowed,
    'validityDays',v_target.validity_days) END;

  RETURN jsonb_build_object(
    'licenceVersion', coalesce(v_fc.licence_version,0),
    'current', CASE WHEN v_cur.tier_key IS NULL THEN NULL ELSE jsonb_build_object(
      'key',v_cur.tier_key,'name',v_cur.display_name,'rank',v_cur.rank,'feeMinor',v_cur.fee_minor,
      'maxAttendance',v_cur.max_attendance,'maxDays',v_cur.max_days,'maxStages',v_cur.max_stages,
      'maxActsPerDay',v_cur.max_acts_per_day,'campingAllowed',v_cur.camping_allowed,
      'validityDays',v_cur.validity_days,'status',v_cur.status,'active',true,
      'validFrom',v_cur.valid_from,'validUntil',v_cur.valid_until,
      'daysRemaining', greatest(0, ceil(extract(epoch from (v_cur.valid_until - now()))/86400)::int)) END,
    'highestEligible', CASE WHEN v_highest.key IS NULL THEN NULL ELSE jsonb_build_object(
      'key',v_highest.key,'name',v_highest.display_name,'rank',v_highest.rank,'feeMinor',v_highest.fee_minor,
      'maxAttendance',v_highest.max_attendance,'maxDays',v_highest.max_days,'maxStages',v_highest.max_stages,
      'maxActsPerDay',v_highest.max_acts_per_day,'campingAllowed',v_highest.camping_allowed,
      'validityDays',v_highest.validity_days) END,
    'target', v_tier_json,
    'next', CASE WHEN v_target.key IS NULL THEN NULL ELSE jsonb_build_object(
      'key',v_target.key,'name',v_target.display_name,'feeMinor',v_target.fee_minor) END,
    'action', v_action,
    'requirements', v_reqs,
    'canApply', v_target.key IS NOT NULL AND v_all_complete AND v_balance >= coalesce(v_target.fee_minor,0),
    'affordable', v_balance >= coalesce(v_target.fee_minor,0),
    'reasonCodes', CASE WHEN v_target.key IS NULL THEN '["FESTIVAL_LICENCE_MAX_TIER"]'::jsonb
                        WHEN NOT v_all_complete THEN '["FESTIVAL_LICENCE_REQUIREMENTS_UNMET"]'::jsonb
                        WHEN v_balance < v_target.fee_minor THEN '["FESTIVAL_LICENCE_INSUFFICIENT_FUNDS"]'::jsonb
                        ELSE '[]'::jsonb END,
    'availableBalanceMinor', v_balance,
    'currentReputation', v_rep,
    'renewalOpensAt', CASE WHEN v_cur.valid_until IS NULL THEN NULL ELSE v_cur.valid_until - interval '30 days' END);
END $$;

CREATE OR REPLACE FUNCTION public._festival_upgrade_category_json(p_festival_company_id uuid, p_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_cat public.festival_upgrade_categories%ROWTYPE;
  v_u public.festival_company_upgrades%ROWTYPE;
  v_cur public.festival_upgrade_levels%ROWTYPE;
  v_next public.festival_upgrade_levels%ROWTYPE;
  v_owned int; v_active int; v_effective int;
  v_balance bigint := public._festival_company_balance_minor(p_festival_company_id);
  v_rank int;
  v_rep int;
  v_missing jsonb := '[]'::jsonb;
  v_status text;
  v_band int;
BEGIN
  SELECT * INTO v_cat FROM public.festival_upgrade_categories WHERE key = p_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_UPGRADE_CATEGORY_NOT_FOUND' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_u FROM public.festival_company_upgrades
   WHERE festival_company_id = p_festival_company_id AND category_key = p_key;

  v_owned := coalesce(v_u.owned_level,0);
  v_active := coalesce(v_u.active_level,0);
  v_effective := CASE WHEN coalesce(v_u.missed_upkeep_weeks,0) >= 4 THEN greatest(0, v_active - 10) ELSE v_active END;
  v_status := coalesce(v_u.status,'not_installed');

  SELECT * INTO v_cur FROM public.festival_upgrade_levels
   WHERE catalogue_version=2 AND category_key=p_key AND level=v_active;
  SELECT * INTO v_next FROM public.festival_upgrade_levels
   WHERE catalogue_version=2 AND category_key=p_key AND level=v_owned+1;

  SELECT coalesce(max(t.rank),0) INTO v_rank
  FROM public.festival_company_licences l JOIN public.festival_licence_tiers t ON t.key=l.tier_key
  WHERE l.festival_company_id=p_festival_company_id AND l.status='active' AND l.valid_until > now();
  SELECT coalesce(c.reputation_score,0) INTO v_rep
  FROM public.festival_companies f JOIN public.companies c ON c.id=f.company_id WHERE f.id=p_festival_company_id;

  IF v_next.level IS NOT NULL THEN
    IF v_rank < v_next.minimum_licence_rank THEN
      v_missing := v_missing || jsonb_build_array(jsonb_build_object(
        'code','FESTIVAL_UPGRADE_LICENCE_REQUIRED',
        'message','Requires a higher festival licence tier.'));
    END IF;
    IF v_rep < v_next.minimum_company_reputation THEN
      v_missing := v_missing || jsonb_build_array(jsonb_build_object(
        'code','FESTIVAL_UPGRADE_REPUTATION_REQUIRED',
        'message','Requires company reputation ' || v_next.minimum_company_reputation || '.'));
    END IF;
    IF v_balance < v_next.purchase_cost_minor THEN
      v_missing := v_missing || jsonb_build_array(jsonb_build_object(
        'code','FESTIVAL_UPGRADE_INSUFFICIENT_FUNDS',
        'message','The festival company balance is too low.'));
    END IF;
  END IF;

  v_band := greatest(1, least(5, ceil(greatest(v_owned,1)/10.0)::int));

  RETURN jsonb_build_object(
    'key', v_cat.key,
    'displayName', v_cat.display_name,
    'description', v_cat.description,
    'ownedLevel', v_owned,
    'activeLevel', v_active,
    'effectiveLevel', v_effective,
    'maximumLevel', 50,
    'bandKey', lower(replace((ARRAY['Basic','Established','Professional','Major','World Class'])[v_band],' ','_')),
    'bandName', (ARRAY['Basic','Established','Professional','Major','World Class'])[v_band],
    'bandStartLevel', (v_band-1)*10 + 1,
    'bandEndLevel', v_band*10,
    'nextMilestoneLevel', CASE WHEN v_owned >= 50 THEN NULL ELSE least(50, ((v_owned/10)+1)*10) END,
    'nextMilestoneName', CASE WHEN v_owned >= 50 THEN NULL
      ELSE (ARRAY['Basic','Established','Professional','Major','World Class'])[least(5,(v_owned/10)+1)] END,
    'levelsUntilMilestone', CASE WHEN v_owned >= 50 THEN NULL ELSE least(50, ((v_owned/10)+1)*10) - v_owned END,
    'status', v_status,
    'currentUpkeepMinor', coalesce(v_cur.weekly_upkeep_minor,0),
    'nextLevel', v_next.level,
    'nextCostMinor', v_next.purchase_cost_minor,
    'nextUpkeepMinor', v_next.weekly_upkeep_minor,
    'buildDurationHours', CASE WHEN v_next.level IS NULL THEN NULL
      ELSE (extract(epoch from v_next.build_duration)/3600)::int END,
    'effects', coalesce(v_cur.effects, '{"capacity":0,"qualityBasisPoints":0,"riskReductionBasisPoints":0,"revenueBasisPoints":0}'::jsonb),
    'nextEffects', v_next.effects,
    'effectDelta', public._festival_effect_delta(
      coalesce(v_cur.effects,'{"capacity":0,"qualityBasisPoints":0,"riskReductionBasisPoints":0,"revenueBasisPoints":0}'::jsonb),
      v_next.effects),
    'missingRequirements', v_missing,
    'affordable', v_next.level IS NULL OR v_balance >= v_next.purchase_cost_minor,
    'construction', jsonb_build_object(
      'status', v_status,
      'startedAt', v_u.build_started_at,
      'completesAt', v_u.build_completes_at,
      'previousActiveLevel', v_active,
      'targetOwnedLevel', v_owned,
      'remainingSeconds', greatest(0, coalesce(ceil(extract(epoch from (v_u.build_completes_at - now())))::int,0)),
      'activationDue', v_u.build_completes_at IS NOT NULL AND v_u.build_completes_at <= now() AND v_active < v_owned),
    'delinquent', coalesce(v_u.missed_upkeep_weeks,0) > 0);
END $$;

CREATE OR REPLACE FUNCTION public._festival_activate_due_upgrades(p_festival_company_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.festival_company_upgrades
     SET active_level = owned_level, status='active', activated_at = now(), updated_at = now()
   WHERE festival_company_id = p_festival_company_id
     AND build_completes_at IS NOT NULL AND build_completes_at <= now()
     AND active_level < owned_level
$$;

CREATE OR REPLACE FUNCTION public._festival_upgrade_state(p_festival_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_fc public.festival_companies%ROWTYPE;
BEGIN
  SELECT * INTO v_fc FROM public.festival_companies WHERE id = p_festival_company_id;
  RETURN jsonb_build_object(
    'festivalCompanyId', v_fc.id,
    'catalogueVersion', 2,
    'companyVersion', coalesce(v_fc.upgrade_version,0),
    'currencyCode','USD',
    'availableBalanceMinor', public._festival_company_balance_minor(p_festival_company_id),
    'purchaseWindow', public._festival_upgrade_window(p_festival_company_id),
    'categories', (SELECT jsonb_agg(public._festival_upgrade_category_json(p_festival_company_id, c.key) ORDER BY c.display_order)
                   FROM public.festival_upgrade_categories c WHERE c.active),
    'licence', public.get_festival_licence_progress(p_festival_company_id));
END $$;

CREATE OR REPLACE FUNCTION public.get_festival_company_upgrades(p_festival_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public._festival_upgrade_authorised(p_festival_company_id) THEN
    RAISE EXCEPTION 'FESTIVAL_UPGRADE_ACCESS_DENIED' USING ERRCODE='P0001';
  END IF;
  PERFORM public._festival_activate_due_upgrades(p_festival_company_id);
  RETURN public._festival_upgrade_state(p_festival_company_id);
END $$;

CREATE OR REPLACE FUNCTION public.get_festival_upgrade_purchase_preview(p_festival_company_id uuid, p_category_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_fc public.festival_companies%ROWTYPE;
  v_cat jsonb; v_balance bigint; v_cost bigint; v_win jsonb;
  v_reasons jsonb := '[]'::jsonb; v_impl jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public._festival_upgrade_authorised(p_festival_company_id) THEN
    RAISE EXCEPTION 'FESTIVAL_UPGRADE_ACCESS_DENIED' USING ERRCODE='P0001';
  END IF;
  PERFORM public._festival_activate_due_upgrades(p_festival_company_id);
  SELECT * INTO v_fc FROM public.festival_companies WHERE id = p_festival_company_id;
  v_cat := public._festival_upgrade_category_json(p_festival_company_id, p_category_key);
  v_balance := public._festival_company_balance_minor(p_festival_company_id);
  v_cost := coalesce((v_cat->>'nextCostMinor')::bigint, 0);
  v_win := public._festival_upgrade_window(p_festival_company_id);

  IF v_cat->>'nextLevel' IS NULL THEN v_reasons := v_reasons || '["FESTIVAL_UPGRADE_MAX_LEVEL"]'::jsonb; END IF;
  IF (v_win->>'remaining')::int <= 0 THEN v_reasons := v_reasons || '["FESTIVAL_UPGRADE_WINDOW_EXHAUSTED"]'::jsonb; END IF;
  SELECT v_reasons || coalesce(jsonb_agg(m->>'code'),'[]'::jsonb) INTO v_reasons
    FROM jsonb_array_elements(v_cat->'missingRequirements') m;
  IF (v_cat->>'nextLevel') IS NOT NULL AND (v_cat->>'nextLevel')::int % 10 = 0 THEN
    v_impl := jsonb_build_array('Reaching this milestone counts toward the next licence tier requirements.');
  END IF;

  RETURN jsonb_build_object(
    'category', v_cat,
    'catalogueVersion', 2,
    'companyVersion', coalesce(v_fc.upgrade_version,0),
    'purchaseWindow', v_win,
    'balanceMinor', v_balance,
    'remainingBalanceMinor', v_balance - v_cost,
    'eligible', jsonb_array_length(v_reasons) = 0,
    'reasonCodes', v_reasons,
    'licenceImplications', v_impl);
END $$;

CREATE OR REPLACE FUNCTION public.purchase_festival_company_upgrade(
  p_festival_company_id uuid, p_category_key text, p_requested_level integer,
  p_expected_catalogue_version integer, p_expected_company_version integer, p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_actor uuid := public._caller_profile_id();
  v_fc public.festival_companies%ROWTYPE;
  v_lvl public.festival_upgrade_levels%ROWTYPE;
  v_owned int; v_balance bigint; v_rank int; v_rep int;
BEGIN
  IF auth.uid() IS NULL OR NOT public._festival_upgrade_authorised(p_festival_company_id) THEN
    RAISE EXCEPTION 'FESTIVAL_UPGRADE_ACCESS_DENIED' USING ERRCODE='P0001';
  END IF;
  IF EXISTS(SELECT 1 FROM public.festival_upgrade_purchase_operations
            WHERE actor_profile_id = v_actor AND idempotency_key = p_idempotency_key) THEN
    RETURN public._festival_upgrade_state(p_festival_company_id);
  END IF;

  SELECT * INTO v_fc FROM public.festival_companies WHERE id = p_festival_company_id FOR UPDATE;
  IF p_expected_catalogue_version <> 2 OR p_expected_company_version <> coalesce(v_fc.upgrade_version,0) THEN
    RAISE EXCEPTION 'FESTIVAL_UPGRADE_VERSION_CONFLICT' USING ERRCODE='P0001';
  END IF;
  PERFORM public._festival_activate_due_upgrades(p_festival_company_id);

  SELECT coalesce(owned_level,0) INTO v_owned FROM public.festival_company_upgrades
   WHERE festival_company_id = p_festival_company_id AND category_key = p_category_key;
  v_owned := coalesce(v_owned,0);
  IF p_requested_level <> v_owned + 1 OR p_requested_level > 50 THEN
    RAISE EXCEPTION 'FESTIVAL_UPGRADE_LEVEL_SEQUENCE_INVALID' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_lvl FROM public.festival_upgrade_levels
   WHERE catalogue_version=2 AND category_key=p_category_key AND level=p_requested_level;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_UPGRADE_CATEGORY_NOT_FOUND' USING ERRCODE='P0001'; END IF;

  IF ((public._festival_upgrade_window(p_festival_company_id))->>'remaining')::int <= 0 THEN
    RAISE EXCEPTION 'FESTIVAL_UPGRADE_WINDOW_EXHAUSTED' USING ERRCODE='P0001';
  END IF;

  SELECT coalesce(max(t.rank),0) INTO v_rank
  FROM public.festival_company_licences l JOIN public.festival_licence_tiers t ON t.key=l.tier_key
  WHERE l.festival_company_id=p_festival_company_id AND l.status='active' AND l.valid_until > now();
  IF v_rank < v_lvl.minimum_licence_rank THEN
    RAISE EXCEPTION 'FESTIVAL_UPGRADE_LICENCE_REQUIRED' USING ERRCODE='P0001';
  END IF;

  SELECT coalesce(reputation_score,0) INTO v_rep FROM public.companies WHERE id = v_fc.company_id;
  IF v_rep < v_lvl.minimum_company_reputation THEN
    RAISE EXCEPTION 'FESTIVAL_UPGRADE_REPUTATION_REQUIRED' USING ERRCODE='P0001';
  END IF;

  v_balance := public._festival_company_balance_minor(p_festival_company_id);
  IF v_balance < v_lvl.purchase_cost_minor THEN
    RAISE EXCEPTION 'FESTIVAL_UPGRADE_INSUFFICIENT_FUNDS' USING ERRCODE='P0001';
  END IF;

  UPDATE public.companies SET balance = balance - (v_lvl.purchase_cost_minor::numeric / 100), updated_at = now()
   WHERE id = v_fc.company_id;
  INSERT INTO public.company_transactions(company_id, transaction_type, amount, description, related_entity_id, related_entity_type, category)
  VALUES (v_fc.company_id, 'expense', (v_lvl.purchase_cost_minor::numeric / 100),
          'Festival upgrade: ' || p_category_key || ' level ' || p_requested_level,
          p_festival_company_id, 'festival_company', 'festival_upgrade');

  INSERT INTO public.festival_company_upgrades(
    festival_company_id, category_key, catalogue_version, owned_level, active_level, status,
    build_started_at, build_completes_at)
  VALUES (p_festival_company_id, p_category_key, 2, p_requested_level, greatest(0, p_requested_level - 1),
          'building', now(), now() + v_lvl.build_duration)
  ON CONFLICT (festival_company_id, category_key) DO UPDATE
    SET owned_level = EXCLUDED.owned_level, status='building', catalogue_version = 2,
        build_started_at = now(), build_completes_at = now() + v_lvl.build_duration, updated_at = now();

  UPDATE public.festival_companies SET upgrade_version = coalesce(upgrade_version,0) + 1, updated_at = now()
   WHERE id = p_festival_company_id;

  INSERT INTO public.festival_upgrade_purchase_operations(
    festival_company_id, actor_profile_id, category_key, requested_level, idempotency_key,
    status, amount_minor, completed_at)
  VALUES (p_festival_company_id, v_actor, p_category_key, p_requested_level, p_idempotency_key,
          'succeeded', v_lvl.purchase_cost_minor, now());

  INSERT INTO public.festival_upgrade_audit(festival_company_id, actor_profile_id, event_type, reason, after_value)
  VALUES (p_festival_company_id, v_actor, 'upgrade_purchased', p_category_key,
          jsonb_build_object('level', p_requested_level, 'costMinor', v_lvl.purchase_cost_minor));

  RETURN public._festival_upgrade_state(p_festival_company_id);
END $$;

CREATE OR REPLACE FUNCTION public.apply_festival_company_licence(
  p_festival_company_id uuid, p_requested_tier_key text,
  p_expected_licence_version integer, p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_actor uuid := public._caller_profile_id();
  v_fc public.festival_companies%ROWTYPE;
  v_tier public.festival_licence_tiers%ROWTYPE;
  v_progress jsonb;
  v_balance bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public._festival_upgrade_authorised(p_festival_company_id) THEN
    RAISE EXCEPTION 'FESTIVAL_LICENCE_ACCESS_DENIED' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO v_fc FROM public.festival_companies WHERE id = p_festival_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_LICENCE_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
  IF p_expected_licence_version <> coalesce(v_fc.licence_version,0) THEN
    RAISE EXCEPTION 'FESTIVAL_LICENCE_VERSION_CONFLICT' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_tier FROM public.festival_licence_tiers WHERE key = p_requested_tier_key AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_LICENCE_TIER_NOT_FOUND' USING ERRCODE='P0001'; END IF;

  v_progress := public.get_festival_licence_progress(p_festival_company_id);
  IF coalesce(v_progress->'target'->>'key','') <> p_requested_tier_key THEN
    RAISE EXCEPTION 'FESTIVAL_LICENCE_TIER_NOT_AVAILABLE' USING ERRCODE='P0001';
  END IF;
  IF NOT (v_progress->>'canApply')::boolean THEN
    RAISE EXCEPTION 'FESTIVAL_LICENCE_REQUIREMENTS_UNMET' USING ERRCODE='P0001';
  END IF;

  v_balance := public._festival_company_balance_minor(p_festival_company_id);
  IF v_balance < v_tier.fee_minor THEN
    RAISE EXCEPTION 'FESTIVAL_LICENCE_INSUFFICIENT_FUNDS' USING ERRCODE='P0001';
  END IF;

  UPDATE public.companies SET balance = balance - (v_tier.fee_minor::numeric / 100), updated_at = now()
   WHERE id = v_fc.company_id;
  INSERT INTO public.company_transactions(company_id, transaction_type, amount, description, related_entity_id, related_entity_type, category)
  VALUES (v_fc.company_id, 'expense', (v_tier.fee_minor::numeric / 100),
          'Festival licence: ' || v_tier.display_name, p_festival_company_id, 'festival_company', 'festival_licence');

  UPDATE public.festival_company_licences SET status='expired', updated_at = now()
   WHERE festival_company_id = p_festival_company_id AND status='active';
  INSERT INTO public.festival_company_licences(festival_company_id, tier_key, status, valid_from, valid_until)
  VALUES (p_festival_company_id, v_tier.key, 'active', now(), now() + make_interval(days => v_tier.validity_days));

  UPDATE public.festival_companies SET licence_version = coalesce(licence_version,0) + 1, updated_at = now()
   WHERE id = p_festival_company_id;

  INSERT INTO public.festival_upgrade_audit(festival_company_id, actor_profile_id, event_type, reason, after_value)
  VALUES (p_festival_company_id, v_actor, 'licence_granted', v_tier.key,
          jsonb_build_object('feeMinor', v_tier.fee_minor));

  RETURN public._festival_upgrade_state(p_festival_company_id);
END $$;

GRANT EXECUTE ON FUNCTION public.get_festival_company_upgrades(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_upgrade_purchase_preview(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_festival_company_upgrade(uuid,text,integer,integer,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_festival_company_licence(uuid,text,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_licence_progress(uuid) TO authenticated;
