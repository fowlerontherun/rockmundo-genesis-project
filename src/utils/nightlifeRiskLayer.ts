/**
 * Nightlife Risk & Reward Layer
 * 
 * Implements the stance-based decision tree for nightlife events.
 * Players choose a stance (Sober, Party Hard, Network, Leave Early)
 * and outcomes are resolved via probability tables influenced by
 * player stats, lifestyle traits, and venue quality.
 */

export type NightlifeStance = "stay_sober" | "party_hard" | "network" | "leave_early";

export interface NightlifeStanceConfig {
  id: NightlifeStance;
  label: string;
  emoji: string;
  description: string;
  riskLevel: "low" | "moderate" | "high" | "minimal";
  fameMultiplier: number;
  energyCostMultiplier: number;
  cashMultiplier: number;
  addictionRiskMultiplier: number;
  scandalChance: number;
  inspirationChance: number;
  networkingChance: number;
}

export const STANCE_CONFIGS: Record<NightlifeStance, NightlifeStanceConfig> = {
  stay_sober: {
    id: "stay_sober",
    label: "Stay Sober",
    emoji: "🧘",
    description: "Safe gains, reduced fame. Keep your wits about you.",
    riskLevel: "low",
    fameMultiplier: 0.5,
    energyCostMultiplier: 0.6,
    cashMultiplier: 0.4,
    addictionRiskMultiplier: 0,
    scandalChance: 0.02,
    inspirationChance: 0.15,
    networkingChance: 0.2,
  },
  party_hard: {
    id: "party_hard",
    label: "Party Hard",
    emoji: "🎉",
    description: "Maximum fame & chemistry, but elevated scandal and health risks.",
    riskLevel: "high",
    fameMultiplier: 2.0,
    energyCostMultiplier: 1.8,
    cashMultiplier: 2.0,
    addictionRiskMultiplier: 2.5,
    scandalChance: 0.18,
    inspirationChance: 0.25,
    networkingChance: 0.1,
  },
  network: {
    id: "network",
    label: "Network",
    emoji: "🤝",
    description: "Focus on contact acquisition. Moderate risks, great connections.",
    riskLevel: "moderate",
    fameMultiplier: 1.0,
    energyCostMultiplier: 1.0,
    cashMultiplier: 1.2,
    addictionRiskMultiplier: 0.8,
    scandalChance: 0.06,
    inspirationChance: 0.1,
    networkingChance: 0.45,
  },
  leave_early: {
    id: "leave_early",
    label: "Leave Early",
    emoji: "🚪",
    description: "Small rewards, negligible risk. Show face, then head out.",
    riskLevel: "minimal",
    fameMultiplier: 0.3,
    energyCostMultiplier: 0.3,
    cashMultiplier: 0.2,
    addictionRiskMultiplier: 0,
    scandalChance: 0.01,
    inspirationChance: 0.05,
    networkingChance: 0.08,
  },
};

export type NightlifeOutcomeType =
  | "great_night"
  | "scandal"
  | "eureka_moment"
  | "exhaustion"
  | "networking_win"
  | "relationship_drama"
  | "minor_arrest"
  | "quiet_night";

export interface NightlifeOutcomeDetail {
  type: NightlifeOutcomeType;
  label: string;
  emoji: string;
  description: string;
  fameChange: number;
  energyChange: number;
  cashChange: number;
  inspirationGained: boolean;
  contactGained: boolean;
  scandalTriggered: boolean;
}

interface ResolutionContext {
  stance: NightlifeStance;
  venueQuality: number; // 1-5
  playerFame: number;
  playerEnergy: number;
  playerCash: number;
}

/** Roll outcomes based on stance + context */
export function resolveNightlifeEvent(ctx: ResolutionContext): NightlifeOutcomeDetail {
  const config = STANCE_CONFIGS[ctx.stance];
  const qualityBonus = (ctx.venueQuality - 1) * 0.05; // 0-20% bonus

  // Base fame/energy/cash from stance
  const baseFame = Math.round((3 + ctx.venueQuality * 2) * config.fameMultiplier);
  const baseEnergyCost = Math.round((10 + ctx.venueQuality * 3) * config.energyCostMultiplier);
  const baseCashCost = Math.round((15 + ctx.venueQuality * 10) * config.cashMultiplier);

  // Roll for special outcomes
  const roll = Math.random();

  // Scandal
  if (roll < config.scandalChance + qualityBonus * 0.5) {
    const fameHit = -Math.round(baseFame * 0.8);
    return {
      type: "scandal",
      label: "Scandal!",
      emoji: "📸",
      description: "Paparazzi caught you in a compromising moment. Tabloids are running the story.",
      fameChange: fameHit,
      energyChange: -baseEnergyCost,
      cashChange: -baseCashCost,
      inspirationGained: false,
      contactGained: false,
      scandalTriggered: true,
    };
  }

  // Minor arrest (only party_hard or network, low chance)
  if (ctx.stance === "party_hard" && roll < 0.04) {
    return {
      type: "minor_arrest",
      label: "Minor Arrest",
      emoji: "🚔",
      description: "A run-in with the law. Short legal trouble, but paradoxically a fame bump.",
      fameChange: Math.round(baseFame * 0.5),
      energyChange: -Math.round(baseEnergyCost * 1.5),
      cashChange: -Math.round(baseCashCost * 2),
      inspirationGained: false,
      contactGained: false,
      scandalTriggered: true,
    };
  }

  // Eureka moment (inspiration)
  if (roll < config.scandalChance + config.inspirationChance) {
    return {
      type: "eureka_moment",
      label: "Eureka Moment!",
      emoji: "💡",
      description: "The night sparked a creative breakthrough — a lyric idea or riff dropped into your mind.",
      fameChange: Math.round(baseFame * 0.7),
      energyChange: -Math.round(baseEnergyCost * 0.8),
      cashChange: -baseCashCost,
      inspirationGained: true,
      contactGained: false,
      scandalTriggered: false,
    };
  }

  // Networking win
  if (roll < config.scandalChance + config.inspirationChance + config.networkingChance) {
    return {
      type: "networking_win",
      label: "New Contact!",
      emoji: "📇",
      description: "You hit it off with an industry insider. A valuable connection has been made.",
      fameChange: Math.round(baseFame * 0.8),
      energyChange: -baseEnergyCost,
      cashChange: -Math.round(baseCashCost * 1.3),
      inspirationGained: false,
      contactGained: true,
      scandalTriggered: false,
    };
  }

  // Exhaustion (high energy cost events)
  if (ctx.stance === "party_hard" && Math.random() < 0.3) {
    return {
      type: "exhaustion",
      label: "Exhausted",
      emoji: "😵",
      description: "You pushed too hard. Tomorrow's rehearsal might be a write-off.",
      fameChange: baseFame,
      energyChange: -Math.round(baseEnergyCost * 1.6),
      cashChange: -baseCashCost,
      inspirationGained: false,
      contactGained: false,
      scandalTriggered: false,
    };
  }

  // Relationship drama (moderate chance for party_hard)
  if (ctx.stance === "party_hard" && Math.random() < 0.15) {
    return {
      type: "relationship_drama",
      label: "Drama!",
      emoji: "💔",
      description: "Your night out caused tensions — a bandmate or partner isn't happy.",
      fameChange: Math.round(baseFame * 0.4),
      energyChange: -baseEnergyCost,
      cashChange: -baseCashCost,
      inspirationGained: false,
      contactGained: false,
      scandalTriggered: false,
    };
  }

  // Leave early = quiet night
  if (ctx.stance === "leave_early") {
    return {
      type: "quiet_night",
      label: "Quick Appearance",
      emoji: "👋",
      description: "You showed your face and slipped out. Minimal impact, minimal risk.",
      fameChange: Math.round(baseFame),
      energyChange: -Math.round(baseEnergyCost),
      cashChange: -Math.round(baseCashCost),
      inspirationGained: false,
      contactGained: false,
      scandalTriggered: false,
    };
  }

  // Default: great night
  return {
    type: "great_night",
    label: "Great Night!",
    emoji: "✨",
    description: "A solid night out. You gained some fame and had a good time.",
    fameChange: baseFame,
    energyChange: -baseEnergyCost,
    cashChange: -baseCashCost,
    inspirationGained: false,
    contactGained: false,
    scandalTriggered: false,
  };
}

export function getStanceRiskColor(riskLevel: NightlifeStanceConfig["riskLevel"]): string {
  switch (riskLevel) {
    case "minimal": return "text-muted-foreground";
    case "low": return "text-green-500";
    case "moderate": return "text-yellow-500";
    case "high": return "text-destructive";
  }
}

export function getOutcomeVariant(type: NightlifeOutcomeType): "default" | "destructive" | "secondary" | "outline" {
  switch (type) {
    case "scandal":
    case "minor_arrest":
    case "relationship_drama":
      return "destructive";
    case "eureka_moment":
    case "networking_win":
    case "great_night":
      return "default";
    case "exhaustion":
      return "secondary";
    default:
      return "outline";
  }
}
