-- Create brand catalog for sponsorships
CREATE TABLE IF NOT EXISTS public.sponsorship_brands (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  size text NOT NULL DEFAULT 'emerging',
  wealth_score integer NOT NULL DEFAULT 1,
  available_budget numeric NOT NULL DEFAULT 0,
  targeting_flags text[] NOT NULL DEFAULT '{}',
  min_fame_threshold integer NOT NULL DEFAULT 0,
  exclusivity_pref boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  cooldown_until timestamptz,
  last_offer_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Track eligible entities for sponsorship matching
CREATE TABLE IF NOT EXISTS public.sponsorship_entities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_id uuid REFERENCES public.bands(id) ON DELETE CASCADE,
  brand_flags text[] NOT NULL DEFAULT '{}',
  fame_momentum numeric NOT NULL DEFAULT 0,
  event_attendance_score numeric NOT NULL DEFAULT 0,
  chart_momentum numeric NOT NULL DEFAULT 0,
  max_deals integer NOT NULL DEFAULT 3,
  active_deals integer NOT NULL DEFAULT 0,
  last_offer_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Persist generated offers
CREATE TABLE IF NOT EXISTS public.sponsorship_offers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid REFERENCES public.sponsorship_brands(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES public.sponsorship_entities(id) ON DELETE CASCADE,
  offer_type text NOT NULL,
  payout numeric NOT NULL,
  exclusivity boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  terms jsonb,
  metadata jsonb,
  expiration_notification_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Notifications for sponsorship lifecycle
CREATE TABLE IF NOT EXISTS public.sponsorship_notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id uuid REFERENCES public.sponsorship_entities(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.sponsorship_offers(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS sponsorship_offers_status_idx ON public.sponsorship_offers(status);
CREATE INDEX IF NOT EXISTS sponsorship_offers_expiry_idx ON public.sponsorship_offers(expires_at);
CREATE INDEX IF NOT EXISTS sponsorship_entities_band_idx ON public.sponsorship_entities(band_id);

-- Enable RLS for new tables
ALTER TABLE public.sponsorship_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_notifications ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to browse active sponsorship brands
CREATE POLICY sponsorship_brands_read_all ON public.sponsorship_brands
FOR SELECT USING (true);

-- Allow bands to access their sponsorship entity profile
CREATE POLICY sponsorship_entities_read_band ON public.sponsorship_entities
FOR SELECT USING (
  band_id IN (SELECT id FROM public.bands WHERE leader_id = auth.uid())
);

-- Allow bands to see offers tied to their entity
CREATE POLICY sponsorship_offers_read_band ON public.sponsorship_offers
FOR SELECT USING (
  entity_id IN (
    SELECT id FROM public.sponsorship_entities se
    WHERE se.id = sponsorship_offers.entity_id
      AND se.band_id IN (SELECT id FROM public.bands WHERE leader_id = auth.uid())
  )
);

-- Allow bands to see notifications tied to their offers
CREATE POLICY sponsorship_notifications_read_band ON public.sponsorship_notifications
FOR SELECT USING (
  entity_id IN (
    SELECT id FROM public.sponsorship_entities se
    WHERE se.id = sponsorship_notifications.entity_id
      AND se.band_id IN (SELECT id FROM public.bands WHERE leader_id = auth.uid())
  )
);

-- Register cron job
INSERT INTO cron_job_config (job_name, edge_function_name, display_name, description, schedule, is_active, allow_manual_trigger)
VALUES (
  'generate-sponsorship-offers',
  'generate-sponsorship-offers',
  'Generate Sponsorship Offers',
  'Score bands against active brands and issue sponsorship offers with expirations',
  '0 */6 * * *',
  true,
  true
)
ON CONFLICT (job_name) DO UPDATE SET
  edge_function_name = EXCLUDED.edge_function_name,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  schedule = EXCLUDED.schedule,
  is_active = EXCLUDED.is_active,
  allow_manual_trigger = EXCLUDED.allow_manual_trigger;
