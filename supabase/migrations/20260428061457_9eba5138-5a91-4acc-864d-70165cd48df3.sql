CREATE TABLE public.child_request_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.child_requests(id) ON DELETE CASCADE,
  actor_profile_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  resulting_status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_child_request_events_request ON public.child_request_events(request_id, created_at DESC);

ALTER TABLE public.child_request_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view request history"
ON public.child_request_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.child_requests cr
    JOIN public.profiles p ON p.id IN (cr.parent_a_id, cr.parent_b_id)
    WHERE cr.id = child_request_events.request_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Parents can insert request events"
ON public.child_request_events
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.child_requests cr
    JOIN public.profiles p ON p.id IN (cr.parent_a_id, cr.parent_b_id)
    WHERE cr.id = child_request_events.request_id
      AND p.user_id = auth.uid()
      AND p.id = child_request_events.actor_profile_id
  )
);