// City Governance Types

export type DrugPolicyStatus = 'prohibited' | 'medical_only' | 'decriminalized' | 'legalized';
export type ElectionStatus = 'nomination' | 'voting' | 'completed' | 'cancelled';
export type CandidateStatus = 'pending' | 'approved' | 'withdrawn' | 'disqualified';

export interface CityLaws {
  id: string;
  city_id: string;
  income_tax_rate: number;
  sales_tax_rate: number;
  travel_tax: number;
  alcohol_legal_age: number;
  drug_policy: DrugPolicyStatus;
  noise_curfew_hour: number | null;
  busking_license_fee: number;
  venue_permit_cost: number;
  prohibited_genres: string[];
  promoted_genres: string[];
  festival_permit_required: boolean;
  max_concert_capacity: number | null;
  community_events_funding: number;
  effective_from: string;
  effective_until: string | null;
  enacted_by_mayor_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CityMayor {
  id: string;
  city_id: string;
  profile_id: string;
  term_start: string;
  term_end: string | null;
  is_current: boolean;
  election_id: string | null;
  approval_rating: number;
  policies_enacted: number;
  created_at: string;
  profile?: {
    id: string;
    stage_name: string | null;
    avatar_url: string | null;
  };
}

export interface CityElection {
  id: string;
  city_id: string;
  election_year: number;
  status: ElectionStatus;
  nomination_start: string;
  nomination_end: string;
  voting_start: string;
  voting_end: string;
  winner_id: string | null;
  total_votes: number;
  voter_turnout_pct: number | null;
  created_at: string;
}

export interface CityCandidate {
  id: string;
  election_id: string;
  profile_id: string;
  campaign_slogan: string | null;
  proposed_policies: ProposedPolicies;
  campaign_budget: number;
  endorsements: string[];
  vote_count: number;
  status: CandidateStatus;
  registered_at: string;
  created_at: string;
  profile?: {
    id: string;
    stage_name: string | null;
    avatar_url: string | null;
    fame: number | null;
  };
}

export interface ProposedPolicies {
  income_tax_rate?: number;
  sales_tax_rate?: number;
  travel_tax?: number;
  alcohol_legal_age?: number;
  drug_policy?: DrugPolicyStatus;
  noise_curfew_hour?: number | null;
  busking_license_fee?: number;
  venue_permit_cost?: number;
  prohibited_genres?: string[];
  promoted_genres?: string[];
  festival_permit_required?: boolean;
  max_concert_capacity?: number | null;
  community_events_funding?: number;
}

export interface CityElectionVote {
  id: string;
  election_id: string;
  voter_profile_id: string;
  candidate_id: string;
  voted_at: string;
}

export interface CityLawHistory {
  id: string;
  city_id: string;
  mayor_id: string | null;
  law_field: string;
  old_value: string | null;
  new_value: string;
  change_reason: string | null;
  game_year: number | null;
  changed_at: string;
  mayor?: {
    profile?: {
      stage_name: string | null;
    };
  };
}

// Law field display names
export const LAW_FIELD_LABELS: Record<string, string> = {
  income_tax_rate: 'Income Tax Rate',
  sales_tax_rate: 'Sales Tax Rate',
  travel_tax: 'Travel Tax',
  alcohol_legal_age: 'Alcohol Legal Age',
  drug_policy: 'Drug Policy',
  noise_curfew_hour: 'Noise Curfew Hour',
  busking_license_fee: 'Busking License Fee',
  venue_permit_cost: 'Venue Permit Cost',
  prohibited_genres: 'Prohibited Genres',
  promoted_genres: 'Promoted Genres',
  festival_permit_required: 'Festival Permit Required',
  max_concert_capacity: 'Max Concert Capacity',
  community_events_funding: 'Community Events Funding',
};

// Drug policy display names
export const DRUG_POLICY_LABELS: Record<DrugPolicyStatus, string> = {
  prohibited: 'Prohibited',
  medical_only: 'Medical Only',
  decriminalized: 'Decriminalized',
  legalized: 'Legalized',
};

// Election phase descriptions
export const ELECTION_PHASE_DESCRIPTIONS: Record<ElectionStatus, string> = {
  nomination: 'Candidates are registering to run for mayor',
  voting: 'Voting is open for eligible residents',
  completed: 'Election has concluded',
  cancelled: 'Election was cancelled',
};
