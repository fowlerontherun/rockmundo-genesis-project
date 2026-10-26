-- Friendships were created with canonical requestor_id/addressee_id on
-- September 18, 2025. The September 20 compatibility migration may have
-- encountered older user_id/friend_user_id columns on drifted installations.
-- Rename only legacy columns when they still exist; never assume all DBs drifted.
DO $normalize_friendships$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='friendships' AND column_name='user_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='friendships' AND column_name='requestor_id'
    ) THEN
      RAISE EXCEPTION 'Friendships has both user_id and requestor_id; manual reconciliation required';
    END IF;
    ALTER TABLE public.friendships RENAME COLUMN user_id TO requestor_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='friendships' AND column_name='friend_user_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='friendships' AND column_name='addressee_id'
    ) THEN
      RAISE EXCEPTION 'Friendships has both friend_user_id and addressee_id; manual reconciliation required';
    END IF;
    ALTER TABLE public.friendships RENAME COLUMN friend_user_id TO addressee_id;
  END IF;
END $normalize_friendships$;

ALTER TABLE public.friendships
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;
ALTER TABLE public.friendships
  DROP COLUMN IF EXISTS user_profile_id;
ALTER TABLE public.friendships
  DROP COLUMN IF EXISTS friend_profile_id;

-- Friendship IDs are PROFILE IDs, not auth.users IDs. Verify auth ownership
-- through profiles before granting client access to either endpoint.
DROP POLICY IF EXISTS "Users can create friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can update their friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friendships;

CREATE POLICY "Users can create friendships"
  ON public.friendships FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = requestor_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Users can update their friendships"
  ON public.friendships FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = requestor_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = addressee_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Users can view their own friendships"
  ON public.friendships FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = requestor_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = addressee_id AND p.user_id = auth.uid())
  );
