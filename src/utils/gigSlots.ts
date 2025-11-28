export interface GigSlot {
  id: 'kids' | 'opening' | 'support' | 'headline';
  name: string;
  startTime: string;
  endTime: string;
  description: string;
  attendanceMultiplier: number;
  paymentMultiplier: number;
  minPrestigeLevel: number;
  minBandFame: number;
  lockoutDuration: number;
  fameBonus: number;
  duration: number; // minutes
}

export const GIG_SLOTS: GigSlot[] = [
  {
    id: 'kids',
    name: 'Kids Slot',
    startTime: '15:00',
    endTime: '15:30',
    description: 'Afternoon matinee for families and young audiences',
    attendanceMultiplier: 0.3,
    paymentMultiplier: 0.5,
    minPrestigeLevel: 0,
    minBandFame: 0,
    lockoutDuration: 30,
    fameBonus: 1.0,
    duration: 30
  },
  {
    id: 'opening',
    name: 'Opening Slot',
    startTime: '19:00',
    endTime: '19:30',
    description: 'Warm up the crowd for the main acts',
    attendanceMultiplier: 0.5,
    paymentMultiplier: 0.6,
    minPrestigeLevel: 0,
    minBandFame: 0,
    lockoutDuration: 90,
    fameBonus: 1.0,
    duration: 30
  },
  {
    id: 'support',
    name: 'Support Slot',
    startTime: '19:45',
    endTime: '20:30',
    description: 'Build energy before the headliner',
    attendanceMultiplier: 0.75,
    paymentMultiplier: 0.8,
    minPrestigeLevel: 2,
    minBandFame: 500,
    lockoutDuration: 120,
    fameBonus: 1.1,
    duration: 45
  },
  {
    id: 'headline',
    name: 'Headline Slot',
    startTime: '20:45',
    endTime: '22:00',
    description: 'The main event - maximum exposure and rewards',
    attendanceMultiplier: 1.0,
    paymentMultiplier: 1.0,
    minPrestigeLevel: 0, // Changed: All prestige levels allow headline
    minBandFame: 0, // Changed: Fame requirement based on venue prestige
    lockoutDuration: 180,
    fameBonus: 1.5,
    duration: 75
  }
];

export function getSlotById(slotId: string): GigSlot | undefined {
  return GIG_SLOTS.find(s => s.id === slotId);
}

export function getSlotBadgeVariant(slotId: string): 'default' | 'secondary' | 'outline' {
  switch (slotId) {
    case 'headline':
      return 'default';
    case 'support':
      return 'secondary';
    default:
      return 'outline';
  }
}

// NEW: Get fame requirement based on venue prestige
export function getHeadlineFameRequirement(venuePrestige: number): number {
  switch (venuePrestige) {
    case 1:
      return 0; // Small venues: no fame needed
    case 2:
      return 250; // Medium venues: some recognition needed
    case 3:
      return 750; // Good venues: established act needed
    case 4:
      return 1500; // Top venues: famous acts only
    default:
      return venuePrestige >= 5 ? 2500 : 0;
  }
}
