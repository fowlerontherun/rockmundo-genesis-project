-- Forward-only certification repairs for Realignment 2A. No prices, upkeep cadence,
-- timetable rules, ownership values, or historical snapshots are changed here.
ALTER TABLE public.festival_upgrade_purchase_operations
  VALIDATE CONSTRAINT festival_upgrade_purchase_requested_level_1_50;

ALTER TABLE public.festival_company_upgrades
  ADD CONSTRAINT festival_company_upgrades_active_level_valid
  CHECK (active_level BETWEEN 0 AND owned_level) NOT VALID;
ALTER TABLE public.festival_company_upgrades
  VALIDATE CONSTRAINT festival_company_upgrades_active_level_valid;
ALTER TABLE public.festival_upgrade_effect_snapshots
  ADD CONSTRAINT festival_upgrade_effect_snapshots_effective_level_valid
  CHECK (effective_level BETWEEN 0 AND active_level) NOT VALID;
ALTER TABLE public.festival_upgrade_effect_snapshots
  VALIDATE CONSTRAINT festival_upgrade_effect_snapshots_effective_level_valid;

CREATE UNIQUE INDEX festival_upgrade_one_published_catalogue
  ON public.festival_upgrade_catalogue_versions ((status))
  WHERE status = 'published' AND retired_at IS NULL;

CREATE OR REPLACE FUNCTION public._festival_effect_delta(current_effects jsonb, next_effects jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT CASE WHEN next_effects IS NULL THEN NULL ELSE coalesce(jsonb_object_agg(keys.key,
   CASE jsonb_typeof(next_effects->keys.key)
    WHEN 'number' THEN jsonb_build_object('kind','number','current',coalesce((current_effects->>keys.key)::numeric,0),'next',(next_effects->>keys.key)::numeric,'delta',(next_effects->>keys.key)::numeric-coalesce((current_effects->>keys.key)::numeric,0))
    WHEN 'boolean' THEN jsonb_build_object('kind','boolean','current',coalesce((current_effects->>keys.key)::boolean,false),'next',(next_effects->>keys.key)::boolean,'changed',coalesce((current_effects->>keys.key)::boolean,false) IS DISTINCT FROM (next_effects->>keys.key)::boolean)
   END),'{}'::jsonb) END
 FROM jsonb_object_keys(coalesce(next_effects,'{}'::jsonb)) keys(key)
$$;

-- The single preview authority. Purchase still obtains the company row lock and
-- recalculates these conditions in its transaction before finance_debit_owner.
CREATE OR REPLACE FUNCTION public._festival_upgrade_eligibility(c uuid, k text, requested_level integer DEFAULT NULL, expected_catalogue integer DEFAULT NULL, expected_company integer DEFAULT NULL, clock_at timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH state AS (SELECT fc.*, cv.version catalogue_version, co.reputation_score,
   coalesce(u.owned_level,0) owned_level, coalesce(u.status,'not_installed') upgrade_status,
   l.level next_level,l.purchase_cost_minor,l.minimum_licence_tier,l.minimum_company_reputation,
   coalesce(a.available_balance_minor,0) available,
   coalesce((SELECT max(t.rank) FROM public.festival_company_licences cl JOIN public.festival_licence_tiers t ON t.key=cl.tier_key WHERE cl.festival_company_id=fc.id AND cl.status='active' AND coalesce(cl.valid_from,'-infinity')<=clock_at AND coalesce(cl.valid_until,'infinity')>clock_at),0) licence_rank
  FROM public.festival_companies fc JOIN public.companies co ON co.id=fc.company_id
  JOIN public.festival_upgrade_catalogue_versions cv ON cv.status='published' AND cv.retired_at IS NULL
  LEFT JOIN public.festival_company_upgrades u ON u.festival_company_id=fc.id AND u.category_key=k
  LEFT JOIN public.festival_upgrade_levels l ON l.catalogue_version=cv.version AND l.category_key=k AND l.level=coalesce(u.owned_level,0)+1 AND l.active AND l.retired_at IS NULL
  LEFT JOIN public.financial_accounts a ON a.owner_type='company' AND a.owner_id=fc.company_id AND a.is_primary WHERE fc.id=c),
 reasons AS (
  SELECT code FROM state, LATERAL (VALUES
   ('FESTIVAL_UPGRADE_CATEGORY_NOT_FOUND',next_level IS NULL AND owned_level<50),
   ('FESTIVAL_UPGRADE_COMPLETE',owned_level>=50),
   ('FESTIVAL_UPGRADE_LEVEL_SEQUENCE_INVALID',requested_level IS NOT NULL AND requested_level<>owned_level+1),
   ('FESTIVAL_UPGRADE_BUILD_IN_PROGRESS',upgrade_status='building'),
   ('FESTIVAL_UPGRADE_INSUFFICIENT_FUNDS',available<coalesce(purchase_cost_minor,0)),
   ('FESTIVAL_UPGRADE_DELINQUENT',upgrade_delinquent),
   ('FESTIVAL_UPGRADE_LICENCE_REQUIRED',licence_rank<coalesce(minimum_licence_tier,0)),
   ('FESTIVAL_UPGRADE_REPUTATION_REQUIRED',reputation_score<coalesce(minimum_company_reputation,0)),
   ('FESTIVAL_UPGRADE_PREREQUISITE_MISSING',EXISTS(SELECT 1 FROM public.festival_upgrade_prerequisites p LEFT JOIN public.festival_company_upgrades x ON x.festival_company_id=c AND x.category_key=p.prerequisite_category_key WHERE p.catalogue_version=state.catalogue_version AND p.category_key=k AND p.level=state.next_level AND coalesce(x.active_level,0)<p.prerequisite_level)),
   ('FESTIVAL_UPGRADE_ROLLING_LIMIT_REACHED',(public._festival_upgrade_purchase_window(c,clock_at)->>'remaining')::int=0),
   ('FESTIVAL_UPGRADE_CATALOGUE_CHANGED',expected_catalogue IS NOT NULL AND expected_catalogue<>catalogue_version),
   ('FESTIVAL_UPGRADE_VERSION_CONFLICT',expected_company IS NOT NULL AND expected_company<>upgrade_version)
  ) r(code,blocked) WHERE blocked)
 SELECT jsonb_build_object('eligible',NOT EXISTS(SELECT 1 FROM reasons),'reasonCodes',coalesce((SELECT jsonb_agg(code ORDER BY code) FROM reasons),'[]'::jsonb),'purchaseWindow',public._festival_upgrade_purchase_window(c,clock_at)) FROM state
$$;

CREATE OR REPLACE FUNCTION public.get_festival_upgrade_purchase_preview(p_festival_company_id uuid,p_category_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb; cat jsonb; eligibility jsonb;
BEGIN
 s:=public.get_festival_company_upgrades(p_festival_company_id);
 SELECT x INTO cat FROM jsonb_array_elements(s->'categories') x WHERE x->>'key'=p_category_key;
 IF cat IS NULL THEN RAISE EXCEPTION 'FESTIVAL_UPGRADE_CATEGORY_NOT_FOUND' USING ERRCODE='P0001'; END IF;
 eligibility:=public._festival_upgrade_eligibility(p_festival_company_id,p_category_key,(cat->>'nextLevel')::integer,(s->>'catalogueVersion')::integer,(s->>'companyVersion')::integer,now());
 RETURN jsonb_build_object('category',cat,'catalogueVersion',s->'catalogueVersion','companyVersion',s->'companyVersion','purchaseWindow',eligibility->'purchaseWindow','balanceMinor',s->'availableBalanceMinor','remainingBalanceMinor',greatest(0,(s->>'availableBalanceMinor')::bigint-coalesce((cat->>'nextCostMinor')::bigint,0)),'eligible',eligibility->'eligible','reasonCodes',eligibility->'reasonCodes','licenceImplications','[]'::jsonb);
END$$;

CREATE OR REPLACE VIEW public.festival_upgrade_migration_summary AS
SELECT cv.version,cv.status,cv.published_at,cv.retired_at,count(l.*) AS catalogue_rows,
 (SELECT count(*) FROM public.festival_company_upgrades u WHERE u.catalogue_version<>2 OR u.owned_level NOT BETWEEN 1 AND 50 OR u.active_level NOT BETWEEN 0 AND u.owned_level) AS invalid_mutable_ownership_rows,
 (SELECT count(*) FROM public.festival_upgrade_legacy_migrations m WHERE m.requires_review) AS outstanding_review_rows
FROM public.festival_upgrade_catalogue_versions cv LEFT JOIN public.festival_upgrade_levels l ON l.catalogue_version=cv.version GROUP BY cv.version,cv.status,cv.published_at,cv.retired_at;
REVOKE ALL ON public.festival_upgrade_migration_summary FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.festival_upgrade_migration_summary TO service_role;


CREATE OR REPLACE FUNCTION public._festival_upgrade_category_json(c uuid,k text,v int) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH base AS (SELECT cat.*,coalesce(u.owned_level,0) owned,coalesce(u.active_level,0) active_level,coalesce(u.missed_upkeep_weeks,0) missed,coalesce(u.status,'not_installed') upgrade_status,u.build_started_at,u.build_completes_at,coalesce(fc.upgrade_delinquent,false) company_delinquent,coalesce(a.available_balance_minor,0) balance FROM public.festival_upgrade_categories cat LEFT JOIN public.festival_company_upgrades u ON u.festival_company_id=c AND u.category_key=cat.key LEFT JOIN public.festival_companies fc ON fc.id=c LEFT JOIN public.financial_accounts a ON a.owner_type='company' AND a.owner_id=fc.company_id AND a.is_primary WHERE cat.key=k), data AS (SELECT b.*,public._festival_effective_level(owned,active_level,missed) effective,n.*,cur.weekly_upkeep_minor current_upkeep,cur.effects current_effects FROM base b LEFT JOIN public.festival_upgrade_levels cur ON cur.catalogue_version=v AND cur.category_key=b.key AND cur.level=public._festival_effective_level(owned,active_level,missed) LEFT JOIN public.festival_upgrade_levels n ON n.catalogue_version=v AND n.category_key=b.key AND n.level=b.owned+1)
 SELECT jsonb_build_object('key',key,'displayName',display_name,'description',description,'ownedLevel',owned,'activeLevel',active_level,'effectiveLevel',effective,'maximumLevel',50,'bandKey',lower(replace((ARRAY['Basic','Established','Professional','Major','World Class'])[least(5,greatest(1,ceil(greatest(owned,1)/10.0)::int))],' ','_')),'bandName',(ARRAY['Basic','Established','Professional','Major','World Class'])[least(5,greatest(1,ceil(greatest(owned,1)/10.0)::int))],'bandStartLevel',((least(5,greatest(1,ceil(greatest(owned,1)/10.0)::int))-1)*10)+1,'bandEndLevel',least(5,greatest(1,ceil(greatest(owned,1)/10.0)::int))*10,'nextMilestoneLevel',CASE WHEN owned<50 THEN least(50,((owned/10)+1)*10) END,'nextMilestoneName',CASE WHEN owned<50 THEN (ARRAY['Basic','Established','Professional','Major','World Class'])[least(5,(owned/10)+1)] END,'levelsUntilMilestone',CASE WHEN owned<50 THEN least(50,((owned/10)+1)*10)-owned END,'status',upgrade_status,'currentUpkeepMinor',coalesce(current_upkeep,0),'nextLevel',level,'nextCostMinor',purchase_cost_minor,'nextUpkeepMinor',weekly_upkeep_minor,'buildDurationHours',extract(epoch from build_duration)::bigint/3600,'effects',coalesce(current_effects,'{}'),'nextEffects',effects,'effectDelta',public._festival_effect_delta(coalesce(current_effects,'{}'::jsonb),effects),'missingRequirements',coalesce((SELECT jsonb_agg(blocker) FROM (SELECT jsonb_build_object('code','FESTIVAL_UPGRADE_LICENCE_REQUIRED','message','A current Festival licence tier '||minimum_licence_tier||' is required.') blocker WHERE minimum_licence_tier>coalesce((SELECT max(t.rank) FROM public.festival_company_licences cl JOIN public.festival_licence_tiers t ON t.key=cl.tier_key WHERE cl.festival_company_id=c AND cl.status='active' AND coalesce(cl.valid_from,'-infinity')<=now() AND coalesce(cl.valid_until,'infinity')>now()),0) UNION ALL SELECT jsonb_build_object('code','FESTIVAL_UPGRADE_REPUTATION_REQUIRED','message','Company reputation '||minimum_company_reputation||' is required.') WHERE minimum_company_reputation>coalesce((SELECT co.reputation_score FROM public.festival_companies f JOIN public.companies co ON co.id=f.company_id WHERE f.id=c),0) UNION ALL SELECT jsonb_build_object('code','FESTIVAL_UPGRADE_PREREQUISITE_MISSING','message','Prerequisite '||p.prerequisite_category_key||' level '||p.prerequisite_level||' is required.') FROM public.festival_upgrade_prerequisites p LEFT JOIN public.festival_company_upgrades pu ON pu.festival_company_id=c AND pu.category_key=p.prerequisite_category_key WHERE p.catalogue_version=v AND p.category_key=k AND p.level=data.level AND coalesce(pu.active_level,0)<p.prerequisite_level) blockers),'[]'::jsonb),'affordable',balance>=coalesce(purchase_cost_minor,0),'construction',jsonb_build_object('status',upgrade_status,'startedAt',build_started_at,'completesAt',build_completes_at,'previousActiveLevel',active_level,'targetOwnedLevel',owned,'remainingSeconds',greatest(0,coalesce(extract(epoch from build_completes_at-now())::bigint,0)),'activationDue',upgrade_status='building' AND build_completes_at<=now()),'delinquent',company_delinquent OR missed>0) FROM data $$;
