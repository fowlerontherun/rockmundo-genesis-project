
-- Festival offer negotiations table
CREATE TABLE public.festival_offer_negotiations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  counter_payment NUMERIC NOT NULL DEFAULT 0,
  merch_cut_percent NUMERIC NOT NULL DEFAULT 0,
  request_backstage BOOLEAN NOT NULL DEFAULT false,
  request_hotel BOOLEAN NOT NULL DEFAULT false,
  request_transport BOOLEAN NOT NULL DEFAULT false,
  request_soundcheck BOOLEAN NOT NULL DEFAULT false,
  total_value NUMERIC NOT NULL DEFAULT 0,
  acceptance_probability INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_response_note TEXT,
  negotiated_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.festival_offer_negotiations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own band negotiations"
  ON public.festival_offer_negotiations FOR SELECT TO authenticated
  USING (band_id IN (SELECT band_id FROM public.band_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can create negotiations for own bands"
  ON public.festival_offer_negotiations FOR INSERT TO authenticated
  WITH CHECK (negotiated_by_user_id = auth.uid() AND band_id IN (SELECT band_id FROM public.band_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own negotiations"
  ON public.festival_offer_negotiations FOR UPDATE TO authenticated
  USING (negotiated_by_user_id = auth.uid());

-- Festival backstage events table
CREATE TABLE public.festival_backstage_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  festival_id UUID NOT NULL,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  choices JSONB NOT NULL DEFAULT '[]'::jsonb,
  chosen_option INTEGER,
  outcome_text TEXT,
  fame_impact INTEGER DEFAULT 0,
  money_impact INTEGER DEFAULT 0,
  chemistry_impact INTEGER DEFAULT 0,
  reputation_impact JSONB DEFAULT '{}'::jsonb,
  triggered_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.festival_backstage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own band backstage events"
  ON public.festival_backstage_events FOR SELECT TO authenticated
  USING (band_id IN (SELECT band_id FROM public.band_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can create backstage events for own bands"
  ON public.festival_backstage_events FOR INSERT TO authenticated
  WITH CHECK (triggered_by_user_id = auth.uid() AND band_id IN (SELECT band_id FROM public.band_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own backstage events"
  ON public.festival_backstage_events FOR UPDATE TO authenticated
  USING (triggered_by_user_id = auth.uid());
