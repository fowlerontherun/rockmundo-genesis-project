-- Create fan_messages table to store direct communications from fans
CREATE TABLE IF NOT EXISTS public.fan_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fan_name TEXT NOT NULL,
  message TEXT NOT NULL,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
  is_read BOOLEAN NOT NULL DEFAULT false,
  reply_message TEXT,
  replied_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS fan_messages_user_id_idx ON public.fan_messages (user_id, is_read);
CREATE INDEX IF NOT EXISTS fan_messages_timestamp_idx ON public.fan_messages ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS fan_messages_sentiment_idx ON public.fan_messages (sentiment);

ALTER TABLE public.fan_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their fan messages" ON public.fan_messages;
CREATE POLICY "Users can view their fan messages"
  ON public.fan_messages
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their fan messages" ON public.fan_messages;
CREATE POLICY "Users can insert their fan messages"
  ON public.fan_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their fan messages" ON public.fan_messages;
CREATE POLICY "Users can update their fan messages"
  ON public.fan_messages
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
