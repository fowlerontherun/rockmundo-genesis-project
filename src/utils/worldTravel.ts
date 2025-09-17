export type TravelMode = 'coach' | 'taxi' | 'air' | 'ferry';

export interface TravelModeConfig {
  label: string;
  description: string;
  speedKmh: number;
  costMultiplier: number;
  comfort: number; // 0-100 scale
}

export interface TravelEstimate {
  mode: TravelMode;
  speedKmh: number;
  timeHours: number;
  cost: number;
  comfort: number;
  description: string;
}

export const BASE_TRAVEL_SPEED_KMH = 80;
export const BASE_TRAVEL_COST_PER_KM = 0.75;
export const BASE_TRAVEL_FIXED_COST = 150;

export const TRAVEL_MODES: Record<TravelMode, TravelModeConfig> = {
  coach: {
    label: 'Coach',
    description: 'Budget-friendly coaches keep costs low at the expense of comfort and speed.',
    speedKmh: 70,
    costMultiplier: 0.85,
    comfort: 55,
  },
  taxi: {
    label: 'Taxi / Rideshare',
    description: 'Door-to-door ground travel with moderate speed and comfort.',
    speedKmh: 90,
    costMultiplier: 1.35,
    comfort: 65,
  },
  air: {
    label: 'Air',
    description: 'Fly between cities quickly with premium comfort and high costs.',
    speedKmh: 780,
    costMultiplier: 3.6,
    comfort: 85,
  },
  ferry: {
    label: 'Ferry',
    description: 'Slow scenic travel over water with the roughest ride.',
    speedKmh: 45,
    costMultiplier: 1.15,
    comfort: 45,
  },
};

export const TRAVEL_MODE_OPTIONS = (Object.entries(TRAVEL_MODES) as [TravelMode, TravelModeConfig][])?.map(
  ([value, config]) => ({
    value,
    label: config.label,
    description: config.description,
    comfort: config.comfort,
    speedKmh: config.speedKmh,
  })
);

export const getTravelModeConfig = (mode: TravelMode): TravelModeConfig =>
  TRAVEL_MODES[mode] ?? TRAVEL_MODES.coach;

export const calculateTravelEstimates = (distanceKm: number, mode: TravelMode): TravelEstimate => {
  const config = getTravelModeConfig(mode);
  const distance = Math.max(0, distanceKm || 0);
  const speedKmh = config.speedKmh || BASE_TRAVEL_SPEED_KMH;
  const rawHours = distance / speedKmh;
  const timeHours = Number.isFinite(rawHours) ? Number(rawHours.toFixed(2)) : 0;

  const baseCost = distance * BASE_TRAVEL_COST_PER_KM + BASE_TRAVEL_FIXED_COST;
  const cost = Math.max(0, Math.round(baseCost * config.costMultiplier));

  return {
    mode,
    speedKmh,
    timeHours,
    cost,
    comfort: config.comfort,
    description: config.description,
  };
};

export const describeComfort = (comfort: number) => {
  if (comfort >= 80) return 'High comfort';
  if (comfort >= 60) return 'Moderate comfort';
  if (comfort >= 45) return 'Rough ride';
  return 'Grueling travel';
};

export const LOW_COMFORT_THRESHOLD = 55;

