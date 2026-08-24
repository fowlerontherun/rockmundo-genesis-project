-- PR B6: festival ticket tiers, vendor shares and operational analytics closure.
-- Forward-only. Existing launch ticket inventory, runtime evidence and Phase 9 Finance settlement remain authoritative.

ALTER TABLE public.festival_public_ticket_products
  ADD COLUMN IF NOT EXISTS base_price_minor bigint,
  ADD COLUMN IF NOT EXISTS pricing_version integer NOT NULL DEFAULT 1;

UPDATE public.festival_public_ticket_products
SET base_price_minor=price_minor
WHERE base_price_minor IS NULL;

ALTER TABLE public.festival_public_ticket_products
  ALTER COLUMN base_price_minor SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.festival_public_ticket_products
    ADD CONSTRAINT festival_public_ticket_products_base_price_nonnegative
    CHECK (base_price_minor>=0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public._festival_ticket_product_seed_base_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.base_price_minor IS NULL THEN NEW.base_price_minor:=NEW.price_minor; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS festival_ticket_product_seed_base_price ON public.festival_public_ticket_products;
CREATE TRIGGER festival_ticket_product_seed_base_price
BEFORE INSERT ON public.festival_public_ticket_products
FOR EACH ROW EXECUTE FUNCTION public._festival_ticket_product_seed_base_price();

CREATE TABLE IF NOT EXISTS public.festival_ticket_dynamic_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_launch_id uuid NOT NULL REFERENCES public.festival_launches(id) ON DELETE CASCADE,
  ticket_product_id uuid NOT NULL REFERENCES public.festival_public_ticket_products(id) ON DELETE CASCADE,
  rule_name text NOT NULL,
  min_sell_through_basis_points integer NOT NULL DEFAULT 0 CHECK (min_sell_through_basis_points BETWEEN 0 AND 10000),
  max_sell_through_basis_points integer NOT NULL DEFAULT 10000 CHECK (max_sell_through_basis_points BETWEEN 0 AND 10000),
  adjustment_basis_points integer NOT NULL DEFAULT 0 CHECK (adjustment_basis_points BETWEEN -9000 AND 30000),
  min_price_minor bigint NOT NULL CHECK (min_price_minor>=0),
  max_price_minor bigint NOT NULL CHECK (max_price_minor>=0),
  starts_at timestamptz,
  ends_at timestamptz,
  priority integer NOT NULL DEFAULT 100 CHECK (priority BETWEEN 0 AND 10000),
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  created_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (min_sell_through_basis_points<=max_sell_through_basis_points),
  CHECK (min_price_minor<=max_price_minor),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at>starts_at),
  UNIQUE(ticket_product_id,rule_name)
);
CREATE INDEX IF NOT EXISTS festival_ticket_dynamic_pricing_match_idx
  ON public.festival_ticket_dynamic_pricing_rules(ticket_product_id,active,priority DESC);

CREATE TABLE IF NOT EXISTS public.festival_ticket_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_launch_id uuid NOT NULL REFERENCES public.festival_launches(id) ON DELETE CASCADE,
  ticket_product_id uuid NOT NULL REFERENCES public.festival_public_ticket_products(id) ON DELETE CASCADE,
  pricing_rule_id uuid REFERENCES public.festival_ticket_dynamic_pricing_rules(id) ON DELETE SET NULL,
  pricing_version integer NOT NULL,
  inventory_version integer NOT NULL,
  active_sold_quantity integer NOT NULL CHECK(active_sold_quantity>=0),
  capacity integer NOT NULL CHECK(capacity>=0),
  sell_through_basis_points integer NOT NULL CHECK(sell_through_basis_points BETWEEN 0 AND 10000),
  previous_price_minor bigint NOT NULL CHECK(previous_price_minor>=0),
  effective_price_minor bigint NOT NULL CHECK(effective_price_minor>=0),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ticket_product_id,pricing_version)
);

CREATE TABLE IF NOT EXISTS public.festival_commerce_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_launch_id uuid NOT NULL REFERENCES public.festival_launches(id) ON DELETE CASCADE,
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  idempotency_key uuid NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK(status IN('processing','completed')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(actor_profile_id,action,idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.festival_vendor_stall_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_launch_id uuid NOT NULL REFERENCES public.festival_launches(id) ON DELETE CASCADE,
  stall_name text NOT NULL,
  category text NOT NULL CHECK(category IN('food','soft_drinks','alcohol_where_game_rules_allow','festival_merch')),
  vendor_name text NOT NULL,
  vendor_owner_type public.financial_owner_type NOT NULL CHECK(vendor_owner_type IN('player','band','company')),
  vendor_owner_id uuid NOT NULL,
  revenue_share_basis_points integer NOT NULL CHECK(revenue_share_basis_points BETWEEN 0 AND 10000),
  share_base text NOT NULL DEFAULT 'gross_after_tax' CHECK(share_base IN('gross','gross_after_tax')),
  currency_code text NOT NULL CHECK(currency_code~'^[A-Z]{3}$'),
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(festival_launch_id,stall_name)
);
CREATE INDEX IF NOT EXISTS festival_vendor_stall_assignments_launch_idx
  ON public.festival_vendor_stall_assignments(festival_launch_id,active,category);

ALTER TABLE public.festival_runtime_vendor_sales
  ADD COLUMN IF NOT EXISTS vendor_stall_assignment_id uuid
    REFERENCES public.festival_vendor_stall_assignments(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.festival_vendor_settlement_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_sales_id uuid NOT NULL UNIQUE REFERENCES public.festival_runtime_vendor_sales(id) ON DELETE RESTRICT,
  vendor_stall_assignment_id uuid NOT NULL REFERENCES public.festival_vendor_stall_assignments(id) ON DELETE RESTRICT,
  vendor_owner_type public.financial_owner_type NOT NULL CHECK(vendor_owner_type IN('player','band','company')),
  vendor_owner_id uuid NOT NULL,
  gross_revenue_minor bigint NOT NULL CHECK(gross_revenue_minor>=0),
  tax_liability_minor bigint NOT NULL DEFAULT 0 CHECK(tax_liability_minor>=0),
  share_base_minor bigint NOT NULL CHECK(share_base_minor>=0),
  revenue_share_basis_points integer NOT NULL CHECK(revenue_share_basis_points BETWEEN 0 AND 10000),
  payable_minor bigint NOT NULL CHECK(payable_minor>=0),
  currency_code text NOT NULL CHECK(currency_code~'^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','queued','paid','waived','failed','outstanding')),
  settlement_line_id uuid UNIQUE REFERENCES public.festival_settlement_lines(id) ON DELETE SET NULL,
  finance_transaction_id uuid UNIQUE REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  terms_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.festival_edition_commerce_bridges (
  edition_id uuid PRIMARY KEY REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  festival_launch_id uuid NOT NULL UNIQUE REFERENCES public.festival_launches(id) ON DELETE CASCADE,
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  provenance text NOT NULL CHECK(provenance IN('legacy_bridge','owner_identity','admin_link')),
  linked_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  linked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.festival_ticket_dynamic_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_ticket_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_commerce_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_vendor_stall_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_vendor_settlement_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_edition_commerce_bridges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.festival_ticket_dynamic_pricing_rules FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.festival_ticket_price_history FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.festival_commerce_requests FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.festival_vendor_stall_assignments FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.festival_vendor_settlement_obligations FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.festival_edition_commerce_bridges FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.festival_ticket_dynamic_pricing_rules,public.festival_ticket_price_history,
  public.festival_commerce_requests,public.festival_vendor_stall_assignments,
  public.festival_vendor_settlement_obligations,public.festival_edition_commerce_bridges TO service_role;

CREATE OR REPLACE FUNCTION public._festival_b6_actor()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce(public.current_profile_id_safe(),public._caller_profile_id())
$$;

CREATE OR REPLACE FUNCTION public._festival_b6_owner_authorised(p_launch_id uuid,p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false)
    OR EXISTS(
      SELECT 1 FROM public.festival_launches l
      JOIN public.festival_companies f ON f.id=l.festival_company_id
      WHERE l.id=p_launch_id AND f.owner_profile_id=p_actor
    )
$$;

CREATE OR REPLACE FUNCTION public._festival_b6_edition_authorised(p_edition_id uuid,p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false)
    OR EXISTS(
      SELECT 1 FROM public.festival_editions e
      WHERE e.id=p_edition_id AND public.can_manage_festival_brand(e.festival_id)
    )
    OR EXISTS(
      SELECT 1 FROM public.festival_edition_management_roles r
      WHERE r.edition_id=p_edition_id AND r.profile_id=p_actor AND r.status='active'
        AND (r.ends_at IS NULL OR r.ends_at>now())
    )
$$;

CREATE OR REPLACE FUNCTION public._festival_b6_commerce_request(
  p_launch_id uuid,p_action text,p_idempotency_key uuid,p_payload jsonb
) RETURNS public.festival_commerce_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=public._festival_b6_actor(); req public.festival_commerce_requests%ROWTYPE;
  payload_digest text:=encode(digest(coalesce(p_payload,'{}'::jsonb)::text,'sha256'),'hex');
BEGIN
  IF actor IS NULL OR NOT public._festival_b6_owner_authorised(p_launch_id,actor) THEN
    RAISE EXCEPTION 'festival_commerce_forbidden';
  END IF;
  SELECT * INTO req FROM public.festival_commerce_requests
  WHERE actor_profile_id=actor AND action=p_action AND idempotency_key=p_idempotency_key
  FOR UPDATE;
  IF FOUND THEN
    IF req.payload_hash<>payload_digest THEN RAISE EXCEPTION 'festival_commerce_idempotency_conflict'; END IF;
    RETURN req;
  END IF;
  INSERT INTO public.festival_commerce_requests(
    festival_launch_id,actor_profile_id,action,idempotency_key,payload_hash
  ) VALUES(p_launch_id,actor,p_action,p_idempotency_key,payload_digest)
  RETURNING * INTO req;
  RETURN req;
END $$;

CREATE OR REPLACE FUNCTION public._festival_reprice_ticket_product(
  p_ticket_product_id uuid,p_reason text DEFAULT 'inventory_change'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE product public.festival_public_ticket_products%ROWTYPE;
  inventory public.festival_ticket_inventory%ROWTYPE;
  rule public.festival_ticket_dynamic_pricing_rules%ROWTYPE;
  active_sold integer; sell_through integer; candidate numeric; effective bigint; next_version integer;
BEGIN
  SELECT * INTO product FROM public.festival_public_ticket_products
  WHERE id=p_ticket_product_id FOR UPDATE;
  IF product.id IS NULL THEN RETURN jsonb_build_object('available',false); END IF;
  SELECT * INTO inventory FROM public.festival_ticket_inventory
  WHERE ticket_product_id=product.id FOR UPDATE;
  IF inventory.id IS NULL THEN RETURN jsonb_build_object('available',false); END IF;

  active_sold:=greatest(inventory.sold_quantity-inventory.cancelled_quantity-inventory.refunded_quantity,0);
  sell_through:=CASE WHEN inventory.capacity<=0 THEN 10000
    ELSE least(10000,greatest(0,round(active_sold::numeric*10000/inventory.capacity)::integer)) END;

  SELECT * INTO rule FROM public.festival_ticket_dynamic_pricing_rules r
  WHERE r.ticket_product_id=product.id AND r.festival_launch_id=product.festival_launch_id
    AND r.active
    AND sell_through BETWEEN r.min_sell_through_basis_points AND r.max_sell_through_basis_points
    AND (r.starts_at IS NULL OR r.starts_at<=now())
    AND (r.ends_at IS NULL OR r.ends_at>now())
  ORDER BY r.priority DESC,(r.max_sell_through_basis_points-r.min_sell_through_basis_points),r.created_at,r.id
  LIMIT 1;

  IF rule.id IS NULL THEN
    effective:=product.base_price_minor;
  ELSE
    candidate:=round(product.base_price_minor::numeric*(10000+rule.adjustment_basis_points)/10000);
    effective:=greatest(rule.min_price_minor,least(rule.max_price_minor,greatest(0,candidate)::bigint));
  END IF;

  IF effective<>product.price_minor THEN
    next_version:=product.pricing_version+1;
    UPDATE public.festival_public_ticket_products
    SET price_minor=effective,pricing_version=next_version
    WHERE id=product.id;
    INSERT INTO public.festival_ticket_price_history(
      festival_launch_id,ticket_product_id,pricing_rule_id,pricing_version,inventory_version,
      active_sold_quantity,capacity,sell_through_basis_points,previous_price_minor,effective_price_minor,reason
    ) VALUES(
      product.festival_launch_id,product.id,rule.id,next_version,inventory.inventory_version,
      active_sold,inventory.capacity,sell_through,product.price_minor,effective,p_reason
    ) ON CONFLICT(ticket_product_id,pricing_version) DO NOTHING;
  ELSE
    next_version:=product.pricing_version;
  END IF;

  RETURN jsonb_build_object(
    'available',true,'ticketProductId',product.id,'pricingRuleId',rule.id,
    'basePriceMinor',product.base_price_minor,'effectivePriceMinor',effective,
    'pricingVersion',next_version,'inventoryVersion',inventory.inventory_version,
    'activeSoldQuantity',active_sold,'capacity',inventory.capacity,'sellThroughBasisPoints',sell_through
  );
END $$;

CREATE OR REPLACE FUNCTION public.save_festival_ticket_dynamic_pricing_rule(
  p_festival_launch_id uuid,p_ticket_product_id uuid,p_rule_name text,
  p_min_sell_through_basis_points integer,p_max_sell_through_basis_points integer,
  p_adjustment_basis_points integer,p_min_price_minor bigint,p_max_price_minor bigint,
  p_starts_at timestamptz,p_ends_at timestamptz,p_priority integer,p_active boolean,
  p_expected_version integer,p_idempotency_key uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req public.festival_commerce_requests%ROWTYPE; product public.festival_public_ticket_products%ROWTYPE;
  rule public.festival_ticket_dynamic_pricing_rules%ROWTYPE; actor uuid:=public._festival_b6_actor();
  payload jsonb; pricing jsonb;
BEGIN
  payload:=jsonb_build_object(
    'launchId',p_festival_launch_id,'productId',p_ticket_product_id,'name',btrim(p_rule_name),
    'from',p_min_sell_through_basis_points,'to',p_max_sell_through_basis_points,
    'adjustment',p_adjustment_basis_points,'minPrice',p_min_price_minor,'maxPrice',p_max_price_minor,
    'startsAt',p_starts_at,'endsAt',p_ends_at,'priority',p_priority,'active',p_active,'expectedVersion',p_expected_version
  );
  req:=public._festival_b6_commerce_request(p_festival_launch_id,'save_dynamic_pricing_rule',p_idempotency_key,payload);
  IF req.status='completed' THEN RETURN req.result; END IF;

  SELECT * INTO product FROM public.festival_public_ticket_products
  WHERE id=p_ticket_product_id AND festival_launch_id=p_festival_launch_id FOR UPDATE;
  IF product.id IS NULL THEN RAISE EXCEPTION 'festival_ticket_product_unavailable'; END IF;
  IF char_length(btrim(coalesce(p_rule_name,'')))<2
     OR p_min_sell_through_basis_points<0 OR p_max_sell_through_basis_points>10000
     OR p_min_sell_through_basis_points>p_max_sell_through_basis_points
     OR p_adjustment_basis_points NOT BETWEEN -9000 AND 30000
     OR p_min_price_minor<0 OR p_max_price_minor<p_min_price_minor
     OR p_priority NOT BETWEEN 0 AND 10000
     OR (p_starts_at IS NOT NULL AND p_ends_at IS NOT NULL AND p_ends_at<=p_starts_at) THEN
    RAISE EXCEPTION 'festival_dynamic_pricing_rule_invalid';
  END IF;

  SELECT * INTO rule FROM public.festival_ticket_dynamic_pricing_rules
  WHERE ticket_product_id=p_ticket_product_id AND rule_name=btrim(p_rule_name) FOR UPDATE;
  IF rule.id IS NULL THEN
    IF p_expected_version<>0 THEN RAISE EXCEPTION 'festival_dynamic_pricing_stale'; END IF;
    INSERT INTO public.festival_ticket_dynamic_pricing_rules(
      festival_launch_id,ticket_product_id,rule_name,min_sell_through_basis_points,max_sell_through_basis_points,
      adjustment_basis_points,min_price_minor,max_price_minor,starts_at,ends_at,priority,active,created_by_profile_id
    ) VALUES(
      p_festival_launch_id,p_ticket_product_id,btrim(p_rule_name),p_min_sell_through_basis_points,p_max_sell_through_basis_points,
      p_adjustment_basis_points,p_min_price_minor,p_max_price_minor,p_starts_at,p_ends_at,p_priority,p_active,actor
    ) RETURNING * INTO rule;
  ELSE
    IF rule.version<>p_expected_version THEN RAISE EXCEPTION 'festival_dynamic_pricing_stale'; END IF;
    UPDATE public.festival_ticket_dynamic_pricing_rules SET
      min_sell_through_basis_points=p_min_sell_through_basis_points,
      max_sell_through_basis_points=p_max_sell_through_basis_points,
      adjustment_basis_points=p_adjustment_basis_points,min_price_minor=p_min_price_minor,max_price_minor=p_max_price_minor,
      starts_at=p_starts_at,ends_at=p_ends_at,priority=p_priority,active=p_active,
      version=version+1,updated_at=now()
    WHERE id=rule.id RETURNING * INTO rule;
  END IF;
  pricing:=public._festival_reprice_ticket_product(product.id,'pricing_rule_saved');
  req.result:=jsonb_build_object('rule',to_jsonb(rule),'pricing',pricing);
  UPDATE public.festival_commerce_requests SET status='completed',result=req.result,completed_at=now() WHERE id=req.id;
  RETURN req.result;
END $$;

CREATE OR REPLACE FUNCTION public.save_festival_vendor_stall_assignment(
  p_festival_launch_id uuid,p_stall_name text,p_category text,p_vendor_name text,
  p_vendor_owner_type text,p_vendor_owner_id uuid,p_revenue_share_basis_points integer,
  p_share_base text,p_expected_version integer,p_idempotency_key uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req public.festival_commerce_requests%ROWTYPE; assignment public.festival_vendor_stall_assignments%ROWTYPE;
  currency text; actor uuid:=public._festival_b6_actor(); payload jsonb;
BEGIN
  payload:=jsonb_build_object('launchId',p_festival_launch_id,'stallName',btrim(p_stall_name),'category',p_category,
    'vendorName',btrim(p_vendor_name),'ownerType',p_vendor_owner_type,'ownerId',p_vendor_owner_id,
    'shareBps',p_revenue_share_basis_points,'shareBase',p_share_base,'expectedVersion',p_expected_version);
  req:=public._festival_b6_commerce_request(p_festival_launch_id,'save_vendor_stall_assignment',p_idempotency_key,payload);
  IF req.status='completed' THEN RETURN req.result; END IF;
  IF char_length(btrim(coalesce(p_stall_name,'')))<2 OR char_length(btrim(coalesce(p_vendor_name,'')))<2
     OR p_category NOT IN('food','soft_drinks','alcohol_where_game_rules_allow','festival_merch')
     OR p_vendor_owner_type NOT IN('player','band','company') OR p_vendor_owner_id IS NULL
     OR p_revenue_share_basis_points NOT BETWEEN 0 AND 10000 OR p_share_base NOT IN('gross','gross_after_tax') THEN
    RAISE EXCEPTION 'festival_vendor_assignment_invalid';
  END IF;
  IF (p_vendor_owner_type='player' AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_vendor_owner_id))
     OR (p_vendor_owner_type='band' AND NOT EXISTS(SELECT 1 FROM public.bands WHERE id=p_vendor_owner_id))
     OR (p_vendor_owner_type='company' AND NOT EXISTS(SELECT 1 FROM public.companies WHERE id=p_vendor_owner_id)) THEN
    RAISE EXCEPTION 'festival_vendor_recipient_invalid';
  END IF;
  SELECT coalesce(
    (SELECT currency FROM public.festival_public_ticket_products WHERE festival_launch_id=p_festival_launch_id ORDER BY sort_order LIMIT 1),
    'USD'
  ) INTO currency;
  SELECT * INTO assignment FROM public.festival_vendor_stall_assignments
  WHERE festival_launch_id=p_festival_launch_id AND stall_name=btrim(p_stall_name) FOR UPDATE;
  IF assignment.id IS NULL THEN
    IF p_expected_version<>0 THEN RAISE EXCEPTION 'festival_vendor_assignment_stale'; END IF;
    INSERT INTO public.festival_vendor_stall_assignments(
      festival_launch_id,stall_name,category,vendor_name,vendor_owner_type,vendor_owner_id,
      revenue_share_basis_points,share_base,currency_code,created_by_profile_id
    ) VALUES(
      p_festival_launch_id,btrim(p_stall_name),p_category,btrim(p_vendor_name),
      p_vendor_owner_type::public.financial_owner_type,p_vendor_owner_id,p_revenue_share_basis_points,p_share_base,currency,actor
    ) RETURNING * INTO assignment;
  ELSE
    IF assignment.version<>p_expected_version THEN RAISE EXCEPTION 'festival_vendor_assignment_stale'; END IF;
    UPDATE public.festival_vendor_stall_assignments SET
      category=p_category,vendor_name=btrim(p_vendor_name),vendor_owner_type=p_vendor_owner_type::public.financial_owner_type,
      vendor_owner_id=p_vendor_owner_id,revenue_share_basis_points=p_revenue_share_basis_points,share_base=p_share_base,
      version=version+1,updated_at=now()
    WHERE id=assignment.id RETURNING * INTO assignment;
  END IF;
  req.result:=jsonb_build_object('assignment',to_jsonb(assignment));
  UPDATE public.festival_commerce_requests SET status='completed',result=req.result,completed_at=now() WHERE id=req.id;
  RETURN req.result;
END $$;

CREATE OR REPLACE FUNCTION public.assign_festival_runtime_vendor_sale(
  p_vendor_sales_id uuid,p_vendor_stall_assignment_id uuid,p_expected_version integer,p_idempotency_key uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sale public.festival_runtime_vendor_sales%ROWTYPE; assignment public.festival_vendor_stall_assignments%ROWTYPE;
  req public.festival_commerce_requests%ROWTYPE; runtime public.festival_runtime_sessions%ROWTYPE; payload jsonb;
BEGIN
  SELECT * INTO sale FROM public.festival_runtime_vendor_sales WHERE id=p_vendor_sales_id FOR UPDATE;
  IF sale.id IS NULL THEN RAISE EXCEPTION 'festival_vendor_sale_not_found'; END IF;
  SELECT * INTO runtime FROM public.festival_runtime_sessions WHERE id=sale.runtime_session_id;
  payload:=jsonb_build_object('saleId',sale.id,'assignmentId',p_vendor_stall_assignment_id,'expectedVersion',p_expected_version);
  req:=public._festival_b6_commerce_request(runtime.festival_launch_id,'assign_runtime_vendor_sale',p_idempotency_key,payload);
  IF req.status='completed' THEN RETURN req.result; END IF;
  IF sale.status<>'open' OR sale.version<>p_expected_version THEN RAISE EXCEPTION 'festival_vendor_sale_stale'; END IF;
  SELECT * INTO assignment FROM public.festival_vendor_stall_assignments
  WHERE id=p_vendor_stall_assignment_id AND festival_launch_id=runtime.festival_launch_id AND active FOR SHARE;
  IF assignment.id IS NULL OR assignment.category<>sale.category THEN RAISE EXCEPTION 'festival_vendor_assignment_mismatch'; END IF;
  UPDATE public.festival_runtime_vendor_sales
  SET vendor_stall_assignment_id=assignment.id,version=version+1
  WHERE id=sale.id RETURNING * INTO sale;
  req.result:=jsonb_build_object('vendorSale',to_jsonb(sale),'assignment',to_jsonb(assignment));
  UPDATE public.festival_commerce_requests SET status='completed',result=req.result,completed_at=now() WHERE id=req.id;
  RETURN req.result;
END $$;

CREATE OR REPLACE FUNCTION public._festival_ticket_purchase_reprice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM public._festival_reprice_ticket_product(NEW.ticket_product_id,'purchase_preflight');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS festival_ticket_purchase_reprice ON public.festival_ticket_purchase_requests;
CREATE TRIGGER festival_ticket_purchase_reprice
AFTER INSERT ON public.festival_ticket_purchase_requests
FOR EACH ROW EXECUTE FUNCTION public._festival_ticket_purchase_reprice();

CREATE OR REPLACE FUNCTION public._festival_ticket_inventory_reprice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF ROW(OLD.sold_quantity,OLD.cancelled_quantity,OLD.refunded_quantity,OLD.capacity,OLD.reserved_quantity)
     IS DISTINCT FROM
     ROW(NEW.sold_quantity,NEW.cancelled_quantity,NEW.refunded_quantity,NEW.capacity,NEW.reserved_quantity) THEN
    PERFORM public._festival_reprice_ticket_product(NEW.ticket_product_id,'inventory_change');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS festival_ticket_inventory_reprice ON public.festival_ticket_inventory;
CREATE TRIGGER festival_ticket_inventory_reprice
AFTER UPDATE OF sold_quantity,cancelled_quantity,refunded_quantity,capacity,reserved_quantity
ON public.festival_ticket_inventory
FOR EACH ROW EXECUTE FUNCTION public._festival_ticket_inventory_reprice();

CREATE OR REPLACE FUNCTION public._festival_vendor_assignment_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF OLD.status='closed' AND NEW.vendor_stall_assignment_id IS DISTINCT FROM OLD.vendor_stall_assignment_id THEN
    RAISE EXCEPTION 'festival_vendor_assignment_closed';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS festival_vendor_assignment_lock ON public.festival_runtime_vendor_sales;
CREATE TRIGGER festival_vendor_assignment_lock
BEFORE UPDATE OF vendor_stall_assignment_id ON public.festival_runtime_vendor_sales
FOR EACH ROW EXECUTE FUNCTION public._festival_vendor_assignment_lock();

CREATE OR REPLACE FUNCTION public._festival_create_vendor_settlement_obligation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE assignment public.festival_vendor_stall_assignments%ROWTYPE; base bigint; payable bigint;
BEGIN
  IF NEW.status='closed' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.vendor_stall_assignment_id IS NOT NULL THEN
    SELECT * INTO assignment FROM public.festival_vendor_stall_assignments WHERE id=NEW.vendor_stall_assignment_id;
    IF assignment.id IS NULL OR NOT assignment.active OR assignment.currency_code<>NEW.currency_code THEN RAISE EXCEPTION 'festival_vendor_assignment_invalid'; END IF;
    base:=CASE assignment.share_base WHEN 'gross' THEN NEW.gross_revenue_minor
      ELSE greatest(NEW.gross_revenue_minor-NEW.tax_liability_minor,0) END;
    payable:=round(base::numeric*assignment.revenue_share_basis_points/10000)::bigint;
    INSERT INTO public.festival_vendor_settlement_obligations(
      vendor_sales_id,vendor_stall_assignment_id,vendor_owner_type,vendor_owner_id,
      gross_revenue_minor,tax_liability_minor,share_base_minor,revenue_share_basis_points,payable_minor,
      currency_code,status,terms_snapshot
    ) VALUES(
      NEW.id,assignment.id,assignment.vendor_owner_type,assignment.vendor_owner_id,
      NEW.gross_revenue_minor,NEW.tax_liability_minor,base,assignment.revenue_share_basis_points,payable,
      NEW.currency_code,CASE WHEN payable=0 THEN 'waived' ELSE 'pending' END,
      jsonb_build_object('stallName',assignment.stall_name,'vendorName',assignment.vendor_name,'category',assignment.category,
        'shareBase',assignment.share_base,'revenueShareBasisPoints',assignment.revenue_share_basis_points,
        'assignmentVersion',assignment.version,'vendorSaleVersion',NEW.version)
    ) ON CONFLICT(vendor_sales_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS festival_vendor_settlement_obligation_on_close ON public.festival_runtime_vendor_sales;
CREATE TRIGGER festival_vendor_settlement_obligation_on_close
AFTER UPDATE OF status ON public.festival_runtime_vendor_sales
FOR EACH ROW EXECUTE FUNCTION public._festival_create_vendor_settlement_obligation();

CREATE OR REPLACE FUNCTION public._festival_sync_vendor_settlement_lines()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.festival_settlement_lines(
    settlement_id,line_type,source_type,source_id,recipient_type,recipient_id,payer_type,payer_id,
    gross_amount_minor,tax_amount_minor,fee_amount_minor,net_amount_minor,currency_code,status,priority,
    formula_version,calculation_metadata
  )
  SELECT NEW.id,'other_expense','festival_vendor_share',o.id,o.vendor_owner_type::text,o.vendor_owner_id,
    'company',fc.company_id,o.share_base_minor,0,0,o.payable_minor,o.currency_code,'pending',45,
    'festival-vendor-share-v1',o.terms_snapshot||jsonb_build_object(
      'grossRevenueMinor',o.gross_revenue_minor,'taxLiabilityMinor',o.tax_liability_minor,
      'vendorSettlementObligationId',o.id
    )
  FROM public.festival_vendor_settlement_obligations o
  JOIN public.festival_runtime_vendor_sales v ON v.id=o.vendor_sales_id
  JOIN public.festival_runtime_sessions r ON r.id=v.runtime_session_id
  JOIN public.festival_companies fc ON fc.id=NEW.festival_company_id
  WHERE r.id=NEW.runtime_session_id AND o.payable_minor>0
  ON CONFLICT(source_type,source_id,line_type) DO NOTHING;

  UPDATE public.festival_vendor_settlement_obligations o
  SET settlement_line_id=l.id,status=CASE WHEN o.status='pending' THEN 'queued' ELSE o.status END,updated_at=now()
  FROM public.festival_settlement_lines l
  WHERE l.settlement_id=NEW.id AND l.source_type='festival_vendor_share' AND l.source_id=o.id
    AND o.settlement_line_id IS DISTINCT FROM l.id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS festival_sync_vendor_settlement_lines ON public.festival_financial_settlements;
CREATE TRIGGER festival_sync_vendor_settlement_lines
AFTER INSERT ON public.festival_financial_settlements
FOR EACH ROW EXECUTE FUNCTION public._festival_sync_vendor_settlement_lines();

CREATE OR REPLACE FUNCTION public._festival_sync_vendor_obligation_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tx uuid;
BEGIN
  IF NEW.source_type='festival_vendor_share' AND NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT p.financial_transaction_id INTO tx
    FROM public.festival_settlement_payments p
    WHERE p.settlement_line_id=NEW.id AND p.status='paid'
    ORDER BY p.attempt DESC LIMIT 1;
    UPDATE public.festival_vendor_settlement_obligations SET
      status=CASE NEW.status WHEN 'paid' THEN 'paid' WHEN 'waived' THEN 'waived'
        WHEN 'outstanding' THEN 'outstanding' WHEN 'failed' THEN 'failed' ELSE status END,
      finance_transaction_id=coalesce(tx,finance_transaction_id),updated_at=now()
    WHERE id=NEW.source_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS festival_sync_vendor_obligation_status ON public.festival_settlement_lines;
CREATE TRIGGER festival_sync_vendor_obligation_status
AFTER UPDATE OF status ON public.festival_settlement_lines
FOR EACH ROW EXECUTE FUNCTION public._festival_sync_vendor_obligation_status();

-- Link the B5 edition aggregate to the canonical launch/runtime commerce stack only when the mapping is unambiguous.
WITH candidates AS (
  SELECT e.id edition_id,l.id festival_launch_id,b.festival_company_id,
    count(*) OVER(PARTITION BY e.id) candidate_count
  FROM public.festival_editions e
  JOIN public.festival_public_legacy_bridges b ON b.legacy_festival_id=e.festival_id
  JOIN public.festival_editions_v2 e2 ON e2.id=b.festival_edition_id
  JOIN public.festival_launches l ON l.festival_company_id=b.festival_company_id
  JOIN public.festival_public_editions pe ON pe.festival_launch_id=l.id
  WHERE (e.edition_year IS NULL OR e2.edition_year=e.edition_year)
    AND (e.edition_year IS NULL OR extract(year FROM pe.starts_at)::integer=e.edition_year)
)
INSERT INTO public.festival_edition_commerce_bridges(edition_id,festival_launch_id,festival_company_id,provenance)
SELECT edition_id,festival_launch_id,festival_company_id,'legacy_bridge'
FROM candidates WHERE candidate_count=1
ON CONFLICT DO NOTHING;

WITH identities AS (
  SELECT DISTINCT e.id edition_id,l.id festival_launch_id,fc.id festival_company_id
  FROM public.festival_editions e
  JOIN public.festivals f ON f.id=e.festival_id
  JOIN public.festival_companies fc
    ON (f.owner_company_id IS NOT NULL AND fc.company_id=f.owner_company_id)
    OR (f.owner_company_id IS NULL AND f.owner_profile_id IS NOT NULL AND fc.owner_profile_id=f.owner_profile_id)
  JOIN public.festival_launches l ON l.festival_company_id=fc.id
  JOIN public.festival_public_editions pe ON pe.festival_launch_id=l.id
  WHERE NOT EXISTS(SELECT 1 FROM public.festival_edition_commerce_bridges x WHERE x.edition_id=e.id)
    AND (e.edition_year IS NULL OR extract(year FROM pe.starts_at)::integer=e.edition_year)
    AND (e.start_at IS NULL OR abs(extract(epoch FROM (pe.starts_at-e.start_at)))<86400*31)
), candidates AS (
  SELECT i.*,count(*) OVER(PARTITION BY edition_id) candidate_count FROM identities i
)
INSERT INTO public.festival_edition_commerce_bridges(edition_id,festival_launch_id,festival_company_id,provenance)
SELECT edition_id,festival_launch_id,festival_company_id,'owner_identity'
FROM candidates WHERE candidate_count=1
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_link_festival_edition_commerce(
  p_edition_id uuid,p_festival_launch_id uuid,p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.festival_editions%ROWTYPE;l public.festival_launches%ROWTYPE;actor uuid:=public._festival_b6_actor();
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN RAISE EXCEPTION 'festival_commerce_forbidden'; END IF;
  IF char_length(btrim(coalesce(p_reason,'')))<8 THEN RAISE EXCEPTION 'festival_commerce_link_reason_required'; END IF;
  SELECT * INTO STRICT e FROM public.festival_editions WHERE id=p_edition_id;
  SELECT * INTO STRICT l FROM public.festival_launches WHERE id=p_festival_launch_id;
  INSERT INTO public.festival_edition_commerce_bridges(
    edition_id,festival_launch_id,festival_company_id,provenance,linked_by_profile_id
  ) VALUES(e.id,l.id,l.festival_company_id,'admin_link',actor)
  ON CONFLICT(edition_id) DO UPDATE SET festival_launch_id=excluded.festival_launch_id,
    festival_company_id=excluded.festival_company_id,provenance='admin_link',
    linked_by_profile_id=actor,linked_at=now();
  PERFORM public._festival_record_organiser_audit(
    e.festival_id,e.id,'commerce_linked','festival_launch',l.id,'{}',
    jsonb_build_object('festivalLaunchId',l.id,'festivalCompanyId',l.festival_company_id),p_reason,'{}',NULL
  );
  RETURN jsonb_build_object('editionId',e.id,'festivalLaunchId',l.id,'festivalCompanyId',l.festival_company_id);
END $$;

CREATE OR REPLACE FUNCTION public.get_festival_edition_commerce_analytics(p_edition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=public._festival_b6_actor(); e public.festival_editions%ROWTYPE;
  bridge public.festival_edition_commerce_bridges%ROWTYPE; runtime public.festival_runtime_sessions%ROWTYPE;
  settlement public.festival_financial_settlements%ROWTYPE;
  ticket_capacity bigint:=0; ticket_reserved bigint:=0; ticket_sold bigint:=0; ticket_remaining bigint:=0;
  ticket_subtotal bigint:=0; ticket_fees bigint:=0; ticket_tax bigint:=0; ticket_collected bigint:=0; ticket_refunds bigint:=0;
  ticket_finance bigint:=0; vendor_gross bigint:=0; vendor_posted bigint:=0; vendor_tax bigint:=0; vendor_cost bigint:=0;
  vendor_share bigint:=0; vendor_paid bigint:=0; vendor_outstanding bigint:=0;
  unique_attendees bigint:=0; total_admissions bigint:=0; peak_onsite bigint:=0; satisfaction numeric;
  performance_count bigint:=0; performance_score numeric; peak_audience bigint:=0;
  codes text[]:=ARRAY[]::text[];
BEGIN
  SELECT * INTO e FROM public.festival_editions WHERE id=p_edition_id;
  IF e.id IS NULL THEN RAISE EXCEPTION 'festival_edition_not_found'; END IF;
  IF actor IS NULL OR NOT public._festival_b6_edition_authorised(e.id,actor) THEN RAISE EXCEPTION 'festival_commerce_forbidden'; END IF;
  SELECT * INTO bridge FROM public.festival_edition_commerce_bridges WHERE edition_id=e.id;
  IF bridge.edition_id IS NULL THEN
    RETURN jsonb_build_object(
      'editionId',e.id,'linked',false,'reconciliation',
      jsonb_build_object('balanced',false,'codes',jsonb_build_array('commerce_bridge_missing'))
    );
  END IF;
  SELECT * INTO runtime FROM public.festival_runtime_sessions WHERE festival_launch_id=bridge.festival_launch_id;
  IF runtime.id IS NOT NULL THEN
    SELECT * INTO settlement FROM public.festival_financial_settlements WHERE runtime_session_id=runtime.id;
  END IF;

  SELECT coalesce(sum(i.capacity),0),coalesce(sum(i.reserved_quantity),0),
    coalesce(sum(greatest(i.sold_quantity-i.cancelled_quantity-i.refunded_quantity,0)),0),
    coalesce(sum(i.available_quantity),0)
  INTO ticket_capacity,ticket_reserved,ticket_sold,ticket_remaining
  FROM public.festival_ticket_inventory i
  JOIN public.festival_public_ticket_products p ON p.id=i.ticket_product_id
  WHERE i.festival_launch_id=bridge.festival_launch_id AND p.product_class='admission';

  SELECT coalesce(sum(s.subtotal_minor),0),coalesce(sum(s.fee_minor),0),coalesce(sum(s.tax_minor),0),coalesce(sum(s.total_minor),0)
  INTO ticket_subtotal,ticket_fees,ticket_tax,ticket_collected
  FROM public.festival_ticket_sales s
  WHERE s.festival_launch_id=bridge.festival_launch_id AND s.status IN('completed','partially_refunded','refunded');

  SELECT coalesce(sum(o.amount_minor),0) INTO ticket_refunds
  FROM public.festival_ticket_refund_obligations o
  JOIN public.festival_ticket_sales s ON s.id=o.festival_ticket_sale_id
  WHERE s.festival_launch_id=bridge.festival_launch_id AND o.status='completed';

  SELECT coalesce(sum(tx.gross_amount_minor),0) INTO ticket_finance
  FROM public.festival_ticket_sales s
  JOIN public.financial_transactions tx
    ON tx.related_entity_type='festival_ticket_purchase' AND tx.related_entity_id=s.purchase_request_id
   AND tx.status='completed'
  WHERE s.festival_launch_id=bridge.festival_launch_id;

  IF runtime.id IS NOT NULL THEN
    SELECT coalesce(sum(v.gross_revenue_minor),0),coalesce(sum(v.tax_liability_minor),0),coalesce(sum(v.cost_basis_minor),0)
    INTO vendor_gross,vendor_tax,vendor_cost
    FROM public.festival_runtime_vendor_sales v WHERE v.runtime_session_id=runtime.id;

    SELECT coalesce(sum(p.amount_minor),0) INTO vendor_posted
    FROM public.festival_runtime_revenue_postings p
    JOIN public.festival_runtime_vendor_sales v ON v.id=p.vendor_sales_id
    WHERE v.runtime_session_id=runtime.id;

    SELECT coalesce(sum(o.payable_minor),0),
      coalesce(sum(CASE WHEN o.status='paid' THEN o.payable_minor ELSE 0 END),0),
      coalesce(sum(CASE WHEN o.status IN('pending','queued','failed','outstanding') THEN o.payable_minor ELSE 0 END),0)
    INTO vendor_share,vendor_paid,vendor_outstanding
    FROM public.festival_vendor_settlement_obligations o
    JOIN public.festival_runtime_vendor_sales v ON v.id=o.vendor_sales_id
    WHERE v.runtime_session_id=runtime.id;

    SELECT coalesce(count(DISTINCT a.issued_ticket_id),0) INTO unique_attendees
    FROM public.festival_runtime_ticket_admissions a WHERE a.runtime_session_id=runtime.id;
    SELECT coalesce(sum(a.admitted_count),0),coalesce(max(a.onsite_count),0)
    INTO total_admissions,peak_onsite FROM public.festival_runtime_attendance a WHERE a.runtime_session_id=runtime.id;
    SELECT round(avg(c.satisfaction),1) INTO satisfaction FROM public.festival_runtime_crowds c WHERE c.runtime_session_id=runtime.id;
    SELECT count(*) FILTER(WHERE p.status='completed'),round(avg(p.performance_score) FILTER(WHERE p.status='completed'),1),
      coalesce(max(p.peak_audience),0)
    INTO performance_count,performance_score,peak_audience
    FROM public.festival_runtime_performances p WHERE p.runtime_session_id=runtime.id;
  END IF;

  IF ticket_collected<>ticket_finance THEN codes:=array_append(codes,'ticket_finance_mismatch'); END IF;
  IF vendor_gross<>vendor_posted AND runtime.id IS NOT NULL THEN codes:=array_append(codes,'vendor_posting_mismatch'); END IF;
  IF settlement.id IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.festival_vendor_settlement_obligations o
    JOIN public.festival_runtime_vendor_sales v ON v.id=o.vendor_sales_id
    WHERE v.runtime_session_id=runtime.id AND o.payable_minor>0 AND o.settlement_line_id IS NULL
  ) THEN codes:=array_append(codes,'vendor_settlement_line_missing'); END IF;
  IF settlement.id IS NOT NULL AND settlement.status='settled' AND vendor_outstanding>0 THEN
    codes:=array_append(codes,'vendor_share_outstanding_after_settlement');
  END IF;

  RETURN jsonb_build_object(
    'editionId',e.id,'festivalId',e.festival_id,'linked',true,
    'festivalLaunchId',bridge.festival_launch_id,'festivalCompanyId',bridge.festival_company_id,
    'bridgeProvenance',bridge.provenance,'runtimeSessionId',runtime.id,'asOf',now(),
    'tickets',jsonb_build_object(
      'capacity',ticket_capacity,'reserved',ticket_reserved,'sold',ticket_sold,'remaining',ticket_remaining,
      'sellThroughBasisPoints',CASE WHEN ticket_capacity=0 THEN 0 ELSE round(ticket_sold::numeric*10000/ticket_capacity)::integer END,
      'subtotalMinor',ticket_subtotal,'feeMinor',ticket_fees,'taxMinor',ticket_tax,'collectedMinor',ticket_collected,
      'refundsMinor',ticket_refunds,'netCashMinor',ticket_collected-ticket_refunds,'financePostedMinor',ticket_finance,
      'products',coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id',p.id,'name',p.name,'productClass',p.product_class,'ticketType',p.ticket_type,
        'basePriceMinor',p.base_price_minor,'effectivePriceMinor',p.price_minor,'pricingVersion',p.pricing_version,
        'capacity',i.capacity,'sold',greatest(i.sold_quantity-i.cancelled_quantity-i.refunded_quantity,0),
        'remaining',i.available_quantity,'rules',coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id',r.id,'name',r.rule_name,'fromBps',r.min_sell_through_basis_points,'toBps',r.max_sell_through_basis_points,
          'adjustmentBps',r.adjustment_basis_points,'minPriceMinor',r.min_price_minor,'maxPriceMinor',r.max_price_minor,
          'priority',r.priority,'active',r.active,'version',r.version,'startsAt',r.starts_at,'endsAt',r.ends_at
        ) ORDER BY r.priority DESC) FROM public.festival_ticket_dynamic_pricing_rules r WHERE r.ticket_product_id=p.id),'[]'::jsonb)
      ) ORDER BY p.sort_order) FROM public.festival_public_ticket_products p
      JOIN public.festival_ticket_inventory i ON i.ticket_product_id=p.id
      WHERE p.festival_launch_id=bridge.festival_launch_id),'[]'::jsonb)
    ),
    'vendors',jsonb_build_object(
      'grossMinor',vendor_gross,'taxMinor',vendor_tax,'costBasisMinor',vendor_cost,'postedMinor',vendor_posted,
      'sharePayableMinor',vendor_share,'sharePaidMinor',vendor_paid,'shareOutstandingMinor',vendor_outstanding,
      'stalls',coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id',a.id,'stallName',a.stall_name,'category',a.category,'vendorName',a.vendor_name,
        'vendorOwnerType',a.vendor_owner_type,'vendorOwnerId',a.vendor_owner_id,
        'revenueShareBasisPoints',a.revenue_share_basis_points,'shareBase',a.share_base,
        'currencyCode',a.currency_code,'active',a.active,'version',a.version
      ) ORDER BY a.stall_name) FROM public.festival_vendor_stall_assignments a
      WHERE a.festival_launch_id=bridge.festival_launch_id),'[]'::jsonb)
    ),
    'attendance',jsonb_build_object('uniqueAttendees',unique_attendees,'totalAdmissions',total_admissions,'peakOnsite',peak_onsite),
    'satisfaction',jsonb_build_object('averageScore',satisfaction),
    'performance',jsonb_build_object('completedPerformances',performance_count,'averageScore',performance_score,'peakAudience',peak_audience),
    'settlement',CASE WHEN settlement.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',settlement.id,'status',settlement.status,'currencyCode',settlement.currency_code,
      'totalRevenueMinor',settlement.total_revenue_minor,'totalCostMinor',settlement.total_cost_minor,
      'netProfitLossMinor',settlement.net_profit_loss_minor,'cashReceivedMinor',settlement.cash_received_minor,
      'cashPaidMinor',settlement.cash_paid_minor,'outstandingPayablesMinor',settlement.outstanding_payables_minor,
      'outstandingReceivablesMinor',settlement.outstanding_receivables_minor
    ) END,
    'reconciliation',jsonb_build_object('balanced',cardinality(codes)=0,'codes',to_jsonb(codes),
      'ticketSalesMinor',ticket_collected,'ticketFinanceMinor',ticket_finance,
      'vendorSalesMinor',vendor_gross,'vendorPostingsMinor',vendor_posted,
      'vendorSharePayableMinor',vendor_share,'vendorSharePaidMinor',vendor_paid)
  );
END $$;

REVOKE ALL ON FUNCTION public._festival_ticket_product_seed_base_price(),public._festival_b6_actor(),public._festival_b6_owner_authorised(uuid,uuid),
  public._festival_b6_edition_authorised(uuid,uuid),public._festival_b6_commerce_request(uuid,text,uuid,jsonb),
  public._festival_reprice_ticket_product(uuid,text),public._festival_ticket_purchase_reprice(),
  public._festival_ticket_inventory_reprice(),public._festival_vendor_assignment_lock(),
  public._festival_create_vendor_settlement_obligation(),public._festival_sync_vendor_settlement_lines(),
  public._festival_sync_vendor_obligation_status() FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.save_festival_ticket_dynamic_pricing_rule(
  uuid,uuid,text,integer,integer,integer,bigint,bigint,timestamptz,timestamptz,integer,boolean,integer,uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_festival_vendor_stall_assignment(
  uuid,text,text,text,text,uuid,integer,text,integer,uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_festival_runtime_vendor_sale(uuid,uuid,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_edition_commerce_analytics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_link_festival_edition_commerce(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public._festival_reprice_ticket_product(uuid,text) TO service_role;

COMMENT ON TABLE public.festival_ticket_dynamic_pricing_rules IS
  'B6 server-owned ticket tier pricing rules. Purchases never supply a price; current price is recalculated before the canonical purchase reads the product.';
COMMENT ON TABLE public.festival_vendor_settlement_obligations IS
  'B6 immutable vendor-share calculation source. Payables enter the existing Phase 9 festival settlement and canonical Finance transfer path.';
COMMENT ON FUNCTION public.get_festival_edition_commerce_analytics(uuid) IS
  'B6 organiser projection for canonical ticket inventory, Finance receipts, runtime attendance/vendor evidence, settlement and reconciliation.';
