-- PR B5 follow-up: keep lifecycle projections aligned with the canonical validator,
-- tighten blackout override semantics, mirror cancellation into public launch artefacts,
-- and expose the accepted-booking scheduling queue through a permission-checked RPC.

CREATE OR REPLACE FUNCTION public.admin_festival_edition_lifecycle_options(p_edition_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  s public.festival_edition_status;
  transitions jsonb := '[]'::jsonb;
  targets text[];
  target text;
  available boolean;
  legal boolean;
  blockers text[];
  warnings text[];
  admin boolean;
  blackout jsonb;
  blackout_blocks boolean;
BEGIN
  IF NOT public.can_manage_festival_edition(p_edition_id) THEN
    RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED';
  END IF;
  admin := coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false);
  SELECT status INTO s FROM public.festival_editions WHERE id=p_edition_id;
  IF s IS NULL THEN RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND'; END IF;

  -- This list mirrors validate_festival_edition_transition. The validator is still
  -- evaluated for every projected target so future graph changes fail closed.
  targets := CASE s
    WHEN 'concept' THEN ARRAY['planning','cancelled','abandoned']
    WHEN 'planning' THEN ARRAY['applications_open','booking','postponed','cancelled','abandoned']
    WHEN 'applications_open' THEN ARRAY['booking','postponed','cancelled','abandoned']
    WHEN 'booking' THEN ARRAY['announced','postponed','cancelled','abandoned']
    WHEN 'announced' THEN ARRAY['on_sale','setup','postponed','cancelled','abandoned']
    WHEN 'on_sale' THEN ARRAY['setup','postponed','cancelled','abandoned']
    WHEN 'setup' THEN ARRAY['live','postponed','cancelled','abandoned']
    WHEN 'live' THEN ARRAY['settling','cancelled','abandoned']
    WHEN 'settling' THEN ARRAY['completed','cancelled','abandoned']
    WHEN 'postponed' THEN ARRAY['planning','announced','cancelled','abandoned']
    ELSE ARRAY[]::text[]
  END;

  blackout := public.festival_edition_blackout_conflicts(p_edition_id);
  FOREACH target IN ARRAY targets LOOP
    blockers := ARRAY[]::text[];
    warnings := ARRAY[]::text[];
    legal := public.validate_festival_edition_transition(s,target::public.festival_edition_status);
    available := legal;
    blackout_blocks := target IN ('applications_open','booking','announced','on_sale','setup','live')
      AND jsonb_array_length(coalesce(blackout,'[]'::jsonb)) > 0;

    IF NOT legal THEN
      blockers := array_append(blockers,'This transition is not allowed by the canonical festival lifecycle.');
    END IF;
    IF target IN ('announced','on_sale') AND NOT EXISTS(
      SELECT 1 FROM public.festival_stages WHERE edition_id=p_edition_id AND archived_at IS NULL
    ) THEN
      blockers := array_append(blockers,'No stages configured for this edition.');
      available := false;
    END IF;
    IF blackout_blocks THEN
      blockers := array_append(blockers,'This edition overlaps an active regional blackout.');
      available := false;
      IF admin THEN
        warnings := array_append(warnings,'A platform administrator may override this blackout with a recorded reason.');
      END IF;
    END IF;

    transitions := transitions || jsonb_build_object(
      'targetState',target,
      'available',available,
      'blockers',to_jsonb(blockers),
      'warnings',to_jsonb(warnings),
      'adminOverrideAllowed',admin AND legal AND blackout_blocks,
      'reasonRequired',target IN ('cancelled','abandoned','postponed') OR blackout_blocks,
      'confirmationRequired',target IN ('live','cancelled','abandoned','completed'),
      'severity',CASE WHEN target IN ('cancelled','abandoned') THEN 'destructive' WHEN target='postponed' THEN 'warning' ELSE 'standard' END,
      'explanation',CASE target
        WHEN 'planning' THEN 'Move the edition into detailed planning.'
        WHEN 'applications_open' THEN 'Open band applications for this edition.'
        WHEN 'booking' THEN 'Close applications and begin booking confirmed acts.'
        WHEN 'announced' THEN 'Publicly announce the edition.'
        WHEN 'on_sale' THEN 'Start selling tickets.'
        WHEN 'setup' THEN 'Move into on-site build and setup.'
        WHEN 'live' THEN 'Start live operations for this edition.'
        WHEN 'settling' THEN 'Begin post-event settlement.'
        WHEN 'completed' THEN 'Mark this edition as fully completed.'
        WHEN 'postponed' THEN 'Postpone this edition and require affected bookings to be rescheduled.'
        WHEN 'cancelled' THEN 'Cancel this edition and queue eligible ticket refunds.'
        WHEN 'abandoned' THEN 'Abandon this edition.'
        ELSE '' END
    );
  END LOOP;

  RETURN jsonb_build_object(
    'editionId',p_edition_id,
    'currentState',s::text,
    'blackoutConflicts',blackout,
    'transitions',transitions
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_transition_festival_edition(
  p_edition_id uuid,p_target_status public.festival_edition_status,p_reason text,
  p_override boolean DEFAULT false,p_metadata jsonb DEFAULT '{}'::jsonb,p_idempotency_key text DEFAULT NULL
) RETURNS public.festival_editions LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  oldrow public.festival_editions%ROWTYPE;
  newrow public.festival_editions%ROWTYPE;
  meta jsonb;
  blackout jsonb;
  blackout_blocks boolean;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN
    RAISE EXCEPTION 'Admin authority required';
  END IF;
  IF nullif(btrim(p_reason),'') IS NULL THEN
    RAISE EXCEPTION 'Lifecycle administration requires a reason';
  END IF;
  SELECT * INTO STRICT oldrow FROM public.festival_editions WHERE id=p_edition_id FOR UPDATE;
  IF NOT public.validate_festival_edition_transition(oldrow.status,p_target_status) THEN
    RAISE EXCEPTION 'FESTIVAL_EDITION_INVALID_TRANSITION: % -> %',oldrow.status,p_target_status;
  END IF;

  blackout := public.festival_edition_blackout_conflicts(p_edition_id);
  blackout_blocks := p_target_status IN ('applications_open','booking','announced','on_sale','setup','live')
    AND jsonb_array_length(coalesce(blackout,'[]'::jsonb)) > 0;
  IF p_override AND NOT blackout_blocks THEN
    RAISE EXCEPTION 'FESTIVAL_BLACKOUT_OVERRIDE_NOT_APPLICABLE';
  END IF;

  meta := coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object(
    'admin_override',p_override,
    'blackout_conflicts',CASE WHEN p_override THEN blackout ELSE '[]'::jsonb END
  );
  IF p_override THEN PERFORM set_config('app.festival_blackout_override','on',true); END IF;
  newrow := public.transition_festival_edition(p_edition_id,p_target_status,p_reason,meta,p_idempotency_key);
  PERFORM public._festival_record_organiser_audit(
    oldrow.festival_id,p_edition_id,
    CASE WHEN p_override THEN 'lifecycle_blackout_override' ELSE 'lifecycle_transition' END,
    'festival_edition',p_edition_id,to_jsonb(oldrow),to_jsonb(newrow),p_reason,meta,p_idempotency_key
  );
  RETURN newrow;
END $$;

-- Keep cancellation projections consistent with the already-canonical public launch model.
CREATE OR REPLACE FUNCTION public._festival_lifecycle_side_effects_b5()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  e public.festival_editions%ROWTYPE;
  launch public.festival_launches%ROWTYPE;
  buyer record;
  member record;
BEGIN
  SELECT * INTO STRICT e FROM public.festival_editions WHERE id=NEW.edition_id;
  PERFORM public._festival_record_organiser_audit(
    e.festival_id,e.id,'edition_'||NEW.to_status::text,'festival_edition',e.id,
    jsonb_build_object('status',NEW.from_status),jsonb_build_object('status',NEW.to_status),NEW.reason,NEW.metadata,
    coalesce(NEW.idempotency_key,NEW.id::text)||':lifecycle-event'
  );

  IF NEW.to_status='postponed' THEN
    UPDATE public.festival_contracts SET status='amendment_required',updated_at=now()
    WHERE edition_id=e.id AND status IN ('active','awaiting_signatures','awaiting_band_signature','awaiting_organiser_signature');
    UPDATE public.festival_stage_slots SET public_status='postponed'
    WHERE edition_id=e.id AND public_status<>'cancelled';
    SELECT * INTO launch FROM public.festival_launches WHERE festival_edition_id=e.id;
    IF launch.id IS NOT NULL AND launch.launch_status='tickets_on_sale' THEN
      UPDATE public.festival_launches SET launch_status='sales_paused',updated_at=now() WHERE id=launch.id;
    END IF;
  ELSIF NEW.to_status='cancelled' THEN
    UPDATE public.festival_contracts SET
      status='cancelled',cancelled_at=coalesce(cancelled_at,now()),cancelled_by_side='organiser',
      cancelled_by_profile_id=NEW.actor_profile_id,cancellation_reason=coalesce(NEW.reason,'Festival cancelled'),
      settlement_required=true,updated_at=now()
    WHERE edition_id=e.id AND status NOT IN ('cancelled','terminated','fulfilled','expired','breached');
    UPDATE public.festival_stage_slot_reservations SET
      status='released',released_at=now(),release_reason='Festival cancelled'
    WHERE edition_id=e.id AND status IN ('provisional','confirmed');
    UPDATE public.festival_stage_slots SET status='cancelled',public_status='cancelled'
    WHERE edition_id=e.id AND status<>'completed';

    SELECT * INTO launch FROM public.festival_launches WHERE festival_edition_id=e.id;
    IF launch.id IS NOT NULL THEN
      UPDATE public.festival_launches SET
        launch_status='cancelled_before_event',public_visibility='private',cancelled_at=coalesce(cancelled_at,now()),
        cancellation_reason=coalesce(NEW.reason,'Festival cancelled'),updated_at=now()
      WHERE id=launch.id;
      UPDATE public.festival_public_editions SET launch_status='cancelled' WHERE festival_launch_id=launch.id;
      UPDATE public.festival_city_calendar_events SET status='cancelled' WHERE festival_launch_id=launch.id;
      UPDATE public.festival_countdowns SET status='cancelled',updated_at=now() WHERE festival_launch_id=launch.id;
      INSERT INTO public.festival_ticket_refund_obligations(
        festival_ticket_sale_id,buyer_profile_id,amount_minor,currency,reason_code
      )
      SELECT s.id,s.buyer_profile_id,s.total_minor,s.currency,'festival_cancelled'
      FROM public.festival_ticket_sales s
      WHERE s.festival_launch_id=launch.id AND s.status='completed'
      ON CONFLICT(festival_ticket_sale_id) DO NOTHING;
      UPDATE public.festival_ticket_sales SET status='cancelled',cancelled_at=coalesce(cancelled_at,now())
      WHERE festival_launch_id=launch.id AND status='completed';
      UPDATE public.festival_issued_tickets SET status='cancelled',cancelled_at=coalesce(cancelled_at,now())
      WHERE festival_ticket_sale_id IN (
        SELECT s.id FROM public.festival_ticket_sales s WHERE s.festival_launch_id=launch.id
      ) AND status IN ('valid','transferred');
    END IF;
  END IF;

  IF NEW.to_status IN ('postponed','cancelled') THEN
    FOR buyer IN
      SELECT DISTINCT s.buyer_profile_id,p.user_id
      FROM public.festival_launches l
      JOIN public.festival_ticket_sales s ON s.festival_launch_id=l.id
      JOIN public.profiles p ON p.id=s.buyer_profile_id
      WHERE l.festival_edition_id=e.id
    LOOP
      INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata)
      VALUES(
        buyer.user_id,buyer.buyer_profile_id,'festival','festival_'||NEW.to_status::text,
        CASE WHEN NEW.to_status='cancelled' THEN 'Festival cancelled' ELSE 'Festival postponed' END,
        CASE WHEN NEW.to_status='cancelled'
          THEN 'This festival has been cancelled. Eligible ticket refunds are queued automatically.'
          ELSE 'This festival has been postponed. Check the festival page for updated dates.' END,
        '/festivals/'||e.festival_id::text,jsonb_build_object('editionId',e.id,'lifecycleEventId',NEW.id)
      );
    END LOOP;
    FOR member IN
      SELECT DISTINCT bm.profile_id,p.user_id
      FROM public.festival_contracts c
      JOIN public.band_members bm ON bm.band_id=c.band_id AND coalesce(bm.member_status,'active')='active'
      JOIN public.profiles p ON p.id=bm.profile_id
      WHERE c.edition_id=e.id
    LOOP
      INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata)
      VALUES(
        member.user_id,member.profile_id,'festival','festival_artist_'||NEW.to_status::text,
        CASE WHEN NEW.to_status='cancelled' THEN 'Festival performance cancelled' ELSE 'Festival performance postponed' END,
        CASE WHEN NEW.to_status='cancelled'
          THEN 'Your festival booking was cancelled by the organiser. Contract settlement will use the accepted cancellation terms.'
          ELSE 'Your festival booking needs rescheduling because the edition was postponed.' END,
        '/festival-opportunities',jsonb_build_object('editionId',e.id,'lifecycleEventId',NEW.id)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

-- Accepted programme bookings waiting for a canonical band contract are projected
-- together with currently usable stage slots. The RPC is read-only and permission checked.
CREATE OR REPLACE FUNCTION public.get_festival_artist_booking_schedule_queue(p_edition_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.festival_editions%ROWTYPE; actor uuid:=public._caller_profile_id();
BEGIN
  SELECT * INTO STRICT e FROM public.festival_editions WHERE id=p_edition_id;
  IF NOT (
    public.can_manage_festival_edition(e.id)
    OR EXISTS(
      SELECT 1 FROM public.festival_edition_management_roles r
      WHERE r.edition_id=e.id AND r.profile_id=actor AND r.status='active'
        AND r.role IN ('delegated_manager','talent_booker','operations_manager','stage_manager')
        AND (r.ends_at IS NULL OR r.ends_at>now())
    )
  ) THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;

  RETURN jsonb_build_object(
    'editionId',e.id,
    'bookings',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',b.id,'artistType',b.artist_type,'bandId',b.band_id,'bandName',bd.name,
        'status',b.status,'setMinutes',b.set_minutes,'billingPosition',b.billing_position,
        'agreedFeeMinor',b.agreed_fee_minor,'currencyCode',b.currency_code,
        'preferredDate',b.provisional_date,'preferredStageId',b.provisional_stage_id,
        'supported',b.artist_type='band' AND b.band_id IS NOT NULL,
        'unsupportedReason',CASE WHEN b.artist_type='band' AND b.band_id IS NOT NULL THEN NULL
          ELSE 'Canonical festival performance contracts currently require a band.' END
      ) ORDER BY b.confirmed_at,b.created_at,b.id)
      FROM public.festival_artist_bookings b
      JOIN public.festival_artist_programmes pr ON pr.id=b.festival_artist_programme_id
      LEFT JOIN public.bands bd ON bd.id=b.band_id
      WHERE pr.festival_edition_id=e.id AND b.status='awaiting_schedule'
    ),'[]'::jsonb),
    'slots',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',s.id,'stageId',s.stage_id,'stageName',coalesce(st.public_name,st.stage_name,st.name),
        'dayNumber',s.day_number,'slotNumber',s.slot_number,'slotType',s.slot_type,
        'startAt',s.start_time,'endAt',s.end_time
      ) ORDER BY s.start_time,s.stage_id,s.slot_number)
      FROM public.festival_stage_slots s
      JOIN public.festival_stages st ON st.id=s.stage_id
      WHERE s.edition_id=e.id AND s.status IN ('open','booked') AND s.canonical_contract_id IS NULL
        AND s.band_id IS NULL AND s.start_time IS NOT NULL AND s.end_time IS NOT NULL
    ),'[]'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION public.get_festival_artist_booking_schedule_queue(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_artist_booking_schedule_queue(uuid) TO authenticated,service_role;
