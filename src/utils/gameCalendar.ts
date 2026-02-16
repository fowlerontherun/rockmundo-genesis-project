import { supabase } from "@/integrations/supabase/client";

export type Season = "spring" | "summer" | "autumn" | "winter";

export interface InGameDate {
  gameYear: number;
  gameMonth: number; // 1-12
  gameDay: number; // 1-30
  season: Season;
  realWorldDaysElapsed: number;
}

export interface SeasonModifiers {
  streamsMultiplier: number;
  salesMultiplier: number;
  gigAttendanceMultiplier: number;
}

export interface TravelDisruption {
  id: string;
  type: "delayed" | "cancelled" | "expensive";
  cause: string;
  severity: number;
  delayHours?: number;
  costMultiplier?: number;
  message: string;
}

const DAYS_PER_GAME_MONTH = 30;
const MONTHS_PER_YEAR = 12;

/** Fixed epoch: January 1, 2026 = Game Year 1, Month 1, Day 1 */
export const GAME_EPOCH = new Date("2026-01-01T00:00:00Z");

/**
 * Calculate current in-game date based on fixed epoch (Jan 1 2026).
 * All players share the same in-game date.
 * characterCreatedAt param is kept for backwards compat but ignored.
 */
export function calculateInGameDate(
  _characterCreatedAt?: Date,
  daysPerGameYear: number = 120,
  daysPerGameMonth: number = 10
): InGameDate {
  const now = new Date();
  const msElapsed = now.getTime() - GAME_EPOCH.getTime();
  const realWorldDaysElapsed = Math.max(0, Math.floor(msElapsed / (1000 * 60 * 60 * 24)));

  // Calculate game days elapsed
  const gameDaysElapsed = Math.floor(
    (realWorldDaysElapsed / daysPerGameMonth) * DAYS_PER_GAME_MONTH
  );

  // Calculate game years, months, and days
  const gameYear = Math.floor(gameDaysElapsed / (DAYS_PER_GAME_MONTH * MONTHS_PER_YEAR)) + 1;
  const remainingDays = gameDaysElapsed % (DAYS_PER_GAME_MONTH * MONTHS_PER_YEAR);
  const gameMonth = Math.floor(remainingDays / DAYS_PER_GAME_MONTH) + 1;
  const gameDay = (remainingDays % DAYS_PER_GAME_MONTH) + 1;

  const season = getCurrentSeason(gameMonth);

  return {
    gameYear,
    gameMonth,
    gameDay,
    season,
    realWorldDaysElapsed,
  };
}

/**
 * Get current season based on game month
 */
export function getCurrentSeason(gameMonth: number): Season {
  if (gameMonth >= 3 && gameMonth <= 5) return "spring";
  if (gameMonth >= 6 && gameMonth <= 8) return "summer";
  if (gameMonth >= 9 && gameMonth <= 11) return "autumn";
  return "winter"; // 12, 1, 2
}

/**
 * Get season emoji
 */
export function getSeasonEmoji(season: Season): string {
  const emojis = {
    spring: "🌸",
    summer: "☀️",
    autumn: "🍂",
    winter: "❄️",
  };
  return emojis[season];
}

/**
 * Get month name
 */
export function getMonthName(month: number): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months[month - 1] || "Unknown";
}

/**
 * Check if today is character's birthday
 */
export function isCharacterBirthday(
  characterBirthDate: Date | null,
  currentGameMonth: number,
  currentGameDay: number
): boolean {
  if (!characterBirthDate) return false;

  const birthMonth = characterBirthDate.getMonth() + 1;
  const birthDay = characterBirthDate.getDate();

  return birthMonth === currentGameMonth && birthDay === currentGameDay;
}

/**
 * Calculate character's current in-game age
 * Uses initial age stored in profile + game years elapsed
 */
export function calculateInGameAge(
  initialAge: number,
  currentGameDate: InGameDate
): number {
  if (!initialAge || initialAge < 16) return 16; // Default starting age
  
  const yearsElapsed = currentGameDate.gameYear - 1; // -1 because year 1 is first year
  return initialAge + yearsElapsed;
}

/**
 * Get season modifiers for a specific genre
 */
export async function getSeasonModifiers(
  season: Season,
  genre: string
): Promise<SeasonModifiers> {
  const { data, error } = await supabase
    .from("season_genre_modifiers")
    .select("*")
    .eq("season", season)
    .eq("genre", genre)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return {
      streamsMultiplier: 1.0,
      salesMultiplier: 1.0,
      gigAttendanceMultiplier: 1.0,
    };
  }

  return {
    streamsMultiplier: Number(data.streams_multiplier) || 1.0,
    salesMultiplier: Number(data.sales_multiplier) || 1.0,
    gigAttendanceMultiplier: Number(data.gig_attendance_multiplier) || 1.0,
  };
}

/**
 * Check for active travel disruptions on a route
 */
export async function checkTravelDisruptions(
  routeId: string
): Promise<TravelDisruption | null> {
  const { data, error } = await supabase
    .from("travel_disruption_events")
    .select("*")
    .eq("route_id", routeId)
    .eq("is_active", true)
    .gt("ends_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;

  let message = "";
  if (data.disruption_type === "cancelled") {
    message = `Travel cancelled due to ${data.cause}. Please try alternative routes.`;
  } else if (data.disruption_type === "delayed") {
    message = `Delayed by ${data.delay_hours} hours due to ${data.cause}.`;
  } else if (data.disruption_type === "expensive") {
    message = `Route costs ${data.cost_multiplier}x normal price due to ${data.cause}.`;
  }

  return {
    id: data.id,
    type: data.disruption_type as "delayed" | "cancelled" | "expensive",
    cause: data.cause,
    severity: data.severity,
    delayHours: data.delay_hours,
    costMultiplier: Number(data.cost_multiplier),
    message,
  };
}

/**
 * Check if birthday reward has been claimed for current game year
 */
export async function hasBirthdayRewardBeenClaimed(
  profileId: string,
  gameYear: number
): Promise<boolean> {
  const { data, error } = await supabase
    .from("player_birthday_rewards")
    .select("id")
    .eq("profile_id", profileId)
    .eq("game_year", gameYear)
    .maybeSingle();

  return !!data && !error;
}

/**
 * Claim birthday reward
 */
export async function claimBirthdayReward(
  userId: string,
  profileId: string,
  gameYear: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if already claimed
    const alreadyClaimed = await hasBirthdayRewardBeenClaimed(profileId, gameYear);
    if (alreadyClaimed) {
      return { success: false, error: "Birthday reward already claimed for this year" };
    }

    // Award XP
    const { error: xpError } = await supabase.from("experience_ledger").insert({
      user_id: userId,
      profile_id: profileId,
      activity_type: "birthday_reward",
      xp_amount: 250,
      metadata: { game_year: gameYear },
    });

    if (xpError) throw xpError;

    // Award cash - Fetch current cash and update
    const { data: profile } = await supabase
      .from("profiles")
      .select("cash")
      .eq("user_id", userId)
      .single();

    if (profile) {
      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: (profile.cash || 0) + 500 })
        .eq("user_id", userId);

      if (cashError) throw cashError;
    }

    // Record birthday reward claim
    const { error: rewardError } = await supabase.from("player_birthday_rewards").insert({
      user_id: userId,
      profile_id: profileId,
      game_year: gameYear,
      xp_awarded: 250,
      cash_awarded: 500,
    });

    if (rewardError) throw rewardError;

    // Log to activity feed
    await supabase.from("activity_feed").insert({
      user_id: userId,
      activity_type: "birthday_reward",
      message: `Happy Birthday! Claimed 250 XP and 500 cash`,
      earnings: 500,
      metadata: { game_year: gameYear },
    });

    return { success: true };
  } catch (error) {
    console.error("Error claiming birthday reward:", error);
    return { success: false, error: "Failed to claim birthday reward" };
  }
}
