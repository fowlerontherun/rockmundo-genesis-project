-- Public festival previews use confirmed edition bookings and paid admission sales.
-- Do not expose private offers, artist fees or owner-only finance projections.
CREATE OR REPLACE FUNCTION public.festival_public_projection_v2(p_festival_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_base jsonb;
  v_edition_id uuid;
  v_launch_id uuid;
  v_timetable jsonb := '[]'::jsonb;
  v_lineup jsonb := '[]'::jsonb;
  v_sold bigint := 0;
  v_available bigint := 0;
  v_capacity bigint := 0;
BEGIN
  v_base := public.festival_public_projection(p_festival_company_id);
  IF v_base IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_launch_id
  FROM public.festival_launches
  WHERE festival_company_id = p_festival_company_id;

  -- Scope the preview to the edition whose public dates were launched.
  SELECT e.id INTO v_edition_id
  FROM public.festival_editions_v2 e
  WHERE e.festival_company_id = p_festival_company_id
    AND e.status NOT IN ('cancelled', 'cancelled_before_event')
    AND e.starts_on = ((v_base->>'startsAt')::timestamptz)::date
  ORDER BY e.edition_year DESC, e.created_at DESC
  LIMIT 1;

  IF v_edition_id IS NULL THEN
    RETURN v_base || jsonb_build_object('lineup', '[]'::jsonb, 'ticketSales', NULL);
  END IF;

  -- Existing compatibility timetable continues to power the attendee experience.
  -- It is provisional; only publicly released slots have confirmed times below.
  v_timetable := public._festival_simplified_timetable_projection(v_edition_id);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'artistName', coalesce(bd.name, pr.display_name, pr.username, 'Confirmed guest act'),
    'artistType', CASE
      WHEN b.band_id IS NOT NULL THEN 'band'
      WHEN b.artist_profile_id IS NOT NULL THEN 'player'
      ELSE 'npc'
    END,
    'genre', bd.genre,
    'billingPosition', coalesce(b.billing_position, 'support'),
    'festivalDate', coalesce(published_slot.start_time::date, b.provisional_date),
    'stageName', published_slot.stage_name,
    'startsAt', published_slot.start_time,
    'endsAt', published_slot.end_time
  ) ORDER BY b.provisional_date NULLS LAST,
    CASE b.billing_position
      WHEN 'headliner' THEN 0 WHEN 'sub_headliner' THEN 1
      WHEN 'featured' THEN 2 WHEN 'special_guest' THEN 3
      WHEN 'support' THEN 4 ELSE 5
    END, b.confirmed_at, b.id), '[]'::jsonb)
  INTO v_lineup
  FROM public.festival_artist_bookings b
  JOIN public.festival_artist_programmes ap
    ON ap.id = b.festival_artist_programme_id
  LEFT JOIN public.bands bd ON bd.id = b.band_id
  LEFT JOIN public.profiles pr ON pr.id = b.artist_profile_id
  LEFT JOIN LATERAL (
    SELECT slot.start_time, slot.end_time,
           coalesce(nullif(stage.public_name, ''), stage.stage_name) AS stage_name
    FROM public.festival_stage_slots slot
    JOIN public.festival_stages stage ON stage.id = slot.stage_id
    WHERE slot.edition_id = v_edition_id
      AND b.band_id IS NOT NULL AND slot.band_id = b.band_id
      AND slot.public_status IN ('published', 'public')
      AND slot.status IN ('booked', 'confirmed', 'performing', 'completed')
      AND slot.start_time IS NOT NULL
    ORDER BY slot.start_time, slot.id
    LIMIT 1
  ) published_slot ON true
  WHERE ap.festival_edition_id = v_edition_id
    AND ap.festival_company_id = p_festival_company_id
    AND b.status IN ('confirmed', 'awaiting_schedule', 'scheduled');

  -- Paid admissions only; add-ons are not attendees and cancelled/refunded
  -- purchases do not remain in the sales total.
  SELECT coalesce(sum(
    CASE
      WHEN sale.status = 'completed' THEN sale.quantity
      WHEN sale.status = 'partially_refunded' THEN (
        SELECT count(*) FROM public.festival_issued_tickets issued
        WHERE issued.festival_ticket_sale_id = sale.id
          AND issued.status IN ('valid', 'used')
      )
      ELSE 0
    END
  ), 0)
  INTO v_sold
  FROM public.festival_ticket_sales sale
  JOIN public.festival_ticket_products product
    ON product.id = sale.festival_ticket_product_id
  JOIN public.festival_ticket_plans plan
    ON plan.id = product.festival_ticket_plan_id
  WHERE sale.festival_launch_id = v_launch_id
    AND plan.festival_edition_id = v_edition_id
    AND product.product_class = 'admission';

  SELECT coalesce(sum(product.capacity_limit), 0)
  INTO v_capacity
  FROM public.festival_ticket_products product
  JOIN public.festival_ticket_plans plan
    ON plan.id = product.festival_ticket_plan_id
  WHERE plan.festival_edition_id = v_edition_id
    AND product.product_class = 'admission'
    AND coalesce(product.active, true);

  SELECT coalesce(sum((item->>'availableQuantity')::bigint), 0)
  INTO v_available
  FROM jsonb_array_elements(coalesce(v_base->'ticketProducts', '[]'::jsonb)) item
  WHERE item->>'productClass' = 'admission';

  RETURN v_base || jsonb_build_object(
    'timetable', coalesce(v_timetable, '[]'::jsonb),
    'lineup', coalesce(v_lineup, '[]'::jsonb),
    'ticketSales', jsonb_build_object(
      'admissionTicketsSold', v_sold,
      'admissionTicketsAvailable', v_available,
      'admissionTicketAllocation', v_capacity
    )
  );
END;
$function$;

-- The definer helper is internal; public access remains via the already
-- visibility-checked get_public_festival and get_public_festival_directory RPCs.
REVOKE ALL ON FUNCTION public.festival_public_projection_v2(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.festival_public_projection_v2(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
