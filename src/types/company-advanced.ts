// Company Empire Advanced Types

export interface CompanyFinancialReport {
  id: string;
  company_id: string;
  report_period: string;
  report_type: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  revenue_breakdown: Record<string, number>;
  expense_breakdown: Record<string, number>;
  subsidiary_performance: Record<string, { revenue: number; expenses: number; profit: number }>;
  employee_costs: number;
  operating_costs: number;
  capital_expenditure: number;
  opening_balance: number;
  closing_balance: number;
  generated_at: string;
  created_at: string;
}

export interface CompanyKPI {
  id: string;
  company_id: string;
  metric_date: string;
  total_subsidiaries: number;
  total_employees: number;
  total_contracts_active: number;
  total_contracts_completed: number;
  customer_satisfaction_avg: number;
  reputation_avg: number;
  market_share_estimate: number;
  growth_rate_monthly: number;
  liquidity_ratio: number;
  created_at: string;
}

export interface CompanySynergy {
  id: string;
  company_id: string;
  synergy_type: SynergyType;
  discount_percent: number;
  is_active: boolean;
  activated_at: string;
  requirements_met: boolean;
  created_at: string;
}

export type SynergyType = 
  | 'label_venue' 
  | 'label_studio' 
  | 'venue_security' 
  | 'venue_logistics' 
  | 'factory_logistics' 
  | 'studio_label' 
  | 'all_in_house';

export interface CompanyGoal {
  id: string;
  company_id: string;
  goal_type: 'revenue' | 'employees' | 'subsidiaries' | 'contracts' | 'reputation' | 'market_share' | 'custom';
  title: string;
  description: string | null;
  target_value: number;
  current_value: number;
  deadline: string | null;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  reward_type: string | null;
  reward_value: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface CompanyNotification {
  id: string;
  company_id: string;
  notification_type: 'contract_pending' | 'payment_due' | 'employee_issue' | 'goal_progress' | 'synergy_unlocked' | 'financial_alert' | 'milestone' | 'warning';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  title: string;
  message: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
  expires_at: string | null;
}

export interface CompanyInternalService {
  id: string;
  company_id: string;
  provider_type: 'security_firm' | 'logistics' | 'venue' | 'studio' | 'rehearsal' | 'factory' | 'label';
  provider_entity_id: string;
  consumer_type: 'band' | 'label' | 'venue' | 'tour' | 'gig' | 'recording';
  consumer_entity_id: string;
  service_type: string;
  original_cost: number;
  discount_applied: number;
  final_cost: number;
  service_date: string;
  notes: string | null;
  created_at: string;
}

// Synergy configuration
export const SYNERGY_DEFINITIONS: Record<SynergyType, {
  label: string;
  description: string;
  requires: string[];
  discount: number;
}> = {
  label_venue: {
    label: 'Label-Venue Partnership',
    description: 'Discounted venue bookings for label artists',
    requires: ['label', 'venue'],
    discount: 15,
  },
  label_studio: {
    label: 'Label-Studio Integration',
    description: 'Reduced recording costs for signed artists',
    requires: ['label', 'studio'],
    discount: 20,
  },
  venue_security: {
    label: 'In-House Security',
    description: 'Lower security costs at owned venues',
    requires: ['venue', 'security'],
    discount: 25,
  },
  venue_logistics: {
    label: 'Venue Logistics Network',
    description: 'Efficient equipment transport to venues',
    requires: ['venue', 'logistics'],
    discount: 15,
  },
  factory_logistics: {
    label: 'Factory-Logistics Chain',
    description: 'Streamlined merch distribution',
    requires: ['factory', 'logistics'],
    discount: 20,
  },
  studio_label: {
    label: 'Exclusive Studio Access',
    description: 'Priority booking and rates for label',
    requires: ['studio', 'label'],
    discount: 20,
  },
  all_in_house: {
    label: 'Full Vertical Integration',
    description: 'Maximum synergy across all business units',
    requires: ['label', 'venue', 'studio', 'security', 'logistics', 'factory'],
    discount: 35,
  },
};

export const GOAL_TYPES = [
  { value: 'revenue', label: 'Revenue Target', icon: 'DollarSign' },
  { value: 'employees', label: 'Employee Count', icon: 'Users' },
  { value: 'subsidiaries', label: 'Subsidiary Count', icon: 'Building2' },
  { value: 'contracts', label: 'Contracts Completed', icon: 'FileText' },
  { value: 'reputation', label: 'Reputation Score', icon: 'Star' },
  { value: 'market_share', label: 'Market Share', icon: 'TrendingUp' },
  { value: 'custom', label: 'Custom Goal', icon: 'Target' },
] as const;

export const NOTIFICATION_PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-info/10 text-info',
  high: 'bg-warning/10 text-warning',
  urgent: 'bg-destructive/10 text-destructive',
};
