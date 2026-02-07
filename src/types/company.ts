// Company System Types

export type CompanyType = 'holding' | 'label' | 'security' | 'factory' | 'logistics' | 'venue' | 'rehearsal' | 'recording_studio';

// Company creation costs, starting balances, and weekly operating costs
export const COMPANY_CREATION_COSTS: Record<CompanyType, { creationCost: number; startingBalance: number; weeklyOperatingCosts: number }> = {
  holding: { creationCost: 500_000, startingBalance: 1_000_000, weeklyOperatingCosts: 2_500 },
  label: { creationCost: 1_000_000, startingBalance: 1_000_000, weeklyOperatingCosts: 8_000 },
  security: { creationCost: 250_000, startingBalance: 500_000, weeklyOperatingCosts: 3_500 },
  factory: { creationCost: 500_000, startingBalance: 750_000, weeklyOperatingCosts: 6_000 },
  logistics: { creationCost: 300_000, startingBalance: 500_000, weeklyOperatingCosts: 4_500 },
  venue: { creationCost: 750_000, startingBalance: 1_000_000, weeklyOperatingCosts: 7_000 },
  rehearsal: { creationCost: 200_000, startingBalance: 300_000, weeklyOperatingCosts: 2_000 },
  recording_studio: { creationCost: 400_000, startingBalance: 600_000, weeklyOperatingCosts: 5_000 },
};

// Corporate tax rates by company type
export const CORPORATE_TAX_RATES: Record<CompanyType, number> = {
  holding: 0.25,
  label: 0.22,
  security: 0.20,
  factory: 0.18,
  logistics: 0.20,
  venue: 0.22,
  rehearsal: 0.15,
  recording_studio: 0.18,
};

export type CompanyStatus = 'active' | 'suspended' | 'bankrupt' | 'dissolved';
export type EmployeeRole = 'ceo' | 'manager' | 'accountant' | 'security_guard' | 'technician' | 'producer' | 'promoter' | 'receptionist';
export type EmployeeStatus = 'active' | 'on_leave' | 'terminated';
export type TransactionType = 'income' | 'expense' | 'transfer_in' | 'transfer_out' | 'salary' | 'investment' | 'dividend';
export type TransactionCategory = 'operations' | 'payroll' | 'subsidiary_revenue' | 'subsidiary_operations' | 'tax' | 'owner_transfer' | 'general';

export interface Company {
  id: string;
  owner_id: string;
  name: string;
  logo_url: string | null;
  company_type: CompanyType;
  parent_company_id: string | null;
  headquarters_city_id: string | null;
  balance: number;
  is_bankrupt: boolean;
  bankruptcy_date: string | null;
  founded_at: string;
  status: CompanyStatus;
  reputation_score: number;
  weekly_operating_costs: number;
  description: string | null;
  created_at: string;
  updated_at: string;
  negative_balance_since: string | null;
  // Joined fields
  headquarters_city?: {
    id: string;
    name: string;
    country: string;
  } | null;
  parent_company?: {
    id: string;
    name: string;
  } | null;
  subsidiaries?: Company[];
  employee_count?: number;
}

export interface CompanyEmployee {
  id: string;
  company_id: string;
  profile_id: string;
  role: EmployeeRole;
  salary: number;
  hired_at: string;
  status: EmployeeStatus;
  performance_rating: number | null;
  created_at: string;
  updated_at: string;
  profile?: {
    id: string;
    stage_name: string;
    avatar_url: string | null;
  };
  company?: Company;
}

export interface CompanyTransaction {
  id: string;
  company_id: string;
  transaction_type: TransactionType;
  amount: number;
  description: string | null;
  category: TransactionCategory | null;
  related_entity_id: string | null;
  related_entity_type: string | null;
  created_at: string;
}

export interface CompanySettings {
  company_id: string;
  auto_pay_salaries: boolean;
  auto_pay_taxes: boolean;
  dividend_payout_percent: number;
  reinvestment_percent: number;
  allow_subsidiary_creation: boolean;
  max_subsidiaries: number;
  notification_threshold_low: number;
  notification_threshold_critical: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCompanyInput {
  name: string;
  company_type: CompanyType;
  description?: string;
  headquarters_city_id?: string;
  parent_company_id?: string;
}

export interface CompanyFinancialSummary {
  total_balance: number;
  monthly_income: number;
  monthly_expenses: number;
  monthly_net: number;
  total_employees: number;
  total_subsidiaries: number;
  pending_taxes: number;
  effective_tax_rate: number;
}

export interface CompanyLabel {
  id: string;
  name: string;
  logo_url: string | null;
  company_id: string | null;
  balance: number;
  is_bankrupt: boolean;
  headquarters_city: string | null;
  reputation_score: number | null;
}

// Company type display info
export const COMPANY_TYPE_INFO: Record<CompanyType, { label: string; icon: string; description: string; color: string }> = {
  holding: {
    label: 'Holding Company',
    icon: 'Building2',
    description: 'Parent company that owns and manages subsidiaries',
    color: 'text-primary',
  },
  label: {
    label: 'Record Label',
    icon: 'Disc',
    description: 'Sign artists, release music, and manage royalties',
    color: 'text-purple-500',
  },
  security: {
    label: 'Security Firm',
    icon: 'Shield',
    description: 'Provide security services for concerts and events',
    color: 'text-blue-500',
  },
  factory: {
    label: 'Merchandise Factory',
    icon: 'Factory',
    description: 'Manufacture merchandise for bands and artists',
    color: 'text-orange-500',
  },
  logistics: {
    label: 'Logistics Company',
    icon: 'Truck',
    description: 'Transport equipment and merchandise',
    color: 'text-cyan-500',
  },
  venue: {
    label: 'Venue',
    icon: 'Building',
    description: 'Own and operate performance venues',
    color: 'text-green-500',
  },
  rehearsal: {
    label: 'Rehearsal Studio',
    icon: 'Music',
    description: 'Rent practice space to bands and artists',
    color: 'text-amber-500',
  },
  recording_studio: {
    label: 'Recording Studio',
    icon: 'Mic2',
    description: 'Professional recording facilities for music production',
    color: 'text-rose-500',
  },
};

export const EMPLOYEE_ROLE_INFO: Record<EmployeeRole, { label: string; description: string; baseSalary: number }> = {
  ceo: { label: 'CEO', description: 'Chief Executive Officer - runs the company', baseSalary: 15000 },
  manager: { label: 'Manager', description: 'Oversees day-to-day operations', baseSalary: 8000 },
  accountant: { label: 'Accountant', description: 'Handles finances and bookkeeping', baseSalary: 6000 },
  security_guard: { label: 'Security Guard', description: 'Provides security services', baseSalary: 3500 },
  technician: { label: 'Technician', description: 'Technical and equipment support', baseSalary: 5000 },
  producer: { label: 'Producer', description: 'Music production and A&R', baseSalary: 10000 },
  promoter: { label: 'Promoter', description: 'Marketing and event promotion', baseSalary: 7000 },
  receptionist: { label: 'Receptionist', description: 'Front desk and customer service', baseSalary: 3000 },
};
