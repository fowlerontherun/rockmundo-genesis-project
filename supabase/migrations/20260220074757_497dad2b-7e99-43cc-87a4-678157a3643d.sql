
-- Create the festival_slot_offers table
CREATE TABLE public.festival_slot_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  festival_id UUID NOT NULL REFERENCES public.game_events(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  stage_slot_id UUID REFERENCES public.festival_stage_slots(id) ON DELETE SET NULL,
  slot_type TEXT NOT NULL DEFAULT 'support',
  slot_date TEXT NOT NULL,
  slot_time TEXT,
  guaranteed_payment NUMERIC NOT NULL DEFAULT 0,
  message TEXT,
  additional_perks TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.festival_slot_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members can view festival offers"
  ON public.festival_slot_offers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.band_members
    WHERE band_members.band_id = festival_slot_offers.band_id
      AND band_members.user_id = auth.uid()
  ));

CREATE POLICY "Band members can respond to festival offers"
  ON public.festival_slot_offers FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.band_members
    WHERE band_members.band_id = festival_slot_offers.band_id
      AND band_members.user_id = auth.uid()
  ));

CREATE POLICY "Admins can create festival offers"
  ON public.festival_slot_offers FOR INSERT
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- Inbox notification trigger
CREATE OR REPLACE FUNCTION public.notify_festival_slot_offer()
RETURNS TRIGGER AS $$
DECLARE
  _festival_title TEXT;
  _member RECORD;
BEGIN
  SELECT title INTO _festival_title FROM public.game_events WHERE id = NEW.festival_id;

  FOR _member IN
    SELECT user_id FROM public.band_members
    WHERE band_id = NEW.band_id AND user_id IS NOT NULL
  LOOP
    INSERT INTO public.player_inbox (user_id, category, title, message, metadata, action_type, action_data, related_entity_type, related_entity_id)
    VALUES (
      _member.user_id,
      'festival',
      'Festival Invitation: ' || COALESCE(_festival_title, 'Unknown Festival'),
      'Your band has been invited to perform as ' || NEW.slot_type || ' at ' || COALESCE(_festival_title, 'a festival') || ' on ' || NEW.slot_date || '. Payment: $' || NEW.guaranteed_payment::TEXT,
      jsonb_build_object('type', 'festival_slot_offer', 'offer_id', NEW.id, 'festival_id', NEW.festival_id, 'band_id', NEW.band_id, 'slot_type', NEW.slot_type),
      'navigate',
      jsonb_build_object('route', '/band', 'tab', 'festival-offers')::jsonb,
      'festival_slot_offer',
      NEW.id::TEXT
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_notify_festival_slot_offer
  AFTER INSERT ON public.festival_slot_offers
  FOR EACH ROW EXECUTE FUNCTION public.notify_festival_slot_offer();
