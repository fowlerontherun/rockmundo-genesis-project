-- Create notifications table to store realtime alerts for users
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('gig_invite', 'band_request', 'fan_milestone', 'achievement', 'system')),
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications (user_id, read);
CREATE INDEX IF NOT EXISTS notifications_timestamp_idx ON public.notifications ("timestamp" DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
CREATE POLICY "Users can view their notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their notifications" ON public.notifications;
CREATE POLICY "Users can insert their notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
CREATE POLICY "Users can update their notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
