-- PR B6 hardening: expose only the organiser-safe runtime vendor assignment queue and canonical commerce currency.
-- This keeps the existing B6 aggregate narrow while completing the vendor-to-runtime workflow.

CREATE OR REPLACE FUNCTION public.get_festival_edition_vendor_assignment_queue(p_edition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  actor uuid:=public._festival_b6_actor();
  bridge public.festival_edition_commerce_bridges%ROWTYPE;
  runtime public.festival_runtime_sessions%ROWTYPE;
  currency text;
BEGIN
  IF actor IS NULL OR NOT public._festival_b6_edition_authorised(p_edition_id,actor) THEN
    RAISE EXCEPTION 'festival_commerce_forbidden';
  END IF;

  SELECT * INTO bridge
  FROM public.festival_edition_commerce_bridges
  WHERE edition_id=p_edition_id;

  IF bridge.edition_id IS NULL THEN
    RETURN jsonb_build_object(
      'editionId',p_edition_id,
      'linked',false,
      'currencyCode',NULL,
      'sales','[]'::jsonb
    );
  END IF;

  SELECT * INTO runtime
  FROM public.festival_runtime_sessions
  WHERE festival_launch_id=bridge.festival_launch_id;

  SELECT coalesce(
    (SELECT p.currency
       FROM public.festival_public_ticket_products p
      WHERE p.festival_launch_id=bridge.festival_launch_id
      ORDER BY p.sort_order,p.id
      LIMIT 1),
    (SELECT v.currency_code
       FROM public.festival_runtime_vendor_sales v
      WHERE v.runtime_session_id=runtime.id
      ORDER BY v.id
      LIMIT 1),
    (SELECT s.currency_code
       FROM public.festival_financial_settlements s
      WHERE s.runtime_session_id=runtime.id
      LIMIT 1),
    'USD'
  ) INTO currency;

  RETURN jsonb_build_object(
    'editionId',p_edition_id,
    'linked',true,
    'festivalLaunchId',bridge.festival_launch_id,
    'runtimeSessionId',runtime.id,
    'currencyCode',currency,
    'sales',CASE WHEN runtime.id IS NULL THEN '[]'::jsonb ELSE coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',v.id,
        'runtimeDayId',v.runtime_day_id,
        'category',v.category,
        'productName',v.product_name,
        'currencyCode',v.currency_code,
        'openingStock',v.opening_stock,
        'remainingStock',v.remaining_stock,
        'unitsSold',v.units_sold,
        'grossRevenueMinor',v.gross_revenue_minor,
        'taxLiabilityMinor',v.tax_liability_minor,
        'costBasisMinor',v.cost_basis_minor,
        'status',v.status,
        'version',v.version,
        'vendorStallAssignmentId',v.vendor_stall_assignment_id,
        'assignedStallName',a.stall_name,
        'assignedVendorName',a.vendor_name,
        'assignmentActive',a.active
      ) ORDER BY d.festival_date,v.category,v.product_name,v.id)
      FROM public.festival_runtime_vendor_sales v
      JOIN public.festival_runtime_days d ON d.id=v.runtime_day_id
      LEFT JOIN public.festival_vendor_stall_assignments a ON a.id=v.vendor_stall_assignment_id
      WHERE v.runtime_session_id=runtime.id
    ),'[]'::jsonb) END
  );
END $$;

REVOKE ALL ON FUNCTION public.get_festival_edition_vendor_assignment_queue(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_festival_edition_vendor_assignment_queue(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_festival_edition_vendor_assignment_queue(uuid) IS
  'B6 permission-checked organiser projection for assigning configured stalls to open canonical runtime vendor sales. Closed sales remain immutable.';
