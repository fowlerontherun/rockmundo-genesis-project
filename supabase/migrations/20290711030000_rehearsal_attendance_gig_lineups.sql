-- Phase 4 PR 03: authoritative rehearsal attendance and gig lineup foundations.

CREATE TABLE IF NOT EXISTS public.band_rehearsal_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rehearsal_id uuid NOT NULL REFERENCES public.band_rehearsals(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  participation_status text NOT NULL DEFAULT 'invited' CHECK (participation_status IN ('invited', 'attended', 'missed')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  attended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT band_rehearsal_participants_unique UNIQUE (rehearsal_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.gig_performers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  role_or_instrument text,
  lineup_status text NOT NULL DEFAULT 'selected' CHECK (lineup_status IN ('selected', 'performed', 'missed')),
  selected_at timestamptz NOT NULL DEFAULT now(),
  performed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gig_performers_unique UNIQUE (gig_id, profile_id)
);

CREATE INDEX IF NOT EXISTS band_rehearsal_participants_rehearsal_idx ON public.band_rehearsal_participants (rehearsal_id, participation_status);
CREATE INDEX IF NOT EXISTS band_rehearsal_participants_band_profile_idx ON public.band_rehearsal_participants (band_id, profile_id);
CREATE INDEX IF NOT EXISTS gig_performers_gig_idx ON public.gig_performers (gig_id, lineup_status);
CREATE INDEX IF NOT EXISTS gig_performers_band_profile_idx ON public.gig_performers (band_id, profile_id);

ALTER TABLE public.band_rehearsal_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_performers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active band members can view rehearsal participants"
ON public.band_rehearsal_participants FOR SELECT TO authenticated
USING (public.is_active_band_member(band_id, auth.uid()));

CREATE POLICY "Active band members can view gig performers"
ON public.gig_performers FOR SELECT TO authenticated
USING (public.is_active_band_member(band_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.is_band_leader_or_manager(target_band_id uuid, actor_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT target_band_id IS NOT NULL AND actor_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = target_band_id
      AND bm.user_id = actor_user_id
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND lower(COALESCE(bm.role, '')) IN ('leader', 'founder', 'co-leader', 'manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_rehearsal_participant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_band_id uuid;
BEGIN
  SELECT br.band_id INTO v_band_id FROM public.band_rehearsals br WHERE br.id = NEW.rehearsal_id;
  IF v_band_id IS NULL OR NEW.band_id <> v_band_id THEN RAISE EXCEPTION 'Participant band must match rehearsal band'; END IF;
  IF NOT public.is_band_member_at_time(NEW.band_id, NEW.profile_id, COALESCE(NEW.invited_at, now())) THEN RAISE EXCEPTION 'Rehearsal participant must be an active current band member'; END IF;
  NEW.updated_at := now();
  IF NEW.participation_status = 'attended' AND NEW.attended_at IS NULL THEN NEW.attended_at := now(); END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_gig_performer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_band_id uuid;
BEGIN
  SELECT g.band_id INTO v_band_id FROM public.gigs g WHERE g.id = NEW.gig_id;
  IF v_band_id IS NULL OR NEW.band_id <> v_band_id THEN RAISE EXCEPTION 'Performer band must match gig band'; END IF;
  IF NOT public.is_band_member_at_time(NEW.band_id, NEW.profile_id, COALESCE(NEW.selected_at, now())) THEN RAISE EXCEPTION 'Gig performer must be an active current band member'; END IF;
  NEW.updated_at := now();
  IF NEW.lineup_status = 'performed' AND NEW.performed_at IS NULL THEN NEW.performed_at := now(); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_rehearsal_participant ON public.band_rehearsal_participants;
CREATE TRIGGER validate_rehearsal_participant BEFORE INSERT OR UPDATE ON public.band_rehearsal_participants FOR EACH ROW EXECUTE FUNCTION public.validate_rehearsal_participant();
DROP TRIGGER IF EXISTS validate_gig_performer ON public.gig_performers;
CREATE TRIGGER validate_gig_performer BEFORE INSERT OR UPDATE ON public.gig_performers FOR EACH ROW EXECUTE FUNCTION public.validate_gig_performer();

CREATE OR REPLACE FUNCTION public.seed_rehearsal_participants(p_rehearsal_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rehearsal record; v_count integer := 0;
BEGIN
  SELECT id, band_id, status, scheduled_start INTO v_rehearsal FROM public.band_rehearsals WHERE id = p_rehearsal_id;
  IF NOT FOUND OR v_rehearsal.status = 'cancelled' THEN RETURN 0; END IF;
  INSERT INTO public.band_rehearsal_participants (rehearsal_id, band_id, profile_id, participation_status, invited_at)
  SELECT v_rehearsal.id, v_rehearsal.band_id, bm.profile_id, 'invited', now()
  FROM public.band_members bm
  WHERE bm.band_id = v_rehearsal.band_id AND bm.profile_id IS NOT NULL
    AND COALESCE(bm.member_status, 'active') = 'active'
    AND (bm.joined_at IS NULL OR bm.joined_at <= COALESCE(v_rehearsal.scheduled_start, now()))
  ON CONFLICT ON CONSTRAINT band_rehearsal_participants_unique DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT; RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_gig_performers(p_gig_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gig record; v_count integer := 0;
BEGIN
  SELECT id, band_id, status, scheduled_date INTO v_gig FROM public.gigs WHERE id = p_gig_id;
  IF NOT FOUND OR COALESCE(v_gig.status, '') IN ('cancelled','failed') THEN RETURN 0; END IF;
  INSERT INTO public.gig_performers (gig_id, band_id, profile_id, role_or_instrument, lineup_status, selected_at)
  SELECT v_gig.id, v_gig.band_id, bm.profile_id, NULLIF(COALESCE(bm.instrument_role, bm.role), ''), 'selected', now()
  FROM public.band_members bm
  WHERE bm.band_id = v_gig.band_id AND bm.profile_id IS NOT NULL
    AND COALESCE(bm.member_status, 'active') = 'active'
    AND COALESCE(bm.is_touring_member, false) = false
    AND (bm.joined_at IS NULL OR bm.joined_at <= COALESCE(v_gig.scheduled_date, now()))
  ON CONFLICT ON CONSTRAINT gig_performers_unique DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT; RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_rehearsal_participants_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN PERFORM public.seed_rehearsal_participants(NEW.id); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.seed_gig_performers_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN PERFORM public.seed_gig_performers(NEW.id); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS seed_rehearsal_participants_on_insert ON public.band_rehearsals;
CREATE TRIGGER seed_rehearsal_participants_on_insert AFTER INSERT ON public.band_rehearsals FOR EACH ROW EXECUTE FUNCTION public.seed_rehearsal_participants_on_insert();
DROP TRIGGER IF EXISTS seed_gig_performers_on_insert ON public.gigs;
CREATE TRIGGER seed_gig_performers_on_insert AFTER INSERT ON public.gigs FOR EACH ROW EXECUTE FUNCTION public.seed_gig_performers_on_insert();

CREATE OR REPLACE FUNCTION public.capture_contributions_for_rehearsal(p_rehearsal_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rehearsal record; v_participant record; v_event_id uuid; v_inserted integer := 0;
BEGIN
  SELECT id, band_id, status, completed_at, scheduled_end INTO v_rehearsal FROM public.band_rehearsals WHERE id = p_rehearsal_id;
  IF NOT FOUND OR v_rehearsal.status <> 'completed' THEN RETURN 0; END IF;
  PERFORM public.seed_rehearsal_participants(v_rehearsal.id);
  UPDATE public.band_rehearsal_participants SET participation_status = 'attended', attended_at = COALESCE(attended_at, COALESCE(v_rehearsal.completed_at, now())), updated_at = now()
  WHERE rehearsal_id = v_rehearsal.id AND participation_status = 'invited';
  FOR v_participant IN SELECT profile_id FROM public.band_rehearsal_participants WHERE rehearsal_id = v_rehearsal.id AND participation_status = 'attended' LOOP
    v_event_id := public.insert_band_contribution_event(v_rehearsal.band_id, v_participant.profile_id, 'rehearsal_attendance', 'band_rehearsal', v_rehearsal.id, COALESCE(v_rehearsal.completed_at, v_rehearsal.scheduled_end, now()), jsonb_build_object('label','Completed band rehearsal','accuracy','verified_participant','verification_method','explicit_attendance'));
    IF v_event_id IS NOT NULL THEN v_inserted := v_inserted + 1; END IF;
  END LOOP;
  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_contributions_for_gig_outcome(p_gig_outcome_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_outcome record; v_performer record; v_event_id uuid; v_inserted integer := 0;
BEGIN
  SELECT go.id, go.gig_id, COALESCE(go.band_id, g.band_id) AS band_id, g.scheduled_date, g.status, go.created_at INTO v_outcome FROM public.gig_outcomes go JOIN public.gigs g ON g.id = go.gig_id WHERE go.id = p_gig_outcome_id;
  IF NOT FOUND OR v_outcome.band_id IS NULL OR COALESCE(v_outcome.status, '') IN ('cancelled','failed') THEN RETURN 0; END IF;
  PERFORM public.seed_gig_performers(v_outcome.gig_id);
  UPDATE public.gig_performers SET lineup_status = 'performed', performed_at = COALESCE(performed_at, COALESCE(v_outcome.scheduled_date, v_outcome.created_at, now())), updated_at = now()
  WHERE gig_id = v_outcome.gig_id AND lineup_status = 'selected';
  FOR v_performer IN SELECT profile_id FROM public.gig_performers WHERE gig_id = v_outcome.gig_id AND lineup_status = 'performed' LOOP
    v_event_id := public.insert_band_contribution_event(v_outcome.band_id, v_performer.profile_id, 'gig_performance', 'gig_outcome', v_outcome.id, COALESCE(v_outcome.scheduled_date, v_outcome.created_at, now()), jsonb_build_object('label','Completed band gig','accuracy','verified_participant','verification_method','explicit_lineup'));
    IF v_event_id IS NOT NULL THEN v_inserted := v_inserted + 1; END IF;
  END LOOP;
  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_completed_rehearsal_contributions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'completed' OR (TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') = 'completed') THEN RETURN NEW; END IF;
  PERFORM public.capture_contributions_for_rehearsal(NEW.id); RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'capture_completed_rehearsal_contributions failed for rehearsal %: %', NEW.id, SQLERRM; RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.capture_completed_gig_contributions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.capture_contributions_for_gig_outcome(NEW.id); RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'capture_completed_gig_contributions failed for gig_outcome %: %', NEW.id, SQLERRM; RETURN NEW; END;
$$;
