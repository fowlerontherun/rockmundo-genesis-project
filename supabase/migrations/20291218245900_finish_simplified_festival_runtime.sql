-- Finish the simplified annual Festival Run flow.
-- New company-owned editions use an edition-native generated schedule snapshot rather than
-- materialising legacy Festival/schedule rows. Historical schedule-backed runtimes remain valid.

ALTER TABLE public.festival_edition_runtimes
  ALTER COLUMN schedule_revision_id DROP NOT NULL;
ALTER TABLE public.festival_edition_runtimes
  ADD COLUMN IF NOT EXISTS schedule_source text NOT NULL DEFAULT 'legacy_revision'
    CHECK (schedule_source IN ('legacy_revision', 'simplified_generated')),
  ADD COLUMN IF NOT EXISTS generated_schedule jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(generated_schedule) = 'object');

ALTER TABLE public.festival_edition_settlements
  ALTER COLUMN schedule_revision_id DROP NOT NULL;

ALTER TABLE public.festival_edition_runtimes
  DROP CONSTRAINT IF EXISTS festival_edition_runtime_schedule_source_check;
ALTER TABLE public.festival_edition_runtimes
  ADD CONSTRAINT festival_edition_runtime_schedule_source_check CHECK (
    (schedule_source = 'legacy_revision' AND schedule_revision_id IS NOT NULL)
    OR
    (schedule_source = 'simplified_generated'
      AND schedule_revision_id IS NULL
      AND generated_schedule ? 'stages'
      AND generated_schedule ? 'items')
  ) NOT VALID;
ALTER TABLE public.festival_edition_runtimes
  VALIDATE CONSTRAINT festival_edition_runtime_schedule_source_check;

-- Runtime viewing and execution should follow the normal company-management authority model.
CREATE OR REPLACE FUNCTION public._festival_edition_runtime_authorised(p_company uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.festival_companies company
    WHERE company.id = p_company
      AND (
        company.owner_profile_id = public._festival_edition_runtime_actor()
        OR public.can_manage_company(company.company_id)
      )
  ) OR public.is_admin(auth.uid())
$$;

CREATE OR REPLACE FUNCTION public._simplified_festival_run_readiness(
  p_festival_company_id uuid,
  p_festival_edition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edition public.festival_editions_v2%ROWTYPE;
  site public.festival_site_plans%ROWTYPE;
  ticket public.festival_ticket_plans%ROWTYPE;
  programme public.festival_artist_programmes%ROWTYPE;
  blockers jsonb := '[]'::jsonb;
  stage_count integer := 0;
  booking_count integer := 0;
  active_licence jsonb;
  max_acts_per_day integer := 0;
  physical_slots integer := 0;
  already_run boolean := false;
  is_admin boolean := coalesce(public.is_admin(auth.uid()), false);
BEGIN
  SELECT * INTO edition
  FROM public.festival_editions_v2
  WHERE id = p_festival_edition_id
    AND festival_company_id = p_festival_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FESTIVAL_RUNTIME_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO site
  FROM public.festival_site_plans
  WHERE festival_edition_id = edition.id;
  SELECT * INTO ticket
  FROM public.festival_ticket_plans
  WHERE festival_edition_id = edition.id;
  SELECT * INTO programme
  FROM public.festival_artist_programmes
  WHERE festival_edition_id = edition.id;

  IF site.id IS NOT NULL THEN
    SELECT count(*) INTO stage_count
    FROM public.festival_site_plan_stages stage
    WHERE stage.festival_site_plan_id = site.id
      AND stage.status = 'ready';
  END IF;

  IF programme.id IS NOT NULL THEN
    SELECT count(*) INTO booking_count
    FROM public.festival_artist_bookings booking
    WHERE booking.festival_artist_programme_id = programme.id
      AND booking.status NOT IN ('cancelled', 'artist_withdrawn', 'festival_cancelled');
  END IF;

  SELECT public._festival_licence_progress_result(p_festival_company_id, now())
  INTO active_licence;
  max_acts_per_day := coalesce((active_licence #>> '{current,maxActsPerDay}')::integer, 0);
  physical_slots := greatest(0, stage_count * greatest(1, coalesce(edition.duration_days, 1)) * 4);
  already_run := EXISTS (
    SELECT 1 FROM public.festival_edition_runtimes runtime
    WHERE runtime.edition_id = edition.id
  );

  IF edition.status = 'cancelled' THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_cancelled',
      'message', 'This annual Festival was cancelled and cannot be run.'
    ));
  ELSIF edition.status = 'completed' AND NOT already_run THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_already_completed',
      'message', 'This annual Festival is already completed.'
    ));
  END IF;

  IF edition.planning_status <> 'ready' OR edition.readiness_score < 100 THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_plan_not_ready',
      'message', 'Finish the annual Plan before running the Festival.'
    ));
  END IF;
  IF site.id IS NULL OR site.status <> 'ready_for_ticketing' OR stage_count = 0 THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_generated_site_not_ready',
      'message', 'The automatic site and stage projection is not ready. Re-save the annual Plan.'
    ));
  END IF;
  IF ticket.id IS NULL OR ticket.status <> 'ready_for_artist_planning' THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_tickets_not_ready',
      'message', 'Finish Tickets & budget before running the Festival.'
    ));
  END IF;
  IF programme.id IS NULL OR booking_count = 0 THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_lineup_required',
      'message', 'Confirm at least one player band or solo artist before running the Festival. The game will fill remaining slots with NPC acts.'
    ));
  END IF;
  IF coalesce((active_licence #>> '{current,active}')::boolean, false) IS NOT TRUE THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_licence_required',
      'message', 'An active Festival licence is required.'
    ));
  END IF;
  IF booking_count > physical_slots AND physical_slots > 0 THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_lineup_over_capacity',
      'message', 'There are more confirmed acts than the generated stages can schedule. Reduce the confirmed line-up or increase Festival scale.'
    ));
  END IF;
  IF max_acts_per_day > 0
     AND booking_count > max_acts_per_day * greatest(1, coalesce(edition.duration_days, 1)) THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_licence_act_limit_exceeded',
      'message', 'The confirmed line-up exceeds the active licence act limit.'
    ));
  END IF;
  IF edition.starts_on IS NULL OR edition.ends_on IS NULL THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_dates_required',
      'message', 'Festival dates are required.'
    ));
  ELSIF NOT is_admin AND current_date < edition.starts_on THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_not_started_yet',
      'message', 'This Festival can be run from ' || to_char(edition.starts_on, 'DD Mon YYYY') || '.'
    ));
  END IF;

  RETURN jsonb_build_object(
    'festivalCompanyId', p_festival_company_id,
    'festivalEditionId', edition.id,
    'editionVersion', edition.version,
    'editionStatus', edition.status,
    'planningStatus', edition.planning_status,
    'readinessScore', edition.readiness_score,
    'scheduledFor', edition.starts_on,
    'stageCount', stage_count,
    'confirmedActs', booking_count,
    'npcFillEnabled', true,
    'activeLicence', active_licence->'current',
    'alreadyRun', already_run,
    'canRun', already_run OR jsonb_array_length(blockers) = 0,
    'blockers', CASE WHEN already_run THEN '[]'::jsonb ELSE blockers END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_simplified_festival_run_readiness(
  p_festival_company_id uuid,
  p_festival_edition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL
     OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'FESTIVAL_RUNTIME_ACCESS_DENIED' USING ERRCODE = 'P0001';
  END IF;
  RETURN public._simplified_festival_run_readiness(
    p_festival_company_id,
    p_festival_edition_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.run_simplified_festival_edition(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_expected_edition_version integer,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  edition public.festival_editions_v2%ROWTYPE;
  site public.festival_site_plans%ROWTYPE;
  ticket public.festival_ticket_plans%ROWTYPE;
  programme public.festival_artist_programmes%ROWTYPE;
  runtime public.festival_edition_runtimes%ROWTYPE;
  upgrade_snapshot public.festival_edition_upgrade_snapshots%ROWTYPE;
  readiness jsonb;
  schedule jsonb := '{}'::jsonb;
  configuration jsonb := '{}'::jsonb;
  approved_financial_evidence jsonb := '[]'::jsonb;
  weather jsonb := '[]'::jsonb;
  story jsonb := '[]'::jsonb;
  stage_count integer := 0;
  booking_count integer := 0;
  physical_slots integer := 0;
  licence_max_acts integer := 0;
  target_slots integer := 0;
  capacity integer := 0;
  expected_tickets bigint := 0;
  admitted integer := 0;
  ticket_price_minor bigint := 0;
  ticket_gross_minor bigint := 0;
  refund_minor bigint := 0;
  food_minor bigint := 0;
  merchandise_minor bigint := 0;
  artist_cost_minor bigint := 0;
  operating_cost_minor bigint := 0;
  audience_score integer := 0;
  artist_score integer := 0;
  weather_roll integer := 0;
  seed text;
  evidence_hash text;
  runtime_digest text;
  stage_item jsonb;
  event_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL
     OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'FESTIVAL_RUNTIME_ACCESS_DENIED' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_festival_edition_id::text, 0));

  SELECT * INTO runtime
  FROM public.festival_edition_runtimes existing
  WHERE existing.edition_id = p_festival_edition_id
  ORDER BY existing.created_at DESC
  LIMIT 1;
  IF FOUND THEN
    RETURN public.get_festival_edition_runtime_control_room(
      p_festival_company_id,
      p_festival_edition_id
    ) || jsonb_build_object('idempotent', true);
  END IF;

  SELECT * INTO edition
  FROM public.festival_editions_v2
  WHERE id = p_festival_edition_id
    AND festival_company_id = p_festival_company_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FESTIVAL_RUNTIME_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF edition.version <> p_expected_edition_version THEN
    RAISE EXCEPTION 'FESTIVAL_RUNTIME_VERSION_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  readiness := public._simplified_festival_run_readiness(
    p_festival_company_id,
    p_festival_edition_id
  );
  IF NOT coalesce((readiness->>'canRun')::boolean, false) THEN
    RAISE EXCEPTION 'FESTIVAL_SIMPLIFIED_RUN_BLOCKED'
      USING ERRCODE = 'P0001', DETAIL = readiness::text;
  END IF;

  SELECT * INTO site
  FROM public.festival_site_plans
  WHERE festival_edition_id = edition.id;
  SELECT * INTO ticket
  FROM public.festival_ticket_plans
  WHERE festival_edition_id = edition.id;
  SELECT * INTO programme
  FROM public.festival_artist_programmes
  WHERE festival_edition_id = edition.id;

  SELECT count(*) INTO stage_count
  FROM public.festival_site_plan_stages stage
  WHERE stage.festival_site_plan_id = site.id
    AND stage.status = 'ready';
  SELECT count(*) INTO booking_count
  FROM public.festival_artist_bookings booking
  WHERE booking.festival_artist_programme_id = programme.id
    AND booking.status NOT IN ('cancelled', 'artist_withdrawn', 'festival_cancelled');

  licence_max_acts := coalesce((readiness #>> '{activeLicence,maxActsPerDay}')::integer, stage_count * 4);
  physical_slots := stage_count * greatest(1, edition.duration_days) * 4;
  target_slots := least(
    physical_slots,
    greatest(
      booking_count,
      least(licence_max_acts * greatest(1, edition.duration_days), physical_slots)
    )
  );
  capacity := greatest(1, coalesce(edition.expected_capacity, site.usable_capacity, 1));

  WITH stages AS (
    SELECT
      stage.id,
      stage.name,
      stage.stage_type,
      stage.capacity,
      stage.sort_order,
      row_number() OVER (ORDER BY stage.sort_order, stage.id) AS stage_number
    FROM public.festival_site_plan_stages stage
    WHERE stage.festival_site_plan_id = site.id
      AND stage.status = 'ready'
  ), bookings AS (
    SELECT
      booking.*,
      coalesce(profile.display_name, profile.username, band.name, 'Guest Artist') AS artist_name,
      row_number() OVER (
        ORDER BY
          CASE booking.billing_position
            WHEN 'emerging' THEN 1
            WHEN 'support' THEN 2
            WHEN 'special_guest' THEN 3
            WHEN 'featured' THEN 4
            WHEN 'sub_headliner' THEN 5
            WHEN 'headliner' THEN 6
            ELSE 3
          END,
          booking.confirmed_at,
          booking.id
      ) AS booking_number
    FROM public.festival_artist_bookings booking
    LEFT JOIN public.profiles profile ON profile.id = booking.artist_profile_id
    LEFT JOIN public.bands band ON band.id = booking.band_id
    WHERE booking.festival_artist_programme_id = programme.id
      AND booking.status NOT IN ('cancelled', 'artist_withdrawn', 'festival_cancelled')
  ), grid AS (
    SELECT
      slot_number,
      ((slot_number - 1) / (stage_count * 4))::integer AS day_index,
      (((slot_number - 1) % stage_count) + 1)::integer AS stage_number,
      (((slot_number - 1) / stage_count) % 4)::integer AS time_index
    FROM generate_series(1, target_slots) slot_number
  ), scheduled AS (
    SELECT
      grid.slot_number,
      grid.day_index,
      grid.time_index,
      stage.id AS stage_id,
      stage.name AS stage_name,
      stage.stage_type,
      stage.capacity AS stage_capacity,
      booking.id AS booking_id,
      coalesce(booking.artist_type, 'npc') AS artist_type,
      coalesce(
        booking.artist_profile_id,
        booking.band_id,
        booking.npc_artist_id
      ) AS artist_id,
      coalesce(
        booking.artist_name,
        'RockMundo ' || initcap(coalesce(edition.vibe, 'Festival')) || ' Act ' || grid.slot_number::text
      ) AS artist_name,
      coalesce(booking.billing_position, CASE WHEN grid.time_index = 3 THEN 'featured' ELSE 'support' END) AS billing_position,
      coalesce(booking.set_minutes, CASE WHEN grid.time_index = 3 THEN 60 ELSE 45 END) AS set_minutes,
      (edition.starts_on + grid.day_index)::date AS festival_date,
      (
        ((edition.starts_on + grid.day_index)::text || ' ' ||
          (time '13:00' + grid.time_index * interval '2 hours')::text)::timestamp
        AT TIME ZONE coalesce(site.timezone, 'UTC')
      ) AS starts_at
    FROM grid
    JOIN stages stage ON stage.stage_number = grid.stage_number
    LEFT JOIN bookings booking ON booking.booking_number = grid.slot_number
  )
  SELECT jsonb_build_object(
    'version', 1,
    'source', 'simplified_generated',
    'festivalEditionId', edition.id,
    'generatedAt', now(),
    'stages', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', stage.id,
        'name', stage.name,
        'stageType', stage.stage_type,
        'capacity', stage.capacity,
        'sortOrder', stage.sort_order
      ) ORDER BY stage.sort_order), '[]'::jsonb)
      FROM stages stage
    ),
    'items', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', CASE WHEN scheduled.booking_id IS NULL
          THEN 'npc:' || edition.id::text || ':' || scheduled.slot_number::text
          ELSE 'booking:' || scheduled.booking_id::text END,
        'sourceBookingId', scheduled.booking_id,
        'stageId', scheduled.stage_id,
        'stageName', scheduled.stage_name,
        'festivalDate', scheduled.festival_date,
        'startsAt', scheduled.starts_at,
        'endsAt', scheduled.starts_at + make_interval(mins => scheduled.set_minutes),
        'setMinutes', scheduled.set_minutes,
        'artistType', scheduled.artist_type,
        'artistId', scheduled.artist_id,
        'artistName', scheduled.artist_name,
        'billingPosition', scheduled.billing_position,
        'headline', scheduled.billing_position IN ('headliner', 'sub_headliner')
      ) ORDER BY scheduled.festival_date, scheduled.starts_at, scheduled.stage_name), '[]'::jsonb)
      FROM scheduled
    )
  ) INTO schedule;

  SELECT coalesce(product.price_minor, 0)
  INTO ticket_price_minor
  FROM public.festival_ticket_products product
  WHERE product.festival_ticket_plan_id = ticket.id
    AND product.active
    AND product.product_class = 'admission'
  ORDER BY product.sale_priority, product.id
  LIMIT 1;
  ticket_price_minor := coalesce(ticket_price_minor, 0);

  expected_tickets := greatest(
    0,
    coalesce(
      nullif(ticket.forecast->>'expectedTicketsSold', '')::bigint,
      round(capacity::numeric * ticket.expected_sell_through_basis_points / 10000)::bigint
    )
  );
  ticket_gross_minor := greatest(
    0,
    coalesce(
      nullif(ticket.forecast->>'expectedGrossTicketReceiptsMinor', '')::bigint,
      expected_tickets * ticket_price_minor
    )
  );
  refund_minor := greatest(
    0,
    coalesce(
      nullif(ticket.forecast->>'expectedRefundsMinor', '')::bigint,
      round(ticket_gross_minor::numeric * ticket.expected_refund_basis_points / 10000)::bigint
    )
  );

  seed := encode(digest(
    edition.id::text || ':' || edition.version::text || ':' || schedule::text,
    'sha256'
  ), 'hex');
  weather_roll := mod(abs(hashtext(seed || ':weather')), 4);
  weather := jsonb_build_array(jsonb_build_object(
    'condition', CASE weather_roll
      WHEN 0 THEN 'Clear'
      WHEN 1 THEN 'Cloudy'
      WHEN 2 THEN 'Light showers'
      ELSE 'Heavy showers'
    END,
    'temperatureC', CASE weather_roll WHEN 3 THEN 14 WHEN 2 THEN 16 ELSE 19 END,
    'warning', CASE weather_roll
      WHEN 3 THEN 'Heavy showers reduced walk-up attendance and increased site pressure.'
      ELSE NULL
    END
  ));

  admitted := least(
    capacity,
    greatest(0, round(expected_tickets::numeric * CASE weather_roll WHEN 3 THEN 0.92 WHEN 2 THEN 0.97 ELSE 1 END)::integer)
  );
  audience_score := 60 + mod(abs(hashtext(seed || ':audience')), 36);
  artist_score := 62 + mod(abs(hashtext(seed || ':artists')), 34);
  operating_cost_minor := greatest(0, edition.estimated_operating_cost_minor);
  food_minor := admitted::bigint * (900 + mod(abs(hashtext(seed || ':food')), 601));
  merchandise_minor := admitted::bigint * (250 + mod(abs(hashtext(seed || ':merch')), 501));

  SELECT coalesce(sum(booking.total_commitment_minor), 0)
  INTO artist_cost_minor
  FROM public.festival_artist_bookings booking
  WHERE booking.festival_artist_programme_id = programme.id
    AND booking.status NOT IN ('cancelled', 'artist_withdrawn', 'festival_cancelled');

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'kind', 'cost',
    'category', 'artist_guarantee',
    'sourceType', 'festival_artist_booking',
    'sourceId', booking.id::text,
    'amountMinor', booking.total_commitment_minor,
    'currencyCode', booking.currency_code,
    'taxTreatment', 'not_taxable',
    'taxMinor', 0,
    'recipientType', CASE booking.artist_type WHEN 'band' THEN 'band' WHEN 'solo' THEN 'player' ELSE NULL END,
    'recipientId', coalesce(booking.band_id, booking.artist_profile_id),
    'calculationRule', 'accepted-festival-offer'
  ) ORDER BY booking.confirmed_at, booking.id), '[]'::jsonb)
  INTO approved_financial_evidence
  FROM public.festival_artist_bookings booking
  WHERE booking.festival_artist_programme_id = programme.id
    AND booking.status NOT IN ('cancelled', 'artist_withdrawn', 'festival_cancelled')
    AND booking.artist_type IN ('band', 'solo');

  approved_financial_evidence := approved_financial_evidence || jsonb_build_array(
    jsonb_build_object(
      'kind', 'cost',
      'category', 'festival_operations',
      'sourceType', 'simplified_annual_plan',
      'sourceId', edition.id::text || ':operations',
      'amountMinor', operating_cost_minor,
      'currencyCode', ticket.currency_code,
      'taxTreatment', 'exclusive',
      'taxMinor', 0,
      'calculationRule', 'annual-plan-estimated-operating-cost'
    ),
    jsonb_build_object(
      'kind', 'revenue',
      'category', 'food_drink',
      'sourceType', 'simplified_runtime',
      'sourceId', edition.id::text || ':food-drink',
      'amountMinor', food_minor,
      'currencyCode', ticket.currency_code,
      'taxTreatment', 'inclusive',
      'taxMinor', 0,
      'calculationRule', 'attendance-runtime-projection'
    ),
    jsonb_build_object(
      'kind', 'revenue',
      'category', 'merchandise',
      'sourceType', 'simplified_runtime',
      'sourceId', edition.id::text || ':merchandise',
      'amountMinor', merchandise_minor,
      'currencyCode', ticket.currency_code,
      'taxTreatment', 'inclusive',
      'taxMinor', 0,
      'calculationRule', 'attendance-runtime-projection'
    )
  );

  PERFORM public.snapshot_festival_edition_upgrades(edition.id, p_festival_company_id);
  SELECT * INTO upgrade_snapshot
  FROM public.festival_edition_upgrade_snapshots snapshot
  WHERE snapshot.edition_id = edition.id
    AND snapshot.festival_company_id = p_festival_company_id
  ORDER BY snapshot.snapshot_version DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FESTIVAL_RUNTIME_CRITICAL_BLOCKERS'
      USING ERRCODE = 'P0001', DETAIL = '{"component":"upgrade_snapshot"}';
  END IF;

  event_at := (edition.starts_on::text || ' 10:00')::timestamp AT TIME ZONE coalesce(site.timezone, 'UTC');
  story := jsonb_build_array(
    jsonb_build_object('id', 'gates', 'occurredAt', event_at, 'message', 'Festival gates opened and the first fans arrived.'),
    jsonb_build_object('id', 'music', 'occurredAt', event_at + interval '3 hours', 'message', 'The automatically generated running order began across ' || stage_count::text || ' stage' || CASE WHEN stage_count = 1 THEN '' ELSE 's' END || '.'),
    jsonb_build_object('id', 'peak', 'occurredAt', event_at + interval '8 hours', 'message', admitted::text || ' fans attended the Festival.'),
    jsonb_build_object('id', 'ratings', 'occurredAt', event_at + interval '10 hours', 'message', 'Audience satisfaction finished at ' || audience_score::text || '/100.'),
    jsonb_build_object('id', 'close', 'occurredAt', (edition.ends_on::text || ' 23:30')::timestamp AT TIME ZONE coalesce(site.timezone, 'UTC'), 'message', 'The Festival closed safely and moved to results processing.')
  );

  configuration := jsonb_build_object(
    'schemaVersion', 2,
    'scheduleSource', 'simplified_generated',
    'scheduleRevision', NULL,
    'generatedSchedule', schedule,
    'stages', schedule->'stages',
    'slots', schedule->'items',
    'contracts', '[]'::jsonb,
    'upgrades', to_jsonb(upgrade_snapshot),
    'licence', upgrade_snapshot.licence_snapshot,
    'capacity', capacity,
    'weather', weather,
    'currencyCode', ticket.currency_code,
    'ticketSalesSnapshot', jsonb_build_object(
      'currencyCode', ticket.currency_code,
      'ticketsSold', expected_tickets,
      'refundedMinor', refund_minor,
      'lines', jsonb_build_array(jsonb_build_object(
        'category', 'ticket_general_admission',
        'sourceId', ticket.id::text,
        'amountMinor', ticket_gross_minor,
        'taxTreatment', 'inclusive',
        'taxMinor', round(ticket_gross_minor::numeric * ticket.sales_tax_rate_basis_points / 10000)::bigint
      ))
    ),
    'taxConfiguration', jsonb_build_object(
      'rule', 'festival-standard-ticket-tax',
      'rateBasisPoints', ticket.sales_tax_rate_basis_points
    ),
    'approvedFinancialEvidence', approved_financial_evidence,
    'artistCommitmentMinor', artist_cost_minor,
    'operatingCostMinor', operating_cost_minor,
    'staffContracts', '[]'::jsonb,
    'supplierContracts', '[]'::jsonb,
    'sponsorContracts', '[]'::jsonb,
    'operationalPlans', jsonb_build_object('source', 'automatic', 'stageCount', stage_count),
    'vendorConfiguration', jsonb_build_object('foodAndDrinkProjectedMinor', food_minor),
    'merchandiseConfiguration', jsonb_build_object('projectedMinor', merchandise_minor),
    'rulesVersion', 'simplified-festival-runtime-v1',
    'seed', seed
  );

  INSERT INTO public.festival_edition_runtimes(
    festival_company_id,
    edition_id,
    schedule_revision_id,
    upgrade_snapshot_id,
    licence_snapshot,
    state,
    simulated_time,
    runtime_seed,
    rules_version,
    weather_sequence,
    expected_attendance,
    admitted_attendance,
    site_attendance,
    departed_attendance,
    site_capacity,
    staff_readiness,
    supplier_readiness,
    sponsor_readiness,
    stage_readiness,
    financial_evidence_status,
    performance_evidence_status,
    version,
    configuration_version,
    audit_metadata,
    started_at,
    completed_at,
    schedule_source,
    generated_schedule
  ) VALUES (
    p_festival_company_id,
    edition.id,
    NULL,
    upgrade_snapshot.id,
    upgrade_snapshot.licence_snapshot,
    'completed',
    (edition.ends_on::text || ' 23:30')::timestamp AT TIME ZONE coalesce(site.timezone, 'UTC'),
    seed,
    'simplified-festival-runtime-v1',
    weather,
    expected_tickets::integer,
    admitted,
    0,
    admitted,
    capacity,
    jsonb_build_object('ready', greatest(4, ceil(capacity / 250.0)::integer), 'total', greatest(4, ceil(capacity / 250.0)::integer)),
    jsonb_build_object('ready', greatest(3, stage_count + 2), 'total', greatest(3, stage_count + 2)),
    jsonb_build_object('ready', 0, 'total', 0),
    jsonb_build_object('ready', stage_count, 'total', stage_count),
    'complete',
    'complete',
    1,
    1,
    jsonb_build_object(
      'preparedBy', actor,
      'runMode', 'simplified_automatic',
      'idempotencyKey', p_idempotency_key,
      'story', story
    ),
    now(),
    now(),
    'simplified_generated',
    schedule
  ) RETURNING * INTO runtime;

  INSERT INTO public.festival_runtime_configuration_versions(
    runtime_id,
    version,
    configuration,
    configuration_digest,
    created_by_profile_id
  ) VALUES (
    runtime.id,
    1,
    configuration,
    encode(digest(configuration::text, 'sha256'), 'hex'),
    actor
  );

  INSERT INTO public.festival_runtime_action_audit(
    runtime_id,
    actor_profile_id,
    action,
    expected_version,
    idempotency_key,
    request_digest,
    result
  ) VALUES (
    runtime.id,
    actor,
    'run_simplified',
    p_expected_edition_version,
    p_idempotency_key,
    encode(digest(jsonb_build_object(
      'festivalCompanyId', p_festival_company_id,
      'festivalEditionId', p_festival_edition_id,
      'editionVersion', p_expected_edition_version
    )::text, 'sha256'), 'hex'),
    jsonb_build_object('state', 'completed', 'scheduleSource', 'simplified_generated')
  );

  INSERT INTO public.festival_runtime_evidence(
    runtime_id, evidence_type, stable_entity_id, evidence, deterministic_value, evidence_digest
  ) VALUES
    (runtime.id, 'audience_satisfaction', 'festival', jsonb_build_object('score', audience_score), audience_score, encode(digest(jsonb_build_object('score', audience_score)::text, 'sha256'), 'hex')),
    (runtime.id, 'artist_satisfaction', 'festival', jsonb_build_object('score', artist_score), artist_score, encode(digest(jsonb_build_object('score', artist_score)::text, 'sha256'), 'hex')),
    (runtime.id, 'food_drink_sale', 'festival', jsonb_build_object('grossMinor', food_minor), food_minor, encode(digest(jsonb_build_object('grossMinor', food_minor)::text, 'sha256'), 'hex')),
    (runtime.id, 'merchandise_sale', 'festival', jsonb_build_object('grossMinor', merchandise_minor), merchandise_minor, encode(digest(jsonb_build_object('grossMinor', merchandise_minor)::text, 'sha256'), 'hex')),
    (runtime.id, 'weather', 'festival', weather->0, weather_roll, encode(digest((weather->0)::text, 'sha256'), 'hex'));

  FOR stage_item IN SELECT value FROM jsonb_array_elements(schedule->'stages') LOOP
    INSERT INTO public.festival_runtime_evidence(
      runtime_id, evidence_type, stable_entity_id, evidence, deterministic_value, evidence_digest
    ) VALUES (
      runtime.id,
      'stage',
      stage_item->>'id',
      jsonb_build_object('name', stage_item->>'name', 'status', 'completed'),
      100,
      encode(digest(jsonb_build_object('name', stage_item->>'name', 'status', 'completed')::text, 'sha256'), 'hex')
    );
  END LOOP;

  SELECT encode(digest(coalesce(jsonb_agg(jsonb_build_object(
    'type', evidence.evidence_type,
    'entity', evidence.stable_entity_id,
    'digest', evidence.evidence_digest
  ) ORDER BY evidence.evidence_type, evidence.stable_entity_id), '[]'::jsonb)::text, 'sha256'), 'hex')
  INTO evidence_hash
  FROM public.festival_runtime_evidence evidence
  WHERE evidence.runtime_id = runtime.id;

  runtime_digest := encode(digest(
    runtime.id::text || ':' || seed || ':' || evidence_hash || ':' || configuration::text,
    'sha256'
  ), 'hex');

  INSERT INTO public.festival_runtime_completion_digests(
    runtime_id,
    schema_version,
    rules_version,
    record_counts,
    component_hashes,
    runtime_digest,
    runtime_version,
    worker_identity
  ) VALUES (
    runtime.id,
    2,
    'simplified-festival-runtime-v1',
    jsonb_build_object(
      'stages', jsonb_array_length(schedule->'stages'),
      'scheduleItems', jsonb_array_length(schedule->'items'),
      'confirmedActs', booking_count,
      'npcActs', greatest(0, jsonb_array_length(schedule->'items') - booking_count),
      'runtimeEvidence', (SELECT count(*) FROM public.festival_runtime_evidence evidence WHERE evidence.runtime_id = runtime.id)
    ),
    jsonb_build_object(
      'schedule', encode(digest(schedule::text, 'sha256'), 'hex'),
      'configuration', encode(digest(configuration::text, 'sha256'), 'hex'),
      'evidence', evidence_hash
    ),
    runtime_digest,
    runtime.version,
    'simplified-festival-runtime-v1'
  );

  UPDATE public.festival_editions_v2
  SET status = 'completed',
      locked_at = coalesce(locked_at, now()),
      completed_at = coalesce(completed_at, now()),
      version = version + 1,
      updated_at = now()
  WHERE id = edition.id;

  INSERT INTO public.festival_edition_audit(
    festival_company_id,
    festival_edition_id,
    actor_profile_id,
    event_type,
    previous_version,
    new_version,
    metadata
  ) VALUES (
    p_festival_company_id,
    edition.id,
    actor,
    'simplified_runtime_completed',
    edition.version,
    edition.version + 1,
    jsonb_build_object(
      'runtimeId', runtime.id,
      'runtimeDigest', runtime_digest,
      'attendance', admitted,
      'audienceScore', audience_score,
      'artistScore', artist_score,
      'scheduleSource', 'simplified_generated'
    )
  );

  RETURN public.get_festival_edition_runtime_control_room(
    p_festival_company_id,
    p_festival_edition_id
  ) || jsonb_build_object('idempotent', false);
END;
$$;

-- Project generated stages and Festival story into the existing control-room contract.
CREATE OR REPLACE FUNCTION public.get_festival_edition_runtime_control_room(
  p_festival_company_id uuid,
  p_edition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  runtime public.festival_edition_runtimes%ROWTYPE;
  actor uuid := public._festival_edition_runtime_actor();
  configuration jsonb;
  stages jsonb := '[]'::jsonb;
  story jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO runtime
  FROM public.festival_edition_runtimes row
  WHERE row.festival_company_id = p_festival_company_id
    AND row.edition_id = p_edition_id
  ORDER BY row.created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF actor IS NULL OR NOT public._festival_edition_runtime_authorised(runtime.festival_company_id) THEN
    PERFORM public._festival_runtime_error('FESTIVAL_RUNTIME_ACCESS_DENIED');
  END IF;

  SELECT versioned.configuration INTO configuration
  FROM public.festival_runtime_configuration_versions versioned
  WHERE versioned.runtime_id = runtime.id
    AND versioned.version = runtime.configuration_version;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', coalesce(stage->>'id', stage->>'stage_key', 'stage-' || ordinal::text),
    'name', coalesce(stage->>'name', stage->>'stage_name', stage->>'public_name', 'Stage ' || ordinal::text),
    'status', CASE
      WHEN runtime.state = 'completed' THEN 'completed'
      WHEN runtime.state = 'live' THEN 'performance'
      WHEN runtime.state = 'closing' THEN 'closing'
      ELSE 'ready'
    END,
    'currentArtist', NULL,
    'nextArtist', CASE WHEN runtime.state = 'completed' THEN NULL ELSE (
      SELECT item->>'artistName'
      FROM jsonb_array_elements(coalesce(configuration #> '{generatedSchedule,items}', '[]'::jsonb)) item
      WHERE item->>'stageId' = stage->>'id'
      ORDER BY item->>'startsAt'
      LIMIT 1
    ) END,
    'delayMinutes', 0,
    'artistReady', true
  ) ORDER BY ordinal), '[]'::jsonb)
  INTO stages
  FROM jsonb_array_elements(
    coalesce(
      configuration #> '{generatedSchedule,stages}',
      configuration->'stages',
      '[]'::jsonb
    )
  ) WITH ORDINALITY value(stage, ordinal);

  story := coalesce(runtime.audit_metadata->'story', '[]'::jsonb);

  RETURN jsonb_build_object(
    'runtimeId', runtime.id,
    'festivalCompanyId', runtime.festival_company_id,
    'editionId', runtime.edition_id,
    'state', runtime.state,
    'version', runtime.version,
    'simulatedTime', runtime.simulated_time,
    'gates', jsonb_build_object(
      'status', CASE WHEN runtime.state IN ('gates_open', 'live', 'paused') THEN 'open' ELSE 'closed' END,
      'queueSize', 0,
      'waitMinutes', 0
    ),
    'attendance', jsonb_build_object(
      'expected', runtime.expected_attendance,
      'admitted', runtime.admitted_attendance,
      'onsite', runtime.site_attendance,
      'departed', runtime.departed_attendance,
      'capacity', runtime.site_capacity
    ),
    'weather', jsonb_build_object(
      'condition', coalesce(runtime.weather_sequence->0->>'condition', 'Preserved forecast'),
      'temperatureC', coalesce((runtime.weather_sequence->0->>'temperatureC')::numeric, 18),
      'warning', runtime.weather_sequence->0->>'warning'
    ),
    'readiness', jsonb_build_object(
      'staff', coalesce(runtime.staff_readiness, '{"ready":0,"total":0}'::jsonb),
      'suppliers', coalesce(runtime.supplier_readiness, '{"ready":0,"total":0}'::jsonb),
      'sponsors', coalesce(runtime.sponsor_readiness, '{"ready":0,"total":0}'::jsonb)
    ),
    'stages', stages,
    'incidents', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', incident.id,
        'category', incident.catalogue_code,
        'severity', incident.severity,
        'status', incident.status,
        'location', incident.location_key,
        'summary', coalesce(incident.required_response->>'summary', 'Operational incident')
      )), '[]'::jsonb)
      FROM public.festival_edition_runtime_incidents incident
      WHERE incident.runtime_id = runtime.id
        AND incident.status NOT IN ('resolved', 'handed_over')
    ),
    'sales', jsonb_build_object(
      'foodAndDrinkMinor', coalesce((
        SELECT sum((evidence.evidence->>'grossMinor')::bigint)
        FROM public.festival_runtime_evidence evidence
        WHERE evidence.runtime_id = runtime.id
          AND evidence.evidence_type = 'food_drink_sale'
      ), 0),
      'merchandiseMinor', coalesce((
        SELECT sum((evidence.evidence->>'grossMinor')::bigint)
        FROM public.festival_runtime_evidence evidence
        WHERE evidence.runtime_id = runtime.id
          AND evidence.evidence_type = 'merchandise_sale'
      ), 0)
    ),
    'satisfaction', jsonb_build_object(
      'audience', coalesce((
        SELECT avg((evidence.evidence->>'score')::numeric)
        FROM public.festival_runtime_evidence evidence
        WHERE evidence.runtime_id = runtime.id
          AND evidence.evidence_type = 'audience_satisfaction'
      ), 50),
      'artist', coalesce((
        SELECT avg((evidence.evidence->>'score')::numeric)
        FROM public.festival_runtime_evidence evidence
        WHERE evidence.runtime_id = runtime.id
          AND evidence.evidence_type = 'artist_satisfaction'
      ), 50)
    ),
    'blockers', '[]'::jsonb,
    'recentEvents', story,
    'permissions', jsonb_build_object(
      'role', CASE WHEN public.is_admin(auth.uid()) THEN 'admin' ELSE 'festival_manager' END,
      'actions', CASE WHEN runtime.state = 'completed' THEN '[]'::jsonb ELSE jsonb_build_array('view') END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_simplified_festival_run_readiness(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.run_simplified_festival_edition(uuid, uuid, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_simplified_festival_run_readiness(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_simplified_festival_edition(uuid, uuid, integer, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
