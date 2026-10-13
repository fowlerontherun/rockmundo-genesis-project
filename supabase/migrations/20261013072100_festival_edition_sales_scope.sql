-- Current edition ticket sales must never include previous years of an annual festival.
CREATE OR REPLACE FUNCTION public.get_festival_ticket_sales_summary_for_launch(
  p_festival_company_id uuid,p_festival_launch_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.festival_launch_can_manage(p_festival_company_id) OR NOT EXISTS(
    SELECT 1 FROM public.festival_launches l WHERE l.id=p_festival_launch_id AND l.festival_company_id=p_festival_company_id
  ) THEN RAISE EXCEPTION 'festival_launch_not_ready'; END IF;
  RETURN (
    SELECT jsonb_build_object(
       'ticketsSold',coalesce(sum(s.quantity),0),
       'grossMinor',coalesce(sum(s.total_minor),0),
       'currency',coalesce(max(s.currency_code),'GBP'),
       'orders',count(*))
    FROM public.festival_ticket_sales s
    WHERE s.festival_launch_id=p_festival_launch_id AND s.status='completed'
  );
END; $$;
REVOKE ALL ON FUNCTION public.get_festival_ticket_sales_summary_for_launch(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_ticket_sales_summary_for_launch(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_festival_player_ticket_sales_breakdown_for_launch(
  p_festival_company_id uuid,p_festival_launch_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
 IF NOT public.festival_launch_can_manage(p_festival_company_id) OR NOT EXISTS(
   SELECT 1 FROM public.festival_launches l WHERE l.id=p_festival_launch_id AND l.festival_company_id=p_festival_company_id
 ) THEN RAISE EXCEPTION 'festival_launch_not_ready'; END IF;
 RETURN (
 SELECT jsonb_build_object(
   'source','player_purchase',
   'ticketsSold',coalesce(sum(s.quantity),0),
   'orders',count(s.id),
   'uniqueBuyers',count(DISTINCT s.buyer_profile_id),
   'grossMinor',coalesce(sum(s.total_minor),0),
   'subtotalMinor',coalesce(sum(s.subtotal_minor),0),
   'feeMinor',coalesce(sum(s.fee_minor),0),
   'taxMinor',coalesce(sum(s.tax_minor),0),
   'byProduct',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'productId',x.festival_ticket_product_id,'name',x.product_name,
        'ticketsSold',x.tickets_sold,'orders',x.orders,'grossMinor',x.gross_minor
      ) ORDER BY x.product_name)
      FROM (
        SELECT s2.festival_ticket_product_id,p.name AS product_name,
          sum(s2.quantity) AS tickets_sold,count(*) AS orders,sum(s2.total_minor) AS gross_minor
        FROM public.festival_ticket_sales s2
        JOIN public.festival_ticket_products p ON p.id=s2.festival_ticket_product_id
        WHERE s2.festival_launch_id=p_festival_launch_id AND s2.status='completed'
        GROUP BY s2.festival_ticket_product_id,p.name
      ) x
    ),'[]'::jsonb))
 FROM public.festival_ticket_sales s
 WHERE s.festival_launch_id=p_festival_launch_id AND s.status='completed'
 );
END; $$;
REVOKE ALL ON FUNCTION public.get_festival_player_ticket_sales_breakdown_for_launch(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_player_ticket_sales_breakdown_for_launch(uuid,uuid) TO authenticated;
