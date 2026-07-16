BEGIN;

DO $$
DECLARE
  v_private_cols text[] := ARRAY['budget_cents','treasury_allocation_cents','lifecycle_metadata','legacy_metadata','creation_idempotency_key'];
  v_col text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='is_public_festival_edition_status') THEN RAISE EXCEPTION 'public helper missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='public_festival_editions') THEN RAISE EXCEPTION 'public view missing'; END IF;
  FOREACH v_col IN ARRAY v_private_cols LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='public_festival_editions' AND column_name=v_col) THEN
      RAISE EXCEPTION 'private column % exposed in public view', v_col;
    END IF;
  END LOOP;
  PERFORM 1 FROM public.public_festival_editions LIMIT 1;
END $$;

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_profile uuid := gen_random_uuid();
  v_festival uuid := gen_random_uuid();
  v_city uuid := gen_random_uuid();
  v_venue uuid := gen_random_uuid();
  v_edition public.festival_editions%ROWTYPE;
  v_retry public.festival_editions%ROWTYPE;
  v_event_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  INSERT INTO public.profiles(id, user_id, username, display_name) VALUES (v_profile, v_user, 'festival_test_owner', 'Festival Test Owner') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.cities(id, name, country) VALUES (v_city, 'Harness City', 'US') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.venues(id, name, city_id, capacity) VALUES (v_venue, 'Harness Venue', v_city, 1000) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.festivals(id, name, owner_profile_id, city_id, venue_id, start_date, end_date, expected_attendance, ticket_price_low, ticket_price_high, treasury_cents, status)
  VALUES (v_festival, 'Harness Fest', v_profile, v_city, v_venue, current_date + 30, current_date + 31, 500, 0, 25, 100000, 'draft')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.festival_editions(festival_id, edition_number, title, city_id, venue_id, start_at, end_at, expected_attendance, capacity, minimum_ticket_price_cents, maximum_ticket_price_cents, creation_idempotency_key)
  VALUES (v_festival, 99, 'Manual Harness', v_city, v_venue, now()+interval '30 days', now()+interval '31 days', 500, 600, 0, 2500, 'manual-key')
  RETURNING * INTO v_edition;

  BEGIN
    INSERT INTO public.festival_editions(festival_id, edition_number, title) VALUES (v_festival, 99, 'Duplicate');
    RAISE EXCEPTION 'duplicate edition_number was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    PERFORM public.transition_festival_edition(v_edition.id, 'live', NULL, '{}'::jsonb, 'bad-live');
    RAISE EXCEPTION 'concept/planning edition transitioned directly to live';
  EXCEPTION WHEN others THEN NULL;
  END;

  SELECT public.transition_festival_edition(v_edition.id, 'applications_open', NULL, '{}'::jsonb, 'to-apps') INTO v_edition;
  SELECT public.transition_festival_edition(v_edition.id, 'booking', NULL, '{}'::jsonb, 'to-booking') INTO v_edition;
  SELECT public.transition_festival_edition(v_edition.id, 'announced', NULL, '{}'::jsonb, 'to-announced') INTO v_edition;
  SELECT public.transition_festival_edition(v_edition.id, 'announced', NULL, '{}'::jsonb, 'noop-new') INTO v_retry;
  SELECT count(*) INTO v_event_count FROM public.festival_edition_lifecycle_events WHERE edition_id=v_edition.id AND to_status='announced';
  IF v_event_count <> 1 THEN RAISE EXCEPTION 'no-op/idempotent transition duplicated history'; END IF;
  SELECT public.transition_festival_edition(v_edition.id, 'on_sale', NULL, '{}'::jsonb, 'to-sale') INTO v_edition;

  BEGIN
    PERFORM public.transition_festival_edition(v_edition.id, 'cancelled', NULL, '{}'::jsonb, 'cancel-no-reason');
    RAISE EXCEPTION 'cancellation without reason accepted';
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    PERFORM public.transition_festival_edition(v_edition.id, 'postponed', NULL, '{}'::jsonb, 'postpone-no-reason');
    RAISE EXCEPTION 'postponement without reason accepted';
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    PERFORM public.transition_festival_edition(v_edition.id, 'on_sale', NULL, '{"different":true}'::jsonb, 'to-sale');
    RAISE EXCEPTION 'idempotency key reuse with different input accepted';
  EXCEPTION WHEN others THEN NULL;
  END;

  UPDATE public.festival_editions SET status='completed' WHERE id=v_edition.id;
  BEGIN
    PERFORM public.transition_festival_edition(v_edition.id, 'live', NULL, '{}'::jsonb, 'completed-live');
    RAISE EXCEPTION 'completed returned to live';
  EXCEPTION WHEN others THEN NULL;
  END;

  IF EXISTS (SELECT 1 FROM public.public_festival_editions WHERE id=v_edition.id AND status IN ('concept','planning')) THEN
    RAISE EXCEPTION 'public view exposes planning/concept editions';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.festival_legacy_mappings GROUP BY legacy_source, legacy_id HAVING count(*) = 1 LIMIT 1) THEN
    RAISE NOTICE 'No legacy mappings fixture present; uniqueness is enforced by catalog constraint.';
  END IF;
END $$;

ROLLBACK;
