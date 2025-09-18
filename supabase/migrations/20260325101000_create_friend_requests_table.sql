-- Create friend request tracking table
DO $$
BEGIN
  CREATE TYPE public.friend_request_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.friend_request_status NOT NULL DEFAULT 'pending',
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  pair_key text GENERATED ALWAYS AS (
    CASE
      WHEN sender_user_id::text < recipient_user_id::text THEN sender_user_id::text || ':' || recipient_user_id::text
      ELSE recipient_user_id::text || ':' || sender_user_id::text
    END
  ) STORED,
  CONSTRAINT friend_requests_sender_differs CHECK (sender_user_id <> recipient_user_id)
);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.friend_requests TO authenticated;

CREATE POLICY "Participants can view friend requests"
  ON public.friend_requests
  FOR SELECT
  USING (auth.uid() = sender_user_id OR auth.uid() = recipient_user_id);

CREATE POLICY "Players can create friend requests"
  ON public.friend_requests
  FOR INSERT
  WITH CHECK (auth.uid() = sender_user_id);

CREATE POLICY "Participants can update friend requests"
  ON public.friend_requests
  FOR UPDATE
  USING (auth.uid() = sender_user_id OR auth.uid() = recipient_user_id)
  WITH CHECK (auth.uid() = sender_user_id OR auth.uid() = recipient_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_pending_pair_idx
  ON public.friend_requests (pair_key)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS friend_requests_sender_idx
  ON public.friend_requests (sender_user_id, status);

CREATE INDEX IF NOT EXISTS friend_requests_recipient_idx
  ON public.friend_requests (recipient_user_id, status);
