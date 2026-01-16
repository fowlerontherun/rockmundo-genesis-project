import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { differenceInHours, parseISO } from "date-fns";

export interface UpcomingGigWarning {
  gigId: string;
  gigDate: Date;
  hoursUntilGig: number;
  venueName: string;
  venueCity: string;
  venueCityId: string;
  bandName: string;
  bandId: string;
  playerCurrentCityId: string | null;
  playerCurrentCityName: string;
  isInWrongCity: boolean;
  needsWarning: boolean;
}

export const useUpcomingGigWarning = () => {
  const { user } = useAuth();
  const { profile, currentCity } = useGameData();

  return useQuery({
    queryKey: ["upcoming-gig-warning", user?.id, profile?.current_city_id],
    queryFn: async (): Promise<UpcomingGigWarning | null> => {
      if (!user?.id) return null;

      // Get user's band memberships
      const { data: userBands } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", user.id);

      if (!userBands || userBands.length === 0) return null;

      const bandIds = userBands.map((b) => b.band_id);

      // Find the next upcoming gig within 24 hours
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const { data: upcomingGigs } = await supabase
        .from("gigs")
        .select(`
          id,
          scheduled_date,
          band_id,
          bands(name),
          venue_id,
          venues(name, city_id, cities(id, name))
        `)
        .in("band_id", bandIds)
        .in("status", ["scheduled", "confirmed"])
        .gte("scheduled_date", now.toISOString())
        .lte("scheduled_date", in24Hours.toISOString())
        .order("scheduled_date", { ascending: true })
        .limit(1);

      if (!upcomingGigs || upcomingGigs.length === 0) return null;

      const gig = upcomingGigs[0];
      const gigDate = parseISO(gig.scheduled_date);
      const hoursUntilGig = differenceInHours(gigDate, now);

      // Only warn if gig is within 6 hours
      if (hoursUntilGig > 6) return null;

      const venue = gig.venues as any;
      const city = venue?.cities as any;
      const band = gig.bands as any;

      const venueCityId = city?.id || "";
      const playerCityId = profile?.current_city_id || "";
      const isInWrongCity = venueCityId !== playerCityId && venueCityId !== "";

      return {
        gigId: gig.id,
        gigDate,
        hoursUntilGig,
        venueName: venue?.name || "Unknown Venue",
        venueCity: city?.name || "Unknown City",
        venueCityId,
        bandName: band?.name || "Your Band",
        bandId: gig.band_id,
        playerCurrentCityId: playerCityId,
        playerCurrentCityName: currentCity?.name || "Unknown",
        isInWrongCity,
        needsWarning: isInWrongCity && hoursUntilGig <= 6,
      };
    },
    enabled: !!user?.id && !!profile,
    staleTime: 60 * 1000, // Check every minute
    refetchInterval: 60 * 1000,
  });
};
