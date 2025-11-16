-- Create contract_clauses table
CREATE TABLE IF NOT EXISTS public.contract_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_type TEXT NOT NULL,
  clause_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  default_terms JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contract_type, clause_key)
);

-- Create contract_negotiations table
CREATE TABLE IF NOT EXISTS public.contract_negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.artist_label_contracts(id) ON DELETE CASCADE,
  clause_id UUID NOT NULL REFERENCES public.contract_clauses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  proposed_terms JSONB,
  counter_terms JSONB,
  last_action_by TEXT DEFAULT 'artist',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contract_id, clause_id)
);

-- Enable RLS
ALTER TABLE public.contract_clauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_negotiations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contract_clauses
CREATE POLICY "Contract clauses are viewable by everyone"
  ON public.contract_clauses
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage contract clauses"
  ON public.contract_clauses
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for contract_negotiations
CREATE POLICY "Negotiations are viewable by involved parties"
  ON public.contract_negotiations
  FOR SELECT
  USING (
    contract_id IN (
      SELECT id FROM artist_label_contracts
      WHERE 
        -- Label owners can view
        (EXISTS (SELECT 1 FROM labels WHERE labels.id = artist_label_contracts.label_id AND labels.created_by = auth.uid()))
        -- Band leaders can view
        OR (EXISTS (SELECT 1 FROM bands WHERE bands.id = artist_label_contracts.band_id AND bands.leader_id = auth.uid()))
        -- Solo artists can view
        OR (artist_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
    )
  );

CREATE POLICY "Involved parties can create negotiations"
  ON public.contract_negotiations
  FOR INSERT
  WITH CHECK (
    contract_id IN (
      SELECT id FROM artist_label_contracts
      WHERE 
        (EXISTS (SELECT 1 FROM labels WHERE labels.id = artist_label_contracts.label_id AND labels.created_by = auth.uid()))
        OR (EXISTS (SELECT 1 FROM bands WHERE bands.id = artist_label_contracts.band_id AND bands.leader_id = auth.uid()))
        OR (artist_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
    )
  );

CREATE POLICY "Involved parties can update negotiations"
  ON public.contract_negotiations
  FOR UPDATE
  USING (
    contract_id IN (
      SELECT id FROM artist_label_contracts
      WHERE 
        (EXISTS (SELECT 1 FROM labels WHERE labels.id = artist_label_contracts.label_id AND labels.created_by = auth.uid()))
        OR (EXISTS (SELECT 1 FROM bands WHERE bands.id = artist_label_contracts.band_id AND bands.leader_id = auth.uid()))
        OR (artist_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_contract_clauses_type ON public.contract_clauses(contract_type);
CREATE INDEX idx_contract_negotiations_contract ON public.contract_negotiations(contract_id);
CREATE INDEX idx_contract_negotiations_status ON public.contract_negotiations(status);

-- Add updated_at trigger
CREATE TRIGGER update_contract_clauses_updated_at
  BEFORE UPDATE ON public.contract_clauses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contract_negotiations_updated_at
  BEFORE UPDATE ON public.contract_negotiations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();