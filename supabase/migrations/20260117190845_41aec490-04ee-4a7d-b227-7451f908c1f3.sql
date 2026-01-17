-- Create merchandise factories table
CREATE TABLE public.merch_factories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city_id UUID REFERENCES public.cities(id),
  factory_type TEXT NOT NULL DEFAULT 'apparel' CHECK (factory_type IN ('apparel', 'accessories', 'vinyl', 'cd', 'posters', 'mixed')),
  quality_level INTEGER NOT NULL DEFAULT 1 CHECK (quality_level >= 1 AND quality_level <= 5),
  production_capacity INTEGER NOT NULL DEFAULT 100,
  current_production INTEGER NOT NULL DEFAULT 0,
  equipment_condition INTEGER NOT NULL DEFAULT 100 CHECK (equipment_condition >= 0 AND equipment_condition <= 100),
  worker_count INTEGER NOT NULL DEFAULT 5,
  worker_skill_avg NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  operating_costs_daily NUMERIC(12,2) NOT NULL DEFAULT 500,
  is_operational BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product catalog table
CREATE TABLE public.merch_product_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id UUID REFERENCES public.merch_factories(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('tshirt', 'hoodie', 'cap', 'poster', 'vinyl', 'cd', 'sticker', 'patch', 'keychain', 'mug')),
  base_cost NUMERIC(10,2) NOT NULL,
  suggested_price NUMERIC(10,2) NOT NULL,
  production_time_hours INTEGER NOT NULL DEFAULT 1,
  min_order_quantity INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create production queue table
CREATE TABLE public.merch_production_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id UUID REFERENCES public.merch_factories(id) ON DELETE CASCADE,
  product_catalog_id UUID REFERENCES public.merch_product_catalog(id) ON DELETE CASCADE,
  client_band_id UUID REFERENCES public.bands(id) ON DELETE SET NULL,
  client_label_id UUID REFERENCES public.labels(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(10,2) NOT NULL,
  total_cost NUMERIC(12,2) NOT NULL,
  quality_rating NUMERIC(3,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_production', 'quality_check', 'completed', 'shipped', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  started_at TIMESTAMP WITH TIME ZONE,
  estimated_completion TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  shipped_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create factory workers table
CREATE TABLE public.merch_factory_workers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id UUID REFERENCES public.merch_factories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'production' CHECK (role IN ('production', 'quality_control', 'supervisor', 'maintenance')),
  skill_level NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (skill_level >= 1 AND skill_level <= 5),
  experience_months INTEGER NOT NULL DEFAULT 0,
  salary_weekly NUMERIC(10,2) NOT NULL DEFAULT 500,
  morale INTEGER NOT NULL DEFAULT 75 CHECK (morale >= 0 AND morale <= 100),
  hired_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quality control records table
CREATE TABLE public.merch_quality_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_queue_id UUID REFERENCES public.merch_production_queue(id) ON DELETE CASCADE,
  inspector_id UUID REFERENCES public.merch_factory_workers(id) ON DELETE SET NULL,
  items_inspected INTEGER NOT NULL,
  items_passed INTEGER NOT NULL,
  items_failed INTEGER NOT NULL,
  defect_types JSONB,
  quality_score NUMERIC(3,2) NOT NULL,
  notes TEXT,
  inspected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create factory contracts table (for bands/labels ordering merch)
CREATE TABLE public.merch_factory_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id UUID REFERENCES public.merch_factories(id) ON DELETE CASCADE,
  client_band_id UUID REFERENCES public.bands(id) ON DELETE SET NULL,
  client_label_id UUID REFERENCES public.labels(id) ON DELETE SET NULL,
  contract_type TEXT NOT NULL DEFAULT 'per_order' CHECK (contract_type IN ('per_order', 'monthly', 'exclusive')),
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  minimum_monthly_orders INTEGER,
  priority_level INTEGER NOT NULL DEFAULT 5,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.merch_factories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merch_product_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merch_production_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merch_factory_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merch_quality_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merch_factory_contracts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for merch_factories
CREATE POLICY "Users can view factories of their companies"
  ON public.merch_factories FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = merch_factories.company_id AND c.owner_id = auth.uid()
  ));

CREATE POLICY "Users can manage factories of their companies"
  ON public.merch_factories FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = merch_factories.company_id AND c.owner_id = auth.uid()
  ));

-- RLS Policies for merch_product_catalog
CREATE POLICY "Users can view product catalog"
  ON public.merch_product_catalog FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.merch_factories f
    JOIN public.companies c ON c.id = f.company_id
    WHERE f.id = merch_product_catalog.factory_id AND c.owner_id = auth.uid()
  ));

CREATE POLICY "Users can manage product catalog"
  ON public.merch_product_catalog FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.merch_factories f
    JOIN public.companies c ON c.id = f.company_id
    WHERE f.id = merch_product_catalog.factory_id AND c.owner_id = auth.uid()
  ));

-- RLS Policies for merch_production_queue
CREATE POLICY "Users can view production queue"
  ON public.merch_production_queue FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.merch_factories f
    JOIN public.companies c ON c.id = f.company_id
    WHERE f.id = merch_production_queue.factory_id AND c.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = merch_production_queue.client_band_id AND bm.user_id = auth.uid()
  ));

CREATE POLICY "Factory owners can manage production queue"
  ON public.merch_production_queue FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.merch_factories f
    JOIN public.companies c ON c.id = f.company_id
    WHERE f.id = merch_production_queue.factory_id AND c.owner_id = auth.uid()
  ));

-- RLS Policies for merch_factory_workers
CREATE POLICY "Users can view factory workers"
  ON public.merch_factory_workers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.merch_factories f
    JOIN public.companies c ON c.id = f.company_id
    WHERE f.id = merch_factory_workers.factory_id AND c.owner_id = auth.uid()
  ));

CREATE POLICY "Users can manage factory workers"
  ON public.merch_factory_workers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.merch_factories f
    JOIN public.companies c ON c.id = f.company_id
    WHERE f.id = merch_factory_workers.factory_id AND c.owner_id = auth.uid()
  ));

-- RLS Policies for merch_quality_records
CREATE POLICY "Users can view quality records"
  ON public.merch_quality_records FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.merch_production_queue pq
    JOIN public.merch_factories f ON f.id = pq.factory_id
    JOIN public.companies c ON c.id = f.company_id
    WHERE pq.id = merch_quality_records.production_queue_id AND c.owner_id = auth.uid()
  ));

CREATE POLICY "Users can manage quality records"
  ON public.merch_quality_records FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.merch_production_queue pq
    JOIN public.merch_factories f ON f.id = pq.factory_id
    JOIN public.companies c ON c.id = f.company_id
    WHERE pq.id = merch_quality_records.production_queue_id AND c.owner_id = auth.uid()
  ));

-- RLS Policies for merch_factory_contracts
CREATE POLICY "Users can view factory contracts"
  ON public.merch_factory_contracts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.merch_factories f
    JOIN public.companies c ON c.id = f.company_id
    WHERE f.id = merch_factory_contracts.factory_id AND c.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = merch_factory_contracts.client_band_id AND bm.user_id = auth.uid()
  ));

CREATE POLICY "Factory owners can manage contracts"
  ON public.merch_factory_contracts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.merch_factories f
    JOIN public.companies c ON c.id = f.company_id
    WHERE f.id = merch_factory_contracts.factory_id AND c.owner_id = auth.uid()
  ));

-- Create indexes for performance
CREATE INDEX idx_merch_factories_company ON public.merch_factories(company_id);
CREATE INDEX idx_merch_product_catalog_factory ON public.merch_product_catalog(factory_id);
CREATE INDEX idx_merch_production_queue_factory ON public.merch_production_queue(factory_id);
CREATE INDEX idx_merch_production_queue_status ON public.merch_production_queue(status);
CREATE INDEX idx_merch_factory_workers_factory ON public.merch_factory_workers(factory_id);
CREATE INDEX idx_merch_factory_contracts_factory ON public.merch_factory_contracts(factory_id);

-- Create trigger for updated_at
CREATE TRIGGER update_merch_factories_updated_at
  BEFORE UPDATE ON public.merch_factories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_merch_production_queue_updated_at
  BEFORE UPDATE ON public.merch_production_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_merch_factory_contracts_updated_at
  BEFORE UPDATE ON public.merch_factory_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();