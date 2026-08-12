-- Authoritative gig commerce v1. Merchandise demand is deterministic from the
-- completed performance inputs. Bar throughput is bounded by attendance,
-- licence, bar level and bartender capacity. A confirmed booking owns its exact
-- bar_revenue_share_pct; otherwise the venue owns 100%.
CREATE TABLE public.gig_commerce_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL UNIQUE REFERENCES public.gigs(id) ON DELETE RESTRICT,
  gig_outcome_id uuid NOT NULL UNIQUE REFERENCES public.gig_outcomes(id) ON DELETE RESTRICT,
  formula_version text NOT NULL,
  merchandise_items integer NOT NULL DEFAULT 0 CHECK (merchandise_items >= 0),
  merchandise_gross integer NOT NULL DEFAULT 0 CHECK (merchandise_gross >= 0),
  merchandise_cost integer NOT NULL DEFAULT 0 CHECK (merchandise_cost >= 0),
  bar_drinks_served integer NOT NULL DEFAULT 0 CHECK (bar_drinks_served >= 0),
  bar_gross integer NOT NULL DEFAULT 0 CHECK (bar_gross >= 0),
  venue_bar_revenue integer NOT NULL DEFAULT 0 CHECK (venue_bar_revenue >= 0),
  band_bar_revenue integer NOT NULL DEFAULT 0 CHECK (band_bar_revenue >= 0),
  booking_id uuid REFERENCES public.venue_bookings(id) ON DELETE SET NULL,
  venue_transaction_id uuid REFERENCES public.venue_financial_transactions(id) ON DELETE SET NULL,
  commerce_snapshot jsonb NOT NULL,
  settled_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gig_commerce_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Band members view gig commerce" ON public.gig_commerce_settlements FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.gigs g JOIN public.band_members bm ON bm.band_id=g.band_id WHERE g.id=gig_id AND bm.user_id=auth.uid())
);

ALTER TABLE public.merch_orders ADD COLUMN IF NOT EXISTS gig_settlement_id uuid REFERENCES public.gig_commerce_settlements(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX merch_orders_one_settled_line ON public.merch_orders(gig_settlement_id, merchandise_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE gig_settlement_id IS NOT NULL;
ALTER TABLE public.venue_financial_transactions ADD COLUMN IF NOT EXISTS gig_settlement_id uuid REFERENCES public.gig_commerce_settlements(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX venue_transactions_one_gig_bar ON public.venue_financial_transactions(gig_settlement_id) WHERE gig_settlement_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.settle_gig_commerce(p_gig_id uuid, p_performance_rating numeric, p_merch_multiplier numeric DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE
  s public.gig_commerce_settlements%ROWTYPE; g public.gigs%ROWTYPE; o public.gig_outcomes%ROWTYPE; v public.venues%ROWTYPE;
  booking public.venue_bookings%ROWTYPE; target integer; remaining integer; qty integer; line record; lines jsonb := '[]';
  merch_count integer:=0; merch_gross integer:=0; merch_cost integer:=0; bartender_count integer:=0; bartender_skill numeric:=0; bar_level integer:=0;
  drinks integer:=0; v_bar_gross integer:=0; venue_pct numeric:=100; venue_take integer:=0; band_take integer:=0; tx uuid; snapshot jsonb;
  venue_city text; venue_country text;
BEGIN
  -- The gig row is the serialization lock. Every effect below commits together.
  SELECT * INTO g FROM public.gigs WHERE id=p_gig_id FOR UPDATE;
  IF g.id IS NULL THEN RAISE EXCEPTION 'GIG_NOT_FOUND'; END IF;
  SELECT * INTO o FROM public.gig_outcomes WHERE gig_id=p_gig_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'OUTCOME_NOT_FOUND'; END IF;
  SELECT * INTO s FROM public.gig_commerce_settlements WHERE gig_id=p_gig_id;
  IF s.id IS NOT NULL THEN RETURN s.commerce_snapshot; END IF;
  SELECT * INTO v FROM public.venues WHERE id=g.venue_id;
  SELECT name,country INTO venue_city,venue_country FROM public.cities WHERE id=v.city_id;

  INSERT INTO public.gig_commerce_settlements(gig_id,gig_outcome_id,formula_version,commerce_snapshot)
  VALUES(p_gig_id,o.id,'gig-commerce-v1','{}') RETURNING * INTO s;

  target := greatest(0, round(coalesce(o.actual_attendance,0) * least(.25, greatest(0, .05 + least(1,coalesce(p_performance_rating,0)/25)*.12)) * greatest(0,least(2,coalesce(p_merch_multiplier,1))))::integer);
  remaining := target;
  -- Variants are the stock authority when an item has active variants. Otherwise
  -- the base item is locked/decremented. Stable hash order replaces Math.random().
  FOR line IN
    SELECT pm.id merchandise_id, mv.id variant_id, pm.item_type, pm.design_name,
      coalesce(mv.selling_price_override,pm.selling_price,0)::integer unit_price,
      coalesce(mv.cost_to_produce_override,pm.cost_to_produce,0)::integer unit_cost,
      CASE WHEN mv.id IS NULL THEN pm.stock_quantity ELSE mv.stock_quantity END stock_quantity
    FROM public.player_merchandise pm
    LEFT JOIN public.merch_variants mv ON mv.merchandise_id=pm.id AND mv.is_active
    WHERE pm.band_id=g.band_id AND (mv.id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM public.merch_variants x WHERE x.merchandise_id=pm.id AND x.is_active))
    ORDER BY md5(p_gig_id::text || ':' || pm.id::text || ':' || coalesce(mv.id::text,''))
  LOOP
    EXIT WHEN remaining=0;
    qty := least(remaining, greatest(0,line.stock_quantity));
    IF qty > 0 THEN
      IF line.variant_id IS NULL THEN UPDATE public.player_merchandise SET stock_quantity=stock_quantity-qty WHERE id=line.merchandise_id AND stock_quantity>=qty;
      ELSE UPDATE public.merch_variants SET stock_quantity=stock_quantity-qty WHERE id=line.variant_id AND stock_quantity>=qty; END IF;
      IF NOT FOUND THEN RAISE EXCEPTION 'INVENTORY_CHANGED'; END IF;
      INSERT INTO public.merch_orders(band_id,merchandise_id,variant_id,quantity,unit_price,total_price,order_type,customer_type,country,city,city_id,gig_id,sales_tax,vat,net_revenue,gig_settlement_id)
      VALUES(g.band_id,line.merchandise_id,line.variant_id,qty,line.unit_price,qty*line.unit_price,'gig','fan',venue_country,venue_city,v.city_id,p_gig_id,0,0,qty*line.unit_price,s.id);
      merch_count:=merch_count+qty; merch_gross:=merch_gross+qty*line.unit_price; merch_cost:=merch_cost+qty*line.unit_cost; remaining:=remaining-qty;
      lines:=lines || jsonb_build_array(jsonb_build_object('merchandiseId',line.merchandise_id,'variantId',line.variant_id,'itemType',line.item_type,'name',line.design_name,'quantity',qty,'unitPrice',line.unit_price,'gross',qty*line.unit_price));
    END IF;
  END LOOP;

  SELECT count(*),coalesce(avg(skill_level),0) INTO bartender_count,bartender_skill FROM public.venue_staff WHERE venue_id=v.id AND role='bartender';
  SELECT coalesce(max(upgrade_level),0) INTO bar_level FROM public.venue_upgrades WHERE venue_id=v.id AND upgrade_type='bar';
  -- Missing named bartenders uses one baseline house server only when staff_count>0.
  IF coalesce(v.alcohol_license,false) AND (bartender_count>0 OR coalesce(v.staff_count,0)>0) THEN
    drinks:=least(coalesce(o.actual_attendance,0), floor((CASE WHEN bartender_count>0 THEN bartender_count*(35+15*bartender_skill) ELSE 35 END) * (1+bar_level*.15))::integer,
      floor(coalesce(o.actual_attendance,0) * least(.8,.18+coalesce(p_performance_rating,0)/100))::integer);
    v_bar_gross:=greatest(0,drinks)*(4+least(3,bar_level));
  END IF;
  SELECT * INTO booking FROM public.venue_bookings WHERE gig_id=p_gig_id AND status='confirmed' ORDER BY created_at DESC LIMIT 1;
  IF booking.id IS NOT NULL THEN venue_pct:=greatest(0,least(100,coalesce(booking.bar_revenue_share_pct,100))); END IF;
  venue_take:=round(v_bar_gross*venue_pct/100); band_take:=v_bar_gross-venue_take;
  IF venue_take>0 AND v.company_id IS NOT NULL THEN
    PERFORM public.finance_credit_owner('company',v.company_id,venue_take::bigint*100,'company_revenue','Gig bar revenue','gig-bar:'||p_gig_id::text,NULL,jsonb_build_object('gigId',p_gig_id,'settlementId',s.id,'venueId',v.id));
    -- Keep the documented legacy mirror in sync with the canonical account.
    UPDATE public.companies SET balance=coalesce(balance,0)+venue_take WHERE id=v.company_id;
    INSERT INTO public.venue_financial_transactions(venue_id,transaction_type,amount,description,related_booking_id,gig_settlement_id)
    VALUES(v.id,'bar_revenue',venue_take,'Authoritative gig bar settlement',booking.id,s.id) RETURNING id INTO tx;
  END IF;
  IF band_take>0 AND booking.id IS NOT NULL THEN
    PERFORM public.finance_credit_owner('band',g.band_id,band_take::bigint*100,'gig_payment','Contracted gig bar share','gig-bar-band:'||p_gig_id::text,NULL,jsonb_build_object('gigId',p_gig_id,'settlementId',s.id,'bookingId',booking.id));
    UPDATE public.bands SET band_balance=coalesce(band_balance,0)+band_take WHERE id=g.band_id;
  END IF;
  snapshot:=jsonb_build_object('formulaVersion','gig-commerce-v1','settlementId',s.id,'merchandise',jsonb_build_object('itemsSold',merch_count,'grossRevenue',merch_gross,'cost',merch_cost,'lines',lines,'owner','band'),'bar',jsonb_build_object('drinksServed',drinks,'grossRevenue',v_bar_gross,'venueRevenue',venue_take,'bandEntitlement',band_take,'owner',CASE WHEN band_take>0 THEN 'shared_by_confirmed_booking' ELSE 'venue' END,'shareSource',CASE WHEN booking.id IS NULL THEN 'venue_fallback' ELSE 'confirmed_booking' END));
  UPDATE public.gig_outcomes SET merch_items_sold=merch_count,merch_revenue=merch_gross WHERE id=o.id;
  UPDATE public.gig_commerce_settlements SET merchandise_items=merch_count,merchandise_gross=merch_gross,merchandise_cost=merch_cost,bar_drinks_served=drinks,bar_gross=v_bar_gross,venue_bar_revenue=venue_take,band_bar_revenue=band_take,booking_id=booking.id,venue_transaction_id=tx,commerce_snapshot=snapshot,settled_at=now() WHERE id=s.id;
  RETURN snapshot;
END $$;
REVOKE ALL ON FUNCTION public.settle_gig_commerce(uuid,numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_gig_commerce(uuid,numeric,numeric) TO service_role;
