export interface LabelFinancialTransaction {
  id: string;
  label_id: string;
  transaction_type: 'revenue' | 'expense' | 'advance' | 'royalty_payment' | 'marketing' | 'overhead' | 'distribution' | 'transfer';
  amount: number;
  description: string | null;
  related_release_id: string | null;
  related_band_id: string | null;
  related_contract_id: string | null;
  created_at: string;
}

export interface LabelStaff {
  id: string;
  label_id: string;
  name: string;
  role: 'a_and_r' | 'marketing' | 'promoter' | 'accountant' | 'legal' | 'producer' | 'manager';
  skill_level: number;
  specialty_genre: string | null;
  salary_monthly: number;
  hired_at: string;
  performance_rating: number;
  created_at: string;
}

export interface LabelDistributionDeal {
  id: string;
  label_id: string;
  distributor_name: string;
  deal_type: 'digital' | 'physical' | 'full';
  revenue_share_pct: number;
  advance_amount: number;
  minimum_releases: number | null;
  territories: string[];
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LabelBusinessData {
  operating_budget: number;
  monthly_overhead: number;
  royalty_default_pct: number;
  advance_pool: number;
  marketing_budget: number;
  a_and_r_budget: number;
  distribution_deal: string;
  distribution_cut_pct: number;
  total_revenue_lifetime: number;
  total_expenses_lifetime: number;
  is_subsidiary: boolean;
  company_id: string | null;
}

export const STAFF_ROLES = [
  { value: 'a_and_r', label: 'A&R Scout', baseSalary: 4000, description: 'Discovers and signs new talent' },
  { value: 'marketing', label: 'Marketing Manager', baseSalary: 3500, description: 'Promotes releases and artists' },
  { value: 'promoter', label: 'Promoter', baseSalary: 3000, description: 'Handles radio and media placement' },
  { value: 'accountant', label: 'Accountant', baseSalary: 3500, description: 'Manages finances and royalties' },
  { value: 'legal', label: 'Legal Counsel', baseSalary: 5000, description: 'Handles contracts and disputes' },
  { value: 'producer', label: 'In-House Producer', baseSalary: 4500, description: 'Produces recordings for artists' },
  { value: 'manager', label: 'Artist Manager', baseSalary: 3500, description: 'Manages signed artists' },
] as const;

export const DISTRIBUTION_TYPES = [
  { value: 'digital', label: 'Digital Only', description: 'Streaming and downloads' },
  { value: 'physical', label: 'Physical Only', description: 'CDs, vinyl, and merchandise' },
  { value: 'full', label: 'Full Distribution', description: 'Digital and physical worldwide' },
] as const;

export const TRANSACTION_TYPES = [
  { value: 'revenue', label: 'Revenue', color: 'text-green-500' },
  { value: 'expense', label: 'Expense', color: 'text-red-500' },
  { value: 'advance', label: 'Artist Advance', color: 'text-orange-500' },
  { value: 'royalty_payment', label: 'Royalty Payment', color: 'text-blue-500' },
  { value: 'marketing', label: 'Marketing', color: 'text-purple-500' },
  { value: 'overhead', label: 'Overhead', color: 'text-gray-500' },
  { value: 'distribution', label: 'Distribution', color: 'text-cyan-500' },
  { value: 'transfer', label: 'Transfer', color: 'text-yellow-500' },
] as const;
