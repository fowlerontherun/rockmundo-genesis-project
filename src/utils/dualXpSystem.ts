// Dual XP System - Skill XP (SXP) and Attribute Points (AP)

export interface DualXpConfig {
  daily_stipend_sxp: number;
  daily_stipend_ap: number;
  daily_activity_xp_cap: number;
  streak_7_bonus_sxp: number;
  streak_7_bonus_ap: number;
  streak_14_bonus_sxp: number;
  streak_14_bonus_ap: number;
  streak_30_bonus_sxp: number;
  streak_30_bonus_ap: number;
  streak_100_bonus_sxp: number;
  streak_100_bonus_ap: number;
  streak_365_bonus_sxp: number;
  streak_365_bonus_ap: number;
}

export interface StreakBonus {
  sxp: number;
  ap: number;
  milestones: number[];
}

export interface StreakMilestone {
  days: number;
  label: string;
  bonusSxp: number;
  bonusAp: number;
  reached: boolean;
}

// Default configuration values
export const DEFAULT_DUAL_XP_CONFIG: DualXpConfig = {
  daily_stipend_sxp: 100,
  daily_stipend_ap: 10,
  daily_activity_xp_cap: 250,
  streak_7_bonus_sxp: 50,
  streak_7_bonus_ap: 10,
  streak_14_bonus_sxp: 100,
  streak_14_bonus_ap: 20,
  streak_30_bonus_sxp: 200,
  streak_30_bonus_ap: 40,
  streak_100_bonus_sxp: 500,
  streak_100_bonus_ap: 100,
  streak_365_bonus_sxp: 1000,
  streak_365_bonus_ap: 200,
};

// Activity type to AP rate mapping (40-60% of XP)
export const ACTIVITY_AP_RATES: Record<string, number> = {
  exercise: 0.60,
  therapy: 0.60,
  meditation: 0.55,
  mentor_session: 0.55,
  busking_session: 0.50,
  gig_performance: 0.50,
  rest: 0.50,
  nutrition: 0.50,
  university_attendance: 0.45,
  book_reading: 0.45,
  recording_complete: 0.40,
  youtube_video: 0.40,
  travel: 0.40,
  admin_grant: 0.50,
  birthday_reward: 0.50,
  weekly_bonus: 0.50,
};

export const DEFAULT_AP_RATE = 0.50;

export const STREAK_MILESTONES = [7, 14, 30, 100, 365];

/**
 * Get AP rate for an activity type
 */
export const getApRateForActivity = (activityType: string): number => {
  return ACTIVITY_AP_RATES[activityType] ?? DEFAULT_AP_RATE;
};

/**
 * Calculate AP from XP amount based on activity type
 */
export const calculateApFromXp = (xpAmount: number, activityType: string): number => {
  const rate = getApRateForActivity(activityType);
  return Math.floor(xpAmount * rate);
};

/**
 * Calculate streak bonuses based on current streak
 */
export const calculateStreakBonus = (
  streak: number, 
  config: DualXpConfig = DEFAULT_DUAL_XP_CONFIG
): StreakBonus => {
  let bonusSxp = 0;
  let bonusAp = 0;
  const milestones: number[] = [];

  if (streak >= 365) {
    bonusSxp += config.streak_365_bonus_sxp;
    bonusAp += config.streak_365_bonus_ap;
    milestones.push(365);
  }
  if (streak >= 100) {
    bonusSxp += config.streak_100_bonus_sxp;
    bonusAp += config.streak_100_bonus_ap;
    milestones.push(100);
  }
  if (streak >= 30) {
    bonusSxp += config.streak_30_bonus_sxp;
    bonusAp += config.streak_30_bonus_ap;
    milestones.push(30);
  }
  if (streak >= 14) {
    bonusSxp += config.streak_14_bonus_sxp;
    bonusAp += config.streak_14_bonus_ap;
    milestones.push(14);
  }
  if (streak >= 7) {
    bonusSxp += config.streak_7_bonus_sxp;
    bonusAp += config.streak_7_bonus_ap;
    milestones.push(7);
  }

  return { sxp: bonusSxp, ap: bonusAp, milestones };
};

/**
 * Get all streak milestones with their status
 */
export const getStreakMilestones = (
  streak: number,
  config: DualXpConfig = DEFAULT_DUAL_XP_CONFIG
): StreakMilestone[] => {
  return [
    { days: 7, label: "1 Week", bonusSxp: config.streak_7_bonus_sxp, bonusAp: config.streak_7_bonus_ap, reached: streak >= 7 },
    { days: 14, label: "2 Weeks", bonusSxp: config.streak_14_bonus_sxp, bonusAp: config.streak_14_bonus_ap, reached: streak >= 14 },
    { days: 30, label: "1 Month", bonusSxp: config.streak_30_bonus_sxp, bonusAp: config.streak_30_bonus_ap, reached: streak >= 30 },
    { days: 100, label: "100 Days", bonusSxp: config.streak_100_bonus_sxp, bonusAp: config.streak_100_bonus_ap, reached: streak >= 100 },
    { days: 365, label: "1 Year", bonusSxp: config.streak_365_bonus_sxp, bonusAp: config.streak_365_bonus_ap, reached: streak >= 365 },
  ];
};

/**
 * Get the next streak milestone
 */
export const getNextMilestone = (streak: number): { days: number; label: string; daysRemaining: number } | null => {
  const milestones = getStreakMilestones(streak);
  const nextMilestone = milestones.find(m => !m.reached);
  
  if (!nextMilestone) return null;
  
  return {
    days: nextMilestone.days,
    label: nextMilestone.label,
    daysRemaining: nextMilestone.days - streak,
  };
};

/**
 * Calculate total stipend reward including streak bonuses
 */
export const calculateTotalStipend = (
  streak: number,
  config: DualXpConfig = DEFAULT_DUAL_XP_CONFIG
): { baseSxp: number; baseAp: number; bonusSxp: number; bonusAp: number; totalSxp: number; totalAp: number } => {
  const { sxp: bonusSxp, ap: bonusAp } = calculateStreakBonus(streak, config);
  
  return {
    baseSxp: config.daily_stipend_sxp,
    baseAp: config.daily_stipend_ap,
    bonusSxp,
    bonusAp,
    totalSxp: config.daily_stipend_sxp + bonusSxp,
    totalAp: config.daily_stipend_ap + bonusAp,
  };
};

/**
 * Check if dates are consecutive days (for streak calculation)
 */
export const areConsecutiveDays = (date1: string | Date, date2: string | Date): boolean => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  // Normalize to start of day
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  return diffDays === 1;
};

/**
 * Get streak status emoji
 */
export const getStreakEmoji = (streak: number): string => {
  if (streak >= 365) return "🏆";
  if (streak >= 100) return "🔥";
  if (streak >= 30) return "⭐";
  if (streak >= 14) return "✨";
  if (streak >= 7) return "🌟";
  if (streak >= 3) return "💫";
  return "🔹";
};
