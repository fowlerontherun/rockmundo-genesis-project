import { generateRandomName } from './nameGenerator';

export const TOURING_MEMBER_TIERS = [
  { 
    tier: 1, 
    name: "Beginner", 
    skillRange: [20, 40] as [number, number], 
    weeklyCost: 500, 
    description: "Learning the ropes" 
  },
  { 
    tier: 2, 
    name: "Competent", 
    skillRange: [41, 60] as [number, number], 
    weeklyCost: 1000, 
    description: "Reliable performer" 
  },
  { 
    tier: 3, 
    name: "Skilled", 
    skillRange: [61, 80] as [number, number], 
    weeklyCost: 2000, 
    description: "Solid musician" 
  },
  { 
    tier: 4, 
    name: "Professional", 
    skillRange: [81, 100] as [number, number], 
    weeklyCost: 4000, 
    description: "Stage-ready pro" 
  },
  { 
    tier: 5, 
    name: "Experienced", 
    skillRange: [101, 150] as [number, number], 
    weeklyCost: 8000, 
    description: "Seasoned veteran" 
  },
];

export const INSTRUMENT_ROLES = [
  'Guitar',
  'Bass',
  'Drums',
  'Keyboards',
  'Vocals',
  'Saxophone',
  'Trumpet',
  'Trombone',
  'Violin',
  'DJ/Producer',
] as const;

export const VOCAL_ROLES = [
  'None',
  'Lead Singer',
  'Backup Singer',
] as const;

export function generateTouringMemberName(): string {
  return generateRandomName();
}

export function getTierInfo(tier: number) {
  return TOURING_MEMBER_TIERS.find(t => t.tier === tier) || TOURING_MEMBER_TIERS[0];
}
