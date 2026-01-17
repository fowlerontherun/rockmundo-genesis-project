export interface SecurityFirm {
  id: string;
  company_id: string;
  name: string;
  license_level: number;
  max_guards: number;
  equipment_quality: number;
  reputation: number;
  total_contracts_completed: number;
  created_at: string;
  updated_at: string;
}

export interface SecurityGuard {
  id: string;
  security_firm_id: string;
  profile_id: string | null;
  name: string;
  is_npc: boolean;
  skill_level: number;
  experience_years: number;
  salary_per_event: number;
  hired_at: string;
  status: 'active' | 'inactive' | 'on_leave';
}

export interface SecurityContract {
  id: string;
  security_firm_id: string;
  client_band_id: string | null;
  client_company_id: string | null;
  gig_id: string | null;
  tour_id: string | null;
  venue_id: string | null;
  contract_type: 'gig' | 'tour' | 'venue_residency' | 'event';
  guards_required: number;
  fee_per_event: number;
  total_fee: number | null;
  start_date: string | null;
  end_date: string | null;
  status: 'pending' | 'accepted' | 'active' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SecurityContractAssignment {
  id: string;
  contract_id: string;
  guard_id: string;
  assignment_date: string;
  status: 'assigned' | 'completed' | 'no_show';
  performance_rating: number | null;
  created_at: string;
}

export const LICENSE_LEVEL_NAMES: Record<number, string> = {
  1: 'Basic',
  2: 'Standard',
  3: 'Professional',
  4: 'Elite',
  5: 'Executive',
};

export const LICENSE_LEVEL_VENUE_CAPACITY: Record<number, number> = {
  1: 500,
  2: 2000,
  3: 10000,
  4: 50000,
  5: 100000,
};

export const EQUIPMENT_QUALITY_NAMES: Record<number, string> = {
  1: 'Basic',
  2: 'Standard',
  3: 'Professional',
  4: 'Advanced',
  5: 'Military-Grade',
};
