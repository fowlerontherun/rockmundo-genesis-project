// Political Party Types

export type PartyRole = 'founder' | 'officer' | 'member';
export type CampaignCategory = 'ads' | 'rallies' | 'staff' | 'media' | 'merch';

export interface PoliticalParty {
  id: string;
  company_id: string | null;
  founder_profile_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  colour_hex: string;
  belief_1: string | null;
  belief_2: string | null;
  belief_3: string | null;
  belief_4: string | null;
  belief_5: string | null;
  total_strength: number;
  member_count: number;
  mayor_count: number;
  treasury_balance: number;
  founded_at: string;
  dissolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartyMembership {
  id: string;
  party_id: string;
  profile_id: string;
  role: PartyRole;
  joined_at: string;
}

export interface CampaignExpenditure {
  id: string;
  candidate_id: string;
  spender_profile_id: string;
  category: CampaignCategory;
  amount: number;
  effect_value: number;
  funded_from: 'personal' | 'party';
  party_id: string | null;
  created_at: string;
}

export interface ElectionNewsArticle {
  id: string;
  election_id: string;
  candidate_id: string;
  author_profile_id: string;
  headline: string;
  body: string;
  published_at: string;
}

export const CAMPAIGN_CATEGORY_LABELS: Record<CampaignCategory, string> = {
  ads: 'Advertising',
  rallies: 'Rallies',
  staff: 'Campaign Staff',
  media: 'Media Outreach',
  merch: 'Merchandise',
};

// Suggested distinct colours — UI hint only; DB enforces uniqueness
export const SUGGESTED_PARTY_COLOURS = [
  '#dc2626', '#2563eb', '#16a34a', '#9333ea',
  '#ea580c', '#0891b2', '#ca8a04', '#db2777',
  '#7c3aed', '#0d9488', '#65a30d', '#475569',
];

export const PARTY_FOUNDING_COST = 25000000; // $250,000 in cents
