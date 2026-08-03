
CREATE OR REPLACE FUNCTION public.purchase_festival_tickets(
  p_festival_launch_id uuid, p_ticket_product_id uuid, p_quantity integer, p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_launch public.festival_launches;
  v_product jsonb;
  v_sale public.festival_ticket_sales;
  v_unit bigint; v_fee bigint; v_tax bigint; v_total bigint; v_currency text;
  v_available integer; v_limit integer; v_cash bigint; i integer;
  v_cost_major bigint;
  v_tickets jsonb := '[]'::jsonb; v_ticket public.festival_issued_tickets;
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'festival_ticket_purchase_stale'; END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN RAISE EXCEPTION 'festival_ticket_quantity_invalid'; END IF;

  SELECT * INTO v_sale FROM public.festival_ticket_sales
   WHERE buyer_profile_id = v_profile AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'saleId', t.festival_ticket_sale_id, 'productId', t.festival_ticket_product_id,
      'festivalName', coalesce(l.snapshot->>'name',''), 'festivalSlug', coalesce(l.public_slug,''),
      'ticketReference', t.ticket_reference, 'ticketType', tp.ticket_type, 'productClass', tp.product_class,
      'accessStartDate', coalesce(tp.valid_from_date, current_date), 'accessEndDate', coalesce(tp.valid_to_date, current_date),
      'ownerProfileId', t.owner_profile_id, 'holderProfileId', t.holder_profile_id, 'status', t.status,
      'issuedAt', t.issued_at)), '[]'::jsonb)
      INTO v_tickets
    FROM public.festival_issued_tickets t
    JOIN public.festival_ticket_products tp ON tp.id = t.festival_ticket_product_id
    JOIN public.festival_launches l ON l.id = t.festival_launch_id
    WHERE t.festival_ticket_sale_id = v_sale.id;
    RETURN jsonb_build_object('saleId', v_sale.id, 'purchaseRequestId', v_sale.id, 'status','completed',
      'quantity', v_sale.quantity, 'subtotalMinor', v_sale.subtotal_minor, 'feeMinor', v_sale.fee_minor,
      'taxMinor', v_sale.tax_minor, 'totalMinor', v_sale.total_minor, 'currency', v_sale.currency_code,
      'inventoryVersion', 1, 'availableQuantity', 0, 'tickets', v_tickets);
  END IF;

  SELECT * INTO v_launch FROM public.festival_launches WHERE id = p_festival_launch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_ticket_product_unavailable'; END IF;
  IF v_launch.launch_status = 'sales_paused' THEN RAISE EXCEPTION 'festival_ticket_sales_paused'; END IF;
  IF v_launch.launch_status = 'sales_closed' THEN RAISE EXCEPTION 'festival_ticket_sales_closed'; END IF;
  IF v_launch.launch_status <> 'tickets_on_sale' THEN RAISE EXCEPTION 'festival_ticket_sales_not_open'; END IF;

  SELECT p INTO v_product FROM jsonb_array_elements(
    public.festival_public_projection(v_launch.festival_company_id)->'ticketProducts') p
  WHERE (p->>'id')::uuid = p_ticket_product_id;
  IF v_product IS NULL THEN RAISE EXCEPTION 'festival_ticket_product_unavailable'; END IF;

  v_unit := (v_product->>'priceMinor')::bigint;
  v_fee := (v_product->>'feeMinor')::bigint;
  v_tax := (v_product->>'taxMinor')::bigint;
  v_currency := v_product->>'currency';
  v_available := (v_product->>'availableQuantity')::integer;
  v_limit := (v_product->>'purchaseLimit')::integer;
  IF p_quantity > v_limit THEN RAISE EXCEPTION 'festival_ticket_purchase_limit_exceeded'; END IF;
  IF v_available < p_quantity THEN RAISE EXCEPTION 'festival_ticket_sold_out'; END IF;
  v_total := (v_unit + v_fee + v_tax) * p_quantity;
  v_cost_major := GREATEST(1, round(v_total / 100.0)::bigint);

  SELECT cash INTO v_cash FROM public.profiles WHERE id = v_profile FOR UPDATE;
  IF coalesce(v_cash, 0) < v_cost_major THEN RAISE EXCEPTION 'festival_ticket_insufficient_funds'; END IF;
  UPDATE public.profiles SET cash = cash - v_cost_major WHERE id = v_profile;

  INSERT INTO public.festival_ticket_sales (festival_launch_id, festival_ticket_product_id, buyer_profile_id,
    quantity, subtotal_minor, fee_minor, tax_minor, total_minor, currency_code, status, idempotency_key)
  VALUES (p_festival_launch_id, p_ticket_product_id, v_profile, p_quantity,
    v_unit * p_quantity, v_fee * p_quantity, v_tax * p_quantity, v_total, v_currency, 'completed', p_idempotency_key)
  RETURNING * INTO v_sale;

  FOR i IN 1..p_quantity LOOP
    INSERT INTO public.festival_issued_tickets (festival_launch_id, festival_ticket_sale_id, festival_ticket_product_id,
      ticket_reference, owner_profile_id, holder_profile_id)
    VALUES (p_festival_launch_id, v_sale.id, p_ticket_product_id,
      upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 12)), v_profile, v_profile)
    RETURNING * INTO v_ticket;
    v_tickets := v_tickets || jsonb_build_object(
      'id', v_ticket.id, 'saleId', v_sale.id, 'productId', p_ticket_product_id,
      'festivalName', coalesce(v_launch.snapshot->>'name',''), 'festivalSlug', coalesce(v_launch.public_slug,''),
      'ticketReference', v_ticket.ticket_reference, 'ticketType', v_product->>'ticketType',
      'productClass', v_product->>'productClass',
      'accessStartDate', v_product->>'accessStartDate', 'accessEndDate', v_product->>'accessEndDate',
      'ownerProfileId', v_profile, 'holderProfileId', v_profile, 'status', 'valid', 'issuedAt', v_ticket.issued_at);
  END LOOP;

  RETURN jsonb_build_object('saleId', v_sale.id, 'purchaseRequestId', v_sale.id, 'status','completed',
    'quantity', p_quantity, 'subtotalMinor', v_unit * p_quantity, 'feeMinor', v_fee * p_quantity,
    'taxMinor', v_tax * p_quantity, 'totalMinor', v_total, 'currency', v_currency,
    'inventoryVersion', 1, 'availableQuantity', v_available - p_quantity, 'tickets', v_tickets);
END; $$;
GRANT EXECUTE ON FUNCTION public.purchase_festival_tickets(uuid, uuid, integer, uuid) TO authenticated;
