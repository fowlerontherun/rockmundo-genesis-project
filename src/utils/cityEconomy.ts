/**
 * Dynamic City Economy System (v1.0.930)
 * City-level economic conditions fluctuate and affect gig earnings, merch sales, and living costs.
 */

export type EconomicPhase = "boom" | "growth" | "stable" | "recession" | "depression";

export interface CityEconomicState {
  phase: EconomicPhase;
  multiplier: number;         // 0.6 – 1.4 earnings multiplier
  costMultiplier: number;     // 0.8 – 1.3 cost multiplier
  tourismBonus: number;       // 0 – 0.3 extra attendance from tourism
  label: string;
  description: string;
}

// Deterministic city economy based on city name + game day
function cityHash(cityName: string): number {
  let h = 0;
  for (let i = 0; i < cityName.length; i++) {
    h = (Math.imul(31, h) + cityName.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const PHASE_CONFIG: Record<EconomicPhase, {
  multiplier: number;
  costMultiplier: number;
  tourismBonus: number;
  label: string;
  description: string;
}> = {
  boom: {
    multiplier: 1.35,
    costMultiplier: 1.25,
    tourismBonus: 0.25,
    label: "Economic Boom 📈",
    description: "High spending power! Gig earnings and merch sales are way up, but costs are higher too.",
  },
  growth: {
    multiplier: 1.15,
    costMultiplier: 1.10,
    tourismBonus: 0.15,
    label: "Growth Period 📊",
    description: "Economy is expanding. Good time for touring and merch sales.",
  },
  stable: {
    multiplier: 1.0,
    costMultiplier: 1.0,
    tourismBonus: 0.05,
    label: "Stable Economy ➡️",
    description: "Normal economic conditions. Standard earnings and costs.",
  },
  recession: {
    multiplier: 0.8,
    costMultiplier: 0.9,
    tourismBonus: 0.0,
    label: "Recession 📉",
    description: "People are spending less. Lower gig earnings but slightly cheaper costs.",
  },
  depression: {
    multiplier: 0.6,
    costMultiplier: 0.8,
    tourismBonus: 0.0,
    label: "Economic Depression 🔻",
    description: "Severe downturn. Gig attendance and spending are significantly reduced.",
  },
};

/**
 * Get the current economic phase for a city on a given game day.
 * Economy cycles on a ~180-day period per city.
 */
export function getCityEconomicState(cityName: string, gameDay: number): CityEconomicState {
  const seed = cityHash(cityName);
  const period = 120 + (seed % 120); // 120-240 day cycle
  const phase = (seed % 360) * (Math.PI / 180);
  const wave = Math.sin((2 * Math.PI * gameDay) / period + phase);

  // Map wave (-1 to 1) to economic phases
  let economicPhase: EconomicPhase;
  if (wave > 0.6) economicPhase = "boom";
  else if (wave > 0.2) economicPhase = "growth";
  else if (wave > -0.2) economicPhase = "stable";
  else if (wave > -0.6) economicPhase = "recession";
  else economicPhase = "depression";

  return {
    phase: economicPhase,
    ...PHASE_CONFIG[economicPhase],
  };
}

/**
 * Apply economic multiplier to gig earnings.
 */
export function applyEconomicMultiplier(baseEarnings: number, cityName: string, gameDay: number): number {
  const state = getCityEconomicState(cityName, gameDay);
  return Math.round(baseEarnings * state.multiplier);
}

/**
 * Apply economic multiplier to merch sales.
 */
export function applyMerchEconomicMultiplier(baseSales: number, cityName: string, gameDay: number): number {
  const state = getCityEconomicState(cityName, gameDay);
  // Merch is more sensitive to economy than gig earnings
  const merchMult = state.multiplier > 1 ? state.multiplier * 1.1 : state.multiplier * 0.95;
  return Math.round(baseSales * merchMult);
}

/**
 * Get tourism attendance bonus for a city.
 */
export function getTourismAttendanceBonus(cityName: string, gameDay: number): number {
  const state = getCityEconomicState(cityName, gameDay);
  return state.tourismBonus;
}

/**
 * Get all major cities' economic states for world dashboard display.
 */
export function getWorldEconomicOverview(gameDay: number): Array<CityEconomicState & { city: string }> {
  const majorCities = [
    "London", "New York", "Los Angeles", "Tokyo", "Paris", "Berlin",
    "Sydney", "Toronto", "Nashville", "Seoul", "São Paulo", "Lagos",
    "Mumbai", "Stockholm", "Amsterdam", "Austin", "Melbourne", "Manchester",
  ];
  return majorCities
    .map(city => ({ city, ...getCityEconomicState(city, gameDay) }))
    .sort((a, b) => b.multiplier - a.multiplier);
}
