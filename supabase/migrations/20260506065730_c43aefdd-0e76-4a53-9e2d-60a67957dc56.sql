ALTER TABLE public.travel_notification_preferences
ADD COLUMN IF NOT EXISTS auto_rejoin_enabled boolean NOT NULL DEFAULT true;