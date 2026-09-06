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
const DAYS_PER_GAME_YEAR = DAYS_PER_GAME_MONTH * MONTHS_PER_YEAR;
const MS_PER_REAL_DAY = 1000 * 60 * 60 * 24;

/** Fixed epoch: January 1, 2026 = Game Year 1, Month 1, Day 1 */
export const GAME_EPOCH = new Date("2026-01-01T00:00:00Z");

/**
 * Calculate current in-game date based on the fixed epoch (Jan 1 2026).
 *
 * The accelerated calendar advances continuously through the real day. With
 * the default 10 real-world days per 30-day game month, one game day lasts
 * eight real hours, so every date from 1-30 is reachable.
 */
export function calculateInGameDate(
  _characterCreatedAt?: Date,
  daysPerGameYear: number = 120,
  daysPerGameMonth: number = 10
): InGameDate {
  const now = new Date();
  const msElapsed = Math.max(0, now.getTime() - GAME_EPOCH.getTime());
  const exactRealWorldDaysElapsed = msElapsed / MS_PER_REAL_DAY;
  const realWorldDaysElapsed = Math.floor(exactRealWorldDaysElapsed);

  const safeDaysPerMonth = Number.isFinite(daysPerGameMonth) && daysPerGameMonth > 0
    ? daysPerGameMonth
    : Math.max(1, daysPerGameYear / MONTHS_PER_YEAR);

  const gameDaysPerRealDay = DAYS_PER_GAME_MONTH / safeDaysPerMonth;
  const gameDaysElapsed = Math.floor(exactRealWorldDaysElapsed * gameDaysPerRealDay);

  const gameYear = Math.floor(gameDaysElapsed / DAYS_PER_GAME_YEAR) + 1;
  const remainingDays = gameDaysElapsed % DAYS_PER_GAME_YEAR;
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

/** Get current season based on game month. */
export function getCurrentSeason(gameMonth: number): Season {
  if (gameMonth >= 3 && gameMonth <= 5) return "spring";
  if (gameMonth >= 6 && gameMonth <= 8) return "summer";
  if (gameMonth >= 9 && gameMonth <= 11) return "autumn";
  return "winter";
}

export function getSeasonEmoji(season: Season): string {
  const emojis = {
    spring: "🌸",
    summer: "☀️",
    autumn: "🍂",
    winter: "❄️",
  };
  return emojis[season];
}

export function getMonthName(month: number): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months[month - 1] || "Unknown";
}

/** Legacy date-based birthday check retained for older callers. */
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
 * Legacy age calculation retained for older callers. New character surfaces
 * should use the anchored age state on profiles via calculateCharacterAgeFromAnchor.
 */
export function calculateInGameAge(
  initialAge: number,
  currentGameDate: InGameDate
): number {
  if (!initialAge || initialAge < 16) return 16;
  const yearsElapsed = currentGameDate.gameYear - 1;
  return initialAge + yearsElapsed;
}

export interface CharacterAgeAnchor {
  age?: number | null;
  birth_game_month?: number | null;
  birth_game_day?: number | null;
  age_anchor_age?: number | null;
  age_anchor_game_year?: number | null;
  age_anchor_game_month?: number | null;
  age_anchor_game_day?: number | null;
}

/** Calculate age by counting birthdays crossed since the profile's age anchor. */
export function calculateCharacterAgeFromAnchor(
  profile: CharacterAgeAnchor,
  currentGameDate: Pick<InGameDate, "gameYear" | "gameMonth" | "gameDay">
): number {
  const anchorAge = Math.max(16, Number(profile.age_anchor_age ?? profile.age ?? 16));
  const anchorYear = Number(profile.age_anchor_game_year ?? 1);
  const anchorMonth = Number(profile.age_anchor_game_month ?? 1);
  const anchorDay = Number(profile.age_anchor_game_day ?? 1);
  const birthMonth = Number(profile.birth_game_month ?? 1);
  const birthDay = Number(profile.birth_game_day ?? 1);

  const currentPassedBirthday =
    currentGameDate.gameMonth > birthMonth ||
    (currentGameDate.gameMonth === birthMonth && currentGameDate.gameDay >= birthDay);
  const anchorPassedBirthday =
    anchorMonth > birthMonth || (anchorMonth === birthMonth && anchorDay >= birthDay);

  const birthdaysCrossed =
    currentGameDate.gameYear - anchorYear +
    (currentPassedBirthday ? 1 : 0) -
    (anchorPassedBirthday ? 1 : 0);

  return Math.max(16, anchorAge + birthdaysCrossed);
}

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
 * Claim the server-authoritative birthday reward. userId remains in the
 * signature for backwards compatibility; ownership is enforced by the RPC.
 */
export async function claimBirthdayReward(
  _userId: string,
  profileId: string,
  gameYear: number,
  inGameDate: Pick<InGameDate, "gameMonth" | "gameDay"> = calculateInGameDate()
): Promise<{ success: boolean; error?: string; sxp?: number; ap?: number; age?: number }> {
  try {
    const { data, error } = await supabase.rpc("claim_character_birthday_reward" as any, {
      _profile_id: profileId,
      _game_year: gameYear,
      _game_month: inGameDate.gameMonth,
      _game_day: inGameDate.gameDay,
    });

    if (error) throw error;
    const result = (data ?? {}) as { success?: boolean; sxp?: number; ap?: number; age?: number };
    return {
      success: result.success === true,
      sxp: result.sxp,
      ap: result.ap,
      age: result.age,
    };
  } catch (error) {
    console.error("Error claiming birthday reward:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to claim birthday reward",
    };
  }
}
