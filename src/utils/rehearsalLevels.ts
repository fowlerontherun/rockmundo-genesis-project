export interface RehearsalLevel {
  level: number;
  name: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  performanceModifier: number;
  minMinutes: number;
  maxMinutes: number | null;
}

// Thresholds aligned to user expectations: 4h = Familiar, 6h = Perfected
export const REHEARSAL_LEVELS: RehearsalLevel[] = [
  {
    level: 0,
    name: "Unlearned",
    variant: "destructive",
    performanceModifier: -0.2,
    minMinutes: 0,
    maxMinutes: 59,
  },
  {
    level: 1,
    name: "Learning",
    variant: "outline",
    performanceModifier: -0.1,
    minMinutes: 60,
    maxMinutes: 179,  // 1-3 hours
  },
  {
    level: 2,
    name: "Familiar",
    variant: "secondary",
    performanceModifier: 0,
    minMinutes: 180,
    maxMinutes: 299,  // 3-5 hours
  },
  {
    level: 3,
    name: "Well Rehearsed",
    variant: "default",
    performanceModifier: 0.1,
    minMinutes: 300,
    maxMinutes: 359,  // 5-6 hours
  },
  {
    level: 4,
    name: "Perfected",
    variant: "default",
    performanceModifier: 0.2,
    minMinutes: 360,  // 6+ hours
    maxMinutes: null,
  },
];

export function getRehearsalLevel(totalMinutes: number): RehearsalLevel {
  return (
    REHEARSAL_LEVELS.find(
      (level) =>
        totalMinutes >= level.minMinutes &&
        (level.maxMinutes === null || totalMinutes <= level.maxMinutes)
    ) || REHEARSAL_LEVELS[0]
  );
}

export function formatRehearsalTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins}m`;
  }
  
  if (mins === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${mins}m`;
}

export function getNextLevelInfo(currentMinutes: number): {
  nextLevel: RehearsalLevel | null;
  minutesNeeded: number;
} {
  const currentLevel = getRehearsalLevel(currentMinutes);
  const nextLevelIndex = currentLevel.level + 1;
  
  if (nextLevelIndex >= REHEARSAL_LEVELS.length) {
    return { nextLevel: null, minutesNeeded: 0 };
  }
  
  const nextLevel = REHEARSAL_LEVELS[nextLevelIndex];
  const minutesNeeded = nextLevel.minMinutes - currentMinutes;
  
  return { nextLevel, minutesNeeded };
}
