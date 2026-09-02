-- Create enum for chat participant status
CREATE TYPE public.chat_participant_status AS ENUM ('online', 'typing', 'muted');

-- Table to track presence information for chat participants
CREATE TABLE public.chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'general',
  status public.chat_participant_status NOT NULL DEFAULT 'online',
  updated_at timestamptz DEFAULT now()
);

-- Ensure a single presence row per user
ALTER TABLE public.chat_participants
  ADD CONSTRAINT chat_participants_user_unique UNIQUE (user_id);

-- Maintain updated_at automatically
CREATE TRIGGER update_chat_participants_updated_at
  BEFORE UPDATE ON public.chat_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS and define policies
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat participants are viewable by everyone"
  ON public.chat_participants
  FOR SELECT
  USING (true);

CREATE POLICY "Users manage their own presence"
  ON public.chat_participants
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status <> 'muted'::public.chat_participant_status
  );

CREATE POLICY "Users update presence when not muted"
  ON public.chat_participants
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status <> 'muted'::public.chat_participant_status
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status <> 'muted'::public.chat_participant_status
  );

CREATE POLICY "Users can leave chat when not muted"
  ON public.chat_participants
  FOR DELETE
  USING (
    auth.uid() = user_id
    AND status <> 'muted'::public.chat_participant_status
  );

CREATE POLICY "Admins manage chat participants"
  ON public.chat_participants
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Make the table available to realtime subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
