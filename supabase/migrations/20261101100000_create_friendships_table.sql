BEGIN;

-- Create enum type for friendship status values
CREATE TYPE IF NOT EXISTS public.friendship_status AS ENUM ('pending', 'accepted', 'declined', 'blocked');

-- Table to manage friend relationships and requests between profiles
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requestor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.friendship_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  responded_at timestamptz,
  CONSTRAINT friendships_no_self_reference CHECK (requestor_id <> addressee_id)
);

-- Ensure each pair of profiles only has a single friendship record regardless of ordering
CREATE UNIQUE INDEX friendships_unique_pair_idx
  ON public.friendships (
    LEAST(requestor_id, addressee_id),
    GREATEST(requestor_id, addressee_id)
  );

CREATE INDEX friendships_requestor_idx ON public.friendships (requestor_id);
CREATE INDEX friendships_addressee_idx ON public.friendships (addressee_id);
CREATE INDEX friendships_status_idx ON public.friendships (status);

-- Track update timestamps automatically
CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Automatically record when a friendship leaves the pending state
CREATE OR REPLACE FUNCTION public.set_friendship_responded_at()
RETURNS trigger AS $$
BEGIN
  IF NEW.status <> 'pending'::public.friendship_status
     AND (OLD.status IS NULL OR OLD.status = 'pending'::public.friendship_status)
     AND NEW.responded_at IS NULL THEN
    NEW.responded_at := timezone('utc', now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_friendships_responded_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.set_friendship_responded_at();

-- Enable row level security so only participants can interact with their friendships
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Friendship participants can view"
  ON public.friendships
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = requestor_id AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = addressee_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Requesters can create friendships"
  ON public.friendships
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = requestor_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Participants manage friendships"
  ON public.friendships
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = requestor_id AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = addressee_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = requestor_id AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = addressee_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can delete friendships"
  ON public.friendships
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = requestor_id AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = addressee_id AND p.user_id = auth.uid()
    )
  );

-- Convenience views for common friendship states
CREATE OR REPLACE VIEW public.pending_friendships AS
SELECT *
FROM public.friendships
WHERE status = 'pending'::public.friendship_status;

CREATE OR REPLACE VIEW public.accepted_friendships AS
SELECT *
FROM public.friendships
WHERE status = 'accepted'::public.friendship_status;

-- Include friendships in realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;

COMMIT;
