
CREATE TABLE public.party_manifestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES public.political_parties(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  position TEXT NOT NULL,
  details TEXT,
  position_order INTEGER NOT NULL DEFAULT 0,
  created_by_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_party_manifestos_party ON public.party_manifestos(party_id, position_order);

ALTER TABLE public.party_manifestos ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Manifestos are world-readable"
  ON public.party_manifestos FOR SELECT
  USING (true);

-- Only founders / officers may insert
CREATE POLICY "Party leadership can add planks"
  ON public.party_manifestos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.party_memberships pm
      JOIN public.profiles p ON p.id = pm.profile_id
      WHERE pm.party_id = party_manifestos.party_id
        AND p.user_id = auth.uid()
        AND pm.role IN ('founder', 'officer')
    )
  );

-- Only founders / officers may update
CREATE POLICY "Party leadership can edit planks"
  ON public.party_manifestos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.party_memberships pm
      JOIN public.profiles p ON p.id = pm.profile_id
      WHERE pm.party_id = party_manifestos.party_id
        AND p.user_id = auth.uid()
        AND pm.role IN ('founder', 'officer')
    )
  );

-- Only founders / officers may delete
CREATE POLICY "Party leadership can remove planks"
  ON public.party_manifestos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.party_memberships pm
      JOIN public.profiles p ON p.id = pm.profile_id
      WHERE pm.party_id = party_manifestos.party_id
        AND p.user_id = auth.uid()
        AND pm.role IN ('founder', 'officer')
    )
  );

CREATE TRIGGER party_manifestos_set_updated_at
BEFORE UPDATE ON public.party_manifestos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
