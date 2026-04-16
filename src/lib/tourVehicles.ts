// Tour vehicle progression system

export type VehicleTier = 
  | 'rusty_van' | 'minivan' | 'sprinter' | 'small_tour_bus' 
  | 'full_tour_bus' | 'luxury_coach' | 'tour_fleet' | 'private_jet_fleet';

export interface VehicleTierConfig {
  key: VehicleTier;
  label: string;
  description: string;
  dailyCost: number;
  capacity: number;
  comfort: number; // 1-7
  speed: 'slow' | 'medium' | 'fast' | 'fastest';
  fameRequired: number;
  gearHaulCapacity: 'minimal' | 'small' | 'medium' | 'large' | 'massive' | 'unlimited';
  breakdownChance: number; // 0-1
  icon: string; // emoji
  moralBoost: number; // -10 to +20
  perks: string[];
}

export const VEHICLE_TIERS: VehicleTierConfig[] = [
  {
    key: 'rusty_van',
    label: 'Rusty Van',
    description: 'A beat-up van with questionable brakes. Smells like old takeaway.',
    dailyCost: 0,
    capacity: 4,
    comfort: 1,
    speed: 'slow',
    fameRequired: 0,
    gearHaulCapacity: 'minimal',
    breakdownChance: 0.15,
    icon: '🚐',
    moralBoost: -5,
    perks: ['Free (you already own it)'],
  },
  {
    key: 'minivan',
    label: 'Minivan',
    description: 'Room for gear but everyone\'s cramped. At least the AC works.',
    dailyCost: 30,
    capacity: 6,
    comfort: 2,
    speed: 'slow',
    fameRequired: 0,
    gearHaulCapacity: 'small',
    breakdownChance: 0.08,
    icon: '🚗',
    moralBoost: -2,
    perks: ['Air conditioning', 'Roof rack for gear'],
  },
  {
    key: 'sprinter',
    label: 'Sprinter Van',
    description: 'The indie workhorse. Bunks in the back, guitar rack up top.',
    dailyCost: 80,
    capacity: 8,
    comfort: 3,
    speed: 'medium',
    fameRequired: 500,
    gearHaulCapacity: 'medium',
    breakdownChance: 0.04,
    icon: '🚌',
    moralBoost: 0,
    perks: ['Sleeping bunks', 'Gear storage', 'WiFi hotspot'],
  },
  {
    key: 'small_tour_bus',
    label: 'Small Tour Bus',
    description: 'Proper bunks, kitchenette, and a lounge area. You\'ve made it.',
    dailyCost: 200,
    capacity: 12,
    comfort: 4,
    speed: 'medium',
    fameRequired: 3000,
    gearHaulCapacity: 'medium',
    breakdownChance: 0.02,
    icon: '🚍',
    moralBoost: 5,
    perks: ['Full bunks', 'Kitchenette', 'Lounge', 'Onboard toilet'],
  },
  {
    key: 'full_tour_bus',
    label: 'Full Tour Bus',
    description: 'Two-story sleeper with satellite TV. The dream machine.',
    dailyCost: 500,
    capacity: 16,
    comfort: 5,
    speed: 'medium',
    fameRequired: 10000,
    gearHaulCapacity: 'large',
    breakdownChance: 0.01,
    icon: '🚎',
    moralBoost: 10,
    perks: ['Private bunks', 'Full kitchen', 'Satellite TV', 'Recording setup', 'Shower'],
  },
  {
    key: 'luxury_coach',
    label: 'Luxury Coach',
    description: 'Private suites, full kitchen, and an onboard recording booth.',
    dailyCost: 1200,
    capacity: 12,
    comfort: 6,
    speed: 'medium',
    fameRequired: 30000,
    gearHaulCapacity: 'large',
    breakdownChance: 0.005,
    icon: '🏎️',
    moralBoost: 15,
    perks: ['Private suites', 'Recording booth', 'Masseuse station', 'Mini bar', 'Security'],
  },
  {
    key: 'tour_fleet',
    label: 'Tour Fleet',
    description: 'Multiple vehicles + dedicated equipment trucks. Stadium-tier logistics.',
    dailyCost: 3000,
    capacity: 40,
    comfort: 6,
    speed: 'fast',
    fameRequired: 75000,
    gearHaulCapacity: 'massive',
    breakdownChance: 0.002,
    icon: '🚛',
    moralBoost: 18,
    perks: ['Band bus + crew bus', '2 equipment trucks', 'Merch truck', 'Catering vehicle', 'Security detail'],
  },
  {
    key: 'private_jet_fleet',
    label: 'Private Jet + Fleet',
    description: 'Fly between cities. Ground fleet handles equipment. Icon status.',
    dailyCost: 8000,
    capacity: 20,
    comfort: 7,
    speed: 'fastest',
    fameRequired: 200000,
    gearHaulCapacity: 'unlimited',
    breakdownChance: 0,
    icon: '✈️',
    moralBoost: 20,
    perks: ['Private jet for band', 'Ground fleet for gear', 'Personal chef', 'Stylist', 'Concierge service'],
  },
];

export function getVehicleTier(key: VehicleTier): VehicleTierConfig {
  return VEHICLE_TIERS.find(v => v.key === key) || VEHICLE_TIERS[0];
}

export function getAvailableVehicles(fame: number): VehicleTierConfig[] {
  return VEHICLE_TIERS.filter(v => fame >= v.fameRequired);
}

export function getLockedVehicles(fame: number): VehicleTierConfig[] {
  return VEHICLE_TIERS.filter(v => fame < v.fameRequired);
}

// Check if vehicle can handle the stage setup
export type HaulRequirement = 'minimal' | 'small' | 'medium' | 'large' | 'massive' | 'unlimited';
const HAUL_ORDER: HaulRequirement[] = ['minimal', 'small', 'medium', 'large', 'massive', 'unlimited'];

export function canVehicleHandleStage(vehicleHaul: HaulRequirement, stageRequirement: HaulRequirement): boolean {
  return HAUL_ORDER.indexOf(vehicleHaul) >= HAUL_ORDER.indexOf(stageRequirement);
}

// Extra equipment truck cost if vehicle can't handle the stage
export function getEquipmentTruckCost(stageRequirement: HaulRequirement, vehicleHaul: HaulRequirement): number {
  if (canVehicleHandleStage(vehicleHaul, stageRequirement)) return 0;
  const gap = HAUL_ORDER.indexOf(stageRequirement) - HAUL_ORDER.indexOf(vehicleHaul);
  // Each gap level = $150/day for truck rental
  return gap * 150;
}
