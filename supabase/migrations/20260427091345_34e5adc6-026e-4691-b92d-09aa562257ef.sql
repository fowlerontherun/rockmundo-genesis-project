
-- ============================================
-- 1. Unified notifications table
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid,
  category text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  action_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_profile_created
  ON public.notifications(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update their notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete their notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Service role / triggers can insert (no insert policy = blocked for clients; triggers run as definer)

-- Realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

-- ============================================
-- 2. Mirror trigger helper
-- ============================================
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_profile_id uuid,
  p_category text,
  p_type text,
  p_title text,
  p_message text,
  p_action_path text,
  p_metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.notifications(user_id, profile_id, category, type, title, message, action_path, metadata)
  VALUES (p_user_id, p_profile_id, p_category, COALESCE(p_type,'info'), p_title, COALESCE(p_message,''), p_action_path, COALESCE(p_metadata,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ============================================
-- 3. Adoption pathway extensions
-- ============================================
ALTER TABLE public.child_requests
  ADD COLUMN IF NOT EXISTS pathway text NOT NULL DEFAULT 'biological',
  ADD COLUMN IF NOT EXISTS agency text,
  ADD COLUMN IF NOT EXISTS application_fee_cents integer,
  ADD COLUMN IF NOT EXISTS home_study_complete_at timestamptz,
  ADD COLUMN IF NOT EXISTS match_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS single_parent_allowed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS match_age_min integer,
  ADD COLUMN IF NOT EXISTS match_age_max integer;

-- Validation trigger to keep pathway values clean
CREATE OR REPLACE FUNCTION public.validate_child_request_pathway()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pathway NOT IN ('biological','adoption') THEN
    RAISE EXCEPTION 'Invalid pathway: %', NEW.pathway;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_child_request_pathway ON public.child_requests;
CREATE TRIGGER trg_validate_child_request_pathway
  BEFORE INSERT OR UPDATE ON public.child_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_child_request_pathway();

-- ============================================
-- 4. Parenting-loop columns on player_children (Phase 2 use, scaffolded now)
-- ============================================
ALTER TABLE public.player_children
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz,
  ADD COLUMN IF NOT EXISTS mood integer NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS needs jsonb NOT NULL DEFAULT '{"food":70,"sleep":70,"affection":70,"learning":50}'::jsonb,
  ADD COLUMN IF NOT EXISTS school_stage text,
  ADD COLUMN IF NOT EXISTS weekly_allowance_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discipline_style text;

-- ============================================
-- 5. AFTER INSERT mirror triggers for existing notification tables
-- ============================================

-- 5a. band_gift_notifications -> notifications
CREATE OR REPLACE FUNCTION public.mirror_band_gift_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- band_gift_notifications has recipient profile_id; resolve to user_id via profiles
  SELECT p.user_id INTO v_user_id FROM public.profiles p WHERE p.id = NEW.recipient_profile_id;
  PERFORM public.create_notification(
    v_user_id,
    NEW.recipient_profile_id,
    'band_gift',
    'achievement',
    'New band gift',
    COALESCE(NEW.message, 'You received a gift from a bandmate.'),
    '/band-management',
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='band_gift_notifications')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='band_gift_notifications' AND column_name='recipient_profile_id')
  THEN
    DROP TRIGGER IF EXISTS trg_mirror_band_gift_notification ON public.band_gift_notifications;
    CREATE TRIGGER trg_mirror_band_gift_notification
      AFTER INSERT ON public.band_gift_notifications
      FOR EACH ROW EXECUTE FUNCTION public.mirror_band_gift_notification();
  END IF;
END $$;

-- 5b. twaater_notifications -> notifications
CREATE OR REPLACE FUNCTION public.mirror_twaater_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile uuid;
BEGIN
  -- Try to resolve owner; tolerate either user_id or profile_id columns being present
  BEGIN
    EXECUTE 'SELECT ($1).user_id' INTO v_user_id USING NEW;
  EXCEPTION WHEN others THEN v_user_id := NULL; END;
  BEGIN
    EXECUTE 'SELECT ($1).profile_id' INTO v_profile USING NEW;
  EXCEPTION WHEN others THEN v_profile := NULL; END;
  IF v_user_id IS NULL AND v_profile IS NOT NULL THEN
    SELECT p.user_id INTO v_user_id FROM public.profiles p WHERE p.id = v_profile;
  END IF;
  PERFORM public.create_notification(
    v_user_id,
    v_profile,
    'twaater',
    'info',
    'New Twaater activity',
    '',
    '/twaater',
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='twaater_notifications') THEN
    DROP TRIGGER IF EXISTS trg_mirror_twaater_notification ON public.twaater_notifications;
    CREATE TRIGGER trg_mirror_twaater_notification
      AFTER INSERT ON public.twaater_notifications
      FOR EACH ROW EXECUTE FUNCTION public.mirror_twaater_notification();
  END IF;
END $$;

-- 5c. sponsorship_notifications -> notifications
CREATE OR REPLACE FUNCTION public.mirror_sponsorship_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile uuid;
BEGIN
  BEGIN EXECUTE 'SELECT ($1).user_id' INTO v_user_id USING NEW; EXCEPTION WHEN others THEN v_user_id := NULL; END;
  BEGIN EXECUTE 'SELECT ($1).profile_id' INTO v_profile USING NEW; EXCEPTION WHEN others THEN v_profile := NULL; END;
  IF v_user_id IS NULL AND v_profile IS NOT NULL THEN
    SELECT p.user_id INTO v_user_id FROM public.profiles p WHERE p.id = v_profile;
  END IF;
  PERFORM public.create_notification(
    v_user_id,
    v_profile,
    'sponsorship',
    'offer',
    'Sponsorship update',
    '',
    '/sponsorships',
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sponsorship_notifications') THEN
    DROP TRIGGER IF EXISTS trg_mirror_sponsorship_notification ON public.sponsorship_notifications;
    CREATE TRIGGER trg_mirror_sponsorship_notification
      AFTER INSERT ON public.sponsorship_notifications
      FOR EACH ROW EXECUTE FUNCTION public.mirror_sponsorship_notification();
  END IF;
END $$;

-- 5d. company_notifications -> notifications
CREATE OR REPLACE FUNCTION public.mirror_company_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile uuid;
BEGIN
  BEGIN EXECUTE 'SELECT ($1).user_id' INTO v_user_id USING NEW; EXCEPTION WHEN others THEN v_user_id := NULL; END;
  BEGIN EXECUTE 'SELECT ($1).profile_id' INTO v_profile USING NEW; EXCEPTION WHEN others THEN v_profile := NULL; END;
  IF v_user_id IS NULL AND v_profile IS NOT NULL THEN
    SELECT p.user_id INTO v_user_id FROM public.profiles p WHERE p.id = v_profile;
  END IF;
  PERFORM public.create_notification(
    v_user_id,
    v_profile,
    'company',
    'info',
    'Company update',
    '',
    '/companies',
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='company_notifications') THEN
    DROP TRIGGER IF EXISTS trg_mirror_company_notification ON public.company_notifications;
    CREATE TRIGGER trg_mirror_company_notification
      AFTER INSERT ON public.company_notifications
      FOR EACH ROW EXECUTE FUNCTION public.mirror_company_notification();
  END IF;
END $$;

-- 5e. child_requests status change -> notifications
CREATE OR REPLACE FUNCTION public.mirror_child_request_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_a uuid;
  v_user_b uuid;
  v_title text;
  v_msg text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_user_a FROM public.profiles WHERE id = NEW.parent_a_id;
  IF NEW.parent_b_id IS NOT NULL THEN
    SELECT user_id INTO v_user_b FROM public.profiles WHERE id = NEW.parent_b_id;
  END IF;

  IF NEW.pathway = 'adoption' THEN
    v_title := CASE NEW.status
      WHEN 'pending' THEN 'Adoption application submitted'
      WHEN 'home_study' THEN 'Adoption home study started'
      WHEN 'matched' THEN 'You have been matched with a child'
      WHEN 'completed' THEN 'Adoption finalized'
      WHEN 'declined' THEN 'Adoption application declined'
      ELSE 'Adoption update'
    END;
  ELSE
    v_title := CASE NEW.status
      WHEN 'pending' THEN 'Child request awaiting partner'
      WHEN 'accepted' THEN 'Child request accepted'
      WHEN 'completed' THEN 'A child has been born'
      WHEN 'declined' THEN 'Child request declined'
      ELSE 'Family update'
    END;
  END IF;

  v_msg := COALESCE('Status: ' || NEW.status, '');

  PERFORM public.create_notification(v_user_a, NEW.parent_a_id, 'family', 'info', v_title, v_msg, '/relationships', to_jsonb(NEW));
  IF v_user_b IS NOT NULL THEN
    PERFORM public.create_notification(v_user_b, NEW.parent_b_id, 'family', 'info', v_title, v_msg, '/relationships', to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_child_request_notification ON public.child_requests;
CREATE TRIGGER trg_mirror_child_request_notification
  AFTER INSERT OR UPDATE OF status ON public.child_requests
  FOR EACH ROW EXECUTE FUNCTION public.mirror_child_request_notification();
