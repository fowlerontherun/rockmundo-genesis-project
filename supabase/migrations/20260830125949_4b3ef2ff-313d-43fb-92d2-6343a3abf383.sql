-- 1. Ownership helper
CREATE OR REPLACE FUNCTION public.twaater_account_is_mine(_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.twaater_accounts a
    WHERE a.id = _account_id
      AND (
        (a.owner_type = 'persona'::twaater_owner_type AND a.owner_id IN (
           SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
        ))
        OR (a.owner_type = 'persona'::twaater_owner_type AND a.owner_id = auth.uid())
        OR (a.owner_type = 'band'::twaater_owner_type AND a.owner_id IN (
           SELECT b.id FROM public.bands b WHERE b.leader_id = auth.uid()
        ))
      )
  )
$$;

-- 2. Fix bookmarks policies
DROP POLICY IF EXISTS "Users can view their bookmarks" ON public.twaater_bookmarks;
DROP POLICY IF EXISTS "Users can create bookmarks" ON public.twaater_bookmarks;
DROP POLICY IF EXISTS "Users can delete their bookmarks" ON public.twaater_bookmarks;
CREATE POLICY "Users can view their bookmarks" ON public.twaater_bookmarks
  FOR SELECT TO authenticated USING (public.twaater_account_is_mine(account_id));
CREATE POLICY "Users can create bookmarks" ON public.twaater_bookmarks
  FOR INSERT TO authenticated WITH CHECK (public.twaater_account_is_mine(account_id));
CREATE POLICY "Users can delete their bookmarks" ON public.twaater_bookmarks
  FOR DELETE TO authenticated USING (public.twaater_account_is_mine(account_id));

-- 3. Fix poll votes
DROP POLICY IF EXISTS "Users can vote on polls" ON public.twaater_poll_votes;
CREATE POLICY "Users can vote on polls" ON public.twaater_poll_votes
  FOR INSERT TO authenticated WITH CHECK (public.twaater_account_is_mine(account_id));

-- 4. Fix notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.twaater_notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.twaater_notifications;
CREATE POLICY "Users can view their own notifications" ON public.twaater_notifications
  FOR SELECT TO authenticated USING (public.twaater_account_is_mine(account_id));
CREATE POLICY "Users can update their own notifications" ON public.twaater_notifications
  FOR UPDATE TO authenticated USING (public.twaater_account_is_mine(account_id));

-- 5. Fix message read status
DROP POLICY IF EXISTS "Users can mark their messages as read" ON public.twaater_messages;
CREATE POLICY "Users can mark their messages as read" ON public.twaater_messages
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.twaater_conversations c
      WHERE c.id = twaater_messages.conversation_id
        AND (public.twaater_account_is_mine(c.participant_1_id) OR public.twaater_account_is_mine(c.participant_2_id))
    )
  );

-- 6. Blocks
CREATE TABLE IF NOT EXISTS public.twaater_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_account_id uuid NOT NULL REFERENCES public.twaater_accounts(id) ON DELETE CASCADE,
  blocked_account_id uuid NOT NULL REFERENCES public.twaater_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT twaater_blocks_unique UNIQUE (blocker_account_id, blocked_account_id),
  CONSTRAINT twaater_blocks_not_self CHECK (blocker_account_id <> blocked_account_id)
);
GRANT SELECT, INSERT, DELETE ON public.twaater_blocks TO authenticated;
GRANT ALL ON public.twaater_blocks TO service_role;
ALTER TABLE public.twaater_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own blocks" ON public.twaater_blocks
  FOR SELECT TO authenticated USING (public.twaater_account_is_mine(blocker_account_id));
CREATE POLICY "Users can create their own blocks" ON public.twaater_blocks
  FOR INSERT TO authenticated WITH CHECK (public.twaater_account_is_mine(blocker_account_id));
CREATE POLICY "Users can remove their own blocks" ON public.twaater_blocks
  FOR DELETE TO authenticated USING (public.twaater_account_is_mine(blocker_account_id));

-- 7. Moderation columns on twaats
ALTER TABLE public.twaats
  ADD COLUMN IF NOT EXISTS is_flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason text,
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by uuid;

-- 8. Reports
CREATE TABLE IF NOT EXISTS public.twaat_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twaat_id uuid NOT NULL REFERENCES public.twaats(id) ON DELETE CASCADE,
  reporter_account_id uuid NOT NULL REFERENCES public.twaater_accounts(id) ON DELETE CASCADE,
  report_reason text NOT NULL,
  report_details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  CONSTRAINT twaat_reports_unique UNIQUE (twaat_id, reporter_account_id)
);
GRANT SELECT, INSERT, UPDATE ON public.twaat_reports TO authenticated;
GRANT ALL ON public.twaat_reports TO service_role;
ALTER TABLE public.twaat_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create reports" ON public.twaat_reports
  FOR INSERT TO authenticated WITH CHECK (public.twaater_account_is_mine(reporter_account_id));
CREATE POLICY "Users can view their own reports" ON public.twaat_reports
  FOR SELECT TO authenticated USING (public.twaater_account_is_mine(reporter_account_id));
CREATE POLICY "Admins can view all reports" ON public.twaat_reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update reports" ON public.twaat_reports
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 9. Filter words
CREATE TABLE IF NOT EXISTS public.twaater_filter_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL UNIQUE,
  severity text NOT NULL DEFAULT 'medium',
  auto_action text NOT NULL DEFAULT 'flag',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT ON public.twaater_filter_words TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.twaater_filter_words TO authenticated;
GRANT ALL ON public.twaater_filter_words TO service_role;
ALTER TABLE public.twaater_filter_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Filter words are viewable" ON public.twaater_filter_words
  FOR SELECT USING (true);
CREATE POLICY "Admins manage filter words" ON public.twaater_filter_words
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 10. Hide moderated posts from the public feed
DROP POLICY IF EXISTS "Public twaats are viewable by everyone" ON public.twaats;
CREATE POLICY "Public twaats are viewable by everyone" ON public.twaats
  FOR SELECT USING (
    visibility = 'public'::twaater_visibility
    AND deleted_at IS NULL
    AND moderation_status NOT IN ('hidden', 'rejected')
  );

-- 11. Automated content filtering
CREATE OR REPLACE FUNCTION public.check_twaat_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hit record;
BEGIN
  SELECT w.word, w.auto_action INTO hit
  FROM public.twaater_filter_words w
  WHERE NEW.body ILIKE '%' || w.word || '%'
  ORDER BY CASE w.auto_action WHEN 'reject' THEN 1 WHEN 'hide' THEN 2 ELSE 3 END
  LIMIT 1;

  IF hit.word IS NULL THEN
    RETURN NEW;
  END IF;

  IF hit.auto_action = 'reject' THEN
    RAISE EXCEPTION 'twaat_rejected_by_content_filter';
  ELSIF hit.auto_action = 'hide' THEN
    NEW.moderation_status := 'hidden';
    NEW.is_flagged := true;
    NEW.flag_reason := 'Automatic filter: ' || hit.word;
  ELSE
    NEW.is_flagged := true;
    NEW.flag_reason := 'Automatic filter: ' || hit.word;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_twaat_content_trigger ON public.twaats;
CREATE TRIGGER check_twaat_content_trigger
  BEFORE INSERT ON public.twaats
  FOR EACH ROW EXECUTE FUNCTION public.check_twaat_content();