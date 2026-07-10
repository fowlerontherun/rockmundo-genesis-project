-- Beta RLS hardening for private player progress, casting workflows, admin assets, and admin audit logs.

-- Private player skill state: catalog metadata stays public, but per-profile progress/unlocks do not.
DROP POLICY IF EXISTS "Profile skill progress is viewable by everyone" ON public.profile_skill_progress;
DROP POLICY IF EXISTS "Profile skill unlocks are viewable by everyone" ON public.profile_skill_unlocks;

CREATE POLICY "Users can view their own skill progress"
  ON public.profile_skill_progress
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_skill_progress.profile_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own skill unlocks"
  ON public.profile_skill_unlocks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_skill_unlocks.profile_id
        AND p.user_id = auth.uid()
    )
  );

-- Presence is user-private except for admins. Public chat messages remain governed by chat_messages policies.
DROP POLICY IF EXISTS "Chat participants are viewable by everyone" ON public.chat_participants;

CREATE POLICY "Users can view their own chat presence"
  ON public.chat_participants
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Casting submissions include resumes, portfolios, and feedback. Limit review access to call owners/admins.
DROP POLICY IF EXISTS "Reviewers can read all submissions" ON public.casting_submissions;
DROP POLICY IF EXISTS "Reviewers can read reviews" ON public.casting_reviews;
DROP POLICY IF EXISTS "Reviewers can insert reviews" ON public.casting_reviews;

CREATE POLICY "Casting call owners can read submissions"
  ON public.casting_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.casting_calls cc
      WHERE cc.id = casting_submissions.casting_call_id
        AND cc.created_by = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Submission participants can read reviews"
  ON public.casting_reviews
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.casting_submissions cs
      LEFT JOIN public.casting_calls cc ON cc.id = cs.casting_call_id
      LEFT JOIN public.profiles p ON p.id = cs.talent_profile_id
      WHERE cs.id = casting_reviews.submission_id
        AND (
          p.user_id = auth.uid()
          OR cc.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

CREATE POLICY "Casting call owners can insert reviews"
  ON public.casting_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.casting_submissions cs
      JOIN public.casting_calls cc ON cc.id = cs.casting_call_id
      WHERE cs.id = casting_reviews.submission_id
        AND (cc.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
    )
  );

-- Admin-managed public asset buckets: read remains public, writes require server-side admin role.
DROP POLICY IF EXISTS "Authenticated upload practice tracks" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update practice tracks" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete practice tracks" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload POV clips" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update POV clips" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload DikCok thumbnails" ON storage.objects;

CREATE POLICY "Admins can upload practice tracks"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'practice-tracks' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update practice tracks"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'practice-tracks' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'practice-tracks' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete practice tracks"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'practice-tracks' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can upload POV clips"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pov-clips' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update POV clips"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pov-clips' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'pov-clips' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can upload DikCok thumbnails"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dikcok-thumbnails' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Append-only audit log for sensitive admin actions performed by Edge Functions/RPCs.
CREATE TABLE IF NOT EXISTS public.admin_action_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_table text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_action_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read admin action audit"
  ON public.admin_action_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Service role can append admin action audit"
  ON public.admin_action_audit
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
