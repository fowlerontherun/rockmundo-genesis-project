-- Ensure authoritative gig commerce respects merchandise sale windows and
-- audience eligibility. Superfan-only merchandise is excluded from ordinary
-- fan gig purchases; future and expired drops are not considered sellable.
create or replace function public.settle_gig_commerce(p_gig_id uuid, p_performance_rating numeric, p_merch_multiplier numeric default 1)
returns jsonb language plpgsql security definer set search_path=public as $$
#variable_conflict use_variable
declare
  s public.gig_commerce_settlements%rowtype; g public.gigs%rowtype; o public.gig_outcomes%rowtype; v public.venues%rowtype;
  booking public.venue_bookings%rowtype; target integer; remaining integer; qty integer; line record; lines jsonb := '[]';
  merch_count integer:=0; merch_gross integer:=0; merch_cost integer:=0; bartender_count integer:=0; bartender_skill numeric:=0; bar_level integer:=0;
  drinks integer:=0; v_bar_gross integer:=0; venue_pct numeric:=100; venue_take integer:=0; band_take integer:=0; tx uuid; snapshot jsonb;
  venue_city text; venue_country text;
  active_360 record; label_merch_cut integer:=0; band_merch_revenue integer:=0;
begin
  select * into g from public.gigs where id=p_gig_id for update;
  if g.id is null then raise exception 'GIG_NOT_FOUND'; end if;
  select * into o from public.gig_outcomes where gig_id=p_gig_id for update;
  if o.id is null then raise exception 'OUTCOME_NOT_FOUND'; end if;
  select * into s from public.gig_commerce_settlements where gig_id=p_gig_id;
  if s.id is not null then return s.commerce_snapshot; end if;
  select * into v from public.venues where id=g.venue_id;
  select name,country into venue_city,venue_country from public.cities where id=v.city_id;

  insert into public.gig_commerce_settlements(gig_id,gig_outcome_id,formula_version,commerce_snapshot)
  values(p_gig_id,o.id,'gig-commerce-v3','{}') returning * into s;

  target := greatest(0, round(coalesce(o.actual_attendance,0) * least(.25, greatest(0, .05 + least(1,coalesce(p_performance_rating,0)/25)*.12)) * greatest(0,least(2,coalesce(p_merch_multiplier,1))))::integer);
  remaining := target;
  for line in
    select pm.id merchandise_id, mv.id variant_id, pm.item_type, pm.design_name,
      coalesce(mv.selling_price_override,pm.selling_price,0)::integer unit_price,
      coalesce(mv.cost_to_produce_override,pm.cost_to_produce,0)::integer unit_cost,
      case when mv.id is null then pm.stock_quantity else mv.stock_quantity end stock_quantity
    from public.player_merchandise pm
    left join public.merch_variants mv on mv.merchandise_id=pm.id and mv.is_active
    where pm.band_id=g.band_id
      and (pm.drop_starts_at is null or pm.drop_starts_at <= now())
      and (pm.available_until is null or pm.available_until > now())
      and not coalesce(pm.superfan_only,false)
      and (mv.id is not null or not exists (select 1 from public.merch_variants x where x.merchandise_id=pm.id and x.is_active))
    order by md5(p_gig_id::text || ':' || pm.id::text || ':' || coalesce(mv.id::text,''))
  loop
    exit when remaining=0;
    qty := least(remaining, greatest(0,line.stock_quantity));
    if qty > 0 then
      if line.variant_id is null then update public.player_merchandise set stock_quantity=stock_quantity-qty where id=line.merchandise_id and stock_quantity>=qty;
      else update public.merch_variants set stock_quantity=stock_quantity-qty where id=line.variant_id and stock_quantity>=qty; end if;
      if not found then raise exception 'INVENTORY_CHANGED'; end if;
      insert into public.merch_orders(band_id,merchandise_id,variant_id,quantity,unit_price,total_price,order_type,customer_type,country,city,city_id,gig_id,sales_tax,vat,net_revenue,gig_settlement_id)
      values(g.band_id,line.merchandise_id,line.variant_id,qty,line.unit_price,qty*line.unit_price,'gig','fan',venue_country,venue_city,v.city_id,p_gig_id,0,0,qty*line.unit_price,s.id);
      merch_count:=merch_count+qty; merch_gross:=merch_gross+qty*line.unit_price; merch_cost:=merch_cost+qty*line.unit_cost; remaining:=remaining-qty;
      lines:=lines || jsonb_build_array(jsonb_build_object('merchandiseId',line.merchandise_id,'variantId',line.variant_id,'itemType',line.item_type,'name',line.design_name,'quantity',qty,'unitPrice',line.unit_price,'gross',qty*line.unit_price));
    end if;
  end loop;

  band_merch_revenue := merch_gross;
  if merch_gross > 0 then
    select alc.id, alc.label_id, alc.royalty_label_pct into active_360
    from public.artist_label_contracts alc
    join public.label_deal_types ldt on ldt.id=alc.deal_type_id
    where alc.band_id=g.band_id and alc.status='active' and ldt.name='360 Deal'
    order by alc.created_at desc limit 1;

    if active_360.id is not null then
      label_merch_cut := greatest(0, round(merch_gross * coalesce(active_360.royalty_label_pct,20) / 100.0)::integer);
      if label_merch_cut > 0 then
        perform public.credit_label_merch_revenue_atomic(active_360.label_id,label_merch_cut,
          format('360 Deal gig merch cut: gig %s',p_gig_id),active_360.id,g.band_id);
        band_merch_revenue := greatest(0, merch_gross-label_merch_cut);
      end if;
    end if;

    if band_merch_revenue > 0 then
      perform public.finance_credit_owner('band',g.band_id,band_merch_revenue::bigint*100,'merchandise_revenue',
        'Gig merchandise sales','gig-merch:'||p_gig_id::text,null,
        jsonb_build_object('gigId',p_gig_id,'settlementId',s.id,'grossRevenue',merch_gross,'labelCut',label_merch_cut,'itemsSold',merch_count));
      update public.bands set band_balance=coalesce(band_balance,0)+band_merch_revenue where id=g.band_id;
    end if;
  end if;

  select count(*),coalesce(avg(skill_level),0) into bartender_count,bartender_skill from public.venue_staff where venue_id=v.id and role='bartender';
  select coalesce(max(upgrade_level),0) into bar_level from public.venue_upgrades where venue_id=v.id and upgrade_type='bar';
  if coalesce(v.alcohol_license,false) and (bartender_count>0 or coalesce(v.staff_count,0)>0) then
    drinks:=least(coalesce(o.actual_attendance,0), floor((case when bartender_count>0 then bartender_count*(35+15*bartender_skill) else 35 end) * (1+bar_level*.15))::integer,
      floor(coalesce(o.actual_attendance,0) * least(.8,.18+coalesce(p_performance_rating,0)/100))::integer);
    v_bar_gross:=greatest(0,drinks)*(4+least(3,bar_level));
  end if;
  select * into booking from public.venue_bookings where gig_id=p_gig_id and status='confirmed' order by created_at desc limit 1;
  if booking.id is not null then venue_pct:=greatest(0,least(100,coalesce(booking.bar_revenue_share_pct,100))); end if;
  venue_take:=round(v_bar_gross*venue_pct/100); band_take:=v_bar_gross-venue_take;
  if venue_take>0 and v.company_id is not null then
    perform public.finance_credit_owner('company',v.company_id,venue_take::bigint*100,'company_revenue','Gig bar revenue','gig-bar:'||p_gig_id::text,null,jsonb_build_object('gigId',p_gig_id,'settlementId',s.id,'venueId',v.id));
    update public.companies set balance=coalesce(balance,0)+venue_take where id=v.company_id;
    insert into public.venue_financial_transactions(venue_id,transaction_type,amount,description,related_booking_id,gig_settlement_id)
    values(v.id,'bar_revenue',venue_take,'Authoritative gig bar settlement',booking.id,s.id) returning id into tx;
  end if;
  if band_take>0 and booking.id is not null then
    perform public.finance_credit_owner('band',g.band_id,band_take::bigint*100,'gig_payment','Contracted gig bar share','gig-bar-band:'||p_gig_id::text,null,jsonb_build_object('gigId',p_gig_id,'settlementId',s.id,'bookingId',booking.id));
    update public.bands set band_balance=coalesce(band_balance,0)+band_take where id=g.band_id;
  end if;

  snapshot:=jsonb_build_object('formulaVersion','gig-commerce-v3','settlementId',s.id,
    'merchandise',jsonb_build_object('itemsSold',merch_count,'grossRevenue',merch_gross,'cost',merch_cost,'labelCut',label_merch_cut,'bandRevenue',band_merch_revenue,'lines',lines,'owner','band'),
    'bar',jsonb_build_object('drinksServed',drinks,'grossRevenue',v_bar_gross,'venueRevenue',venue_take,'bandEntitlement',band_take,'owner',case when band_take>0 then 'shared_by_confirmed_booking' else 'venue' end,'shareSource',case when booking.id is null then 'venue_fallback' else 'confirmed_booking' end));
  update public.gig_outcomes set merch_items_sold=merch_count,merch_revenue=merch_gross where id=o.id;
  update public.gig_commerce_settlements set formula_version='gig-commerce-v3',merchandise_items=merch_count,merchandise_gross=merch_gross,merchandise_cost=merch_cost,bar_drinks_served=drinks,bar_gross=v_bar_gross,venue_bar_revenue=venue_take,band_bar_revenue=band_take,booking_id=booking.id,venue_transaction_id=tx,commerce_snapshot=snapshot,settled_at=now() where id=s.id;
  return snapshot;
end $$;
