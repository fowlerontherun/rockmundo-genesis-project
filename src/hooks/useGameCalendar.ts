import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateInGameDate, getCurrentSeason, getMonthName, getSeasonEmoji } from "@/utils/gameCalendar";
import type { InGameDate } from "@/utils/gameCalendar";

export function useGameCalendar(profileCreatedAt?: Date) {
  return useQuery({
    queryKey: ["game-calendar", profileCreatedAt?.toISOString()],
    queryFn: async () => {
      // Fetch calendar config
      const { data: config } = await supabase
        .from("game_calendar_config")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (!profileCreatedAt || !config) {
        return null;
      }

      const inGameDate = calculateInGameDate(
        profileCreatedAt,
        config.real_world_days_per_game_year,
        config.real_world_days_per_game_month
      );

      return {
        ...inGameDate,
        monthName: getMonthName(inGameDate.gameMonth),
        seasonEmoji: getSeasonEmoji(inGameDate.season),
        config,
      };
    },
    enabled: !!profileCreatedAt,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useSeasonModifiers(genre?: string, season?: string) {
  return useQuery({
    queryKey: ["season-modifiers", genre, season],
    queryFn: async () => {
      if (!genre || !season) return null;

      const { data } = await supabase
        .from("season_genre_modifiers")
        .select("*")
        .eq("season", season)
        .eq("genre", genre)
        .eq("is_active", true)
        .maybeSingle();

      return data;
    },
    enabled: !!genre && !!season,
    staleTime: 1000 * 60 * 5,
  });
}

export function useBirthdayCheck(
  profileId?: string,
  birthDate?: Date | null,
  inGameDate?: InGameDate
) {
  return useQuery({
    queryKey: ["birthday-check", profileId, birthDate?.toISOString(), inGameDate?.gameYear],
    queryFn: async () => {
      if (!profileId || !birthDate || !inGameDate) return null;

      const birthMonth = birthDate.getMonth() + 1;
      const birthDay = birthDate.getDate();

      const isBirthday =
        birthMonth === inGameDate.gameMonth && birthDay === inGameDate.gameDay;

      if (!isBirthday) return { isBirthday: false, canClaim: false };

      // Check if reward already claimed
      const { data: claimed } = await supabase
        .from("player_birthday_rewards")
        .select("id")
        .eq("profile_id", profileId)
        .eq("game_year", inGameDate.gameYear)
        .maybeSingle();

      return {
        isBirthday: true,
        canClaim: !claimed,
        gameYear: inGameDate.gameYear,
      };
    },
    enabled: !!profileId && !!birthDate && !!inGameDate,
    staleTime: 1000 * 60, // 1 minute
  });
}
