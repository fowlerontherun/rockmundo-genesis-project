-- Phase 10: Advanced Company Features
-- Company-wide analytics, cross-business integration, and consolidated reporting

-- Company financial reports table (monthly snapshots)
CREATE TABLE IF NOT EXISTS company_financial_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_period date NOT NULL,
  report_type text NOT NULL DEFAULT 'monthly' CHECK (report_type IN ('weekly', 'monthly', 'quarterly', 'annual')),
  total_revenue numeric DEFAULT 0,
  total_expenses numeric DEFAULT 0,
  net_profit numeric DEFAULT 0,
  revenue_breakdown jsonb DEFAULT '{}',
  expense_breakdown jsonb DEFAULT '{}',
  subsidiary_performance jsonb DEFAULT '{}',
  employee_costs numeric DEFAULT 0,
  operating_costs numeric DEFAULT 0,
  capital_expenditure numeric DEFAULT 0,
  opening_balance numeric DEFAULT 0,
  closing_balance numeric DEFAULT 0,
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Company KPI metrics tracking
CREATE TABLE IF NOT EXISTS company_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  metric_date date NOT NULL DEFAULT CURRENT_DATE,
  total_subsidiaries integer DEFAULT 0,
  total_employees integer DEFAULT 0,
  total_contracts_active integer DEFAULT 0,
  total_contracts_completed integer DEFAULT 0,
  customer_satisfaction_avg numeric DEFAULT 0,
  reputation_avg numeric DEFAULT 0,
  market_share_estimate numeric DEFAULT 0,
  growth_rate_monthly numeric DEFAULT 0,
  liquidity_ratio numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, metric_date)
);

-- Cross-business synergies (discounts between owned businesses)
CREATE TABLE IF NOT EXISTS company_synergies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  synergy_type text NOT NULL CHECK (synergy_type IN ('label_venue', 'label_studio', 'venue_security', 'venue_logistics', 'factory_logistics', 'studio_label', 'all_in_house')),
  discount_percent numeric DEFAULT 10 CHECK (discount_percent >= 0 AND discount_percent <= 50),
  is_active boolean DEFAULT true,
  activated_at timestamptz DEFAULT now(),
  requirements_met boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Company goals and milestones
CREATE TABLE IF NOT EXISTS company_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  goal_type text NOT NULL CHECK (goal_type IN ('revenue', 'employees', 'subsidiaries', 'contracts', 'reputation', 'market_share', 'custom')),
  title text NOT NULL,
  description text,
  target_value numeric NOT NULL,
  current_value numeric DEFAULT 0,
  deadline date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'cancelled')),
  reward_type text,
  reward_value numeric,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Company notifications/alerts
CREATE TABLE IF NOT EXISTS company_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('contract_pending', 'payment_due', 'employee_issue', 'goal_progress', 'synergy_unlocked', 'financial_alert', 'milestone', 'warning')),
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  title text NOT NULL,
  message text,
  related_entity_type text,
  related_entity_id uuid,
  is_read boolean DEFAULT false,
  is_dismissed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- Cross-business service usage (track when owned businesses serve each other)
CREATE TABLE IF NOT EXISTS company_internal_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider_type text NOT NULL CHECK (provider_type IN ('security_firm', 'logistics', 'venue', 'studio', 'rehearsal', 'factory', 'label')),
  provider_entity_id uuid NOT NULL,
  consumer_type text NOT NULL CHECK (consumer_type IN ('band', 'label', 'venue', 'tour', 'gig', 'recording')),
  consumer_entity_id uuid NOT NULL,
  service_type text NOT NULL,
  original_cost numeric NOT NULL,
  discount_applied numeric DEFAULT 0,
  final_cost numeric NOT NULL,
  service_date timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE company_financial_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_synergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_internal_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies for financial reports
CREATE POLICY "Company owners can view financial reports"
ON company_financial_reports FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = company_financial_reports.company_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "System can insert financial reports"
ON company_financial_reports FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = company_financial_reports.company_id
    AND c.owner_id = auth.uid()
  )
);

-- RLS for KPIs
CREATE POLICY "Company owners can view KPIs"
ON company_kpis FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = company_kpis.company_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "System can manage KPIs"
ON company_kpis FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = company_kpis.company_id
    AND c.owner_id = auth.uid()
  )
);

-- RLS for synergies
CREATE POLICY "Company owners can view synergies"
ON company_synergies FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = company_synergies.company_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Company owners can manage synergies"
ON company_synergies FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = company_synergies.company_id
    AND c.owner_id = auth.uid()
  )
);

-- RLS for goals
CREATE POLICY "Company owners can manage goals"
ON company_goals FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = company_goals.company_id
    AND c.owner_id = auth.uid()
  )
);

-- RLS for notifications
CREATE POLICY "Company owners can manage notifications"
ON company_notifications FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = company_notifications.company_id
    AND c.owner_id = auth.uid()
  )
);

-- RLS for internal services
CREATE POLICY "Company owners can view internal services"
ON company_internal_services FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = company_internal_services.company_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Company owners can record internal services"
ON company_internal_services FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = company_internal_services.company_id
    AND c.owner_id = auth.uid()
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_financial_reports_company ON company_financial_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_reports_period ON company_financial_reports(report_period);
CREATE INDEX IF NOT EXISTS idx_kpis_company_date ON company_kpis(company_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_synergies_company ON company_synergies(company_id);
CREATE INDEX IF NOT EXISTS idx_goals_company_status ON company_goals(company_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_company_unread ON company_notifications(company_id, is_read) WHERE NOT is_read;
CREATE INDEX IF NOT EXISTS idx_internal_services_company ON company_internal_services(company_id);
CREATE INDEX IF NOT EXISTS idx_internal_services_date ON company_internal_services(service_date);